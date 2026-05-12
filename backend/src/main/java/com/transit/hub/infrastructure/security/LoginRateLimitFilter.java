package com.transit.hub.infrastructure.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Arrays;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

/**
 * Rate-limits POST /api/auth/login per client IP. Default: five
 * attempts per five minutes; over-quota returns 429 with Retry-After.
 * Configurable via {@code app.security.login-rate-limit.max-attempts}
 * and {@code .window-minutes} — dev / test profiles bump the limit so
 * Playwright runs do not exhaust the bucket between specs. In-memory
 * (Bucket4j) — single-node only. For multi-node deployments, swap the
 * backing store to Hazelcast or Redis.
 */
@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    @Value("${app.security.login-rate-limit.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.security.login-rate-limit.window-minutes:5}")
    private int windowMinutes;

    /**
     * CSV of remote addresses (the {@link HttpServletRequest#getRemoteAddr()
     * value Tomcat reports for the TCP peer) that are allowed to claim a
     * different client IP via {@code X-Forwarded-For}. Empty by default —
     * any operator standing the app behind a reverse proxy must opt in
     * by listing the proxy's IP, otherwise an attacker can defeat the
     * rate-limit by sending one bogus header per attempt.
     */
    @Value("${app.security.trusted-proxies:}")
    private String trustedProxiesCsv;

    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    private Set<String> trustedProxies = Set.of();

    @PostConstruct
    void parseTrustedProxies() {
        trustedProxies = Arrays.stream(trustedProxiesCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!isLogin(request)) {
            chain.doFilter(request, response);
            return;
        }
        String ip = clientIp(request);
        Duration window = Duration.ofMinutes(windowMinutes);
        Bucket bucket = buckets.computeIfAbsent(ip, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(maxAttempts, Refill.greedy(maxAttempts, window)))
                .build());
        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(window.toSeconds()));
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"too_many_attempts\"}");
        }
    }

    /** Resets all per-IP buckets. Intended for use in integration tests only. */
    public void clearBuckets() {
        buckets.clear();
    }

    private boolean isLogin(HttpServletRequest req) {
        return "POST".equalsIgnoreCase(req.getMethod())
                && "/api/auth/login".equals(req.getRequestURI());
    }

    private String clientIp(HttpServletRequest req) {
        String remote = req.getRemoteAddr();
        // Only honour X-Forwarded-For if the TCP peer is a proxy we've
        // explicitly trusted. Otherwise any client can mint a fresh
        // rate-limit bucket by rolling a random IP through the header.
        if (remote == null || !trustedProxies.contains(remote)) {
            return remote;
        }
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return remote;
    }
}
