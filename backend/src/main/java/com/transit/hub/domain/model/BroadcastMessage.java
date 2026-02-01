package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "broadcast_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BroadcastMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

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

    public boolean isActive() {
        Instant now = Instant.now();
        return now.isAfter(startTime) && now.isBefore(endTime);
    }

    public boolean isActiveAt(Instant time) {
        return time.isAfter(startTime) && time.isBefore(endTime);
    }
}
