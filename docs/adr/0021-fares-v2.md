# ADR 0021 — GTFS Fares v2

**Status:** Accepted

## Context

ADR 0012 captured the v1 import (`fare_attributes.txt` +
`fare_rules.txt`) and explicitly deferred the v2 family. Most North
American agencies (and a growing set of EU operators) now publish v2
because it models product-based pricing (passes, day tickets), area-
based zones and timeframe-based pricing — all things v1 cannot
express without abuse.

The two formats coexist on real feeds during a transition: v2 ships
the modern model, v1 stays for legacy consumers. Our import has to
read both.

## Decision

**Persist a 5-table subset of GTFS Fares v2** in addition to v1.
Read-only — admins inspect the imported model via
`GET /api/admin/fares-v2`; no fare-computation logic at this stage.

### 1. Tables

```
areas (id, external_id, name)
stop_areas (area_id, stop_id)              — M2M, cascade both ways
timeframes (id, timeframe_group_id, start_time, end_time, service_id)
fare_products (id, external_id, name, fare_media_id, amount, currency)
fare_leg_rules (id, leg_group_id, network_id, from_area_id, to_area_id,
                from_timeframe_group_id, to_timeframe_group_id,
                fare_product_id, rule_priority)
fare_transfer_rules (id, from_leg_group_id, to_leg_group_id,
                     transfer_count, duration_limit, duration_limit_type,
                     fare_transfer_type, fare_product_id)
```

`leg_group_id` and timeframe group ids stay as raw strings: GTFS
shares them across multiple rule rows, so a surrogate FK would force
us to materialise the group as its own table for no semantic gain.

### 2. Networks and media (V31)

A follow-up migration adds three more tables:

```
networks (id, external_id, name)
route_networks (network_id, route_id)             — M2M, cascade both ways
fare_media (id, external_id, name, media_type)
```

`fare_leg_rules.network_id` and `fare_products.fare_media_id` keep
their raw-string columns rather than promoting to FKs. Reasoning:
the v2 import sequence already serialises (areas → timeframes →
products → leg rules → transfer rules); adding a hard FK on
networks / media would reorder the wipe cadence and risk
SET-NULL spurious fires during partial re-imports. The raw-string
loose link is harmless for browse and the future fare-computation
path can resolve client-side.

### 3. Leg join rules (V34)

V34 closes the spec with `fare_leg_join_rules.txt` — niche, used by
very few feeds, but persisted in its own table for completeness.
Stop references are FK (with SET NULL on deletion), network
references stay as raw strings (consistent with V30 / V31).

The data being available behind raw-string columns means each
deferred file becomes a follow-up migration, not a model rewrite.

### 3. Coexistence with v1

ADR 0012's tables (`fare_attributes`, `fare_rules`) and the v2
tables persist independently. A feed shipping both populates both;
neither table touches the other. The kiosk's future fare display
will prefer v2 when present and fall back to v1 — that pick belongs
to the consumer, not the importer.

### 4. Wipe-and-reimport semantics

Schedule import (ADR 0013) wipes its target table; v2 follows the
same pattern in dependency order:

```
fare_transfer_rules → fare_leg_rules → fare_products → timeframes → areas
```

Wiping dependents first prevents `ON DELETE SET NULL` from firing
spuriously during the rebuild.

### 5. Admin surface

Single endpoint `GET /api/admin/fares-v2` returns the entire v2
graph in one round-trip. The v2 graph is small on real feeds (a
few hundred rules tops) and the relations are useless when split,
so paging the response would just push joining onto the client.

The frontend used to render four sub-tables (Products, Areas,
Leg rules, Transfer rules) in the `/admin/gtfs-data` tab group,
next to v1. That admin viewer was dropped 2026-05-18 — the data is
still imported and persisted, surfaced to passengers via the
fare popup, and reachable through Swagger for ad-hoc inspection.

## Trade-offs accepted

- **No fare computation** — given a journey (legs + transfers),
  the model can determine the cost, but we don't expose this. The
  kiosk doesn't currently quote fares; when it does, the algorithm
  lives in a domain service, not the importer.
- **`leg_group_id` as plain string** — see §1. Slight duplication of
  the value across rules; matches the GTFS shape exactly and avoids
  an extra table that would never be enumerated independently.
- **No service_id resolution on timeframes** — `timeframes.service_id`
  references `service_calendars.external_id` but we keep it raw.
  Resolving to the FK would force every Fares v2 import to wait for
  service calendars (which are wiped before each schedule import,
  see ADR 0013), making the dependency graph awkward. Raw string is
  enough for browse; consumers join client-side if they need it.
