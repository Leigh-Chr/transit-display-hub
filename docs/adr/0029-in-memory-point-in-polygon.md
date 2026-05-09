# ADR 0029 — In-memory point-in-polygon for `locations.geojson`

**Status:** Accepted

## Context

The admin UI and the future passenger trip planner want to answer
"which TAD zones cover this address?" — a `find_containing_polygons(lat, lon)`
query.

ADR 0026 was written before that surface existed and accepted the
trade-off of "no spatial-index queries", with a note that JTS + Hibernate
Spatial + PostGIS would be added when the need arose. Now that the need
is concrete, we have to pick: do we actually adopt the heavy stack, or
is there a lighter answer?

The realistic load profile:
- 5–20 zones per imported feed (M Réso ships zero today; published
  GTFS-flex feeds in France carry between 1 and ~10).
- Query rate: occasional admin diagnostics, plus an eventual
  passenger trip planner whose call rate is bounded by the kiosk
  refresh cadence (< 10 req/s aggregate).
- Polygon shapes: typically a single outer ring with 5–50 vertices,
  sometimes a MultiPolygon for split service areas.

Adopting JTS + Hibernate Spatial + PostGIS for that volume is overkill:
- Build classpath grows ~3 MB.
- Production database needs the PostGIS extension installed and
  Flyway scripts to create the `geometry` column.
- H2 dev needs H2GIS or a separate code path to keep the dev / prod
  parity ADR 0021 cares about.

## Decision

**Keep ADR 0026 intact (no JTS, no Hibernate Spatial).** Add a
hand-rolled point-in-polygon helper, `PolygonContains`, that operates
directly on the GeoJSON string already persisted in `geometry_json`,
and use it in two steps:

1. **SQL bbox pre-filter.** `LocationRepository.findByBoundingBoxContaining(lat, lon)`
   uses the existing min / max columns from V35. Indexable, four
   numeric comparisons, runs as a regular JPA query.
2. **Java ray-cast on each candidate.** Even-odd ray-casting on the
   parsed GeoJSON, with hole support (interior rings flip the
   inside / outside flag) and `MultiPolygon` aggregation. Works on
   anything Jackson can parse.

Public surface: `GET /api/admin/locations/contains?lat=X&lon=Y`,
admin-gated like the rest of `/api/admin/locations`.

```java
public List<LocationResponse> findContainingPoint(double lat, double lon) {
    return locationRepository.findByBoundingBoxContaining(lat, lon).stream()
            .filter(loc -> PolygonContains.contains(loc.getGeometryJson(), lat, lon))
            .map(LocationResponse::from)
            .toList();
}
```

## Consequences

- **ADR 0026 stays valid.** The persistence model (`geometry_json TEXT`
  + bbox columns) doesn't change. No migration. No new dependency.
- **Cost shape.** The bbox pre-filter eliminates ~99 % of candidates
  on a feed where most zones don't cover the input point; the
  ray-cast then runs on ≤ 20 polygons of ≤ 50 vertices each. Total
  cost is dominated by JSON parsing (~50 µs per polygon) — comparable
  to one Hibernate query, well below any human-perceptible latency.
- **No DB-side spatial index.** A query on a feed with 100 k zones
  would need to scan 100 k rows for the bbox filter — not realistic
  on the data shapes we serve. If a future feed actually publishes
  thousands of zones, that's the trigger to revisit and adopt JTS;
  this ADR will be marked `Status: Superseded by NNNN` then.
- **Edge cases handled.** Holes (interior rings of a `Polygon`) are
  supported. `MultiPolygon` is supported. Malformed JSON degrades
  gracefully (returns false). Unsupported geometry types
  (`LineString`, `Point`) return false rather than throwing.
- **Tested in two layers.** `PolygonContainsTest` covers the
  geometric algorithm with concrete coordinate fixtures
  (square, donut, two disjoint squares, malformed JSON). The
  `LocationControllerIntegrationTest` covers the SQL pre-filter +
  Java ray-cast round-trip with a deliberately L-shaped polygon
  whose bbox is loose (the bbox accepts a corner-of-bbox point that
  the polygon rejects), proving the two-step pipeline does narrow
  the result correctly.
