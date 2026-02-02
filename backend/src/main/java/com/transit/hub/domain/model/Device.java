package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.DeviceStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

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
    private Instant lastHeartbeat;

    public void recordHeartbeat() {
        this.lastHeartbeat = Instant.now();
        this.status = DeviceStatus.ONLINE;
    }

    public void markOffline() {
        this.status = DeviceStatus.OFFLINE;
    }
}
