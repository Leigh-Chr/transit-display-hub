# ADR 0015 — Demand-responsive transit (location groups + booking rules)

**Status:** Accepted

## Context

GTFS extends its core scheduled-trip model with a set of optional
files that describe demand-responsive transit (TAD — *transport à
la demande*):

- `location_groups.txt` — bundles several stops as a single boarding
  zone for flexible routing.
- `location_group_stops.txt` — many-to-many link from group to stops.
- `locations.geojson` — alternative bundling using free-form
  pickup polygons (no schema; the file is GeoJSON).
- `stop_areas.txt` — yet another grouping mechanism, primarily for
  fare zones.
- `booking_rules.txt` — how to book a flexible trip (phone, URL,
  advance notice, cutoff time).
- `stop_times.{pickup,drop_off}_booking_rule_id` — per-stop_time FK
  pointing at a booking rule.

Until Phase 5.3 the importer skipped all of this. Rural TAD operators
that ship flexible-route data had no way to surface their booking
channels on the kiosk, and the admin had no visibility on which trips
required pre-booking.

## Decision

**Persist `location_groups.txt`, `location_group_stops.txt` and
`booking_rules.txt`. Defer `locations.geojson`, `stop_areas.txt`, and
the per-stop_time booking-rule FKs.**

### 1. Domain model

- `LocationGroup` — `external_id` (= `location_group_id`), optional
  `group_name`, many-to-many to `Stop` via `location_group_stops`.
- `BookingRule` — `external_id` (= `booking_rule_id`),
  `BookingType` enum (`REAL_TIME` | `SAME_DAY` | `PRIOR_DAYS`),
  five prior-notice fields (`min` / `max` duration, `start` / `last`
  day, `last_time`), plus phone / `booking_url` / `info_url` /
  `message` for passenger-facing display.

Both entities are independent of the rest of the schema — no
schedule rows reference them yet (see "deferred" below).

### 2. Migration V29

Single migration adds three tables:

- `location_groups` (id, external_id, group_name).
- `location_group_stops` (location_group_id, stop_id) with both
  cascading on parent deletion.
- `booking_rules` with all the spec columns.

### 3. Import pipeline

`importLocationGroups()` and `importBookingRules()` run after the
fares import:

- Wipe both tables (`deleteAllInBatch`) before re-inserting. None of
  the rows carry FKs from outside the import scope, so a clean
  rebuild is safe.
- Endpoints resolved through the same `resolveStop` helper used by
  transfers and pathways, so a `location_group_stops` row pointing
  at a child platform collapses to the root station the way the
  rest of the importer does.

### 4. Endpoint shape

`GET /api/admin/booking-rules` returns every rule sorted by booking
type (real-time → same-day → prior-days) then by external id. Admin
auth via the existing `/api/admin/**` rule.

Location groups don't get a dedicated endpoint yet — they're useful
once a passenger-facing TAD UI exists, and exposing them now would
just be dead surface.

## Why we defer the per-stop_time FKs

Wiring `pickup_booking_rule_id` and `drop_off_booking_rule_id` onto
`Schedule` would touch the schedule import hot-path and the
`Schedule` columnset. Both are already heavy. Until a kiosk surface
shows "phone +33… to book" alongside an arrival, the link adds
noise without value.

When that surface lands, the FKs are a one-migration delta — the
booking rules they reference will be there, addressable by their
stable UUIDs, and the matching is a per-row lookup we can profile
before committing to it.

## Why we defer locations.geojson

Free-form polygon support for "ride between any address inside this
zone" requires:

- A GeoJSON parser and a geometry library (JTS).
- A persistence story for polygons (PostGIS in prod, in-memory in
  H2 dev).
- A passenger-facing UI to actually pick an address inside the
  polygon — well outside the kiosk's UX scope.

Stop-bundle TAD (`location_groups`) covers the realistic Phase 5.3
use case (rural lines that pick up at any of N village stops). The
GeoJSON variant is a phase of its own.

## Why we defer stop_areas

`stop_areas.txt` is a third grouping mechanism, primarily for fare
zone resolution. Phase 4.1's Fares v1 stores the zone id as an
opaque string on `FareRule.origin_id` / `destination_id` /
`contains_id`, which is the lighter path. When Fares v2 lands (and
needs `area_id`-based leg rules), a `StopArea` entity becomes
worthwhile; until then it would just shadow `LocationGroup` without
adding semantics.

## Trade-offs accepted

- **No passenger surface.** The admin sees the data; kiosks don't
  yet render "this trip requires a 2-hour advance call". Delivering
  the data first lets the UX phase land cleanly without backend
  rework.
- **Wiped on every import.** Same trade-off as fares, attributions,
  shapes. The orchestrator skips re-import when the SHA hasn't
  changed, so the wipe-and-rebuild only fires on real updates.
- **No per-stop_time FK.** Phase-scoped: cost is a one-line ALTER
  when needed.
