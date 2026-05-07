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
 * GTFS Fares v2 {@code fare_leg_rules.txt} — declares which
 * {@link FareProduct} applies to a leg matching the (network, from
 * area, to area, time window) tuple. The {@code legGroupId} ties
 * multiple rules together so {@link FareTransferRule} can reference
 * them by name.
 *
 * {@code networkId} stays as a raw string until {@code networks.txt}
 * gets imported — when that happens, the column promotes to a
 * proper FK.
 */
@Entity
@Table(name = "fare_leg_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareLegRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "leg_group_id", length = 100)
    private String legGroupId;

    @Column(name = "network_id", length = 100)
    private String networkId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_area_id")
    private Area fromArea;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_area_id")
    private Area toArea;

    @Column(name = "from_timeframe_group_id", length = 100)
    private String fromTimeframeGroupId;

    @Column(name = "to_timeframe_group_id", length = 100)
    private String toTimeframeGroupId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fare_product_id")
    private FareProduct fareProduct;

    @Column(name = "rule_priority")
    private Integer rulePriority;
}
