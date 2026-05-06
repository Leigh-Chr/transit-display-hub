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
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "schedules",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_schedule_stop_itinerary_time",
           columnNames = {"stop_id", "itinerary_id", "time"}
       ),
       indexes = {
           @Index(name = "idx_schedule_stop_time", columnList = "stop_id, time"),
           @Index(name = "idx_schedule_itinerary", columnList = "itinerary_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @NotNull(message = "Time is required")
    @Column(nullable = false)
    private LocalTime time;

    @NotNull(message = "Stop is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stop_id", nullable = false)
    private Stop stop;

    @NotNull(message = "Itinerary is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "itinerary_id", nullable = false)
    private Itinerary itinerary;

    /** GTFS {@code pickup_type}: 0 = standard, 1 = no pickup, 2 = phone
     *  the agency, 3 = coordinate with the driver. The (1, 1) "no service"
     *  pair is filtered at import time, so 1 here always means "drop-off
     *  only" since drop_off_type would be 0. */
    @Column(name = "pickup_type", nullable = false)
    @Builder.Default
    private short pickupType = 0;

    /** GTFS {@code drop_off_type}: same encoding as {@link #pickupType}. */
    @Column(name = "drop_off_type", nullable = false)
    @Builder.Default
    private short dropOffType = 0;

    /** Per-schedule override of the itinerary's wheelchair default.
     *  Null = inherit. Stored as nullable boolean (rather than the
     *  WheelchairAccess enum) because once we know a trip diverges from
     *  its itinerary default, the only relevant questions are accessible
     *  yes / accessible no — UNKNOWN at this granularity collapses into
     *  inheriting the itinerary value. */
    @Column(name = "wheelchair_override")
    private Boolean wheelchairOverride;

    /** Per-schedule override of the itinerary's bikes-allowed default.
     *  Same null-means-inherit semantics as {@link #wheelchairOverride}. */
    @Column(name = "bikes_allowed_override")
    private Boolean bikesAllowedOverride;
}
