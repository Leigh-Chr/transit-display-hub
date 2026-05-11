package com.transit.hub.application.service;

import com.transit.hub.application.dto.LoginBundle;
import com.transit.hub.application.dto.request.LoginRequest;
import com.transit.hub.application.dto.response.LoginResponse;
import com.transit.hub.domain.model.RefreshToken;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
import com.transit.hub.infrastructure.security.RefreshTokenService;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService")
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private RefreshTokenService refreshTokenService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-05-11T10:00:00Z"), ZoneOffset.UTC);

    @InjectMocks
    private AuthService authService;

    private User testUser;
    private static final String TEST_TOKEN = "test.jwt.token";
    private static final Instant TEST_EXPIRATION = Instant.now().plusSeconds(3600);

    @BeforeEach
    void setUp() {
        // Plug the fixed clock into the @InjectMocks-built instance so the
        // refresh-token TTL computation is deterministic in these tests.
        authService = new AuthService(userRepository, passwordEncoder, jwtService,
                refreshTokenService, clock);
        testUser = TestDataFactory.createUserWithPassword("testuser", "encoded_password", UserRole.ADMIN);
    }

    @Nested
    @DisplayName("login")
    class Login {

        @Test
        @DisplayName("returns token with valid credentials")
        void withValidCredentials_ReturnsToken() {
            LoginRequest request = new LoginRequest("testuser", "password123");
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("password123", "encoded_password")).thenReturn(true);
            when(jwtService.generateToken(testUser)).thenReturn(TEST_TOKEN);
            when(jwtService.extractExpiration(TEST_TOKEN)).thenReturn(TEST_EXPIRATION);

            LoginResponse response = authService.login(request);

            assertThat(response).isNotNull();
            assertThat(response.token()).isEqualTo(TEST_TOKEN);
            assertThat(response.expiresAt()).isEqualTo(TEST_EXPIRATION);
            assertThat(response.role()).isEqualTo(UserRole.ADMIN);
            assertThat(response.username()).isEqualTo("testuser");

            verify(userRepository).findByUsername("testuser");
            verify(passwordEncoder).matches("password123", "encoded_password");
            verify(jwtService).generateToken(testUser);
        }

        @Test
        @DisplayName("throws BadCredentialsException when user not found")
        void withNonExistentUser_ThrowsBadCredentials() {
            LoginRequest request = new LoginRequest("unknown", "password");
            when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verify(userRepository).findByUsername("unknown");
            verifyNoInteractions(passwordEncoder, jwtService);
        }

        @Test
        @DisplayName("throws BadCredentialsException with wrong password")
        void withWrongPassword_ThrowsBadCredentials() {
            LoginRequest request = new LoginRequest("testuser", "wrongpassword");
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("wrongpassword", "encoded_password")).thenReturn(false);

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verify(userRepository).findByUsername("testuser");
            verify(passwordEncoder).matches("wrongpassword", "encoded_password");
            verifyNoInteractions(jwtService);
        }

        @Test
        @DisplayName("throws BadCredentialsException when user is disabled")
        void withDisabledUser_ThrowsBadCredentials() {
            User disabledUser = TestDataFactory.createDisabledUser("disabled", UserRole.ADMIN);
            LoginRequest request = new LoginRequest("disabled", "password");
            when(userRepository.findByUsername("disabled")).thenReturn(Optional.of(disabledUser));

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Account is disabled");

            verify(userRepository).findByUsername("disabled");
            verifyNoInteractions(passwordEncoder, jwtService);
        }

        @Test
        @DisplayName("returns correct role for AGENT user")
        void withAgentUser_ReturnsAgentRole() {
            User agentUser = TestDataFactory.createUserWithPassword("agent", "encoded_password", UserRole.AGENT);
            LoginRequest request = new LoginRequest("agent", "password");
            when(userRepository.findByUsername("agent")).thenReturn(Optional.of(agentUser));
            when(passwordEncoder.matches("password", "encoded_password")).thenReturn(true);
            when(jwtService.generateToken(agentUser)).thenReturn(TEST_TOKEN);
            when(jwtService.extractExpiration(TEST_TOKEN)).thenReturn(TEST_EXPIRATION);

            LoginResponse response = authService.login(request);

            assertThat(response.role()).isEqualTo(UserRole.AGENT);
            assertThat(response.username()).isEqualTo("agent");
        }

        @Test
        @DisplayName("calls jwtService to generate token only after validation")
        void verifiesMethodCallOrder() {
            LoginRequest request = new LoginRequest("testuser", "password");
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("password", "encoded_password")).thenReturn(true);
            when(jwtService.generateToken(testUser)).thenReturn(TEST_TOKEN);
            when(jwtService.extractExpiration(TEST_TOKEN)).thenReturn(TEST_EXPIRATION);

            authService.login(request);

            var inOrder = inOrder(userRepository, passwordEncoder, jwtService);
            inOrder.verify(userRepository).findByUsername("testuser");
            inOrder.verify(passwordEncoder).matches("password", "encoded_password");
            inOrder.verify(jwtService).generateToken(testUser);
        }

        @Test
        @DisplayName("throws BadCredentialsException when username is null")
        void withNullUsername_ThrowsBadCredentials() {
            LoginRequest request = new LoginRequest(null, "password");
            when(userRepository.findByUsername(null)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verifyNoInteractions(passwordEncoder, jwtService);
        }

        @Test
        @DisplayName("throws BadCredentialsException when username is empty")
        void withEmptyUsername_ThrowsBadCredentials() {
            LoginRequest request = new LoginRequest("", "password");
            when(userRepository.findByUsername("")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verifyNoInteractions(passwordEncoder, jwtService);
        }

        @Test
        @DisplayName("throws BadCredentialsException when password is null")
        void withNullPassword_ThrowsBadCredentials() {
            LoginRequest request = new LoginRequest("testuser", null);
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches(null, "encoded_password")).thenReturn(false);

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verifyNoInteractions(jwtService);
        }

        @Test
        @DisplayName("throws BadCredentialsException when password is empty")
        void withEmptyPassword_ThrowsBadCredentials() {
            LoginRequest request = new LoginRequest("testuser", "");
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("", "encoded_password")).thenReturn(false);

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verifyNoInteractions(jwtService);
        }

        @Test
        @DisplayName("disabled user check precedes password check")
        void disabledUserCheck_PrecedesPasswordCheck() {
            User disabledUser = TestDataFactory.createDisabledUser("disabled", UserRole.AGENT);
            LoginRequest request = new LoginRequest("disabled", "password");
            when(userRepository.findByUsername("disabled")).thenReturn(Optional.of(disabledUser));

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Account is disabled");

            // Password should never be checked for a disabled user
            verifyNoInteractions(passwordEncoder, jwtService);
        }

        @Test
        @DisplayName("response includes correct role in token for ADMIN")
        void tokenForAdmin_ContainsAdminRole() {
            LoginRequest request = new LoginRequest("testuser", "password");
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("password", "encoded_password")).thenReturn(true);
            when(jwtService.generateToken(testUser)).thenReturn(TEST_TOKEN);
            when(jwtService.extractExpiration(TEST_TOKEN)).thenReturn(TEST_EXPIRATION);

            LoginResponse response = authService.login(request);

            assertThat(response.role()).isEqualTo(UserRole.ADMIN);
            assertThat(response.token()).isEqualTo(TEST_TOKEN);
            assertThat(response.expiresAt()).isEqualTo(TEST_EXPIRATION);
        }

        @Test
        @DisplayName("multiple logins for same user each produce a token")
        void multipleLogins_EachProducesToken() {
            String token1 = "token.first.login";
            String token2 = "token.second.login";
            Instant expiration1 = Instant.now().plusSeconds(3600);
            Instant expiration2 = Instant.now().plusSeconds(7200);

            LoginRequest request = new LoginRequest("testuser", "password");
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("password", "encoded_password")).thenReturn(true);
            when(jwtService.generateToken(testUser)).thenReturn(token1, token2);
            when(jwtService.extractExpiration(token1)).thenReturn(expiration1);
            when(jwtService.extractExpiration(token2)).thenReturn(expiration2);

            LoginResponse response1 = authService.login(request);
            LoginResponse response2 = authService.login(request);

            assertThat(response1.token()).isEqualTo(token1);
            assertThat(response2.token()).isEqualTo(token2);
            assertThat(response1.token()).isNotEqualTo(response2.token());

            verify(jwtService, times(2)).generateToken(testUser);
        }
    }

    @Nested
    @DisplayName("loginWithRefresh")
    class LoginWithRefresh {

        @Test
        @DisplayName("returns bundle with access token, refresh raw and remaining TTL")
        void returnsBundle() {
            Instant refreshExpiresAt = Instant.parse("2026-05-25T10:00:00Z");
            LoginRequest request = new LoginRequest("testuser", "password");
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("password", "encoded_password")).thenReturn(true);
            when(jwtService.generateToken(testUser)).thenReturn(TEST_TOKEN);
            when(jwtService.extractExpiration(TEST_TOKEN)).thenReturn(TEST_EXPIRATION);
            RefreshToken refreshEntity = RefreshToken.builder()
                    .user(testUser)
                    .expiresAt(refreshExpiresAt)
                    .build();
            when(refreshTokenService.issue(testUser, "UA", "1.2.3.4"))
                    .thenReturn(new RefreshTokenService.Issued("raw-refresh", refreshEntity));

            LoginBundle bundle = authService.loginWithRefresh(request, "UA", "1.2.3.4");

            assertThat(bundle.loginResponse().token()).isEqualTo(TEST_TOKEN);
            assertThat(bundle.loginResponse().role()).isEqualTo(UserRole.ADMIN);
            assertThat(bundle.refreshTokenRaw()).isEqualTo("raw-refresh");
            // 14 days between fixed clock (2026-05-11T10:00:00Z) and refreshExpiresAt
            assertThat(bundle.refreshTokenTtl()).isEqualTo(java.time.Duration.ofDays(14));
        }

        @Test
        @DisplayName("propagates BadCredentialsException without touching refresh service")
        void invalidCredentialsDoesNotMintRefresh() {
            LoginRequest request = new LoginRequest("unknown", "password");
            when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.loginWithRefresh(request, "UA", "1.2.3.4"))
                    .isInstanceOf(BadCredentialsException.class);

            verifyNoInteractions(refreshTokenService);
        }
    }

    @Nested
    @DisplayName("refresh")
    class Refresh {

        @Test
        @DisplayName("rotates the refresh token and mints a new access bundle")
        void rotatesAndIssues() {
            Instant newRefreshExpiresAt = Instant.parse("2026-05-25T10:00:00Z");
            RefreshToken rotatedEntity = RefreshToken.builder()
                    .user(testUser)
                    .expiresAt(newRefreshExpiresAt)
                    .build();
            when(refreshTokenService.rotate("incoming-raw", "UA", "1.2.3.4"))
                    .thenReturn(new RefreshTokenService.Issued("new-raw", rotatedEntity));
            when(jwtService.generateToken(testUser)).thenReturn(TEST_TOKEN);
            when(jwtService.extractExpiration(TEST_TOKEN)).thenReturn(TEST_EXPIRATION);

            LoginBundle bundle = authService.refresh("incoming-raw", "UA", "1.2.3.4");

            assertThat(bundle.loginResponse().token()).isEqualTo(TEST_TOKEN);
            assertThat(bundle.refreshTokenRaw()).isEqualTo("new-raw");
            assertThat(bundle.refreshTokenTtl()).isEqualTo(java.time.Duration.ofDays(14));
        }

        @Test
        @DisplayName("propagates BadCredentialsException from rotate")
        void propagatesRotateFailure() {
            when(refreshTokenService.rotate(any(), any(), any()))
                    .thenThrow(new BadCredentialsException("Refresh token revoked"));

            assertThatThrownBy(() -> authService.refresh("raw", "UA", "1.2.3.4"))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessageContaining("revoked");
        }
    }

    @Nested
    @DisplayName("logout")
    class Logout {

        @Test
        @DisplayName("delegates to refresh service when token is present")
        void revokesPresentToken() {
            authService.logout("raw-token");
            verify(refreshTokenService).revoke("raw-token");
        }

        @Test
        @DisplayName("is a no-op when raw is null or blank")
        void noopForBlank() {
            authService.logout(null);
            authService.logout("");
            authService.logout("   ");
            verifyNoInteractions(refreshTokenService);
        }
    }
}
