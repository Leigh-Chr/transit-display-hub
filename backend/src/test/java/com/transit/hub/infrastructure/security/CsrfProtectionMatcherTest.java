package com.transit.hub.infrastructure.security;

import com.transit.hub.infrastructure.config.AuthProperties;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("CsrfProtectionMatcher — when CSRF is required for a request")
class CsrfProtectionMatcherTest {

    private static final AuthProperties AUTH_PROPS =
            new AuthProperties("ACCESS_TOKEN", "REFRESH_TOKEN", true, "Strict", "");

    private final CsrfProtectionMatcher matcher = new CsrfProtectionMatcher(AUTH_PROPS);

    @Nested
    @DisplayName("safe methods")
    class SafeMethods {
        @Test
        void getNeverNeedsCsrf() {
            assertThat(matcher.matches(withMethod("/api/messages", "GET"))).isFalse();
        }

        @Test
        void headNeverNeedsCsrf() {
            assertThat(matcher.matches(withMethod("/api/messages", "HEAD"))).isFalse();
        }

        @Test
        void optionsNeverNeedsCsrf() {
            assertThat(matcher.matches(withMethod("/api/messages", "OPTIONS"))).isFalse();
        }
    }

    @Nested
    @DisplayName("/api/auth/login")
    class LoginEndpoint {
        @Test
        void postLoginExemptBecauseNoXsrfCookieYet() {
            assertThat(matcher.matches(post("/api/auth/login"))).isFalse();
        }
    }

    @Nested
    @DisplayName("/api/auth/refresh — regression for S-03")
    class RefreshEndpoint {
        @Test
        void postRefreshRequiresCsrfNowThatACookieSessionIsRolling() {
            // Pre-fix: the whole /api/auth/** prefix was exempt, which let a
            // cross-site form silently rotate the user's tokens once SameSite
            // dropped from Strict to Lax. CSRF now applies here.
            assertThat(matcher.matches(post("/api/auth/refresh"))).isTrue();
        }
    }

    @Nested
    @DisplayName("/api/auth/logout — regression for S-03")
    class LogoutEndpoint {
        @Test
        void postLogoutRequiresCsrfToBlockOneClickInvoluntaryLogout() {
            assertThat(matcher.matches(post("/api/auth/logout"))).isTrue();
        }
    }

    @Nested
    @DisplayName("Authorization: Bearer header — regression for S-02")
    class BearerCallers {
        @Test
        void pureBearerCallerStaysExempt() {
            MockHttpServletRequest req = post("/api/messages");
            req.addHeader("Authorization", "Bearer token123");
            assertThat(matcher.matches(req)).isFalse();
        }

        @Test
        void bearerPlusAccessCookieIsTreatedAsCookieAuthAndNeedsCsrf() {
            // Pre-fix: a cross-site form could tack a bogus Bearer header onto
            // a cookie-authenticated POST and the matcher's string sniff would
            // let it through. After the fix the cookie wins.
            MockHttpServletRequest req = post("/api/messages");
            req.addHeader("Authorization", "Bearer attacker-can-write-anything");
            req.setCookies(new Cookie("ACCESS_TOKEN", "victim-jwt"));
            assertThat(matcher.matches(req)).isTrue();
        }

        @Test
        void bearerPlusRefreshCookieAlsoNeedsCsrf() {
            MockHttpServletRequest req = post("/api/messages");
            req.addHeader("Authorization", "Bearer x");
            req.setCookies(new Cookie("REFRESH_TOKEN", "victim-refresh"));
            assertThat(matcher.matches(req)).isTrue();
        }

        @Test
        void bearerPlusUnrelatedCookieStaysExempt() {
            MockHttpServletRequest req = post("/api/messages");
            req.addHeader("Authorization", "Bearer x");
            req.setCookies(new Cookie("locale", "fr"));
            assertThat(matcher.matches(req)).isFalse();
        }
    }

    @Nested
    @DisplayName("default mutating request")
    class DefaultMutating {
        @Test
        void postWithoutAnythingRequiresCsrf() {
            assertThat(matcher.matches(post("/api/messages"))).isTrue();
        }

        @Test
        void putWithoutAnythingRequiresCsrf() {
            MockHttpServletRequest req = post("/api/messages");
            req.setMethod("PUT");
            assertThat(matcher.matches(req)).isTrue();
        }

        @Test
        void deleteWithoutAnythingRequiresCsrf() {
            MockHttpServletRequest req = post("/api/messages");
            req.setMethod("DELETE");
            assertThat(matcher.matches(req)).isTrue();
        }
    }

    @Nested
    @DisplayName("configurable cookie names honoured")
    class CustomCookieNames {
        @Test
        void customAccessCookieNameRecognisedAsAuth() {
            AuthProperties custom = new AuthProperties("MY_ACCESS", "MY_REFRESH", true, "Strict", "");
            CsrfProtectionMatcher m = new CsrfProtectionMatcher(custom);

            MockHttpServletRequest req = post("/api/messages");
            req.addHeader("Authorization", "Bearer x");
            req.setCookies(new Cookie("MY_ACCESS", "victim"));
            assertThat(m.matches(req)).isTrue();
        }
    }

    private static MockHttpServletRequest post(String uri) {
        return withMethod(uri, "POST");
    }

    private static MockHttpServletRequest withMethod(String uri, String method) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod(method);
        request.setRequestURI(uri);
        return request;
    }
}
