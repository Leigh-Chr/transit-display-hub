# ADR 0026 — Persist `locations.geojson` as TEXT, no JTS / Hibernate Spatial

**Status:** Accepted (extended by ADR 0029 — point-in-polygon support
landed without invalidating the storage decision). **Amended 2026-05-18**:
the `/api/admin/locations` browse + `/contains` endpoints (and the
`LocationControllerIntegrationTest`) were dropped along with the
admin TAD viewer; the storage decision below stays valid for the
popup-side `LocationService.findByStop` which still reads the persisted
geometry through `NetworkMapController`.

## Context

GTFS-flex publishes `locations.geojson` — a FeatureCollection where
each Feature is a polygonal pickup or dropoff zone for a
demand-responsive (TAD) trip. Each Feature carries a polygon (or
MultiPolygon) plus a `stop_id` property that ties it back to the
flexible side of `stop_times.txt`.

Today's known consumers:
- the admin browser will surface the polygons in a list view (one row
  per zone, with bbox + raw geometry)
- a future kiosk popup may render the zone outline so a passenger
  understands where the on-demand trip will pick them up

Neither consumer needs spatial queries (`ST_Contains`,
`ST_Intersects`, `ST_DWithin` …). They only need to fetch the polygon
back unchanged and let the front-end render it with Leaflet / Mapbox.

The ergonomic JVM stack for spatial data is JTS Topology Suite +
Hibernate Spatial. Adopting it means:
- `org.locationtech.jts:jts-core` runtime jar (~1.5 MB)
- `org.hibernate.orm:hibernate-spatial` to serialise `Geometry` columns
- PostGIS extension on the prod database
- a non-portable column type (`geometry(Polygon, 4326)`) that H2 dev
  can't validate without an extension we'd have to bundle

For a feature with no spatial-query consumer, that's a heavy commitment.

## Decision

**Persist the raw GeoJSON `geometry` object as a TEXT column.** Add a
pre-computed bounding box (min/max lat/lon) so the admin browser can
sort / filter without parsing JSON, and rely on Jackson (already in
the classpath) to read the file at import time.

### Schema (V35)

```sql
CREATE TABLE locations (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    stop_external_id VARCHAR(100),
    name VARCHAR(200),
    geometry_type VARCHAR(30) NOT NULL,
    geometry_json TEXT NOT NULL,
    min_latitude DOUBLE PRECISION,
    min_longitude DOUBLE PRECISION,
    max_latitude DOUBLE PRECISION,
    max_longitude DOUBLE PRECISION
);
```

### Importer

```java
JsonNode root = mapper.readTree(locationsFile.toFile());
for (JsonNode feature : root.get("features")) {
    JsonNode geom = feature.get("geometry");
    double[] bbox = computeBoundingBox(geom.get("coordinates"));
    locationRepository.save(Location.builder()
        .externalId(...)
        .stopExternalId(props.get("stop_id").asText())
        .geometryType(geom.get("type").asText())
        .geometryJson(mapper.writeValueAsString(geom))
        .minLatitude(...).maxLatitude(...)...
        .build());
}
```

Bounding box is computed in one recursive walk over the coordinates
tree — works uniformly for `Polygon`, `MultiPolygon`, the rare nested
shapes some feeds publish.

## Consequences

- **Zero new runtime dependency.** Jackson is already used everywhere.
  Build classpath stays as-is; the prod Postgres image doesn't need
  PostGIS.
- **Portable across H2 (dev) and PostgreSQL (prod).** `TEXT` and
  `DOUBLE PRECISION` are SQL-92 staples; no extension required.
- **Front-end keeps full geometry control.** GeoJSON is the lingua
  franca of web-mapping libraries — Leaflet / Mapbox / OpenLayers
  all accept it raw, no client-side conversion needed.
- **Loss: no spatial queries today.** When (if) we need
  "find all locations within X km of a point" or "which zones contain
  this lat/lon", we'll add JTS + Hibernate Spatial then. The bbox
  columns are forward-compatible — we can still pre-filter by bbox
  before the spatial query. ADR 0026 will be marked
  `Status: Superseded by NNNN` at that point.
- **Loss: no DB-level geometry validation.** A malformed polygon
  stored here won't be caught until the front-end tries to render it.
  Acceptable for an admin-only browse — a real passenger surface would
  validate at import time before reaching here.
- **Tests stay light.** No PostGIS image to spin up for integration
  tests; the popup-side test path (`StopPopupControllerIntegrationTest`
  hitting `/api/network-map/stops/{id}/tad-zone`) writes the geometry
  string directly and asserts shape on the way out.
