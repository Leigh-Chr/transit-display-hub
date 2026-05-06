# ADR 0004 — Resolving the destination shown to passengers

**Status:** Accepted

## Context

The kiosk displays a destination string for every upcoming arrival. The
naive choice is the trip's overall headsign — the line's terminus — and
that's what `DisplayStateCalculator.toArrivalInfo` used to do via
`itinerary.getTerminusName()`.

That fails on three real-world patterns:

1. **Loop services.** A circular line shares both directions but the
   public destination changes mid-loop ("vers Centre" / "vers Gare").
2. **Terminus short-running.** Late-evening services that stop short of
   the published terminus. The vehicle's roller display reads the
   short terminus; the GTFS feed flags the difference at each affected
   stop_time.
3. **Branching.** Multi-branch lines (Y-shaped routes) where the
   destination diverges past the branch point.

GTFS handles all three with `stop_times.stop_headsign` — the
destination text the vehicle shows *at this specific stop*. When
present, it overrides `trips.trip_headsign`.

## Decision

`ItineraryStop` gains a nullable `stopHeadsign` column. The importer
populates it from `stop_times.stop_headsign` during the second pass
over the stop_times file (the pass that already collects the trip's
ordered stop list).

`DisplayStateCalculator.toArrivalInfo` is now passed the `stopId` of
the kiosk it's computing for. It walks the itinerary's
`itineraryStops` looking for the matching stop and returns the
stop-specific headsign when non-blank, falling through to
`itinerary.getTerminusName()` otherwise.

The lookup is O(n) over the stops on the itinerary — typically 15–40
items for an urban route. We don't memoise: the schedule list at any
stop is already capped at one entry per direction by the existing
`Collectors.toMap` upstream, so this lookup runs ≤ 4 times per
display-state computation.

## Consequences

**Backwards compatibility.** Itineraries imported before V12 have
`stop_headsign = NULL` for every row, so the resolver returns the
terminus — identical to the previous behaviour.

**Hub display.** `HubDisplayService` flat-maps the per-stop arrivals,
so each `HubArrivalInfo.destinationName` already carries the
stop-specific value resolved upstream. No additional change.

## Alternatives rejected

- **Store `stop_headsign` on `Schedule`.** Way more rows. The headsign
  at a given (itinerary, stop) is structural; the same row holds for
  every trip on that itinerary unless the trip is genuinely different —
  which is what the GTFS variant pattern is for, not a per-schedule
  override.
- **Pass the full `Schedule` to a frontend resolver.** Forces the
  frontend to know about itineraryStop arrays; the backend already
  has the join, so the resolution belongs there.
