# ADR 0001 — LineType enum and `route_type` mapping

**Status:** Accepted

## Context

The original `LineType` enum bucketed every transit service into one of
four values: `BUS`, `TRAM`, `METRO`, `TRAIN`. The GTFS importer's
`mapRouteType` collapsed the basic GTFS modes (0..12) plus the Extended
Route Types (Hierarchical Vehicle Types, range 100..1799) into the same
four buckets via a series of broad `if` clauses.

This silently mis-classified at least four real-world cases:

- `route_type = 4` (Ferry) and `1000-1299` (water transport) → `BUS`
- `route_type = 6` (aerial lift / cable car) → `BUS`
- `route_type = 7` (Funicular) → `BUS`
- `route_type = 11` (Trolleybus) → `BUS`
- `route_type = 12` (Monorail) → `TRAM` (a copy-paste bug — Monorail
  shares no glyph or behaviour with a tram)

The kiosk renders an icon per type. Mis-typing meant a Lyon trolleybus
showed a bus icon, a Marseille ferry showed a bus icon, and the Paris
"Funiculaire de Montmartre" showed a bus icon — all defensible
fallbacks, but jarring next to the correctly-typed metros and trams of
the same network.

## Decision

`LineType` becomes a 10-value enum:
`BUS`, `TRAM`, `METRO`, `TRAIN`, `FERRY`, `FUNICULAR`, `CABLE_CAR`,
`TROLLEYBUS`, `MONORAIL`, `OTHER`.

`mapRouteType` is moved out of `GtfsImportService` (where it was
private and unreachable from tests) into `GtfsParse` and rewritten as a
two-tier dispatch:

1. **Basic GTFS values** (0–12) get a direct `case` arm each.
2. **Extended HVT codes** (100–1799) get bucketed by `routeType / 100`
   into the closest enum member; the leaf taxonomy is too granular for
   our display (we don't draw a different icon for "Long-distance
   tourist railway" vs "Sleeper rail").

Unknown values fall through to `OTHER` rather than the previous
silent-`BUS` default — visible-but-anonymous beats invisible mis-typing.

## Consequences

**Frontend.** The schematic-map adds Material Symbols paths for the new
types: ferry uses `directions_boat`, funicular and cable car share the
tram glyph (no Material Symbols equivalent at icon scale), trolleybus
reuses the bus path, monorail reuses the metro path. Admins selecting a
line type now see all 10 options in `line-dialog`.

**Schema.** `lines.type` widens from `VARCHAR(10)` to `VARCHAR(15)` to
fit `TROLLEYBUS`. Migration is `ALTER COLUMN TYPE`, additive.

**Tests.** `GtfsParseTest` parameterises 30+ values across both tiers;
the previous test suite covered only the four-value enum.

## Alternatives rejected

- **Keep four values, add a `subtype` column.** Forces every consumer
  to handle two enums and breaks the obvious `switch` over `LineType`.
  Adds a per-line second column for no benefit a denormalisation
  doesn't already give.
- **One enum value per HVT code.** ~120 enum members, dwarfs the value
  any UI could surface. Ferries don't need to distinguish "Local water
  transport" from "International car ferry" on a kiosk.
