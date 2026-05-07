# ADR 0010 — GTFS translations and the per-installation language

**Status:** Accepted

## Context

GTFS lets feeds carry localised strings via {@code translations.txt}.
A single polymorphic table keys each translation by
{@code (table_name, record_id, field_name, language)} and provides the
translated value. Typical fields:

| `table_name` | `field_name`                       |
|--------------|------------------------------------|
| stops        | stop_name, stop_desc, tts_stop_name |
| routes       | route_short_name, route_long_name, route_desc |
| trips        | trip_headsign, trip_short_name     |
| stop_times   | stop_headsign                      |
| feed_info    | feed_publisher_name                |

Until Phase 4.2 we ignored {@code translations.txt} entirely. Kiosks
displayed the feed's primary language as authored — fine for a
single-language deployment, sub-optimal for cross-border or tourist
hubs where Paris RATP, Brussels STIB or Bordeaux TBM all ship FR + EN
strings out of the box.

## Decision

**Persist every translation row, apply a single global preferred
language at render time.**

### 1. Domain model

One entity, {@code Translation}, stored as-is from the GTFS table:

- {@code tableName}, {@code recordId}, {@code fieldValue},
  {@code fieldName}, {@code language}, {@code translation}.
- Unique key:
  {@code (table_name, record_id, field_name, language)}.
- Indexes: {@code (language, table_name)} for the bulk-load path,
  {@code (table_name, record_id, language)} for ad-hoc lookups.

We persist {@code field_value} for parity with the spec but only the
{@code record_id} matching mode is honoured at runtime — see "Why
record-id only" below.

### 2. Single global language

Configuration:

```yaml
app:
  translations:
    preferred-language: ""   # BCP-47 tag, e.g. "fr", "en-GB"
```

Empty (default) is a no-op: the calculator returns the feed's primary
language. When set, every kiosk and hub display run by the install
honours it.

We deliberately did *not* push per-request {@code Accept-Language}.
The kiosk hardware reality is one screen, one language. STOMP/WS
pushes don't carry headers — they'd need a per-subscriber session
parameter, which complicates re-render logic and back-pressure. The
single-language path covers 95 % of deployments and keeps the
calculator branchless.

### 3. Application surface

Three sites in `DisplayStateCalculator` swap text:

- **Stop name** — `stops.{externalId}.stop_name`.
- **Line code / name** — `routes.{externalId}.route_short_name`
  and `routes.{externalId}.route_long_name`. Translated independently
  so a partial feed (only short_name localised) still works.
- **Destination** — chained: per-stop `stop_headsign` (if set, kept
  as-is — see below), then `trips.{externalId}.trip_headsign`,
  finally the terminus stop's `stop_name` translation.

Hub display inherits the translations transparently because
`HubDisplayService` consumes `DisplayStateCalculator` results.

### 4. Caching

A `TranslationLookup` is built once per `calculateForStop` call from
`translationRepository.findByLanguage(lang)`. The lookup is an
unmodifiable {@code Map<String, String>} keyed by the composite triple,
making each resolution O(1). At ~5 k translations on a busy multi-
language feed the load is ~10 ms and dominated by the JDBC fetch.

We can promote this to a Spring cache invalidated by the orchestrator
when needed; for now the simpler "load on each call" path keeps the
behaviour easy to reason about and lets the import pipeline drop
translations cleanly via `deleteAllInBatch` without cache eviction.

## Why record-id only

The spec also lets a translation row use {@code field_value} as a
matching key, applying to *every* row whose `field_name` equals that
value. It exists for de-duplication ("translate every stop named
'Centre' to 'Centro'") but in practice:

- Bigger feeds carry record_id rows because they need disambiguation
  (two different "Centre" stops with different translations).
- Resolving field_value at render time means scanning the original
  text, then the translation table, then re-applying — or
  pre-expanding at import time, which can multiply the row count
  dramatically.

The persisted column is there if a future phase wants to add the
field-value resolver; the runtime path stays simple until then.

## Why we don't translate `stop_headsign`

The `stop_times.stop_headsign` row identifier in
`translations.txt` is `(trip_id, stop_id, stop_sequence)`, which the
spec encodes as a JSON triple in `record_id`. We currently store
`stop_headsign` per `ItineraryStop` without surfacing the original
GTFS triple, so a translation lookup would need either:

1. Persisting the GTFS triple on `ItineraryStop` (schema change).
2. Reverse-deriving it from the itinerary external_id and the
   stop_sequence, which is brittle.

Until a passenger surface justifies the work, we leave `stop_headsign`
untranslated. The `trip_headsign` fallback covers the vast majority
of cases — feeds that go to the trouble of localising headsigns
typically translate both fields together.

## Trade-offs accepted

- **Empty `app.translations.preferred-language` = no-op.** Existing
  installs see no behaviour change.
- **Bulk load per request.** A 5 k-row translation table loads in ~10
  ms. We accept this until the kiosk request rate makes it visible
  in profiling.
- **No client-side language switcher.** A passenger can't toggle
  between FR and EN on the kiosk; that would require a richer
  subscriber-language protocol on top of WebSocket. Scope deferred.
