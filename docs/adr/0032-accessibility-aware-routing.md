## ADR 0032 — Accessibility-aware routing

**Status:** Accepted

## Context

The route-finder (Dijkstra over the line/transfer graph, see ADR 0006)
treats every stop as reachable. Passengers using a wheelchair or
mobility aid need a mode that prunes inaccessible stops.

GTFS exposes the data: `stops.wheelchair_boarding` (0 unknown / 1
accessible / 2 not accessible), `pathways.pathway_mode` (stairs vs
elevator), and per-trip `wheelchair_accessible`.

## Decision

Add an `accessibleOnly: boolean` option to
`RouteFinderService.findRoute`. When true, every stop with
`wheelchair_boarding === 'NOT_ACCESSIBLE'` is pruned from the graph
before running Dijkstra. UNKNOWN / null stops remain — the spec defines
them as "not declared", not "not accessible", and feeds frequently
omit the field entirely.

The option surfaces as a toggle button on the network-map page next
to the "Full network" toggle. Toggling re-runs the active search so
the result updates immediately.

## Consequences

- Zero data migration: the filter reads `NetworkMap.stops` already
  shipped with the public payload.
- Pathway-mode penalties (escalator vs stairs vs elevator) and
  per-trip `wheelchair_accessible` filtering are not yet applied —
  scope-limited to "stop accessibility" for the first iteration. The
  pathway data is exposed via the indoor graph endpoint (ADR 0031);
  a future iteration can read it inside the route-finder.
- Feeds that never declare `wheelchair_boarding` get the same routes
  whether the toggle is on or off — desirable: the spec doesn't
  permit assuming a stop is inaccessible from missing data.
