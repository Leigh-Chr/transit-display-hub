# ADR 0025 — Section-boundary flushes during the GTFS import

**Status:** Accepted

## Context

`GtfsImportService.importFromZip` runs the full GTFS pipeline inside a
single `@Transactional` method: agencies → routes → stops → shapes →
itineraries → schedules → transfers → levels → pathways →
translations → fares (v1 + v2) → location groups → attributions. By
the time the first implicit flush fires, the persistence context is
holding thousands of dirty entities accumulated across every prior
section.

On every dev boot Hibernate emitted:

```
WARN org.hibernate.orm.action — HHH90032022:
Batch containing 2558 statements could not be sorted
(might indicate a circular entity relationship)
```

The 2 558 came from importStops's saveAll touching ~2 500 stops with
their `parent_stop_id` self-references plus the cascading `stop_lines`
join inserts queued from the upstream `importItineraries`. With
`hibernate.order_inserts: true` (the default), Hibernate's
`ActionSorter` tries to topologically order inserts by FK dependency
to maximise JDBC batching. The Stop self-reference means the type
graph contains a cycle that the sorter can't resolve, so it gives up
and falls back to insertion order.

The warning is informational — the seed completes correctly — but it
fires on **every dev boot**, which violated the "0 WARN at startup"
bar set by the post-0.8.0 quality pass.

## Considered alternatives

1. **`hibernate.order_inserts: false`** in the dev profile.
   Tested. The warning disappears, but the scheduled re-import (cron
   at 04:00) crashes with a foreign-key violation:
   `ITINERARIES.SHAPE_ID → SHAPES.ID` — without ordering, an Itinerary
   row could flush before its referenced Shape because both were
   pending in the same accumulated batch. **Rejected.**
2. **Suppress HHH90032022 via Logback filter.** Hides the symptom
   without changing the underlying buildup. **Rejected**: the warning
   is real signal that the persistence context is unbounded.
3. **Section-boundary flushes.** Force a flush after each major import
   section so the action queue stays small enough that `ActionSorter`
   can sort it. **Accepted.**

## Decision

**Inject `EntityManager` into `GtfsImportService` and call `flush()` at
section boundaries**:

- between `importStops` pass 1 (parent stations) and pass 2 (platform
  rows referencing them) — a self-FK boundary that BatchSorter can't
  cross
- after `importStops`
- after `importShapes`
- after `importItineraries`

```java
@PersistenceContext
private EntityManager entityManager;

// in importStops:
for (RawStop r : raw) if (r.locationType == 1) persist(r, null);
entityManager.flush(); // parents land before children's FKs queue up
for (RawStop r : raw) if (r.locationType != 1) persist(r, parentOrNull);
entityManager.flush();

// in importFromZip:
StopImport stopImport = importStops(...);
entityManager.flush();
Map<String, Shape> shapes = importShapes(...);
entityManager.flush();
ItineraryImport itineraries = importItineraries(...);
entityManager.flush();
```

## Consequences

- **HHH90032022 silenced** on the dev seed (Grenoble: 2 501 stops,
  434k schedules). Verified by polling boot logs: zero `HHH9xxxx` lines
  start to finish.
- **`order_inserts` stays on**, so each per-section flush still
  respects FK dependencies. Re-import safety preserved.
- **Bounded persistence context.** Each flush operates on one
  section's worth of entities, not the cumulative seed. Lower memory
  pressure during large imports.
- **No measurable seed regression.** Import time on the cached
  Grenoble feed stayed within noise (16 s vs. 16 s before). The extra
  flushes are dwarfed by the schedule fan-out in `importSchedules`.
- **Caveat:** the choice of flush points is import-shape-specific. If
  `importFromZip` grows new sections that introduce circular FKs, add
  a flush after them too. Treat the boundaries as a list, not a magic
  invariant.
- **Production unaffected.** Production boots Flyway (no seed). The
  dev refresh cron runs the same `importFromZip` so the fix benefits
  it too.
