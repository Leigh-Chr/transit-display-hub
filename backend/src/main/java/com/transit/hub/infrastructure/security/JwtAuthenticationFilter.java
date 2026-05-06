package com.transit.hub.infrastructure.security;

import com.transit.hub.domain.model.enums.UserRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        try {
            if (jwtService.isValidToken(token)) {
                String username = jwtService.extractUsername(token);
                UserRole role = jwtService.extractRole(token);

                if (SecurityContextHolder.getContext().getAuthentication() == null) {
                    List<SimpleGrantedAuthority> authorities = List.of(
                            new SimpleGrantedAuthority("ROLE_" + role.name())
                    );

                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(username, null, authorities);

                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            } else {
                // The bearer was present but expired or signed with a different key.
                // Surface the cause via WWW-Authenticate so the client can distinguish
                // "you're not logged in" from "your session timed out" and react
                // accordingly (e.g. clear the stored token before redirecting).
                response.setHeader(
                        "WWW-Authenticate",
                        "Bearer error=\"invalid_token\", error_description=\"Token expired or invalid\"");
            }
        } catch (Exception e) {
            if (log.isDebugEnabled()) {
                log.debug("JWT authentication failed: {}", e.getMessage());
            }
            response.setHeader(
                    "WWW-Authenticate",
                    "Bearer error=\"invalid_token\", error_description=\"Token rejected\"");
        }

        filterChain.doFilter(request, response);
    }
}
