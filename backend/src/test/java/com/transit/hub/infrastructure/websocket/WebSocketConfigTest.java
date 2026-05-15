package com.transit.hub.infrastructure.websocket;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("WebSocketConfig.resolveAccessToken")
class WebSocketConfigTest {

    private static StompHeaderAccessor connectAccessor(Map<String, Object> sessionAttrs) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionAttributes(sessionAttrs);
        return accessor;
    }

    @Nested
    @DisplayName("cookie path (S-12)")
    class CookiePath {

        @Test
        @DisplayName("returns the value lifted from the handshake cookie session attribute")
        void returnsCookieToken() {
            Map<String, Object> attrs = new HashMap<>();
            attrs.put(WebSocketConfig.ACCESS_TOKEN_SESSION_KEY, "cookie-jwt");
            StompHeaderAccessor accessor = connectAccessor(attrs);

            assertThat(WebSocketConfig.resolveAccessToken(accessor)).isEqualTo("cookie-jwt");
        }

        @Test
        @DisplayName("prefers the cookie token even when an Authorization header is also present")
        void cookieBeatsHeader() {
            Map<String, Object> attrs = new HashMap<>();
            attrs.put(WebSocketConfig.ACCESS_TOKEN_SESSION_KEY, "cookie-jwt");
            StompHeaderAccessor accessor = connectAccessor(attrs);
            accessor.setNativeHeader("Authorization", "Bearer header-jwt");

            assertThat(WebSocketConfig.resolveAccessToken(accessor)).isEqualTo("cookie-jwt");
        }

        @Test
        @DisplayName("falls through when the cookie attribute is blank")
        void blankCookieFallsThrough() {
            Map<String, Object> attrs = new HashMap<>();
            attrs.put(WebSocketConfig.ACCESS_TOKEN_SESSION_KEY, "  ");
            StompHeaderAccessor accessor = connectAccessor(attrs);
            accessor.setNativeHeader("Authorization", "Bearer header-jwt");

            assertThat(WebSocketConfig.resolveAccessToken(accessor)).isEqualTo("header-jwt");
        }
    }

    @Nested
    @DisplayName("Authorization header fallback")
    class HeaderFallback {

        @Test
        @DisplayName("returns the Bearer payload when no cookie attribute is present")
        void returnsHeaderToken() {
            StompHeaderAccessor accessor = connectAccessor(new HashMap<>());
            accessor.setNativeHeader("Authorization", "Bearer legacy-jwt");

            assertThat(WebSocketConfig.resolveAccessToken(accessor)).isEqualTo("legacy-jwt");
        }

        @Test
        @DisplayName("returns null when the Authorization scheme is not Bearer")
        void rejectsNonBearer() {
            StompHeaderAccessor accessor = connectAccessor(new HashMap<>());
            accessor.setNativeHeader("Authorization", "Basic dXNlcjpwYXNz");

            assertThat(WebSocketConfig.resolveAccessToken(accessor)).isNull();
        }

        @Test
        @DisplayName("returns null when no token is supplied at all")
        void returnsNullWhenAbsent() {
            StompHeaderAccessor accessor = connectAccessor(new HashMap<>());

            assertThat(WebSocketConfig.resolveAccessToken(accessor)).isNull();
        }

        @Test
        @DisplayName("tolerates a missing session attribute map")
        void nullSessionAttributesAreSafe() {
            StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
            // explicit null — Spring sometimes hands the accessor with no attribute map yet
            accessor.setSessionAttributes(null);
            accessor.setNativeHeader("Authorization", "Bearer x");

            assertThat(WebSocketConfig.resolveAccessToken(accessor)).isEqualTo("x");
        }
    }
}
