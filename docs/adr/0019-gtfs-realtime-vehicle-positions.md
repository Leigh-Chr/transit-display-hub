# ADR 0019 — GTFS-Realtime VehiclePositions

**Status:** Accepted

## Context

After ServiceAlerts (ADR 0017) and TripUpdates (ADR 0018), the third
GTFS-Realtime feed — VehiclePositions — completes the spec: live
geographic position, bearing, speed, occupancy and congestion of
each vehicle running the network. Operator-facing utility:

- Ops dashboards know which buses are currently in service.
- Integration testing — comparing the position feed to the
  scheduled trip helps debug feed quality.
- Future passenger surface: a moving icon on a network map, an
  "occupancy" badge ("plein" / "places assises") on the kiosk
  arrival rows.

The kiosk doesn't yet render a map and the existing displays don't
need vehicle-level data, so this phase persists the snapshot and
exposes it via an admin endpoint only — no passenger overlay.

## Decision

**Persist the latest VehiclePositions snapshot in memory, expose
via `GET /api/admin/realtime/vehicles`. No passenger-facing
integration in this phase.**

### 1. Cache shape

`RealtimeVehiclePositionCache` mirrors the pattern from
`RealtimeAlertCache` / `RealtimeTripUpdateCache`:

- `AtomicReference<List<VehicleSnapshot>>` for lock-free reads.
- `VehicleSnapshot` is a flat record carrying every notable GTFS-RT
  field — vehicle id / label, trip / route id, lat / lon / bearing
  / speed, current status, stop id / sequence, congestion,
  occupancy (status + percentage), timestamp.

The cache returns the snapshot pre-sorted by `(route_id, vehicle_id)`
so the admin page is stable across refreshes.

### 2. Polling cadence

VehiclePositions naturally update faster than alerts and trip
updates — a bus moves continuously, not only at events. Default cron
is **15 s** (vs 30 s for alerts / trip updates) via
`app.gtfs-rt.vehicle-positions-poll-cron`.

`app.gtfs-rt.vehicle-positions-url` controls the feed URL; empty
disables the polling and the admin endpoint returns an empty list.

### 3. Endpoint shape

`GET /api/admin/realtime/vehicles` returns the snapshot as
`VehiclePositionResponse` rows. `POST .../refresh` forces an
immediate poll for ad-hoc inspection. Both gated by `ROLE_ADMIN`
through the existing `/api/admin/**` rule.

We expose every GTFS-RT field as-is rather than computing derived
values (km/h from m/s, "approaching" from `current_status`) so a
future map renderer or admin dashboard can apply its own
formatting.

## Why we don't apply VehiclePositions to the kiosk yet

Three blockers:

1. **No map renderer.** The schematic network map is positional,
   not geographic — it can't render lat/lon points without a
   coordinate transform that doesn't exist yet.
2. **Stop-level proximity is already covered by TripUpdates.** The
   "is this bus close to the stop?" question maps to
   TripUpdate `current_stop_sequence` + `STOPPED_AT` /
   `IN_TRANSIT_TO`, not to a position. A kiosk could surface
   "bus is at the previous stop" with TripUpdates alone.
3. **Occupancy as a kiosk badge** needs UX design (text vs icon,
   "plein" vs "places debout", colour scheme). That's a
   passenger-UX phase of its own.

The data being available behind the admin endpoint means the moment
any of those blockers lifts, the integration is one DTO change.

## Trade-offs accepted

- **No persistence layer.** A restart loses the snapshot until the
  next poll (typically <15 s). Acceptable — VehiclePositions is by
  design ephemeral.
- **No history.** We don't keep the last N snapshots; the operator
  sees only "now". A future analytics phase would write positions
  to a time-series store (TimescaleDB, ClickHouse), not to JPA.
- **Full feed parsed every poll.** A 5 000-vehicle feed (Paris RATP
  scale) parses in under 100 ms; the cache replace is a single
  reference assignment. Diffing positions instead of replacing
  would only matter at numbers we don't have.
