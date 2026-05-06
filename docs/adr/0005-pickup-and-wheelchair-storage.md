# ADR 0005 — Storage strategy for accessibility / pickup metadata

**Status:** Accepted

## Context

GTFS publishes three trip-level booleans that the kiosk wants to surface:

- `wheelchair_accessible` (0/1/2)
- `bikes_allowed` (0/1/2)
- `pickup_type` and `drop_off_type` per stop_time (0/1/2/3)

Each of these is intuitively a per-schedule attribute, since the
underlying value lives on `trips`. But the schedules table is the
largest in the model: a feed the size of Bordeaux yields ~2 million
rows. Storing four extra non-null small-int columns × 2M rows × N
imports compounds quickly, and the wheelchair / bikes values are
overwhelmingly the same across every trip of an itinerary.

Two competing pressures:

- **Accuracy.** Some trips genuinely differ from the rest of their
  line — a single non-accessible bus on an otherwise accessible route.
  Collapsing to a per-itinerary value loses that information.
- **Footprint.** Publishing the full per-schedule columns adds ~16 MB
  to a Bordeaux-sized feed and a noticeable cost to every read of
  `findUpcomingSchedules`.

## Decision

**Hybrid model with majority defaults and per-row overrides:**

- `Itinerary.wheelchairDefault` and `Itinerary.bikesAllowedDefault` —
  enums (`UNKNOWN/ACCESSIBLE/NOT_ACCESSIBLE` and analogue). Computed
  at import time as the majority value across every trip matching the
  itinerary's `(route_id, direction_id)`. Counts only declared values
  (1 or 2); ignores `UNKNOWN`. Ties resolve to `UNKNOWN`.
- `Schedule.wheelchairOverride` and `Schedule.bikesAllowedOverride` —
  nullable booleans. Stored only when the trip's value diverges from
  the itinerary's default. Null = inherit.

**The pickup / drop-off pair stays per-schedule** since (a) it varies
within the same trip (different stop_times on the same trip can have
different pickup_types), and (b) the (1, 1) "no service" combination
filters whole rows out at import time, keeping the table cheap.

`DisplayStateCalculator` resolves the effective accessibility per
arrival: schedule override > itinerary default > UNKNOWN. The result
is exposed verbatim on `ArrivalInfo` and `HubArrivalInfo`.

## Consequences

**Footprint.** On the five test feeds (Grenoble, Strasbourg, Bordeaux,
Nantes, Tours), at most ~3 % of trips diverge from their itinerary
default for wheelchair access; under 1 % for bikes. The override
column stays NULL for the rest, so the marginal storage cost is
sub-megabyte.

**Pictograms.** The kiosk renders an `accessible_forward` icon for
ACCESSIBLE, `do_not_disturb` for NOT_ACCESSIBLE, and nothing for
UNKNOWN — matches the GTFS convention of treating the unspecified
value as "no claim" rather than "implicitly accessible".

## Alternatives rejected

- **Store full enum on `Schedule`.** Multi-megabyte cost for marginal
  accuracy — the override column captures every divergence with two
  bits of information per row.
- **Store on `Itinerary` only, no overrides.** Loses the rare-but-real
  cases of single-trip divergence. Some operators publish a non-
  accessible morning depot run; the override exists for them.
