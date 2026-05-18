package com.transit.hub.api.security;

import com.transit.hub.infrastructure.config.AuthProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Centralises construction of the two auth cookies so the controller
 * never has to remember the right combination of attributes.
 *
 * <p>The {@code accessToken} cookie is path-scoped to {@code /} so the
 * JWT filter can read it on every API call. The {@code refreshToken}
 * cookie is path-scoped to {@code /api/auth} so it only ships on
 * /refresh and /logout calls — it never accompanies a regular API
 * request, which limits its blast radius if the access cookie ever
 * leaks.
 */
@Component
@RequiredArgsConstructor
public class AuthCookieFactory {

    private final AuthProperties props;

    public String getAccessCookieName() {
        return props.accessCookieName();
    }

    public String getRefreshCookieName() {
        return props.refreshCookieName();
    }

    public ResponseCookie buildAccessCookie(String value, Duration maxAge) {
        return baseBuilder(props.accessCookieName(), value, "/")
                .maxAge(maxAge)
                .build();
    }

    public ResponseCookie buildRefreshCookie(String value, Duration maxAge) {
        return baseBuilder(props.refreshCookieName(), value, "/api/auth")
                .maxAge(maxAge)
                .build();
    }

    public ResponseCookie clearAccessCookie() {
        return baseBuilder(props.accessCookieName(), "", "/")
                .maxAge(0)
                .build();
    }

    public ResponseCookie clearRefreshCookie() {
        return baseBuilder(props.refreshCookieName(), "", "/api/auth")
                .maxAge(0)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder baseBuilder(String name, String value, String path) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(props.cookieSecure())
                .path(path)
                .sameSite(props.cookieSameSite());
        if (!props.cookieDomain().isEmpty()) {
            builder.domain(props.cookieDomain());
        }
        return builder;
    }
}
