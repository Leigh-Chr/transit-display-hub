# ADR 0014 — Persisting GTFS shapes for future map views

**Status:** Superseded by V53 (2026-05-18). The "future shapes-aware
map view" referenced below never materialised: the schematic map is
topological by design (Leaflet / octolinear renderers were considered
and rejected — see project doctrine), and no other consumer ever read
the persisted rows. The admin viewer at `/admin/shapes` was the sole
client of the data and the dedicated `GET /api/itineraries/{id}/shape`
endpoint. V53__drop_shapes.sql removes the `shapes` / `shape_points`
tables and the `itineraries.shape_id` column; the importer no longer
parses `shapes.txt`. The body below is preserved for historical
context only.

---

**Original status:** Accepted

## Context

GTFS {@code shapes.txt} encodes the actual geographic path a vehicle
follows along its route as an ordered sequence of latitude /
longitude points. The kiosk and the network map currently render
routes schematically — straight lines from stop to stop — so we
ignored shapes entirely until Phase 2.1.

Two pressures pushed us to persist them now even though no consumer
needs them yet:

1. **Schema lead time.** A shapes-aware map view (Leaflet, Mapbox)
   takes a frontend phase of its own. Having the data ready in the
   API removes a "wait, the backend has to ship the data first"
   round-trip.
2. **Idempotent import was already touching `Itinerary`.** Phase 0.5c
   restructured `importItineraries()` to upsert by `external_id`;
   wiring shapes into the same loop was a small marginal cost
   instead of a separate refactor later.

## Decision

**Persist `shapes.txt` as `Shape` + `ShapePoint` entities. Link from
`Itinerary.shape` via the representative trip's `shape_id`. Expose a
public read-only endpoint at `GET /api/itineraries/{id}/shape`.**

### 1. Domain model

- `Shape` — `external_id` (= GTFS `shape_id`), `OneToMany` of
  `ShapePoint`s with `@OrderBy("sequence ASC")`.
- `ShapePoint` — `shape` FK, `sequence` (int), `latitude`,
  `longitude`, optional `dist_traveled`. Unique on
  `(shape_id, sequence)` so a malformed feed surfaces immediately
  rather than silently producing a twisted polyline.
- `Itinerary.shape` — nullable `ManyToOne`. Null = "feed didn't ship
  a shape for this trip", consumer falls back to stop-to-stop.

### 2. Migration V28

Single migration adds both tables plus the FK column. ON DELETE
behaviour:

- `shape_points.shape_id` cascades — orphan points make no sense.
- `itineraries.shape_id` `SET NULL` so dropping a shape during
  re-import doesn't take itineraries with it.

### 3. Import pipeline

`importShapes()` runs after the stops import and before
`importItineraries()`:

1. Wipes both `shapes` and `shape_points` tables. Cascade through the
   FK clears the points; `itineraries.shape_id` falls to NULL via
   the migration's ON DELETE SET NULL — `importItineraries()` sets
   them again immediately after.
2. Reads `shapes.txt`, accumulates points in a per-shape list.
3. Sorts each list by `shape_pt_sequence` (the spec doesn't
   guarantee the rows arrive ordered) and dedupes consecutive
   sequence numbers (rare malformed feeds repeat them).
4. Persists the parent `Shape` once with the cascade picking up the
   children.

`importItineraries()` reads the trip's `shape_id` from `trips.txt`
(via the extended `TripInfo` record) and looks up the corresponding
`Shape`. The lookup is null-safe: feeds without `shapes.txt`
silently produce itineraries with no shape FK, which the future map
view interprets as "fall back to stop-to-stop lines".

### 4. Endpoint shape

`GET /api/itineraries/{id}/shape`:

- 200 with `{id, externalId, points: [{lat, lon, distTraveled?}]}` —
  the polyline.
- 204 No Content when the itinerary exists but has no shape (rather
  than 404, which would imply the itinerary is missing).
- 404 when the itinerary id is unknown.

The endpoint reuses the public read-only auth tier already declared
for `/api/itineraries/**` GETs. Anonymous kiosks and the
network-map view read it without a login.

## Why no Douglas-Peucker simplification yet

Real feeds ship dense shapes — a single urban bus route can carry
500–2,000 points. A naive client rendering would push 30k+ points
across a network with 50 routes. Douglas-Peucker would cut that by
80–90 % at no visible quality cost.

We deferred it because:

1. **No consumer yet.** Without a map view, there's nothing to
   profile. Premature optimisation would lock us into an epsilon
   the future renderer might disagree with.
2. **Server-side simplification can be added at the endpoint.** The
   endpoint can accept a `?epsilon=` query param and run Douglas-
   Peucker on demand without touching the persisted points.

When the map view lands, we'll measure first and add simplification
to the endpoint (not the import) so we keep the high-fidelity
polyline available for analytics.

## Why we anchor `Itinerary.shape` on the representative trip

GTFS associates `shape_id` with `trips`, not with
`(route, direction)`. Different trips of the same route can ship
different shapes (loop variants, terminus short-running). Our
`Itinerary` is `(route, direction)`-grained, so we have to pick.

We use the representative trip's shape — the same trip whose stops
we already use to build the itinerary's stop list. This guarantees
the polyline aligns with the stops shown in the kiosk schedule
dialog, which is the visual integration most users will care about.
The ~5 % of routes whose variants have meaningfully different shapes
will look "approximately right" but not pixel-perfect; we accept
that until a per-variant model becomes worth the cost.

## Trade-offs accepted

- **No simplification.** Endpoint payloads can be fat for dense
  feeds. Acceptable until a renderer exists.
- **No per-variant shapes.** One shape per `(route, direction)`,
  matching the rest of the itinerary model. Routes with multiple
  shape variants accept the representative-trip pick.
- **Re-import wipes shapes.** Same pattern as service calendars and
  fares: simpler than a diff-based update; the orchestrator skips
  the import when the feed SHA hasn't changed, so this only fires
  on real updates.
