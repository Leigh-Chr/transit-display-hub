# ADR 0022 — Per-platform Stops

**Status:** Accepted

## Context

Phase 1.3 in the project roadmap. Until now the GTFS importer
collapsed every parent_station chain to a single root row: a
station with four platforms (each a `location_type=0` stop pointing
at the same `parent_station`) became one Stop in the database, and
all four platforms' stop_times rolled up into that single Stop's
schedules.

That collapse was easy to implement but lossy:

- **Per-platform kiosks impossible.** A device installed on
  platform 2 of a four-platform terminus showed every line of every
  platform mixed together — passengers had to read the destination
  to know which one was theirs.
- **`platform_code` data wasted.** The feed publishes "A", "B",
  "12bis" per platform; the collapsed Stop kept only the parent's
  (usually empty) platform_code.
- **Hub-display granularity.** The hub UI assumes each stop_id is
  a single platform; aggregating multi-platform stations had no
  natural data shape.

## Decision

**Persist each GTFS stop as its own row, including parent stations,
linked by a self-referencing `parent_stop_id` FK.** A kiosk bound
to a parent station aggregates schedules from its child platforms
at display time, preserving the behaviour of devices that were
previously bound to the collapsed parent.

### 1. Schema (V33)

```
ALTER TABLE stops
    ADD COLUMN parent_stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
    ADD COLUMN location_type SMALLINT NOT NULL DEFAULT 0;
CREATE INDEX idx_stops_parent ON stops(parent_stop_id);
CREATE INDEX idx_stops_location_type ON stops(location_type);
```

`location_type` stores the GTFS value verbatim (0 = platform,
1 = station). Values 2-4 are filtered at import (entrances,
generic nodes, boarding areas — none are stop_times targets).
Future GTFS extensions to the type field pass through the SMALLINT
column without breaking the import.

`ON DELETE SET NULL` on `parent_stop_id`: a station getting deleted
detaches its children rather than cascading. Children keep their
schedules and devices; the link just unrefers.

### 2. Importer (`GtfsImportService.importStops`)

Two-pass persistence so children can resolve their parent FK:

1. **Pass 1**: persist parent stations (`location_type=1`). Each gets
   its own row, named after the GTFS `stop_name`.
2. **Pass 2**: persist platforms (`location_type=0`). The parent FK
   resolves against the pass-1 map; platforms whose declared parent
   isn't in the feed (broken reference) become free-standing.

The previous `rootStopIdByGtfsId` map disappears: every downstream
consumer (`importItineraries`, `importSchedules`, `importTransfers`,
`importPathways`, `importAreas`) now resolves a GTFS `stop_id`
directly via `stopsByGtfsId.get(stopId)`. No parent-walk required —
the data structure already has the answer.

### 3. Display aggregation

`DisplayStateCalculator.calculateForStop`:

- If the stop is a platform (`location_type=0`), behaviour unchanged:
  schedules query against `s.stop.id = stopId`.
- If the stop is a parent station (`location_type=1`), the calculator
  expands to `{stopId} ∪ findChildIds(stopId)` and queries against
  `s.stop.id IN (...)`. Schedules from every child platform appear
  on the parent's display.

A single-element fast path keeps the regular per-platform case on the
original `=` comparison (saves one planning step on the hottest path).

### 4. Backwards compatibility

Existing devices bound to a previously-collapsed parent keep their
UUID across the re-import (external_id-based upsert, ADR 0013). The
parent's `location_type` flips from 0 to 1 during the first re-import,
which makes the display calculator start aggregating its newly-created
children. Same arrivals shown — operators don't need to rebind.

Devices bound to a free-standing stop (no parent, no children)
behave identically before and after.

## Trade-offs accepted

- **More rows.** A four-platform terminus that was one row is now
  five (parent + 4 platforms). Real feeds: we expect a 30-50 %
  total stop-count increase on rail-heavy networks. `stops` is
  still on the order of thousands, not millions, so the cost is
  trivial.
- **Schedules now point at platforms.** Aggregate kiosk arrival
  lists at parent stops require an extra repository query per
  refresh (the IN-based variant). Acceptable — the parent path is
  exercised only by the few devices bound to a station-level stop,
  most kiosks stay on the platform fast path.
- **No platform-aware kiosk template change in this commit.** The
  current kiosk template still shows a single platform_code on the
  header. When a parent-bound kiosk aggregates children, it inherits
  the parent's (usually empty) platform_code; the per-arrival
  platform info isn't surfaced. Future work: extend `ArrivalInfo`
  with an optional `platformCode` so a parent-bound kiosk can render
  per-arrival platform badges (matching the hub display's `platform`
  column).
