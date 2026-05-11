package com.transit.hub.infrastructure.security;

import com.transit.hub.domain.model.RefreshToken;
import com.transit.hub.domain.model.User;
import com.transit.hub.infrastructure.persistence.RefreshTokenRepository;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("RefreshTokenService")
class RefreshTokenServiceTest {

    private static final Instant FIXED_NOW = Instant.parse("2026-05-11T10:00:00Z");
    private static final String UA = "Mozilla/5.0";
    private static final String IP = "127.0.0.1";

    @Mock
    private RefreshTokenRepository repository;

    private RefreshTokenService service;
    private User user;

    @BeforeEach
    void setUp() {
        var jwtProps = new com.transit.hub.infrastructure.config.JwtProperties(
                "secret-only-validated-by-JwtService-not-this-test-but-must-be-32-chars",
                1, "transit-display-hub", "transit-display-hub-admin", 14);
        service = new RefreshTokenService(repository, Clock.fixed(FIXED_NOW, ZoneOffset.UTC), jwtProps);
        user = TestDataFactory.createAdmin("alice");
    }

    @Nested
    @DisplayName("issue")
    class Issue {

        @Test
        @DisplayName("mints a token with the expected lifetime and metadata")
        void mintsToken() {
            when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

            RefreshTokenService.Issued issued = service.issue(user, UA, IP);

            assertThat(issued.rawToken()).isNotBlank();
            assertThat(issued.entity().getUser()).isSameAs(user);
            assertThat(issued.entity().getIssuedAt()).isEqualTo(FIXED_NOW);
            assertThat(issued.entity().getExpiresAt())
                    .isEqualTo(FIXED_NOW.plus(14, ChronoUnit.DAYS));
            assertThat(issued.entity().getUserAgent()).isEqualTo(UA);
            assertThat(issued.entity().getIpAddress()).isEqualTo(IP);
            assertThat(issued.entity().getTokenHash())
                    .hasSize(64)
                    .matches("[0-9a-f]+");
            verify(repository).save(any(RefreshToken.class));
        }

        @Test
        @DisplayName("raw token is unique across two calls")
        void rawTokenIsUnique() {
            when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

            String first = service.issue(user, UA, IP).rawToken();
            String second = service.issue(user, UA, IP).rawToken();

            assertThat(first).isNotEqualTo(second);
        }
    }

    @Nested
    @DisplayName("rotate")
    class Rotate {

        @Test
        @DisplayName("revokes the existing row and mints a successor pointing back to it")
        void rotatesAndChainsReplacement() {
            when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
            RefreshTokenService.Issued initial = service.issue(user, UA, IP);

            when(repository.findByTokenHash(initial.entity().getTokenHash()))
                    .thenReturn(Optional.of(initial.entity()));

            RefreshTokenService.Issued rotated = service.rotate(initial.rawToken(), UA, IP);

            assertThat(initial.entity().getRevokedAt()).isEqualTo(FIXED_NOW);
            assertThat(initial.entity().getReplacedBy()).isSameAs(rotated.entity());
            assertThat(rotated.rawToken()).isNotEqualTo(initial.rawToken());
        }

        @Test
        @DisplayName("rejects an unknown token")
        void rejectsUnknown() {
            when(repository.findByTokenHash(any())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.rotate("nope", UA, IP))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessageContaining("Unknown");
        }

        @Test
        @DisplayName("rejects a revoked token")
        void rejectsRevoked() {
            when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
            RefreshTokenService.Issued initial = service.issue(user, UA, IP);
            initial.entity().setRevokedAt(FIXED_NOW.minusSeconds(60));
            when(repository.findByTokenHash(initial.entity().getTokenHash()))
                    .thenReturn(Optional.of(initial.entity()));

            assertThatThrownBy(() -> service.rotate(initial.rawToken(), UA, IP))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessageContaining("revoked");
        }

        @Test
        @DisplayName("rejects an expired token")
        void rejectsExpired() {
            when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
            RefreshTokenService.Issued initial = service.issue(user, UA, IP);
            initial.entity().setExpiresAt(FIXED_NOW.minusSeconds(1));
            when(repository.findByTokenHash(initial.entity().getTokenHash()))
                    .thenReturn(Optional.of(initial.entity()));

            assertThatThrownBy(() -> service.rotate(initial.rawToken(), UA, IP))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessageContaining("expired");
        }

        @Test
        @DisplayName("reuse of an already-rotated token nukes the active chain")
        void reuseTriggersChainRevocation() {
            when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
            RefreshTokenService.Issued first = service.issue(user, UA, IP);
            // Simulate a previous successful rotation.
            RefreshToken successor = RefreshToken.builder().build();
            first.entity().setReplacedBy(successor);
            when(repository.findByTokenHash(first.entity().getTokenHash()))
                    .thenReturn(Optional.of(first.entity()));

            assertThatThrownBy(() -> service.rotate(first.rawToken(), UA, IP))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessageContaining("already rotated");

            verify(repository).revokeAllActiveByUserId(eq(user.getId()), eq(FIXED_NOW));
        }
    }

    @Nested
    @DisplayName("revoke")
    class Revoke {

        @Test
        @DisplayName("marks the row revoked when found and still active")
        void revokesActive() {
            when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
            RefreshTokenService.Issued initial = service.issue(user, UA, IP);
            when(repository.findByTokenHash(initial.entity().getTokenHash()))
                    .thenReturn(Optional.of(initial.entity()));

            service.revoke(initial.rawToken());

            assertThat(initial.entity().getRevokedAt()).isEqualTo(FIXED_NOW);
            ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
            verify(repository, times(2)).save(captor.capture()); // 1× issue + 1× revoke
        }

        @Test
        @DisplayName("is a no-op when the token is unknown")
        void noopForUnknown() {
            when(repository.findByTokenHash(any())).thenReturn(Optional.empty());

            service.revoke("ghost");

            verify(repository, never()).save(any(RefreshToken.class));
        }

        @Test
        @DisplayName("does not overwrite an existing revoke timestamp")
        void preservesExistingRevocation() {
            when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
            RefreshTokenService.Issued initial = service.issue(user, UA, IP);
            Instant earlier = FIXED_NOW.minusSeconds(300);
            initial.entity().setRevokedAt(earlier);
            when(repository.findByTokenHash(initial.entity().getTokenHash()))
                    .thenReturn(Optional.of(initial.entity()));

            service.revoke(initial.rawToken());

            assertThat(initial.entity().getRevokedAt()).isEqualTo(earlier);
        }
    }

    @Nested
    @DisplayName("revokeAllForUser")
    class RevokeAllForUser {

        @Test
        @DisplayName("delegates to the repository update")
        void delegatesToRepository() {
            when(repository.revokeAllActiveByUserId(user.getId(), FIXED_NOW)).thenReturn(3);

            int count = service.revokeAllForUser(user.getId());

            assertThat(count).isEqualTo(3);
        }
    }

    @Nested
    @DisplayName("purgeExpired")
    class PurgeExpired {

        @Test
        @DisplayName("deletes rows whose expiresAt is before now")
        void delegatesToRepository() {
            when(repository.deleteExpiredBefore(FIXED_NOW)).thenReturn(5);

            int count = service.purgeExpired();

            assertThat(count).isEqualTo(5);
        }
    }
}
