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
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

/**
 * Mirrors GTFS {@code transfers.txt}. A row says "to interchange between
 * {@code fromStop} and {@code toStop}, the connection takes
 * {@code minTransferTime} seconds (or is timed/unavailable depending on
 * {@code transferType})".
 * <p>
 * Replaces the magic {@code TRANSFER_COST = 10000} the route-finder used
 * to apply uniformly: in a real station, a same-platform transfer is
 * near-zero while a cross-quay transfer can take 8 minutes. The frontend
 * Dijkstra now weighs each transfer with its actual cost.
 */
@Entity
@Table(name = "transfers",
       indexes = {
           @Index(name = "idx_transfer_from", columnList = "from_stop_id"),
           @Index(name = "idx_transfer_to", columnList = "to_stop_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transfer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_stop_id", nullable = false)
    private Stop fromStop;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_stop_id", nullable = false)
    private Stop toStop;

    /**
     * GTFS {@code transfer_type}:
     * 0 = recommended, 1 = timed (synced services), 2 = minimum time required,
     * 3 = transfer not possible.
     */
    @Column(name = "transfer_type", nullable = false)
    private short transferType;

    /** Minimum time in seconds. Only meaningful for type 2 in the GTFS spec,
     *  but feeds frequently populate it for types 0/1 too — we store
     *  whatever the feed provides. */
    @Column(name = "min_transfer_time")
    private @Nullable Integer minTransferTime;

    /** Optional GTFS route qualifier: when set, the rule only applies
     *  to transfers leaving services on this route. Stored as the raw
     *  external_id so callers can join through Line.external_id when
     *  needed. */
    @Column(name = "from_route_id", length = 100)
    private @Nullable String fromRouteId;

    @Column(name = "to_route_id", length = 100)
    private @Nullable String toRouteId;

    /** Optional GTFS trip qualifier: scope the rule to a specific trip
     *  pair (used by feeds that synchronise particular runs). */
    @Column(name = "from_trip_id", length = 100)
    private @Nullable String fromTripId;

    @Column(name = "to_trip_id", length = 100)
    private @Nullable String toTripId;
}
