package com.transit.hub.infrastructure.security;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Rate-limits POST {@code /api/auth/login} per client IP. Default: five
 * attempts per five minutes; over-quota returns 429 with
 * {@code Retry-After}. Configurable via
 * {@code app.security.login-rate-limit.max-attempts} and {@code .window-minutes}
 * — dev / test profiles bump the limit so Playwright runs do not
 * exhaust the bucket between specs.
 */
@Slf4j
@Component
public class LoginRateLimitFilter extends AuthIpRateLimitFilter {

    /** Above this attempt cap on the dev profile we emit a startup reminder. */
    private static final int LOOSE_LIMIT_WARN_THRESHOLD = 10;

    private final Environment environment;

    @Value("${app.security.login-rate-limit.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.security.login-rate-limit.window-minutes:5}")
    private int windowMinutes;

    public LoginRateLimitFilter(Environment environment) {
        this.environment = environment;
    }

    /**
     * Surface a loud warning if a dev profile boots with a relaxed login
     * rate limit. Catches the foot-gun of an operator accidentally shipping
     * {@code SPRING_PROFILES_ACTIVE=dev} on a publicly reachable host —
     * dev tolerates 100 attempts / 5 min so Playwright suites do not exhaust
     * the bucket, and that ceiling has no business facing the internet.
     */
    @PostConstruct
    void warnIfLooseLimitOnDevProfile() {
        if (environment.acceptsProfiles(Profiles.of("dev"))
                && maxAttempts > LOOSE_LIMIT_WARN_THRESHOLD) {
            log.warn(
                    "Login rate limit relaxed to {} attempts / {} min on the 'dev' profile. "
                            + "Do not expose this build to the public internet.",
                    maxAttempts, windowMinutes);
        }
    }

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
