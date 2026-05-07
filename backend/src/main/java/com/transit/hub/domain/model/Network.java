package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * GTFS Fares v2 {@code networks.txt} — a named bundle of routes used
 * to scope {@link FareLegRule} matching ("this product applies to the
 * metro network only"). The M2M with {@link Line} is loaded lazily.
 *
 * The {@code network_id} string on {@code fare_leg_rules.network_id}
 * stays as a raw column rather than a FK so v2 imports don't have to
 * gate on networks being persisted first.
 */
@Entity
@Table(name = "networks",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_network_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Network {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "external_id", nullable = false, length = 100)
    private String externalId;

    @Column(name = "name", length = 200)
    private String name;

    @ManyToMany
    @JoinTable(
        name = "route_networks",
        joinColumns = @JoinColumn(name = "network_id"),
        inverseJoinColumns = @JoinColumn(name = "route_id"))
    @Builder.Default
    private Set<Line> routes = new HashSet<>();
}
