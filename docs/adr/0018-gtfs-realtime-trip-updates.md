# ADR 0018 — GTFS-Realtime TripUpdates

**Status:** Accepted

## Context

ADR 0017 landed ServiceAlerts as the first GTFS-Realtime feed. The
second feed — TripUpdates — carries per-trip delays, cancellations
and stop-level skip flags. Visible passenger value: a kiosk can show
"5 min late" instead of the theoretical 14:32, which is the most
common single-feature request from operators piloting our displays.

Two integration questions had to be answered:

1. **How do we match a TripUpdate to a schedule?** GTFS-RT identifies
   updates by `trip_id`. Our `Itinerary.external_id` carries the
   *representative trip's* trip_id (the one with the most stops in
   its `(route, direction)` group). Updates targeting non-
   representative trips would be silently dropped.
2. **How do we surface the delay to the kiosk without rewriting the
   schedule contract?** The existing `scheduledTime` field is the
   theoretical timetable; replacing it would lose the comparison
   the passenger actually wants.

## Decision

**Match by representative trip_id only, expose the delay as a
separate `realtimeDelaySeconds` field on `ArrivalInfo`, drop SKIPPED
schedules entirely.**

### 1. Cache shape

`RealtimeTripUpdateCache` (Spring `@Component`) holds an
`AtomicReference<Map<String tripId, TripAdjustment>>`.
`TripAdjustment` carries:

- `tripId` — for round-trip identification.
- `tripLevelDelaySeconds` — from `TripUpdate.delay`, applied to every
  stop the per-stop list doesn't override.
- `byStopExternalId: Map<String, StopAdjustment>` — per-stop
  adjustments keyed by GTFS `stop_id`.

`StopAdjustment` carries arrival / departure delays + absolute times,
plus a `skipped` flag.

### 2. Polling

`RealtimeAlertScheduler` was extended (rather than introducing a
second scheduler class) to drive both alerts and trip updates from
the same component. Trip updates use
`app.gtfs-rt.trip-updates-url` and `app.gtfs-rt.trip-updates-poll-cron`
(default every 30 s) — symmetric with the alerts config so operators
configure one or both independently.

The `ApplicationReadyEvent` listener primes both caches at startup so
the first kiosk request after a restart sees the realtime data.

### 3. Matching at render time

`DisplayStateCalculator.resolveRealtimeDelay(schedule)`:

1. Pull `itinerary.external_id` (= representative trip_id).
2. `realtimeTripUpdateCache.findUpdate(trip_id)` — O(1) map lookup.
3. If the update's `byStopExternalId` contains the schedule's
   `stop.external_id`, use its delay (per-stop wins).
4. Else fall back to `tripLevelDelaySeconds`.
5. Return `null` when nothing matches — the kiosk renders the
   theoretical time with no badge.

### 4. SKIPPED handling

A `StopTimeUpdate` with `schedule_relationship = SKIPPED` means the
operator pulled the trip's stop from this run. We drop the schedule
entirely (filter pre-`toArrivalInfo`) so:

- The kiosk doesn't show a phantom departure with a delay badge.
- The next departure rolls up into the slot, which is the right
  passenger experience.

### 5. ArrivalInfo extension

`DisplayState.ArrivalInfo.realtimeDelaySeconds` (`Integer`):

- `null` — no realtime data available, render the scheduled time
  as-is.
- `0` — feed says "on time" (still distinguishable from `null` so
  a "live" badge can appear).
- positive — late by N seconds.
- negative — early by N seconds.

`HubDisplayState.HubArrivalInfo` mirrors the field so hub displays
get the same "live / scheduled" distinction.

`scheduledTime` itself is **not** mutated. The frontend computes the
displayed time as `scheduledTime + delay` so a "scheduled / live"
comparison remains possible — useful for terminus stations where
passengers want to know both "the bus left late" and "this is when
it should have left".

## Why representative trip_id only

Persisting `(every trip_id) → itinerary_id` would let us match
updates targeting non-representative trips, but:

- The mapping table grows fast (~10–100× the itinerary count on
  dense feeds).
- It would be wiped and rebuilt on every import (no `external_id`,
  no FK from outside).
- Most operators publish realtime updates on the routes' busy
  representative trips first; coverage is reasonable even with the
  light matcher.

When that light coverage starts to bite (operators with feeds
heavily targeting variant trips), a `TripItineraryMapping` entity
becomes the cleanest extension. Until then, simpler wins.

## Why we don't mutate `scheduledTime`

Three reasons:

1. **The passenger cares about both numbers.** "Bus to Centre,
   scheduled 14:32, expected 14:35" is more informative than
   replacing 14:32 with 14:35 silently.
2. **Cross-component caching.** `DisplayStateService` caches the
   computed state and gates pushes on a monotonic `version`.
   Mutating `scheduledTime` makes equality comparisons brittle —
   the same theoretical departure with a tiny delay change would
   look like a different row. Carrying the delay as a separate
   field keeps `scheduledTime` stable.
3. **Frontend renders the math.** The kiosk has the full clock and
   formatting code; pushing raw fields lets it render
   "14:32 (+5 min)" without server-side logic deciding for it.

## Why polling rather than push

GTFS-RT is a pull protocol by design — the agency hosts a static URL
that returns the current Protobuf snapshot. Pull keeps:

- The auth model simple (no inbound webhook to secure).
- The failure mode predictable (a missed poll just retries; an
  unavailable agency doesn't crash us).
- The same code path for alerts and trip updates.

WebSocket push to kiosks remains via the existing display
WebSocket — `DisplayStateService` recomputes and broadcasts when the
RT cache mutates the per-stop view. (That broadcast wiring is
unchanged: `version` bumps trigger a push on the next change cycle.)

## Trade-offs accepted

- **Coverage gap on variant trips.** Operators publishing realtime
  on non-representative trips see less "live" coverage. Light
  matcher is intentional; upgrade path is documented.
- **No stop_sequence-only matching.** Updates carrying
  `stop_sequence` without `stop_id` are dropped — the calculator
  doesn't know the schedule's sequence number. Real feeds tend to
  carry both.
- **Cache reset on restart.** A few seconds of "no live data" right
  after a deploy. The boot-time refresh keeps that window short.
- **No per-vehicle position yet.** VehiclePositions feed is left
  unimplemented; the visible value (a moving icon on a map view)
  needs a map renderer the kiosk doesn't have.
