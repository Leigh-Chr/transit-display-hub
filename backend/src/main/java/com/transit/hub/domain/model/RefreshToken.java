package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens",
       indexes = {
           @Index(name = "idx_refresh_token_user", columnList = "user_id"),
           @Index(name = "idx_refresh_token_expires_at", columnList = "expires_at")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private @Nullable Long version;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * SHA-256 hex digest of the raw token that was handed to the
     * client. We never store the raw value — a leak of this table
     * does not give an attacker something they can replay.
     */
    @NotBlank
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @NotNull
    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @NotNull
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private @Nullable Instant revokedAt;

    /**
     * Walks the rotation chain. When /refresh accepts this token we
     * mint a new RefreshToken and set this column to its id, so reuse
     * of an already-rotated token can be detected.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replaced_by_id")
    private @Nullable RefreshToken replacedBy;

    @Column(name = "user_agent", length = 255)
    private @Nullable String userAgent;

    @Column(name = "ip_address", length = 45)
    private @Nullable String ipAddress;

    /**
     * Active = not revoked yet and not past its expiry. Callers pass the
     * clock-driven now so the domain stays free of wall-clock reads
     * (ADR 0024).
     */
    public boolean isActiveAt(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }
}
