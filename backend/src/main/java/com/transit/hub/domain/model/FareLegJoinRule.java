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

import java.util.UUID;

/**
 * GTFS Fares v2 {@code fare_leg_join_rules.txt} — declares that two
 * consecutive legs matching on (from network/stop → to network/stop)
 * collapse into a single fare leg. Used by trip-planner fare logic
 * to model free transfers within a multi-operator network.
 *
 * Rare; persisted for completeness so a fare-aware future surface
 * doesn't have to re-parse the GTFS feed.
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

    @Column(name = "from_network_id", length = 100)
    private String fromNetworkId;

    @Column(name = "to_network_id", length = 100)
    private String toNetworkId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_stop_id")
    private Stop fromStop;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_stop_id")
    private Stop toStop;
}
