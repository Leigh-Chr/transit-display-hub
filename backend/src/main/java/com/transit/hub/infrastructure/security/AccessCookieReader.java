package com.transit.hub.infrastructure.security;

import jakarta.servlet.http.Cookie;

/**
 * Resolves the access JWT out of the cookie jar of a servlet request.
 * Shared by {@link JwtAuthenticationFilter} (HTTP path) and the
 * WebSocket handshake interceptor in
 * {@link com.transit.hub.infrastructure.websocket.WebSocketConfig}
 * so the cookie-name lookup and blank-value guard live in one place.
 */
public final class AccessCookieReader {

    private AccessCookieReader() {
        // utility class — no instances
    }

    /**
     * @return the access token value, or {@code null} if the cookie is
     *         missing or blank.
     */
    public static String readAccessToken(Cookie[] cookies, String accessCookieName) {
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (accessCookieName.equals(cookie.getName())) {
                String value = cookie.getValue();
                if (value != null && !value.isBlank()) {
                    return value;
                }
            }
        }
        return null;
    }
}
