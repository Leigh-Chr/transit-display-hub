package com.transit.hub.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Rate-limits POST {@code /api/auth/refresh} per client IP. Default:
 * thirty rotations per minute. A legitimate single-tab client tops out
 * near four rotations per hour (the access token lives ~15 min, refresh
 * fires shortly before expiry); a power user with several tabs and the
 * occasional reload sits comfortably below the cap. Anything above is
 * either a runaway bug — worth surfacing as 429 so the user notices —
 * or a stolen-refresh-token brute-force attempt.
 */
@Component
public class RefreshRateLimitFilter extends AuthIpRateLimitFilter {

    @Value("${app.security.refresh-rate-limit.max-attempts:30}")
    private int maxAttempts;

    @Value("${app.security.refresh-rate-limit.window-minutes:1}")
    private int windowMinutes;

    @Override
    protected boolean matches(HttpServletRequest req) {
        return "POST".equalsIgnoreCase(req.getMethod())
                && "/api/auth/refresh".equals(req.getRequestURI());
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
