package com.transit.hub.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed view of the {@code app.auth.*} block driving the cookie-based
 * session. Defaults match the dev profile so a fresh checkout boots
 * without env var plumbing.
 */
@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        String accessCookieName,
        String refreshCookieName,
        boolean cookieSecure,
        String cookieSameSite,
        String cookieDomain
) {
    public AuthProperties {
        if (accessCookieName == null || accessCookieName.isBlank()) {
            accessCookieName = "ACCESS_TOKEN";
        }
        if (refreshCookieName == null || refreshCookieName.isBlank()) {
            refreshCookieName = "REFRESH_TOKEN";
        }
        if (cookieSameSite == null || cookieSameSite.isBlank()) {
            cookieSameSite = "Strict";
        }
        if (cookieDomain == null) {
            cookieDomain = "";
        }
    }
}
