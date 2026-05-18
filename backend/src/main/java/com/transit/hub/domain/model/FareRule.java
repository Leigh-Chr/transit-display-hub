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
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

/**
 * Mirrors a row of GTFS {@code fare_rules.txt} (Fares v1). Each row
 * declares the conditions under which the parent {@link FareAttribute}
 * applies: which {@link Line route}, and / or which origin / destination
 * / contains fare zones (raw GTFS zone ids — we don't model
 * {@code stops.zone_id} as an entity yet).
 * <p>
 * All four conditional columns are optional — a row with only
 * {@code fareAttribute} set means the fare applies to every trip in
 * the feed. Multiple rules under the same fare describe alternative
 * matching paths.
 */
@Entity
@Table(name = "fare_rules",
       indexes = {
           @Index(name = "idx_fare_rule_attribute", columnList = "fare_attribute_id"),
           @Index(name = "idx_fare_rule_route", columnList = "route_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fare_attribute_id", nullable = false)
    private FareAttribute fareAttribute;

    /** Optional route the rule restricts the fare to. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_id")
    private @Nullable Line route;

    /** GTFS {@code origin_id} — raw zone id. */
    @Size(max = 100)
    @Column(name = "origin_id", length = 100)
    private @Nullable String originId;

    /** GTFS {@code destination_id} — raw zone id. */
    @Size(max = 100)
    @Column(name = "destination_id", length = 100)
    private @Nullable String destinationId;

    /** GTFS {@code contains_id} — zone the trip must traverse. */
    @Size(max = 100)
    @Column(name = "contains_id", length = 100)
    private @Nullable String containsId;
}
