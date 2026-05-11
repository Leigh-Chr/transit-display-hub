package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.transit.hub.domain.model.Location;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;

/**
 * Reads GTFS-flex {@code locations.geojson} and replaces the {@link Location} table
 * on every import. Each top-level GeoJSON Feature is one polygonal pickup/dropoff
 * zone; the raw geometry is stored as TEXT alongside a pre-computed bounding box
 * for fast browsing.
 *
 * <p>JTS / Hibernate Spatial intentionally avoided — see ADR 0026.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LocationImporter {

    private final LocationRepository locationRepository;

    /** Jackson mapper reused across features (thread-safe after construction). */
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Wipes the locations table and re-imports from {@code locations.geojson}.
     * Absent file is silently skipped.
     */
    public void importLocations(Path locationsFile) throws IOException {
        locationRepository.deleteAllInBatch();
        locationRepository.flush();

        if (!Files.exists(locationsFile)) {
            log.info("GTFS import: locations.geojson missing, skipping");
            return;
        }

        JsonNode root = mapper.readTree(locationsFile.toFile());
        JsonNode features = root.get("features");
        if (features == null || !features.isArray() || features.isEmpty()) {
            log.info("GTFS import: locations.geojson has no features, skipping");
            return;
        }

        int persisted = 0;
        int skipped = 0;
        for (JsonNode feature : features) {
            JsonNode geom = feature.get("geometry");
            JsonNode props = feature.get("properties");
            if (geom == null || !geom.has("type") || !geom.has("coordinates")) {
                skipped++;
                continue;
            }
            String externalId = feature.has("id") ? feature.get("id").asText() :
                    (props != null && props.has("id") ? props.get("id").asText() : null);
            if (isBlank(externalId)) {
                skipped++;
                continue;
            }
            String stopExternalId = props != null && props.has("stop_id")
                    ? props.get("stop_id").asText() : null;
            // The current GTFS-flex spec stores the human-readable name
            // under `properties.name`. Older feeds (and the original
            // Mobility-Data fixture set) used `stop_name`. Try both so
            // we work with feeds that haven't yet migrated.
            String name = null;
            if (props != null) {
                if (props.has("name") && !props.get("name").isNull()) {
                    name = props.get("name").asText();
                } else if (props.has("stop_name") && !props.get("stop_name").isNull()) {
                    name = props.get("stop_name").asText();
                }
            }
            String geomType = geom.get("type").asText();

            double[] bbox = computeBoundingBox(geom.get("coordinates"));
            Location loc = Location.builder()
                    .externalId(truncate(externalId, 100))
                    .stopExternalId(truncate(stopExternalId, 100))
                    .name(truncate(name, 200))
                    .geometryType(truncate(geomType, 30))
                    .geometryJson(mapper.writeValueAsString(geom))
                    .minLatitude(Double.isNaN(bbox[0]) ? null : bbox[0])
                    .minLongitude(Double.isNaN(bbox[1]) ? null : bbox[1])
                    .maxLatitude(Double.isNaN(bbox[2]) ? null : bbox[2])
                    .maxLongitude(Double.isNaN(bbox[3]) ? null : bbox[3])
                    .build();
            locationRepository.save(loc);
            persisted++;
        }
        if (skipped > 0) {
            log.warn("GTFS import: skipped {} locations.geojson features (missing id or geometry)", skipped);
        }
        log.info("GTFS import: {} locations.geojson features persisted", persisted);
    }

    /** Walks any GeoJSON coordinates array (Polygon, MultiPolygon, …)
     *  recursively and returns {@code [minLat, minLon, maxLat, maxLon]}.
     *  GeoJSON convention is {@code [longitude, latitude]} per coordinate
     *  pair. Returns four {@code NaN} slots if the structure is malformed. */
    private double[] computeBoundingBox(JsonNode coordinates) {
        double[] box = {Double.MAX_VALUE, Double.MAX_VALUE, -Double.MAX_VALUE, -Double.MAX_VALUE};
        walkCoordinates(coordinates, box);
        if (box[0] == Double.MAX_VALUE) {
            return new double[]{Double.NaN, Double.NaN, Double.NaN, Double.NaN};
        }
        return box;
    }

    private void walkCoordinates(JsonNode node, double[] box) {
        if (node == null || !node.isArray() || node.isEmpty()) { return; }
        JsonNode head = node.get(0);
        if (head != null && head.isNumber() && node.size() >= 2) {
            // Leaf coordinate pair: [lon, lat] (GeoJSON convention).
            double lon = node.get(0).asDouble();
            double lat = node.get(1).asDouble();
            box[0] = Math.min(box[0], lat);
            box[1] = Math.min(box[1], lon);
            box[2] = Math.max(box[2], lat);
            box[3] = Math.max(box[3], lon);
            return;
        }
        for (JsonNode child : node) {
            walkCoordinates(child, box);
        }
    }
}
