package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.LoginRequest;
import com.transit.hub.application.dto.response.LoginResponse;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
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

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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

    @InjectMocks
    private AuthService authService;

    private User testUser;
    private static final String TEST_TOKEN = "test.jwt.token";
    private static final Instant TEST_EXPIRATION = Instant.now().plusSeconds(3600);

    @BeforeEach
    void setUp() {
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
    }
}
