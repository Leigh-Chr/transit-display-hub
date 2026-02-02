package com.transit.hub.domain.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "timed_entries",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_timed_entry_stop_route_time",
           columnNames = {"stop_id", "route_id", "time"}
       ),
       indexes = {
           @Index(name = "idx_timed_entry_stop_time", columnList = "stop_id, time"),
           @Index(name = "idx_timed_entry_route", columnList = "route_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TimedEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull(message = "Time is required")
    @Column(nullable = false)
    private LocalTime time;

    @NotNull(message = "Stop is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stop_id", nullable = false)
    private Stop stop;

    @NotNull(message = "Route is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_id", nullable = false)
    private Route route;
}
