# ADR 0006 — Route-finder transfer cost from `transfers.txt`

**Status:** Accepted

## Context

`RouteFinderService` (frontend) used a constant `TRANSFER_COST = 10000`
for every change of line at a stop. The unit was implicit ("score"); the
value dwarfed the 1-cost same-line edges by four orders of magnitude.
Effect: the Dijkstra search systematically preferred a single line
even when an interchange-via-transfer would be 10× faster in real life.

GTFS `transfers.txt` solves this by declaring per-pair costs:

- `transfer_type = 0` — recommended. `min_transfer_time` optional.
- `transfer_type = 1` — timed (synced services). Effectively zero wait.
- `transfer_type = 2` — minimum-time required. `min_transfer_time` is
  the cost.
- `transfer_type = 3` — transfer not possible. The edge should be
  pruned, not weighted.

## Decision

**Backend persists `transfers.txt`** as a `Transfer` entity
(from_stop, to_stop, transfer_type, min_transfer_time) with both
endpoints as foreign keys. The endpoints are resolved through the same
parent-station collapse the importer applies to `stop_times`, so a
transfer declared between two quays maps to the persisted root stops
the kiosks know about.

**The network-map response includes the transfer table inline.**
Frontends receive it on every snapshot fetch — no extra request.

**The route-finder switches from a constant to a typed lookup.** The
frontend builds a `Map<"fromId|toId", NetworkTransfer>` indexing both
directions of every declared row, then weighs each cross-line edge:

- type 3 → near-infinite cost (`999_999`); pruned at edge-creation time
- type 1 → `min_transfer_time` if set, otherwise 0
- types 0/2 → `min_transfer_time` if set, otherwise the calibrated
  `DEFAULT_TRANSFER_COST_SECONDS = 180`

180 seconds matches the typical European urban-metro experience:
3 minutes including platform walk and average wait. Calibrated against
informal timing on the Île-de-France network; same order of magnitude
as published guidance.

## Consequences

**Routes through interchange-friendly stations.** A station with a
declared 30s same-platform transfer beats a single-line detour adding
5 minutes. This is the intended behaviour and matches what passengers
actually experience.

**Backwards compatibility.** Networks without `transfers.txt` keep the
default cost of 180s — a step up from the previous 10000 that still
preserves the "single-line route is preferred when comparable in length"
behaviour for short trips.

**Tie-break on duplicate rows.** When the feed declares the same pair
twice (rare but happens with both directional and generic entries),
the indexer keeps the cheaper of the two.

## Alternatives rejected

- **Time-weight the same-line edges too.** Would need synthetic
  duration data we don't have. The current Dijkstra runs on
  unit-cost line edges + seconds-cost transfer edges; mixing units
  is technically wrong but works because the two are summed and the
  optimiser picks the smallest total — and same-line travel time is a
  fairly uniform multiplier.
- **Constant cost calibrated per network.** Adds a config knob no
  admin will ever tune. The feed's own `min_transfer_time` is the
  authoritative answer; the constant 180 is a fallback, not a target.
