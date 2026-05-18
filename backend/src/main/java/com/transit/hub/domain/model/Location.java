package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
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
 * One feature of GTFS-flex {@code locations.geojson}. Each row carries
 * a polygon (or MultiPolygon) describing a flexible-trip pickup or
 * dropoff zone. The geometry is persisted as raw GeoJSON in
 * {@link #geometryJson} alongside its type and a pre-computed
 * bounding box so the admin browser and (eventually) the kiosk popup
 * can render it without parsing the JSON on the request path.
 *
 * <p>The reference to the trip side stays loose: GTFS-flex points
 * {@code stop_times.stop_id} at the location's external id, and the
 * importer keeps that as a string in {@link #stopExternalId}. We
 * don't FK to {@code stops} because the location can be referenced
 * even without a Stop row of the same id (the spec allows
 * location-only stops).
 *
 * <p>See ADR 0026 for why we deliberately skip JTS / Hibernate Spatial.
 */
@Entity
@Table(name = "locations",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_location_external_id", columnNames = "external_id"),
       indexes = @Index(name = "idx_location_stop_external_id",
                        columnList = "stop_external_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS-flex location id. Unique per feed. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", length = 100, nullable = false)
    private String externalId;

    /** Optional GTFS stop_id this location represents. The flexible-trip
     *  side of the spec lets stop_times point at either a regular Stop
     *  or a location, so this field is nullable. */
    @Size(max = 100)
    @Column(name = "stop_external_id", length = 100)
    private @Nullable String stopExternalId;

    /** Human-readable name pulled from {@code feature.properties.stop_name}
     *  when the feed publishes one. */
    @Size(max = 200)
    @Column(length = 200)
    private @Nullable String name;

    /** GeoJSON geometry type ({@code "Polygon"} or {@code "MultiPolygon"})
     *  cached so admin queries can group / filter without parsing JSON. */
    @NotBlank
    @Size(max = 30)
    @Column(name = "geometry_type", length = 30, nullable = false)
    private String geometryType;

    /** Raw GeoJSON {@code geometry} object as a JSON string. Persisted as
     *  TEXT rather than a JTS geometry: today's only consumer is the
     *  admin browser (display the polygon) and the eventual kiosk popup
     *  (render the zone), neither of which needs spatial-index queries.
     *  Keeping the column as TEXT means no JTS / Hibernate Spatial / PostGIS
     *  dependency footprint. */
    @NotBlank
    @Column(name = "geometry_json", nullable = false, columnDefinition = "TEXT")
    private String geometryJson;

    @Column(name = "min_latitude")
    private @Nullable Double minLatitude;

    @Column(name = "min_longitude")
    private @Nullable Double minLongitude;

    @Column(name = "max_latitude")
    private @Nullable Double maxLatitude;

    @Column(name = "max_longitude")
    private @Nullable Double maxLongitude;
}
