package com.transit.hub.domain.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

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
}
