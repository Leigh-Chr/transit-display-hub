# ADR 0017 — GTFS-Realtime ServiceAlerts

**Status:** Accepted

## Context

GTFS-Realtime layers three independent feeds on top of the static
GTFS schedule:

- **TripUpdates** — per-trip delays and cancellations.
- **VehiclePositions** — live geographic position of buses / trams.
- **ServiceAlerts** — operator-pushed messages ("line 12 closed
  between Centre and Hôtel de Ville due to demonstration").

ServiceAlerts are the easiest to integrate: they target entities by
GTFS id (`route_id`, `stop_id`, `agency_id`) and their semantics map
cleanly to the existing `BroadcastMessage` model. The other two
feeds need per-trip matching infrastructure and are deferred.

The original Phase 3 attempt failed when neither
`com.google.transit:gtfs-realtime-bindings` nor
`org.onebusaway:onebusaway-gtfs-realtime-api` could be resolved
without adding a non-Maven-Central repository.

## Decision

**Generate the Protobuf bindings locally from a vendored
`gtfs-realtime.proto` file, ship a single in-memory cache for
ServiceAlerts only, and overlay the alerts onto the kiosk's
existing `MessageInfo` list.**

### 1. Vendored `.proto` definition

`backend/src/main/proto/gtfs-realtime.proto` carries a subset of the
official GTFS-Realtime spec — enough to parse `Alert` messages
correctly. `TripUpdate` and `VehiclePosition` are stubbed (just
their wire tags) so unknown fields are skipped without error rather
than crashing the parser.

The Gradle Protobuf plugin (`com.google.protobuf` 0.9.4) downloads
the `protoc` binary from Maven Central as an artefact —
`com.google.protobuf:protoc:3.25.5` — and emits the Java bindings
under `build/generated/source/proto/main/java/`. No system-wide
`protoc` install required.

### 2. In-memory cache

`RealtimeAlertCache` (Spring `@Component`) holds an
`AtomicReference<List<AlertSnapshot>>`. The snapshot is a flat,
serialisable subset of the Protobuf payload:

- `id`, `routeExternalIds`, `stopExternalIds`, `agencyExternalIds`,
  `headerText`, `descriptionText`, `url`, `cause`, `effect`,
  `severity`, `activePeriods`.

Three properties drive the cache:

- `app.gtfs-rt.alerts-url` — feed URL (empty disables the cache).
- `app.gtfs-rt.alerts-poll-cron` — defaults to every 30 s.
- `app.gtfs-rt.timeout-seconds` — HTTP read timeout, default 10 s.

`RealtimeAlertScheduler` triggers `refresh()` at the cron cadence
and on `ApplicationReadyEvent` so the first kiosk request after a
restart sees fresh alerts immediately.

### 3. Display overlay

`DisplayStateCalculator` calls
`realtimeAlertCache.activeAlerts(now)` once per render and matches
each alert against the stop's `external_id`, the line `external_id`s
served by the stop, and the agency `external_id`s of those lines.
Alerts with no informed entity surface on every stop ("network-
wide"), the way GTFS-RT spec describes the empty-list case.

Realtime alerts append after persisted broadcast messages, both
capped to the existing `MAX_MESSAGES = 3`. The kiosk renders the
combined list with the same styling — operators can't accidentally
hide a critical realtime alert under three legacy info messages
because the calculator preserves chronological priority of the
persisted ones (which already filter by recency).

### 4. Severity mapping

GTFS-RT carries an explicit `severity_level` field
(`UNKNOWN_SEVERITY` / `INFO` / `WARNING` / `SEVERE`), but most feeds
leave it unset. The mapping:

- `SEVERE` → `CRITICAL`.
- `WARNING` → `WARNING`.
- `INFO` → `INFO`.
- `UNKNOWN_SEVERITY` falls back to `effect` inference:
  `NO_SERVICE` / `STOP_MOVING` → `CRITICAL`,
  `REDUCED_SERVICE` / `SIGNIFICANT_DELAYS` / `DETOUR` /
  `MODIFIED_SERVICE` / `ACCESSIBILITY_ISSUE` → `WARNING`,
  everything else → `INFO`.

### 5. Admin endpoint

`GET /api/admin/realtime/alerts` returns the current snapshot;
`POST /api/admin/realtime/alerts/refresh` polls the feed
synchronously. Both gated by `ROLE_ADMIN` via the existing
`/api/admin/**` rule.

## Why ServiceAlerts only (not TripUpdates / VehiclePositions)

TripUpdates needs a `trip_id → schedule` matching layer that
`Itinerary.external_id` can't satisfy on its own — feeds reference
non-representative trips, and we'd have to persist
`tripId → itineraryId` mapping at import time. That's a phase of
its own.

VehiclePositions needs geographic rendering on a kiosk we don't yet
have. Persisting positions without a UI consumer is dead surface.

ServiceAlerts is the highest-value-to-effort RT feed: every transit
operator's alert API is a ServiceAlerts feed, the matching is by
GTFS id (which we already index), and the existing `MessageInfo`
contract on the kiosk needs no change.

## Why we vendor the .proto file

`com.google.transit:gtfs-realtime-bindings` (the upstream Java
artefact) ships only on Google's Maven repository, not on Maven
Central. Adding the Google repo to `build.gradle.kts` would expand
the trust boundary of every contributor's build. Vendoring the
`.proto` instead:

- Stays Maven-Central-only.
- Pins the spec version explicitly (we control when to upgrade).
- Lets us strip down to ServiceAlerts to keep the generated code
  small.

The cost is one file to keep in sync if the spec ever changes — and
the spec hasn't materially changed in years.

## Trade-offs accepted

- **Stub message bodies for TripUpdate / VehiclePosition.** The
  parser sees them, recognises the wire tags, and skips their
  contents cleanly. A future phase replacing the stubs is purely
  additive.
- **First translation wins for `TranslatedString`.** GTFS-RT carries
  arrays of translated strings; we render the first entry, which by
  convention is the default language. A future phase wiring
  `app.translations.preferred-language` into RT can pick the right
  language at lookup time.
- **No persistence.** The cache is in-memory only. A restart loses
  alerts until the next poll (typically <30 s). Acceptable —
  GTFS-RT is by definition ephemeral.
- **Single cache for all alerts.** No partitioning by route or
  stop — every render scans the full list. At ~10–50 alerts per
  feed this is irrelevant; if it grows, an indexed view can be
  added without changing the contract.
