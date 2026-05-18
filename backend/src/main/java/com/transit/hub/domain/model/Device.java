package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.DeviceStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
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
@Table(name = "devices",
       indexes = {
           @Index(name = "idx_device_token_lookup", columnList = "token_lookup"),
           @Index(name = "idx_device_status", columnList = "status"),
           @Index(name = "idx_device_last_heartbeat", columnList = "last_heartbeat")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Device {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * First 8 characters of the plain token for fast lookup.
     * Not secure alone, but allows filtering before BCrypt verification.
     */
    @NotBlank(message = "Token lookup is required")
    @Column(name = "token_lookup", nullable = false, length = 8)
    private String tokenLookup;

    @NotBlank(message = "Token is required")
    @Column(nullable = false, unique = true, length = 60)
    private String tokenHash;

    @NotNull(message = "Stop is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stop_id", nullable = false)
    private Stop stop;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private DeviceStatus status = DeviceStatus.OFFLINE;

    @Column(name = "last_heartbeat")
    private @Nullable Instant lastHeartbeat;

    /**
     * Stamp the heartbeat with the caller's clock. The domain refuses to
     * read {@code Instant.now()} so a fixed {@link java.time.Clock}
     * injected at the service edge (ADR 0024) drives the timestamp in
     * production AND in tests — no more dependency on the wall clock.
     */
    public void recordHeartbeat(Instant now) {
        this.lastHeartbeat = now;
        this.status = DeviceStatus.ONLINE;
    }

    public void markOffline() {
        this.status = DeviceStatus.OFFLINE;
    }
}
