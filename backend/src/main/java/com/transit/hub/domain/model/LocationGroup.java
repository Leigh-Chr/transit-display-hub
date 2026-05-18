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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Mirrors GTFS {@code location_groups.txt} + {@code location_group_stops.txt}.
 * A location group bundles several stops (or whole zones) that a
 * demand-responsive service treats as one pickup / drop-off
 * destination — typical for rural TAD: "ride between any of the 12
 * villages on this route".
 * <p>
 * Stops are linked through a many-to-many; the spec also allows
 * referencing entries from {@code locations.geojson}, but we don't
 * model the GeoJSON variant in this phase.
 */
@Entity
@Table(name = "location_groups",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_location_group_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", length = 100, nullable = false, unique = true)
    private String externalId;

    /** Optional human-readable name (e.g. "All villages, North route"). */
    @Size(max = 200)
    @Column(name = "group_name", length = 200)
    private @Nullable String groupName;

    @ManyToMany
    @JoinTable(name = "location_group_stops",
            joinColumns = @JoinColumn(name = "location_group_id"),
            inverseJoinColumns = @JoinColumn(name = "stop_id"))
    @Builder.Default
    private Set<Stop> stops = new HashSet<>();
}
