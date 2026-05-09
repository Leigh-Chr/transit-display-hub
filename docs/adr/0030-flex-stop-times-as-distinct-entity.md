## ADR 0030 — `flex_stop_times` as a distinct entity from `schedules`

**Status:** Accepted

## Context

GTFS-flex extends `stop_times.txt` with four columns —
`location_id`, `location_group_id`,
`start_pickup_drop_off_window`, `end_pickup_drop_off_window` —
that turn the row into a different shape entirely. The spec is
explicit:

> A row of `stop_times.txt` SHALL specify exactly one of
> `stop_id`, `location_group_id` or `location_id`. When
> `location_group_id` or `location_id` is present, `arrival_time`
> and `departure_time` are forbidden, and the two pickup/drop-off
> window fields are required.

So a flex row carries:

- no concrete arrival time,
- a target that may be a polygon (`location_id`) or a fuzzy set
  of stops (`location_group_id`),
- a service-availability window rather than a clock time.

The `schedules` table — designed for "vehicle Y arrives at stop X
at 12:34" — has nullable=false on `time` and `stop_id`. Routing
flex rows through it would mean making half its columns nullable
and adding an XOR constraint at the application layer.

## Options considered

1. **Store everything on `schedules`.** Make `time`, `stop_id`
   nullable; add `start_window`, `end_window`, `location_id`,
   `location_group_id`. Use a CHECK constraint or an
   application-level XOR validator to keep the shape sane.
2. **Skip flex rows entirely.** Drop them at import. Conservative
   but means GTFS-flex stays half-supported (we have
   `BookingRule`, `Location`, `LocationGroup` rows but nothing
   ties them to a trip).
3. **New `flex_stop_times` table.** Schema dedicated to the flex
   shape, joined to `Itinerary` like `schedules`, with optional
   FKs to `stops` / `locations` / `location_groups`.

## Decision

Option 3 — `flex_stop_times` as a dedicated entity.

The two row types are structurally different enough that
overlaying them on the same JPA entity hides the distinction
that matters most to consumers: "is this a *known arrival* or a
*service window*?" Consumers of `schedules` (display calculator,
kiosk WebSocket payload, JMH benches) all assume an arrival
time; widening the type for the flex case would force them to
handle null `time` everywhere.

Keeping the two tables side by side also lets queries scan the
flex side independently — TAD zones list views and "is this
trip running now?" need only `flex_stop_times`, never the full
`schedules` join.

## Consequences

- The importer routes rows on the fly: a row with a window plus
  a `location_id` / `location_group_id` lands in
  `flex_stop_times`; everything else stays in `schedules`. The
  routing happens inside `importSchedules` so the order of
  `importLocations` / `importLocationGroups` had to move ahead
  of `importSchedules` in the orchestration — both must exist
  to resolve the flex row's target FK in a single pass.
- `flex_stop_times` carries no `external_id`; like `schedules`
  it's wiped on every reimport.
- ADR 0026's storage decision (raw GeoJSON, no JTS) is unaffected
  — `flex_stop_times.location_id` is a relational FK to the
  `locations` table whose schema didn't change.
- Future: a passenger surface that exposes "next pickup window
  for this zone today" pulls from `flex_stop_times` joined to
  `service_calendars` for the day-of-week filter, the same way
  `schedules` does.
