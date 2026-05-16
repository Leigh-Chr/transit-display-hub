package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "broadcast_messages",
       indexes = {
           @Index(name = "idx_message_time_range", columnList = "startTime, endTime"),
           @Index(name = "idx_message_scope", columnList = "scopeType, scope_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BroadcastMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @NotBlank(message = "Title is required")
    @Size(max = 100, message = "Title must be at most 100 characters")
    @Column(nullable = false)
    private String title;

    @NotBlank(message = "Content is required")
    @Size(max = 500, message = "Content must be at most 500 characters")
    @Column(nullable = false, length = 500)
    private String content;

    @NotNull(message = "Severity is required")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MessageSeverity severity;

    @NotNull(message = "Start time is required")
    @Column(nullable = false)
    private Instant startTime;

    @NotNull(message = "End time is required")
    @Column(nullable = false)
    private Instant endTime;

    @NotNull(message = "Scope type is required")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MessageScope scopeType;

    @Column(name = "scope_id")
    private UUID scopeId;

    @AssertTrue(message = "End time must be after start time")
    public boolean isValidTimeRange() {
        if (startTime == null || endTime == null) {
            return true; // Let @NotNull handle null validation
        }
        return endTime.isAfter(startTime);
    }

    /**
     * Half-open interval [startTime, endTime): a message is visible the moment
     * its start arrives and stops being visible when end arrives. Matches the
     * repository queries (`start <= now AND end > now`) so a message created
     * exactly at its start instant fires the corresponding event.
     *
     * <p>The entity refuses to read {@code Instant.now()} so callers pass
     * a clock-driven {@link Instant} (ADR 0024). Tests inject a fixed
     * instant; production receives {@code Instant.now(clock)} from the
     * service layer.
     */
    public boolean isActiveAt(Instant time) {
        return !time.isBefore(startTime) && time.isBefore(endTime);
    }
}
