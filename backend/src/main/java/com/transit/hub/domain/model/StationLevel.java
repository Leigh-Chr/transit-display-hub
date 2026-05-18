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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

/**
 * Mirrors a row of GTFS {@code levels.txt}. A {@code StationLevel}
 * identifies a floor inside a station (mezzanine = 0, platform = -1,
 * concourse = 1, etc.) so {@link Pathway}s can label which level they
 * connect.
 * <p>
 * The parent stop is the station ({@code location_type = 1}) the level
 * belongs to. The {@code level_index} is monotonic within a station
 * (negative = below ground), {@code level_name} is a passenger-facing
 * label like "Platform 1" or "Concourse".
 */
@Entity
@Table(name = "station_levels",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_station_level_external_id",
           columnNames = {"external_id"}),
       indexes = {
           @Index(name = "idx_station_level_parent", columnList = "parent_stop_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationLevel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS {@code level_id}. Stable across re-imports. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", length = 100, nullable = false, unique = true)
    private String externalId;

    /** Station this level belongs to. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_stop_id")
    private @Nullable Stop parentStop;

    /** GTFS {@code level_index}. Negative for underground levels. */
    @Column(name = "level_index", nullable = false)
    private double levelIndex;

    /** GTFS {@code level_name}. Passenger-facing label, e.g. "Platform 1". */
    @Size(max = 100)
    @Column(name = "level_name", length = 100)
    private @Nullable String levelName;
}
