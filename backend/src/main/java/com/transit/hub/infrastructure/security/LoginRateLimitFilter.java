package com.transit.hub.infrastructure.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

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

    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();

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
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
