package com.transit.hub.infrastructure.security;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import com.transit.hub.infrastructure.config.AuthProperties;
import jakarta.servlet.http.Cookie;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthenticationFilter")
class JwtAuthenticationFilterTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FilterChain filterChain;

    private JwtAuthenticationFilter jwtAuthenticationFilter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        AuthProperties authProps = new AuthProperties("ACCESS_TOKEN", "REFRESH_TOKEN", false, "Strict", "");
        jwtAuthenticationFilter = new JwtAuthenticationFilter(jwtService, authProps, userRepository);
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        SecurityContextHolder.clearContext();
    }

    private static User enabledUser(String username, UserRole role) {
        return User.builder().username(username).role(role).enabled(true).tokenVersion(0L).build();
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
            when(userRepository.findByUsername("admin"))
                    .thenReturn(Optional.of(enabledUser("admin", UserRole.ADMIN)));

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
        @DisplayName("leaves SecurityContext anonymous when the user is disabled (regression S-06)")
        void disabledUser_LeavesContextAnonymous() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer valid-token");
            when(jwtService.isValidToken("valid-token")).thenReturn(true);
            when(jwtService.extractUsername("valid-token")).thenReturn("disabled-user");
            when(jwtService.extractRole("valid-token")).thenReturn(UserRole.ADMIN);
            User disabled = User.builder()
                    .username("disabled-user").role(UserRole.ADMIN).enabled(false).build();
            when(userRepository.findByUsername("disabled-user"))
                    .thenReturn(Optional.of(disabled));

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            assertThat(response.getHeader("WWW-Authenticate"))
                    .isEqualTo("Bearer error=\"invalid_token\", error_description=\"Account disabled\"");
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("leaves SecurityContext anonymous when the username no longer exists")
        void unknownUser_LeavesContextAnonymous() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer valid-token");
            when(jwtService.isValidToken("valid-token")).thenReturn(true);
            when(jwtService.extractUsername("valid-token")).thenReturn("ghost");
            when(jwtService.extractRole("valid-token")).thenReturn(UserRole.AGENT);
            when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("populates SecurityContext with ROLE_AGENT")
        void withValidAgentToken_PopulatesSecurityContext() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer agent-token");
            when(jwtService.isValidToken("agent-token")).thenReturn(true);
            when(jwtService.extractUsername("agent-token")).thenReturn("agent");
            when(jwtService.extractRole("agent-token")).thenReturn(UserRole.AGENT);
            when(userRepository.findByUsername("agent"))
                    .thenReturn(Optional.of(enabledUser("agent", UserRole.AGENT)));

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            var auth = SecurityContextHolder.getContext().getAuthentication();
            assertThat(auth).isNotNull();
            assertThat(auth.getPrincipal()).isEqualTo("agent");
            assertThat(auth.getAuthorities())
                    .extracting(a -> a.getAuthority())
                    .containsExactly("ROLE_AGENT");
        }

        @Test
        @DisplayName("rejects the token when its embedded tokenVersion is stale (S-09)")
        void staleTokenVersion_LeavesContextAnonymous() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer stale-token");
            when(jwtService.isValidToken("stale-token")).thenReturn(true);
            when(jwtService.extractUsername("stale-token")).thenReturn("alice");
            when(jwtService.extractRole("stale-token")).thenReturn(UserRole.ADMIN);
            User user = User.builder()
                    .username("alice").role(UserRole.ADMIN).enabled(true).tokenVersion(7L).build();
            when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
            when(jwtService.extractTokenVersion("stale-token")).thenReturn(5L);

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            assertThat(response.getHeader("WWW-Authenticate"))
                    .isEqualTo("Bearer error=\"invalid_token\", error_description=\"Token revoked\"");
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("accepts the token when its tokenVersion matches the user's current value")
        void matchingTokenVersion_PopulatesSecurityContext() throws ServletException, IOException {
            request.addHeader("Authorization", "Bearer good-token");
            when(jwtService.isValidToken("good-token")).thenReturn(true);
            when(jwtService.extractUsername("good-token")).thenReturn("bob");
            when(jwtService.extractRole("good-token")).thenReturn(UserRole.AGENT);
            User user = User.builder()
                    .username("bob").role(UserRole.AGENT).enabled(true).tokenVersion(3L).build();
            when(userRepository.findByUsername("bob")).thenReturn(Optional.of(user));
            when(jwtService.extractTokenVersion("good-token")).thenReturn(3L);

            jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
            verify(filterChain).doFilter(request, response);
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
            when(userRepository.findByUsername("alice"))
                    .thenReturn(Optional.of(enabledUser("alice", UserRole.ADMIN)));

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
            when(userRepository.findByUsername("bob"))
                    .thenReturn(Optional.of(enabledUser("bob", UserRole.AGENT)));

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
