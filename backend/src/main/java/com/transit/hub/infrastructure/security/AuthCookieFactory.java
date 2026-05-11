package com.transit.hub.infrastructure.security;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
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
@Getter
public class AuthCookieFactory {

    @Value("${app.auth.access-cookie-name:ACCESS_TOKEN}")
    private String accessCookieName;

    @Value("${app.auth.refresh-cookie-name:REFRESH_TOKEN}")
    private String refreshCookieName;

    @Value("${app.auth.cookie-secure:false}")
    private boolean secure;

    @Value("${app.auth.cookie-same-site:Strict}")
    private String sameSite;

    @Value("${app.auth.cookie-domain:}")
    private String domain;

    public ResponseCookie buildAccessCookie(String value, Duration maxAge) {
        return baseBuilder(accessCookieName, value, "/")
                .maxAge(maxAge)
                .build();
    }

    public ResponseCookie buildRefreshCookie(String value, Duration maxAge) {
        return baseBuilder(refreshCookieName, value, "/api/auth")
                .maxAge(maxAge)
                .build();
    }

    public ResponseCookie clearAccessCookie() {
        return baseBuilder(accessCookieName, "", "/")
                .maxAge(0)
                .build();
    }

    public ResponseCookie clearRefreshCookie() {
        return baseBuilder(refreshCookieName, "", "/api/auth")
                .maxAge(0)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder baseBuilder(String name, String value, String path) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secure)
                .path(path)
                .sameSite(sameSite);
        if (!domain.isEmpty()) {
            builder.domain(domain);
        }
        return builder;
    }
}
