# ADR 0013 — Idempotent GTFS import keyed by external_id

**Status:** Accepted

## Context

Until Phase 0.5c the importer recreated every domain row on every
run: `agencies`, `lines`, `stops`, `itineraries` were `save()`'d
directly from the GTFS CSV without checking whether a matching row
already existed. That produced fresh UUIDs each time, which broke
two semantic FKs that live outside the import scope:

1. **`Device.stop_id`** — kiosks register against a specific
   `Stop.id`. Reimporting the same feed minted a new UUID and the
   kiosk lost its binding.
2. **`BroadcastMessage.scope_id`** — admin-broadcast messages with
   `scope = LINE` or `STOP` carry the target's UUID. Reimports
   silently invalidated the targeting.

The boot loader hid the bug because it skipped re-imports when the
DB was already seeded (`lines.count() > 0`). Once the
`GtfsRefreshScheduler` (Phase 0.7) and the admin manual reimport
endpoint started actually triggering reimports, the bug surfaced as
"all our kiosks unbound after the nightly refresh".

## Decision

**Match by `external_id` and preserve UUIDs across imports for
`Agency`, `Line`, `Stop`, `Itinerary`. Wipe and rebuild the
import-only collections (`Schedule`, `ItineraryStop`, `stop_lines`,
calendars, transfers, fares, …).**

### 1. Upsert pattern (`importAgencies`, `importRoutes`,
`importStops`, `importItineraries`)

```java
Map<String, T> existing = repo.findAll().stream()
    .filter(t -> t.getExternalId() != null)
    .collect(toMap(T::getExternalId, identity(), (a, b) -> a));

Set<UUID> seen = new HashSet<>();
for (CSVRecord r : parser) {
    String externalId = r.get("…_id");
    T entity = existing.containsKey(externalId)
        ? existing.get(externalId)
        : new T();
    entity.setExternalId(externalId);
    // … populate fields
    T saved = repo.save(entity);
    seen.add(saved.getId());
}

// Drop or disable orphans
for (T old : existing.values()) {
    if (!seen.contains(old.getId())) {
        if (old instanceof Stop s) {
            s.setDisabled(true);
            repo.save(old);
        } else {
            repo.delete(old);
        }
    }
}
```

### 2. `Stop` orphan handling: disable, don't delete

Stops carry FKs from `Device.stop_id` (no cascade). A hard delete
would cascade-fail or, worse, orphan a kiosk that points at a stop
no longer in the feed. Instead, when an existing Stop's
`external_id` is missing from the new feed:

- Set `Stop.disabled = true` (Phase 0.5a soft-delete flag).
- Save — the kiosk's display state stops surfacing the stop on
  message scopes and the admin UI greys it out, but the FK stays
  valid.
- A Stop that reappears in a later import gets `disabled = false`
  back automatically.

### 3. `Line` / `Itinerary` orphan handling: hard delete

Both can be hard-deleted because:

- Cascade clears their child rows (`schedules`, `itinerary_stops`,
  `stop_lines`).
- The only outside reference is `BroadcastMessage.scope_id`, which
  is not a formal FK. An orphan message simply stops matching any
  active line / stop and the existing message cleanup handles it.

### 4. `Schedule` rebuild

Schedules carry no `external_id` and no outside FK. With the calendar
refactor of Phase 1.4 (`ON DELETE SET NULL` on
`schedules.service_calendar_id`), a re-import would otherwise leave
old schedules with a nulled-out calendar, which the matcher treats as
"always active" — so they'd appear every day until manually purged.

`importSchedules()` now `deleteAllInBatch()` first. Admin-created
schedules get rebuilt next to GTFS schedules; in installs piloted by
GTFS, admin-created schedules are rare in practice. The boot loader's
"skip when seeded" guard keeps non-GTFS installs unaffected.

### 5. `stop_lines` rebuild

`importItineraries()` clears `stop.getLines()` on every stop before
the per-itinerary loop adds the current feed's memberships back.
Without that clearing, a line dropped from the feed kept its
`stop_lines` rows forever.

## Why match by `external_id` rather than synthetic keys

Two reasons:

- **Stability across feeds.** The GTFS `stop_id` / `route_id` /
  `trip_id` is the only key the operator controls. Any other key
  (lat/lon, name) drifts when the feed gets cleaned up.
- **One-line lookup.** `findAll().stream().toMap(externalId, …)`
  is a single round-trip; no JPA-level "find by external_id"
  required, no per-row query.

The collisions that worried us in early planning (different feeds
re-using the same `stop_id`) don't apply: a single transit-display-
hub installation imports a single feed, so the namespace is the
operator's.

## Why trip_id can shift between imports (and why we accept it)

`Itinerary.external_id` is the GTFS trip_id of the *representative
trip* — the one with the most stops in its `(route, direction)`
group. Feeds occasionally renumber trips, and the longest trip can
become a different one between releases. When that happens:

- The old representative trip_id no longer matches anything in the
  new feed.
- A new `Itinerary` row is created for the new representative.
- The old itinerary becomes orphan and gets deleted.

The kiosk's display picks up the new itinerary id seamlessly; the
itinerary admin screen would show one fewer entry transiently. We
accept this churn because anchoring `external_id` on something more
stable (e.g. `(route, direction)` synthetic key) would diverge from
GTFS semantics and complicate cross-feed debugging.

## Trade-offs accepted

- **Schedule volume rebuilt on every import.** A 500k-row feed
  re-inserts 500k rows on each refresh. Postgres handles it; the
  alternative (diff-based update) doesn't pay for itself given the
  refresh cadence is daily, not per-minute.
- **Admin-created schedules are wiped on import.** Acceptable in
  GTFS-piloted installs where admin schedule edits are rare. A
  future phase can tag schedules with `created_by = admin` and
  spare them from the wipe.
- **Disabled stops accumulate.** A station that disappeared three
  feeds ago is still in the table with `disabled = true`. We accept
  the bloat in exchange for kiosk FK stability; an admin sweep tool
  can cull rows older than N days when the operator confirms no
  kiosk references them.
