package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
import org.jspecify.annotations.Nullable;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * GTFS Fares v2 {@code areas.txt} — a named set of stops used as
 * origin / destination boundaries by {@link FareLegRule}. The M2M
 * with {@link Stop} is loaded lazily because feeds can ship areas
 * containing thousands of stops.
 */
@Entity
@Table(name = "areas",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_area_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Area {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS {@code area_id} — Required per spec. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", nullable = false, length = 100)
    private String externalId;

    @Column(name = "name", length = 200)
    private @Nullable String name;

    @ManyToMany
    @JoinTable(
        name = "stop_areas",
        joinColumns = @JoinColumn(name = "area_id"),
        inverseJoinColumns = @JoinColumn(name = "stop_id"))
    @Builder.Default
    private Set<Stop> stops = new HashSet<>();
}
