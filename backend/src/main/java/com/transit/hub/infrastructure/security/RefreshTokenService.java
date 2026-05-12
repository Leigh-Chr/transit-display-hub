package com.transit.hub.infrastructure.security;

import com.transit.hub.domain.model.RefreshToken;
import com.transit.hub.domain.model.User;
import com.transit.hub.infrastructure.config.JwtProperties;
import com.transit.hub.infrastructure.persistence.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Mints and rotates refresh tokens used by the cookie-based auth flow.
 *
 * <p>The raw token never sits in the database — only its SHA-256 hex
 * digest does. Rotation is mandatory on every /refresh hit: the
 * previous row is marked revoked and its {@code replaced_by_id}
 * pointer walks the new row, so reuse of a token that already minted a
 * successor is interpreted as theft and revokes the entire chain.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    private static final int RAW_TOKEN_BYTES = 32; // 256 bits → ~43 base64url chars
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository repository;
    private final Clock clock;
    private final JwtProperties jwtProperties;

    /**
     * Mints a brand new refresh token for the given user (e.g. at login).
     * Returns both the raw value (to drop in the response cookie) and
     * the persisted entity.
     */
    @Transactional
    public Issued issue(User user, String userAgent, String ipAddress) {
        return mint(user, userAgent, ipAddress);
    }

    /**
     * Validates the supplied raw token, marks its row revoked, and
     * mints a successor. If the supplied token has already been
     * rotated (replaced_by_id is set) or is otherwise inactive, the
     * whole chain for that user is revoked and an exception is thrown.
     */
    @Transactional
    public Issued rotate(String rawToken, String userAgent, String ipAddress) {
        String hash = hash(rawToken);
        // Pessimistic-write lock so two concurrent /refresh calls for the
        // same token serialise on the row. Without it, both threads could
        // pass the freshness checks and mint successors before either
        // committed `replacedBy`, silently bypassing the reuse-detection
        // chain. The lock is released when the surrounding @Transactional
        // commits.
        RefreshToken existing = repository.findByTokenHashForUpdate(hash)
                .orElseThrow(() -> new BadCredentialsException("Unknown refresh token"));

        Instant now = clock.instant();

        // Token already rotated → almost certainly a stolen value being
        // replayed. Burn every active token for this user.
        if (existing.getReplacedBy() != null) {
            log.warn("Refresh token reuse detected for user {} — revoking active chain",
                    existing.getUser().getId());
            repository.revokeAllActiveByUserId(existing.getUser().getId(), now);
            throw new BadCredentialsException("Refresh token already rotated");
        }

        if (existing.getRevokedAt() != null) {
            throw new BadCredentialsException("Refresh token revoked");
        }

        if (existing.getExpiresAt().isBefore(now)) {
            throw new BadCredentialsException("Refresh token expired");
        }

        Issued next = mint(existing.getUser(), userAgent, ipAddress);
        existing.setRevokedAt(now);
        existing.setReplacedBy(next.entity());
        repository.save(existing);

        return next;
    }

    @Transactional
    public void revoke(String rawToken) {
        repository.findByTokenHash(hash(rawToken)).ifPresent(rt -> {
            if (rt.getRevokedAt() == null) {
                rt.setRevokedAt(clock.instant());
                repository.save(rt);
            }
        });
    }

    @Transactional
    public int revokeAllForUser(UUID userId) {
        return repository.revokeAllActiveByUserId(userId, clock.instant());
    }

    @Transactional
    public int purgeExpired() {
        return repository.deleteExpiredBefore(clock.instant());
    }

    /**
     * Daily housekeeping so {@code refresh_tokens} doesn't grow without
     * bound — issued rows beyond their {@code expires_at} carry no
     * security value and only widen the audit query surface. Cron
     * scheduled 30 min after the GTFS refresh window so the two jobs
     * don't share a single Hikari connection burst.
     */
    @Scheduled(cron = "${app.auth.refresh-token-purge-cron:0 30 4 * * *}")
    void scheduledPurgeExpired() {
        int removed = purgeExpired();
        if (removed > 0) {
            log.info("Purged {} expired refresh tokens", removed);
        }
    }

    public Duration ttl() {
        return Duration.ofDays(jwtProperties.refreshExpirationDays());
    }

    private Issued mint(User user, String userAgent, String ipAddress) {
        byte[] raw = new byte[RAW_TOKEN_BYTES];
        RANDOM.nextBytes(raw);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        Instant now = clock.instant();
        RefreshToken entity = RefreshToken.builder()
                .user(user)
                .tokenHash(hash(rawToken))
                .issuedAt(now)
                .expiresAt(now.plus(Duration.ofDays(jwtProperties.refreshExpirationDays())))
                .userAgent(userAgent)
                .ipAddress(ipAddress)
                .build();

        repository.save(entity);
        return new Issued(rawToken, entity);
    }

    private static String hash(String rawToken) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandated by every JRE — if it ever fails, fail loud.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    public record Issued(String rawToken, RefreshToken entity) {}
}
