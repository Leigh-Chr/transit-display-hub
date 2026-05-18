package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
 * GTFS Fares v2 {@code fare_leg_join_rules.txt}. The canonical spec
 * keys a rule by ({@code leg_group_id}, {@code leg_sequence}) — two
 * consecutive legs join into one fare leg when their group and
 * sequence match. The legacy MobilityData layout
 * (from_network/to_network/from_stop/to_stop) is still produced by
 * a few feeds; we keep both and prefer canonical when present.
 */
@Entity
@Table(name = "fare_leg_join_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareLegJoinRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Canonical spec key: references {@code fare_leg_rules.leg_group_id}. */
    @Column(name = "leg_group_id", length = 100)
    private @Nullable String legGroupId;

    /** Canonical spec key: 1-based incremental position of this leg
     *  within its leg-group. */
    @Column(name = "leg_sequence")
    private @Nullable Integer legSequence;

    /** Canonical spec field: max minutes since the preceding trip's
     *  alighting after which the join no longer applies. Required by
     *  the spec when {@code legSequence > 1}. */
    @Column(name = "preceding_trip_transfer_limit")
    private @Nullable Integer precedingTripTransferLimit;

    /** Legacy column (pre-2024 layout). */
    @Column(name = "from_network_id", length = 100)
    private @Nullable String fromNetworkId;

    /** Legacy column (pre-2024 layout). */
    @Column(name = "to_network_id", length = 100)
    private @Nullable String toNetworkId;

    /** Legacy column (pre-2024 layout). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_stop_id")
    private @Nullable Stop fromStop;

    /** Legacy column (pre-2024 layout). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_stop_id")
    private @Nullable Stop toStop;
}
