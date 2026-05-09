package com.transit.hub.domain.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;

/**
 * Plain Java ray-casting implementation for "is this point inside the
 * polygon" on a GTFS-flex {@code geometry} JSON blob.
 *
 * <p>Why no dependency: the in-memory point-in-polygon check is cheap
 * (a few hundred nanoseconds for a typical zone outline) and the GTFS
 * spec only allows {@code Polygon} and {@code MultiPolygon}. Pulling
 * JTS Topology Suite (1.5 MB) just for this single operation would
 * supersede ADR 0026 — the cost / benefit doesn't add up while the
 * call sites stay this narrow. If a future surface needs proper
 * spatial queries (find all zones within X km, area / intersection /
 * union, geodesic distance), that's the right time to migrate.
 *
 * <p>The ray-casting algorithm is a textbook even-odd test: a
 * horizontal ray from the test point crosses the polygon boundary an
 * odd number of times when the point is inside. Holes (interior rings
 * in a {@code Polygon}) are handled because the ray flips its inside /
 * outside flag at every ring crossing. {@code MultiPolygon} aggregates
 * with logical OR over the constituent polygons.
 */
public final class PolygonContains {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private PolygonContains() {}

    /**
     * @param geometryJson raw GeoJSON {@code geometry} object as a JSON
     *                     string. Either {@code Polygon} or
     *                     {@code MultiPolygon}; anything else returns
     *                     {@code false}.
     * @param lat          target latitude.
     * @param lon          target longitude.
     * @return whether the point lies inside the polygon (or any
     *         constituent polygon of a MultiPolygon).
     */
    public static boolean contains(String geometryJson, double lat, double lon) {
        if (geometryJson == null || geometryJson.isBlank()) {
            return false;
        }
        JsonNode root;
        try {
            root = MAPPER.readTree(geometryJson);
        } catch (IOException e) {
            return false;
        }
        String type = root.path("type").asText("");
        JsonNode coordinates = root.path("coordinates");
        return switch (type) {
            case "Polygon" -> polygonContains(coordinates, lon, lat);
            case "MultiPolygon" -> multiPolygonContains(coordinates, lon, lat);
            default -> false;
        };
    }

    private static boolean multiPolygonContains(JsonNode polygons, double x, double y) {
        if (polygons == null || !polygons.isArray()) {
            return false;
        }
        for (JsonNode poly : polygons) {
            if (polygonContains(poly, x, y)) {
                return true;
            }
        }
        return false;
    }

    /**
     * GeoJSON {@code Polygon} coordinates: array of linear rings,
     * outer ring first, every subsequent ring is a hole. The point is
     * inside the polygon iff it's inside the outer ring AND not inside
     * any hole.
     */
    private static boolean polygonContains(JsonNode rings, double x, double y) {
        if (rings == null || !rings.isArray() || rings.size() == 0) {
            return false;
        }
        if (!ringContains(rings.get(0), x, y)) {
            return false;
        }
        for (int i = 1; i < rings.size(); i++) {
            if (ringContains(rings.get(i), x, y)) {
                return false;  // inside a hole
            }
        }
        return true;
    }

    /**
     * Even-odd ray-cast on a single ring. The ring is a list of
     * {@code [lon, lat]} pairs; the test ray runs east. Edge cases
     * (the point sitting exactly on an edge) are intentionally
     * resolved as "inside" only when the edge is traversed top-to-
     * bottom, which keeps the count consistent on shared edges between
     * adjacent rings.
     */
    private static boolean ringContains(JsonNode ring, double x, double y) {
        if (ring == null || !ring.isArray() || ring.size() < 3) {
            return false;
        }
        boolean inside = false;
        int n = ring.size();
        for (int i = 0, j = n - 1; i < n; j = i++) {
            JsonNode pi = ring.get(i);
            JsonNode pj = ring.get(j);
            if (pi == null || pj == null
                    || !pi.isArray() || pi.size() < 2
                    || !pj.isArray() || pj.size() < 2) {
                continue;
            }
            double xi = pi.get(0).asDouble();
            double yi = pi.get(1).asDouble();
            double xj = pj.get(0).asDouble();
            double yj = pj.get(1).asDouble();
            boolean intersect = ((yi > y) != (yj > y))
                    && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) {
                inside = !inside;
            }
        }
        return inside;
    }
}
