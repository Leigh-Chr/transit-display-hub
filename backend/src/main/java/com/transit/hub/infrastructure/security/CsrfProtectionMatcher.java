package com.transit.hub.infrastructure.security;

import com.transit.hub.infrastructure.config.AuthProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.web.util.matcher.RequestMatcher;

import java.util.Set;

/**
 * CSRF protection scope for the auth surface.
 *
 * <p>Mutating requests require CSRF, with two intentional exceptions:
 * <ul>
 *   <li>{@code POST /api/auth/login} — the caller has not yet received an
 *       XSRF cookie, so requiring one would be a chicken-and-egg.</li>
 *   <li>Pure stateless {@code Authorization: Bearer} callers with no auth
 *       cookie attached — the browser never auto-attaches that header, so
 *       CSRF would catch nothing for them.</li>
 * </ul>
 *
 * <p>Crucially, a request carrying both a Bearer header <em>and</em> an
 * auth cookie still requires CSRF: otherwise an attacker tacks a bogus
 * Bearer header onto a cross-site form to short-circuit the check.
 */
class CsrfProtectionMatcher implements RequestMatcher {

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");
    private static final String LOGIN_PATH = "/api/auth/login";
    private static final String BEARER_PREFIX = "Bearer ";

    private final String accessCookieName;
    private final String refreshCookieName;

    CsrfProtectionMatcher(AuthProperties authProperties) {
        this.accessCookieName = authProperties.accessCookieName();
        this.refreshCookieName = authProperties.refreshCookieName();
    }

    @Override
    public boolean matches(HttpServletRequest request) {
        if (SAFE_METHODS.contains(request.getMethod())) {
            return false;
        }
        if (LOGIN_PATH.equals(request.getRequestURI())) {
            return false;
        }
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null
                && authHeader.startsWith(BEARER_PREFIX)
                && !hasAuthCookie(request)) {
            return false;
        }
        return true;
    }

    private boolean hasAuthCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return false;
        }
        for (Cookie cookie : cookies) {
            String name = cookie.getName();
            if (accessCookieName.equals(name) || refreshCookieName.equals(name)) {
                return true;
            }
        }
        return false;
    }
}
