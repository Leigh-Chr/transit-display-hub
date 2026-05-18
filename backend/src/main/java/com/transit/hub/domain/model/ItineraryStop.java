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
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

@Entity
@Table(name = "itinerary_stops",
       uniqueConstraints = {
           @UniqueConstraint(
               name = "uk_itinerary_stop",
               columnNames = {"itinerary_id", "stop_id"}),
           @UniqueConstraint(
               name = "uk_itinerary_position",
               columnNames = {"itinerary_id", "position"})
       },
       indexes = {
           @Index(name = "idx_itinerary_stop_itinerary", columnList = "itinerary_id"),
           @Index(name = "idx_itinerary_stop_stop", columnList = "stop_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItineraryStop {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull(message = "Itinerary is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "itinerary_id", nullable = false)
    private Itinerary itinerary;

    @NotNull(message = "Stop is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stop_id", nullable = false)
    private Stop stop;

    @NotNull(message = "Position is required")
    @Min(value = 0, message = "Position must be non-negative")
    @Column(nullable = false)
    private Integer position;

    /** GTFS {@code stop_headsign}. The destination text shown on the
     *  vehicle's roller display at this specific stop, which can differ
     *  from the trip's overall {@code trip_headsign} on lines whose
     *  public destination changes mid-route (loop services, terminus
     *  short-running, branching). Null when the feed doesn't override
     *  the trip-level headsign. */
    @jakarta.validation.constraints.Size(max = 100)
    @Column(name = "stop_headsign", length = 100)
    private @Nullable String stopHeadsign;

}
