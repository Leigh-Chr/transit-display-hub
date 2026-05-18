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
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.time.LocalTime;
import java.util.UUID;

/**
 * GTFS-flex stop_times row: a pickup/drop-off window over a flex zone
 * (location), a flex group of stops (location_group) or a regular stop.
 * The three target FKs ({@link #stop}, {@link #location},
 * {@link #locationGroup}) are mutually exclusive at the spec level — the
 * importer enforces that exactly one is non-null.
 * <p>
 * Distinct from {@link Schedule}, which still represents a concrete
 * arrival at a fixed stop with a known time-of-day.
 */
@Entity
@Table(name = "flex_stop_times",
       indexes = {
           @Index(name = "idx_flex_stop_time_itinerary", columnList = "itinerary_id"),
           @Index(name = "idx_flex_stop_time_location", columnList = "location_id"),
           @Index(name = "idx_flex_stop_time_location_group", columnList = "location_group_id"),
           @Index(name = "idx_flex_stop_time_window",
                  columnList = "start_pickup_drop_off_window, end_pickup_drop_off_window")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FlexStopTime {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "itinerary_id", nullable = false)
    private Itinerary itinerary;

    @NotNull
    @Column(name = "stop_sequence", nullable = false)
    private Integer stopSequence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stop_id")
    private @Nullable Stop stop;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id")
    private @Nullable Location location;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_group_id")
    private @Nullable LocationGroup locationGroup;

    @NotNull
    @Column(name = "start_pickup_drop_off_window", nullable = false)
    private LocalTime startPickupDropOffWindow;

    @NotNull
    @Column(name = "end_pickup_drop_off_window", nullable = false)
    private LocalTime endPickupDropOffWindow;

    @Column(name = "pickup_type")
    private @Nullable Short pickupType;

    @Column(name = "drop_off_type")
    private @Nullable Short dropOffType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pickup_booking_rule_id")
    private @Nullable BookingRule pickupBookingRule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "drop_off_booking_rule_id")
    private @Nullable BookingRule dropOffBookingRule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_calendar_id")
    private @Nullable ServiceCalendar serviceCalendar;

    @Size(max = 100)
    @Column(name = "stop_headsign", length = 100)
    private @Nullable String stopHeadsign;
}
