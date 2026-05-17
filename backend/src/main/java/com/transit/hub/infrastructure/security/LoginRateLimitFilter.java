package com.transit.hub.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Rate-limits POST {@code /api/auth/login} per client IP. Default: five
 * attempts per five minutes; over-quota returns 429 with
 * {@code Retry-After}. Configurable via
 * {@code app.security.login-rate-limit.max-attempts} and {@code .window-minutes}
 * — dev / test profiles bump the limit so Playwright runs do not
 * exhaust the bucket between specs.
 */
@Component
public class LoginRateLimitFilter extends AuthIpRateLimitFilter {

    @Value("${app.security.login-rate-limit.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.security.login-rate-limit.window-minutes:5}")
    private int windowMinutes;

    @Override
    protected boolean matches(HttpServletRequest req) {
        return "POST".equalsIgnoreCase(req.getMethod())
                && "/api/auth/login".equals(req.getRequestURI());
    }

    @Override
    protected int maxAttempts() {
        return maxAttempts;
    }

    @Override
    protected int windowMinutes() {
        return windowMinutes;
    }
}
