## ADR 0031 — Indoor pathway rendering in schematic mode

**Status:** Accepted

## Context

GTFS `pathways.txt` + `levels.txt` describe the indoor topology of a
station: which platforms connect via which stairs, escalators,
elevators and at what cost (traversal time, stair count, slope).

The natural visualisation in mass-transit apps is a 2-D station map
(Citymapper, Apple Maps subway view). That kind of view requires either
geo-located pathway endpoints (rare in feeds) or a hand-drawn floor
plan per station (massive content effort).

The user's standing rule for this project is "no real geographic /
real-geometry rendering — schematic only" (see
`feedback_user_rejections`). So an indoor map view styled like a
Mapbox basemap is off the table.

## Decision

Render indoor topology as a **flat list of pathway segments grouped
under a station header**, with one row per pathway:

```
🚇  Ascenseur · 30 s · « Quai 2 »
       Vestibule ↔ Quai 2
🚇  Escalier · 45 s · 24 marches (montée)
       Vestibule → Hall
```

Levels are surfaced as a chip row at the top:
```
[Hall] [Vestibule] [Quai 1] [Quai 2]
```

This pattern reuses the existing schematic-popup language:
typography, chips, mat-icons. No new map renderer, no new
visualisation paradigm.

## Implementation

- Public endpoint `GET /api/network-map/stops/{stopId}/pathways`
  returns the sub-graph rooted at the parent station: every level +
  every pathway whose either endpoint is a child of the station.
- `PathwayListComponent` is a standalone Angular component, embedded
  in the public stop popup and reused by the admin pathways page.
- The admin pathways page also displays the levels chip row when a
  stop is selected, using the same endpoint.

## Consequences

- A passenger reading the popup gets actionable indoor info ("there's
  an elevator from your platform to street level") without needing a
  visual map.
- An accessibility filter (Phase 4 — routing PMR) can read the same
  graph to skip stair-only paths or weight elevator durations.
- If a future stakeholder asks for a 2-D station map, this ADR does
  not block it — it just establishes that the absence of one is a
  conscious product decision, not a missing feature.
- No new dependencies. Renders inline in mat-icon + flexbox.
