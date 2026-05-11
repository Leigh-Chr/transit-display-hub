package com.transit.hub.infrastructure.security;

import com.transit.hub.domain.model.enums.UserRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import jakarta.servlet.http.Cookie;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthenticationFilter")
class JwtAuthenticationFilterTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private FilterChain filterChain;

    @InjectMocks
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(jwtAuthenticationFilter, "accessCookieName", "ACCESS_TOKEN");
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("Valid token")
    class ValidToken {

        @Test
        @DisplayName("populates SecurityContext with username and ROLE_ADMIN")
        void withValidAdminToken_PopulatesSecurityContext() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer valid-token");
            when(jwtService.isValidToken("valid-token")).thenReturn(true);
            when(jwtService.extractUsername("valid-token")).thenReturn("admin");
            when(jwtService.extractRole("valid-token")).thenReturn(UserRole.ADMIN);

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            var auth = SecurityContextHolder.getContext().getAuthentication();
            assertThat(auth).isNotNull();
            assertThat(auth.getPrincipal()).isEqualTo("admin");
            assertThat(auth.getAuthorities())
                    .extracting(a -> a.getAuthority())
                    .containsExactly("ROLE_ADMIN");
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("populates SecurityContext with ROLE_AGENT")
        void withValidAgentToken_PopulatesSecurityContext() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer agent-token");
            when(jwtService.isValidToken("agent-token")).thenReturn(true);
            when(jwtService.extractUsername("agent-token")).thenReturn("agent");
            when(jwtService.extractRole("agent-token")).thenReturn(UserRole.AGENT);

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            var auth = SecurityContextHolder.getContext().getAuthentication();
            assertThat(auth).isNotNull();
            assertThat(auth.getPrincipal()).isEqualTo("agent");
            assertThat(auth.getAuthorities())
                    .extracting(a -> a.getAuthority())
                    .containsExactly("ROLE_AGENT");
        }
    }

    @Nested
    @DisplayName("No Authorization header")
    class NoAuthHeader {

        @Test
        @DisplayName("continues filter chain without authentication")
        void withoutAuthHeader_ContinuesWithoutAuth() throws ServletException, IOException {
            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            verify(filterChain).doFilter(request, response);
            verifyNoInteractions(jwtService);
        }
    }

    @Nested
    @DisplayName("Invalid token")
    class InvalidToken {

        @Test
        @DisplayName("continues filter chain when token is invalid")
        void withInvalidToken_ContinuesWithoutAuth() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer invalid-token");
            when(jwtService.isValidToken("invalid-token")).thenReturn(false);

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("continues filter chain when token throws exception")
        void withExceptionThrowingToken_ContinuesWithoutAuth() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer bad-token");
            when(jwtService.isValidToken("bad-token")).thenThrow(new RuntimeException("parse error"));

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            verify(filterChain).doFilter(request, response);
        }
    }

    @Nested
    @DisplayName("Malformed Bearer header")
    class MalformedHeader {

        @Test
        @DisplayName("continues filter chain with non-Bearer authorization")
        void withNonBearerAuth_ContinuesWithoutAuth() throws ServletException, IOException {
            request.addHeader("Authorization", "Basic dXNlcjpwYXNz");

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            verify(filterChain).doFilter(request, response);
            verifyNoInteractions(jwtService);
        }
    }

    @Nested
    @DisplayName("Cookie fallback")
    class CookieFallback {

        @Test
        @DisplayName("authenticates from ACCESS_TOKEN cookie when no Bearer header is present")
        void withValidCookie_PopulatesSecurityContext() throws ServletException, IOException {
            request.setCookies(new Cookie("ACCESS_TOKEN", "cookie-token"));
            when(jwtService.isValidToken("cookie-token")).thenReturn(true);
            when(jwtService.extractUsername("cookie-token")).thenReturn("alice");
            when(jwtService.extractRole("cookie-token")).thenReturn(UserRole.ADMIN);

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            var auth = SecurityContextHolder.getContext().getAuthentication();
            assertThat(auth).isNotNull();
            assertThat(auth.getPrincipal()).isEqualTo("alice");
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("Bearer header wins over cookie when both are present")
        void bearerHeaderWinsOverCookie() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer header-token");
            request.setCookies(new Cookie("ACCESS_TOKEN", "cookie-token"));
            when(jwtService.isValidToken("header-token")).thenReturn(true);
            when(jwtService.extractUsername("header-token")).thenReturn("bob");
            when(jwtService.extractRole("header-token")).thenReturn(UserRole.AGENT);

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            var auth = SecurityContextHolder.getContext().getAuthentication();
            assertThat(auth.getPrincipal()).isEqualTo("bob");
            verify(jwtService, never()).isValidToken("cookie-token");
        }

        @Test
        @DisplayName("does not emit WWW-Authenticate when the cookie token is invalid")
        void invalidCookie_DoesNotEmitWwwAuthenticate() throws ServletException, IOException {
            request.setCookies(new Cookie("ACCESS_TOKEN", "bad-cookie"));
            when(jwtService.isValidToken("bad-cookie")).thenReturn(false);

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(response.getHeader("WWW-Authenticate")).isNull();
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("blank cookie value is ignored")
        void blankCookieValue_Ignored() throws ServletException, IOException {
            request.setCookies(new Cookie("ACCESS_TOKEN", ""));

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            verifyNoInteractions(jwtService);
        }
    }

    @Nested
    @DisplayName("SecurityContext already populated")
    class AlreadyAuthenticated {

        @Test
        @DisplayName("does not replace existing authentication")
        void withExistingAuth_DoesNotReplace() throws ServletException, IOException {
            // Pre-populate SecurityContext
            UsernamePasswordAuthenticationToken existingAuth =
                    new UsernamePasswordAuthenticationToken("existing-user", null,
                            List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
            SecurityContextHolder.getContext().setAuthentication(existingAuth);

            request.addHeader("Authorization", "Bearer valid-token");
            when(jwtService.isValidToken("valid-token")).thenReturn(true);
            when(jwtService.extractUsername("valid-token")).thenReturn("new-user");
            when(jwtService.extractRole("valid-token")).thenReturn(UserRole.AGENT);

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            var auth = SecurityContextHolder.getContext().getAuthentication();
            assertThat(auth.getPrincipal()).isEqualTo("existing-user");
            verify(filterChain).doFilter(request, response);
        }
    }
}
