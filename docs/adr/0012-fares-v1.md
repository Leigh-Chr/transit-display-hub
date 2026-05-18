# ADR 0012 — GTFS Fares v1 (fare_attributes + fare_rules)

**Status:** Accepted

## Context

GTFS supports two fare expression formats:

- **Fares v1** — `fare_attributes.txt` (price, currency, transfer
  policy, agency) plus `fare_rules.txt` (which routes / origin
  zones / destination zones / contains zones the fare applies to).
  Stable since 2009, supported by every European transit feed we
  consume.
- **Fares v2** — `fare_products.txt`, `fare_leg_rules.txt`,
  `fare_transfer_rules.txt`, `areas.txt`, `stop_areas.txt`,
  `timeframes.txt`, plus optional rider-category and media tables.
  Strictly more expressive (multi-leg journeys, time-of-day pricing,
  rider categories) but rare in production feeds.

Until Phase 4.1 we ignored both. The admin had no way to see what a
trip on a given line would cost, and the kiosk had nothing to display
when a passenger asked.

## Decision

**Persist Fares v1 as-is. Defer Fares v2 to a later phase.**

### 1. Domain model

Two entities, mirroring the spec:

- `FareAttribute`: `external_id` (= `fare_id`), `price`
  (`BigDecimal`, scale 4 for sub-cent precision), `currency`
  (ISO-4217), `payment_method` enum (`ON_BOARD` | `PREPAID`),
  `transfers` (nullable `Integer` — `null` = unlimited per spec, 0 /
  1 / 2 = explicit limits), `transfer_duration` (seconds, nullable),
  optional `agency` FK. One-to-many on `rules`.
- `FareRule`: parent `fareAttribute` FK, optional `route` FK
  (`Line`), three free-form zone strings (`origin_id`,
  `destination_id`, `contains_id`). All four conditional columns
  are optional — a rule with only `fareAttribute` set means "applies
  to every trip".

We don't model `stops.zone_id` as an entity yet: GTFS treats the
zone strings as opaque labels, and feeds vary wildly in how they
populate them. The admin endpoint surfaces the raw strings; a future
phase can introduce a `FareZone` entity once we have a UX driver for
it.

### 2. Migration V27

Single migration adds both tables. ON DELETE behaviour:

- `fare_rules.fare_attribute_id` cascades on attribute deletion.
- `fare_rules.route_id` `SET NULL` so dropping a line doesn't take
  fare data with it (the rule becomes "regardless of route").
- `fare_attributes.agency_id` `SET NULL` for the same reason.

### 3. Import pipeline

`importFares()` runs after `importTranslations()`:

1. Wipes both tables (`deleteAllInBatch` on `fare_attributes` —
   cascade clears `fare_rules`).
2. Reads `fare_attributes.txt`, persisting each row and indexing it
   by GTFS `fare_id`.
3. Reads `fare_rules.txt` (optional) and adds rules under the right
   parent. Rules referencing an unknown `fare_id` are skipped with a
   warning.
4. Saves the parents again so the cascade picks up the new rules.

### 4. Endpoint shape

`GET /api/admin/fares` returns every fare attribute with its rules
inline, sorted by price ascending (admins see the cheapest tickets
first; tiebreak by `external_id`). `FareController` lives under
`/api/admin/**`, so the existing `hasRole("ADMIN")` rule in
`SecurityConfig` covers it.

## Why we don't compute "the fare for this trip"

Resolving the fare a passenger pays for a specific trip involves
matching the trip's route against `fare_rules.route_id`, the start
stop's `zone_id` against `origin_id`, the end stop's against
`destination_id`, every traversed zone against `contains_id`, then
combining results across multiple matching attributes (typically
"min price wins"). The GTFS spec is precise but the matching is
verbose, and the kiosk doesn't yet have a passenger-facing surface
for fares.

This phase delivers the data; a later phase can add the resolver
when there's a UX justification.

## Why Fares v1 only

Two reasons:

- **Coverage.** Every European feed we ingest (TBM, RATP, STIB, …)
  ships v1. v2 adoption is still mostly North American transit
  agencies. v1 is enough to surface fares in our pilot deployments.
- **Schema cost.** v2 introduces six new tables with cross-table
  references (`stop_areas` ↔ `areas` ↔ `fare_leg_rules` ↔
  `fare_products`). Modelling that without a runtime consumer would
  pile on dead schema; doing it alongside the resolver makes more
  sense.

The Fares v1 schema is independent of any future v2 schema — we can
add v2 tables without changing v1 data.

## Trade-offs accepted

- **No fare resolver.** The admin sees raw attribute / rule data;
  computing "fare for trip X" is deferred.
- **Zone ids are opaque strings.** No `FareZone` entity, no FK from
  `Stop.zone_id` (which we don't persist as a column). Acceptable
  while the only consumer is an admin browse.
- **Currency stored as 3-char string.** No reference table. ISO-4217
  is stable enough that validation can live in the importer's
  `truncate(... 3)` clamp; we accept rare malformed feeds will
  produce uppercase 3-letter strings that aren't currencies.

> _Update (2026-05-18) — `Stop.zone_id` est désormais persisté comme
> colonne (migration `V37__add_stop_zone_id.sql`, v1.0.0) pour alimenter
> le matching `FareCalculator` (cf. ADR 0033). Le reste de la décision
> tient : pas de `FareZone` entity, pas de FK relationnelle, juste une
> colonne opaque sur `stops`._
