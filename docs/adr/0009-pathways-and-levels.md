# ADR 0009 — Persisting station levels and pathways

**Status:** Accepted. **Amended 2026-05-18**: the dedicated admin
viewer at `/admin/pathways` and its `GET /api/stops/{stopId}/pathways`
endpoint (section 4) were dropped — the network-map stop-popup already
surfaces the station's indoor topology through `<app-pathway-list>`
backed by `PathwayService.findStationGraphForStop()`. The storage
layer (entities, repository, importer) and the level/pathway data
flow into the popup are unchanged.

## Context

Inside a hub station, passengers move between platforms, concourses,
mezzanines and exits via a graph of stairs, escalators, lifts and
walkways. GTFS encodes this graph in two files:

- `levels.txt` — floors of a station, identified by a `level_id`,
  ordered by `level_index` (negative = underground), with an optional
  human-readable `level_name`.
- `pathways.txt` — directed edges between two stops with a
  `pathway_mode` (1..7: walkway, stairs, escalator, lift, etc.), an
  optional `traversal_time`, accessibility hints (`max_slope`,
  `min_width`, `stair_count`) and signpost text.

Until Phase 5.1 we ignored both files. The hub display already exposes
`platform_code` (Phase 1.3 light) so passengers can locate their quay,
but the connectivity between platforms — "lift on the right", "stairs
to mezzanine", "60 s to the eastern exit" — wasn't available anywhere.

## Decision

**Persist `levels.txt` and `pathways.txt` as-is, expose pathways via a
per-stop REST endpoint.** No display surfacing yet — the goal is to
make the data available so the next phase (a hub-level accessibility
filter, or a future indoor router) can build on top of it.

### 1. Domain model

Two entities:

- `StationLevel` — `external_id` (= GTFS `level_id`), optional
  `parent_stop` FK, `level_index` (double, monotonic per station),
  `level_name`. Unique on `external_id` so re-imports update in place.
- `Pathway` — `external_id` (= `pathway_id`), `fromStop` and `toStop`
  FKs, `pathway_mode` enum (`WALKWAY` / `STAIRS` /
  `MOVING_SIDEWALK` / `ESCALATOR` / `ELEVATOR` / `FARE_GATE` /
  `EXIT_GATE`), `is_bidirectional`, plus the optional measurement
  fields (`length_metres`, `traversal_time_seconds`, `stair_count`,
  `max_slope`, `min_width_metres`) and signpost strings.

`PathwayMode` is an enum (`ServiceExceptionType` precedent from
Phase 1.4) rather than a `short`: the values are stable (the spec
hasn't changed since GTFS-Pathways landed in 2019) and a string
column reads clearly in DB dumps.

### 2. Migration V25

Single migration adds both tables. ON DELETE behaviour:

- `pathways.from_stop_id` / `to_stop_id` cascade on Stop deletion —
  pathways without endpoints make no sense.
- `station_levels.parent_stop_id` is `SET NULL` so an admin can drop
  a parent station without losing the level metadata; the level row
  becomes orphaned and an admin-side cleanup task can decide what
  to do.

### 3. Endpoint matching uses the parent-station collapse

GTFS feeds typically declare pathways between platform-level stops
(`location_type = 0`) and concourse / generic nodes
(`location_type = 3`) under a parent station. Our importer collapses
all of those into the parent station for now (Phase 1.3 light only
exposed `platform_code`), so most pathways will end up as
self-transfers from the root stop to itself. That's still useful —
the admin can filter by `pathway_mode = ELEVATOR` to spot
non-step-free stations, and the row count remains a faithful image
of the feed. Phase 1.3 complete will rewire these FKs to per-platform
stops without schema changes.

### 4. Endpoint shape (superseded 2026-05-18)

Originally exposed `GET /api/stops/{stopId}/pathways`. The endpoint
was dropped along with the dedicated admin viewer — the popup uses
`PathwayService.findStationGraphForStop()` directly through
`/api/network-map/stops/{id}/pathway-graph`, which returns the full
station graph (parent station + every child platform) rather than the
single-stop slice this endpoint used to ship.

## Why no UI surfacing yet

A complete pathway UX (signposted directions, accessibility filter,
elevator-out alerts) is its own product surface — at minimum a
dedicated section on the hub display. Splitting it from the storage
layer keeps this phase reviewable: the schema and endpoint can land,
the matching against per-platform stops (Phase 1.3 complete) can
land, and the UI work can build on both rather than getting tangled
with the import pipeline.

## Trade-offs accepted

- **Self-pathways at the root stop.** Feeds with rich pathway data
  (Paris RATP, NYC MTA) will look denser than they are: many rows
  describe in-station segments that all collapse to the same
  `from_stop_id == to_stop_id`. The admin endpoint sorts them
  consistently so the duplicates aren't disorienting; they go away
  for free once Phase 1.3 introduces per-platform Stop rows.
- **No level FK on Pathway.** GTFS allows pathways to reference
  levels indirectly through their endpoints — a stop has a
  `level_id`. We follow that indirection rather than denormalising
  on the pathway row. The admin endpoint can join through the
  endpoints when it needs the floor labels.

> _Update (2026-05-18) — la promesse « Phase 1.3 complete will rewire
> these FKs to per-platform stops » a été livrée par ADR 0022 (v0.8.2).
> Le caveat « self-pathways at the root stop » est résolu : les
> in-station segments collapsent désormais sur des Stop rows distinctes
> par quai._
