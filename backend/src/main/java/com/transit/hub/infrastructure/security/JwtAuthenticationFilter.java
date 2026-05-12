package com.transit.hub.infrastructure.security;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.config.AuthProperties;
import com.transit.hub.infrastructure.persistence.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AuthProperties authProperties;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        TokenSource source = extractToken(request);

        if (source.token() == null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            if (jwtService.isValidToken(source.token())) {
                String username = jwtService.extractUsername(source.token());
                UserRole role = jwtService.extractRole(source.token());

                if (SecurityContextHolder.getContext().getAuthentication() == null) {
                    // Re-read the user on every authenticated hit so a
                    // disabled flip lands within one request instead of
                    // the JWT's 8 h expiry window. The DB cost is one
                    // primary-key lookup; cache later if it shows up on
                    // a profile. A user that's gone or disabled produces
                    // an anonymous SecurityContext — the downstream
                    // authorize-http-requests chain will 401/403 it.
                    Optional<User> snapshot = userRepository.findByUsername(username);
                    if (snapshot.isEmpty() || !snapshot.get().isEnabled()) {
                        if (source.fromBearer()) {
                            response.setHeader(
                                    "WWW-Authenticate",
                                    "Bearer error=\"invalid_token\", error_description=\"Account disabled\"");
                        }
                        filterChain.doFilter(request, response);
                        return;
                    }

                    List<SimpleGrantedAuthority> authorities = List.of(
                            new SimpleGrantedAuthority("ROLE_" + role.name())
                    );

                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(username, null, authorities);

                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            } else if (source.fromBearer()) {
                // Token was present but expired or signed with a different key.
                // Surface the cause via WWW-Authenticate so the client can distinguish
                // "you're not logged in" from "your session timed out" and react
                // accordingly. We only do this when the caller used the Bearer
                // header — cookie-bearing requests already manage state on their
                // own and don't read this header.
                response.setHeader(
                        "WWW-Authenticate",
                        "Bearer error=\"invalid_token\", error_description=\"Token expired or invalid\"");
            }
        } catch (Exception e) {
            log.debug("JWT authentication failed: {}", e.getMessage());
            if (source.fromBearer()) {
                response.setHeader(
                        "WWW-Authenticate",
                        "Bearer error=\"invalid_token\", error_description=\"Token rejected\"");
            }
        }

        filterChain.doFilter(request, response);
    }

    private TokenSource extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return new TokenSource(authHeader.substring(7), true);
        }
        // Cookie fallback for the v1.4.0 cookie-based session. The cookie
        // value is the access JWT itself — the filter does not care whether
        // it arrived via header or cookie.
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (authProperties.accessCookieName().equals(cookie.getName())) {
                    String value = cookie.getValue();
                    if (value != null && !value.isBlank()) {
                        return new TokenSource(value, false);
                    }
                }
            }
        }
        return new TokenSource(null, false);
    }

    private record TokenSource(String token, boolean fromBearer) {}
}
