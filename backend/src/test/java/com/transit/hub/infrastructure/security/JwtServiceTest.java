package com.transit.hub.infrastructure.security;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.testutil.TestDataFactory;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

import static org.assertj.core.api.Assertions.*;

@DisplayName("JwtService")
class JwtServiceTest {

    private JwtService jwtService;
    private static final String TEST_SECRET = "this-is-a-very-long-secret-key-for-testing-jwt-minimum-256-bits-required";
    private static final int EXPIRATION_HOURS = 24;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret", TEST_SECRET);
        ReflectionTestUtils.setField(jwtService, "expirationHours", EXPIRATION_HOURS);
    }

    @Nested
    @DisplayName("generateToken")
    class GenerateToken {

        @Test
        @DisplayName("creates valid JWT with correct subject")
        void createsValidJwt() {
            User user = TestDataFactory.createAdmin("testuser");

            String token = jwtService.generateToken(user);

            assertThat(token).isNotNull().isNotEmpty();
            assertThat(jwtService.extractUsername(token)).isEqualTo("testuser");
        }

        @Test
        @DisplayName("includes role claim in token")
        void includesRoleClaim() {
            User admin = TestDataFactory.createAdmin("admin");
            User agent = TestDataFactory.createAgent("agent");

            String adminToken = jwtService.generateToken(admin);
            String agentToken = jwtService.generateToken(agent);

            assertThat(jwtService.extractRole(adminToken)).isEqualTo(UserRole.ADMIN);
            assertThat(jwtService.extractRole(agentToken)).isEqualTo(UserRole.AGENT);
        }

        @Test
        @DisplayName("sets expiration based on configured hours")
        void setsCorrectExpiration() {
            User user = TestDataFactory.createAdmin("testuser");
            Instant beforeGeneration = Instant.now();

            String token = jwtService.generateToken(user);

            Instant expiration = jwtService.extractExpiration(token);
            // Allow 1 second tolerance for truncation to second precision
            Instant expectedMin = beforeGeneration.plus(EXPIRATION_HOURS, ChronoUnit.HOURS).minusSeconds(1);
            Instant expectedMax = beforeGeneration.plus(EXPIRATION_HOURS, ChronoUnit.HOURS).plusSeconds(5);

            assertThat(expiration).isBetween(expectedMin, expectedMax);
        }
    }

    @Nested
    @DisplayName("extractUsername")
    class ExtractUsername {

        @Test
        @DisplayName("returns correct subject from valid token")
        void returnsCorrectSubject() {
            User user = TestDataFactory.createAdmin("john.doe");
            String token = jwtService.generateToken(user);

            String username = jwtService.extractUsername(token);

            assertThat(username).isEqualTo("john.doe");
        }

        @Test
        @DisplayName("throws exception for malformed token")
        void throwsForMalformedToken() {
            assertThatThrownBy(() -> jwtService.extractUsername("not.a.valid.token"))
                    .isInstanceOf(Exception.class);
        }
    }

    @Nested
    @DisplayName("validateToken")
    class ValidateToken {

        @Test
        @DisplayName("returns true for valid token with matching username")
        void returnsTrueForValidToken() {
            User user = TestDataFactory.createAdmin("testuser");
            String token = jwtService.generateToken(user);

            boolean isValid = jwtService.validateToken(token, "testuser");

            assertThat(isValid).isTrue();
        }

        @Test
        @DisplayName("returns false when username doesn't match")
        void returnsFalseForMismatchedUsername() {
            User user = TestDataFactory.createAdmin("testuser");
            String token = jwtService.generateToken(user);

            boolean isValid = jwtService.validateToken(token, "differentuser");

            assertThat(isValid).isFalse();
        }

        @Test
        @DisplayName("returns false for expired token")
        void returnsFalseForExpiredToken() {
            // Create an expired token manually
            String expiredToken = createExpiredToken("testuser");

            boolean isValid = jwtService.validateToken(expiredToken, "testuser");

            assertThat(isValid).isFalse();
        }

        @Test
        @DisplayName("returns false for tampered token")
        void returnsFalseForTamperedToken() {
            User user = TestDataFactory.createAdmin("testuser");
            String token = jwtService.generateToken(user);
            // Tamper with the token by changing a character
            String tamperedToken = token.substring(0, token.length() - 5) + "XXXXX";

            boolean isValid = jwtService.validateToken(tamperedToken, "testuser");

            assertThat(isValid).isFalse();
        }
    }

    @Nested
    @DisplayName("isValidToken")
    class IsValidToken {

        @Test
        @DisplayName("returns true for valid non-expired token")
        void returnsTrueForValidToken() {
            User user = TestDataFactory.createAdmin("testuser");
            String token = jwtService.generateToken(user);

            boolean isValid = jwtService.isValidToken(token);

            assertThat(isValid).isTrue();
        }

        @Test
        @DisplayName("returns false for expired token")
        void returnsFalseForExpiredToken() {
            String expiredToken = createExpiredToken("testuser");

            boolean isValid = jwtService.isValidToken(expiredToken);

            assertThat(isValid).isFalse();
        }

        @Test
        @DisplayName("returns false for malformed token")
        void returnsFalseForMalformedToken() {
            boolean isValid = jwtService.isValidToken("this.is.not.valid");

            assertThat(isValid).isFalse();
        }

        @Test
        @DisplayName("returns false for null token")
        void returnsFalseForNullToken() {
            boolean isValid = jwtService.isValidToken(null);

            assertThat(isValid).isFalse();
        }

        @Test
        @DisplayName("returns false for empty token")
        void returnsFalseForEmptyToken() {
            boolean isValid = jwtService.isValidToken("");

            assertThat(isValid).isFalse();
        }

        @Test
        @DisplayName("returns false for token signed with different key")
        void returnsFalseForWrongSignature() {
            // Create token with a different secret
            String differentSecret = "another-very-long-secret-key-that-is-different-from-the-original-one";
            SecretKey differentKey = Keys.hmacShaKeyFor(differentSecret.getBytes(StandardCharsets.UTF_8));

            String tokenWithDifferentKey = Jwts.builder()
                    .subject("testuser")
                    .issuedAt(Date.from(Instant.now()))
                    .expiration(Date.from(Instant.now().plus(1, ChronoUnit.HOURS)))
                    .signWith(differentKey)
                    .compact();

            boolean isValid = jwtService.isValidToken(tokenWithDifferentKey);

            assertThat(isValid).isFalse();
        }
    }

    @Nested
    @DisplayName("extractExpiration")
    class ExtractExpiration {

        @Test
        @DisplayName("returns correct expiration instant")
        void returnsCorrectExpiration() {
            User user = TestDataFactory.createAdmin("testuser");
            Instant before = Instant.now();
            String token = jwtService.generateToken(user);
            Instant after = Instant.now();

            Instant expiration = jwtService.extractExpiration(token);

            // Expiration should be approximately EXPIRATION_HOURS from now
            assertThat(expiration).isAfter(before.plus(EXPIRATION_HOURS - 1, ChronoUnit.HOURS));
            assertThat(expiration).isBefore(after.plus(EXPIRATION_HOURS + 1, ChronoUnit.HOURS));
        }
    }

    @Nested
    @DisplayName("extractRole")
    class ExtractRole {

        @Test
        @DisplayName("returns ADMIN role for admin user token")
        void returnsAdminRole() {
            User admin = TestDataFactory.createAdmin("admin");
            String token = jwtService.generateToken(admin);

            UserRole role = jwtService.extractRole(token);

            assertThat(role).isEqualTo(UserRole.ADMIN);
        }

        @Test
        @DisplayName("returns AGENT role for agent user token")
        void returnsAgentRole() {
            User agent = TestDataFactory.createAgent("agent");
            String token = jwtService.generateToken(agent);

            UserRole role = jwtService.extractRole(token);

            assertThat(role).isEqualTo(UserRole.AGENT);
        }
    }

    private String createExpiredToken(String username) {
        SecretKey key = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        Instant pastTime = Instant.now().minus(1, ChronoUnit.HOURS);

        return Jwts.builder()
                .subject(username)
                .claim("role", UserRole.ADMIN.name())
                .issuedAt(Date.from(pastTime.minus(1, ChronoUnit.HOURS)))
                .expiration(Date.from(pastTime))
                .signWith(key)
                .compact();
    }
}
