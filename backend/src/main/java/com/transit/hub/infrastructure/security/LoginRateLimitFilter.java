package com.transit.hub.infrastructure.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

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
@Slf4j
public class LoginRateLimitFilter extends OncePerRequestFilter {

    @Value("${app.security.login-rate-limit.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.security.login-rate-limit.window-minutes:5}")
    private int windowMinutes;

    /**
     * CSV of trusted-proxy entries — each one is either a literal IP
     * ({@code 10.0.0.1}) or a CIDR block ({@code 10.0.0.0/8}). The
     * {@link HttpServletRequest#getRemoteAddr() TCP peer} must match
     * one of them for the filter to honour the {@code X-Forwarded-For}
     * header. Empty by default — any operator standing the app behind
     * a reverse proxy must opt in by listing the proxy's IP or subnet,
     * otherwise an attacker can defeat the rate-limit by sending one
     * bogus header per attempt.
     */
    @Value("${app.security.trusted-proxies:}")
    private String trustedProxiesCsv;

    /**
     * Per-IP token buckets. Caffeine evicts an idle entry after
     * {@code expireAfterAccess(15 min)} so a distributed brute-force
     * attack rotating through the IPv4 space can't grow the map without
     * bound — buckets that nobody is hitting any more die off. Capacity
     * cap is a defence-in-depth backstop for the same scenario; on a
     * single VM the realistic working set is in the low thousands.
     */
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(15))
            .maximumSize(100_000)
            .build();

    private List<IpAddressMatcher> trustedProxies = List.of();

    @PostConstruct
    void parseTrustedProxies() {
        List<IpAddressMatcher> matchers = new ArrayList<>();
        for (String raw : trustedProxiesCsv.split(",")) {
            String entry = raw.trim();
            if (entry.isEmpty()) {
                continue;
            }
            try {
                matchers.add(new IpAddressMatcher(entry));
            } catch (IllegalArgumentException ex) {
                log.warn("Ignoring invalid trusted-proxy entry '{}': {}", entry, ex.getMessage());
            }
        }
        trustedProxies = List.copyOf(matchers);
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
        Bucket bucket = buckets.get(ip, k -> Bucket.builder()
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
        buckets.invalidateAll();
    }

    private boolean isLogin(HttpServletRequest req) {
        return "POST".equalsIgnoreCase(req.getMethod())
                && "/api/auth/login".equals(req.getRequestURI());
    }

    private String clientIp(HttpServletRequest req) {
        String remote = req.getRemoteAddr();
        // Only honour X-Forwarded-For if the TCP peer matches one of the
        // explicitly trusted proxies (literal IP or CIDR block). Otherwise
        // any client can mint a fresh rate-limit bucket by rolling a
        // random IP through the header.
        if (remote == null || !isTrustedProxy(remote)) {
            return remote;
        }
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return remote;
    }

    private boolean isTrustedProxy(String remote) {
        for (IpAddressMatcher matcher : trustedProxies) {
            if (matcher.matches(remote)) {
                return true;
            }
        }
        return false;
    }
}
