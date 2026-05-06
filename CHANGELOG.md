# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-05-06

GTFS integration deepened across the model, the import pipeline and the
passenger-facing display. Eighteen Flyway migrations (V6–V23), all
additive except the `lines.code` widening from VARCHAR(10) to
VARCHAR(30). Architecture decisions are captured in `docs/adr/`.

### Added

#### Domain model
- **`LineType` extended** to ten values (`BUS`, `TRAM`, `METRO`, `TRAIN`,
  `FERRY`, `FUNICULAR`, `CABLE_CAR`, `TROLLEYBUS`, `MONORAIL`, `OTHER`)
  with a tier-based `route_type` mapping covering the basic GTFS modes
  (0..12) and the Extended Hierarchical Vehicle Types (100..1799). See
  ADR 0001.
- **`Agency` entity** populated from `agency.txt`. `Line.agency_id`
  becomes the per-line owner of timezone, language and contact info.
  `DisplayStateCalculator` resolves the display zone via Stop →
  Agency → `app.timezone` fallback. See ADR 0002.
- **`FeedInfo` singleton** captures `feed_info.txt` plus source URL,
  SHA-256 and import timestamp. Replaced in place at every successful
  import. See ADR 0003.
- **`ImportAudit` append-only log** records every attempt — successful,
  skipped or failed — with duration, entity counters, status and
  trigger identifier. See ADR 0003.
- **`Transfer` entity** persists `transfers.txt`. Inline on the
  network-map response so the route-finder weights interchanges by
  declared `min_transfer_time` instead of the previous magic constant.
  See ADR 0006.
- **`Attribution` entity** persists `attributions.txt` with role flags
  (producer / operator / authority). Public endpoint.
- **`external_id` columns** on `Stop`, `Line`, `Itinerary`, `Agency`,
  `Attribution` so re-imports can match rows rather than recreate them.
- **`stops.disabled`** soft-delete flag, ready for the matching
  algorithm landing in a follow-up.
- **Stop identity extended** with `short_code` (the signpost id),
  `tts_name` (screen-reader pronunciation), `stop_timezone`,
  `description`, `url`, `wheelchair_boarding`, `platform_code`.
- **Per-itinerary defaults** for `wheelchair_default` and
  `bikes_allowed_default`, computed via majority vote across the trips
  of the same `(route, direction)`. Per-schedule overrides stored
  only when a trip diverges. See ADR 0005.
- **`Schedule` enriched** with `pickup_type`, `drop_off_type`,
  `wheelchair_override`, `bikes_allowed_override`, `timepoint`,
  `frequency_headway_seconds`, `frequency_exact_times`, `block_id`.
  The headway annotation lets the kiosk render "every 4 min" alongside
  the next-departure clock for high-frequency lines.
- **`ItineraryStop.stop_headsign`** drives the destination shown to
  passengers, falling back to the trip-level terminus. See ADR 0004.
- **`Line` enriched** with `text_color` (route_text_color, with YIQ
  fallback for missing values), `continuous_pickup` /
  `continuous_drop_off`, `sort_order`, `description`, `url`. Code
  widened to VARCHAR(30).

#### Import pipeline
- **`GtfsImportOrchestrator`** — single entry point shared by the boot
  loader, the cron scheduler and the admin endpoint. Owns the
  `ReentrantLock`, the streaming SHA-256 and the audit-row lifecycle.
  See ADR 0007.
- **`GtfsRefreshScheduler`** — daily cron at 04:00 by default,
  configurable via `app.data-loader.gtfs.refresh-cron`.
- **Cache validation** in `GtfsDownloader` via `If-Modified-Since` and
  `If-None-Match`, with a sidecar `.meta` file holding the previous
  response's `Last-Modified` and `ETag`. 304 responses reuse the
  cached zip even past the local TTL.
- **Manual reimport endpoint** `POST /api/admin/gtfs/reimport` runs
  synchronously under the admin's identity.
- **Domain util `ColorContrast`** computes a WCAG-aligned foreground
  for any background color via the YIQ luminance formula. Used by the
  importer when `route_text_color` is missing and by `LineService` for
  admin-created lines.

#### API
- `GET /api/agencies` — agency list (any authenticated user).
- `GET /api/admin/feed-info` — current feed metadata (admin).
- `GET /api/admin/import-audit?limit=N` — recent import attempts (admin).
- `POST /api/admin/gtfs/reimport` — force a refresh (admin).
- `GET /api/attributions` — public credit block.
- `LineResponse` now carries `agencyId` / `agencyName` so the admin
  table can show the operating agency without a second request.
- `StopResponse` now carries `shortCode`, `platformCode`,
  `description`, `url`, `wheelchairBoarding` so the admin stop screen
  surfaces the full GTFS identity in one payload.

#### Frontend
- **Kiosk display** renders accessibility (`accessible_forward` /
  `do_not_disturb`), bicycle (`directions_bike`) and pickup-type
  badges next to each arrival, plus a discreet `stop_code` sub-title
  so passengers can confirm the signpost id printed at the stop.
- **Admin dashboard** gains a `FeedInfoCard` surfacing publisher,
  version, validity range and days-until-expiry (red expired, amber
  expiring within 7 days, default otherwise).
- **`lineTextColor` helper** prefers the server-resolved foreground
  before the YIQ fallback. Used by kiosk, hub display, schematic-map
  and admin dashboard line badges.
- **Route-finder** consumes the inline `transfers` from the
  network-map snapshot. Type 3 transfers (impossible) are pruned;
  type 1 (timed) drops to near-zero; types 0/2 use `min_transfer_time`
  with a 180s default.

### Changed
- `Line.code` column widens to `VARCHAR(30)` (was 10). The kiosk badge
  CSS already auto-shrinks for long codes.
- `app.timezone` becomes a fallback rather than the primary source.
  Existing installs without GTFS data behave identically.

### Fixed
- `route_type = 12` no longer mis-maps to `TRAM` (it's now `MONORAIL`).
- Ferries (`route_type = 4`, `1000-1299`), trolleybuses (11, 800-899),
  funiculars (7, 1400-1499) and aerial cable cars (6, 1300-1399) are
  no longer silently bucketed as `BUS`.

---

## [0.2.0] - 2026-05-06

### Fixed (correctness)

- **Heartbeat WebSocket** : added the missing `@MessageMapping("/device/heartbeat")` handler. Previously every kiosk device flipped to OFFLINE 2 minutes after authenticating because nothing on the backend was reading the heartbeat the front-end was sending.
- **Cross-day schedule lookup** : `DisplayStateCalculator` now issues a second query when the 30-minute window crosses midnight, so kiosks no longer go blank in the late evening.
- **Migration V3** : added the missing `lines.category` column the entity expected; `ddl-auto: validate` would have refused to boot in prod.
- **Hub partial failure** : a deleted/typo'd stop in the hub URL no longer takes down the entire screen — the others keep rendering.
- **Last admin guard** : the backend now refuses any delete/update that would leave zero active administrators (the front-end check alone was a comment claiming a server-side guarantee that didn't exist).

### Fixed (data integrity)

- **`LineService.deleteLine`** : itinerary stops are removed before bulk-deleting itineraries; the FK had no `ON DELETE CASCADE`.
- **`ItineraryService.addStopToItinerary`** : positions shifted via a single SQL bulk update so the `(itinerary_id, position)` unique constraint isn't violated mid-flush.
- **`ScheduleService`** : refuses schedules on empty itineraries or itineraries that don't actually serve the target stop (announcements that misled passengers).
- **`@Version` optimistic locking** added on Stop, Line, Itinerary, Schedule, BroadcastMessage and User. Concurrent admin edits now surface as 409 instead of silent last-writer-wins.
- **`StopDeletedEvent`** : kiosks subscribed to a deleted stop receive a final CRITICAL "stop removed" payload instead of freezing on stale data.

### Security

- **STOMP CONNECT validates the JWT** via a `ChannelInterceptor` and binds the principal to the session — anonymous connections still allowed for public kiosks but invalid tokens are now rejected.
- **NETWORK-scope messages require ROLE_ADMIN** at service-level (`assertAuthorizedForScope`); agents can no longer push network-wide alerts.
- **Logout disconnects all live WebSocket sessions** (display, hub, network-map) instead of leaving them subscribed for an account that no longer has a token.
- **Snapshot on reconnect** : every WS service emits `reconnected$`; consumers (kiosk, hub, network-map) re-fetch their REST snapshot after a disconnect to catch the deletes/renames the broker may have skipped.
- **JWT secret** moved out of `application.yml` (env var with a labelled dev fallback); prod still refuses to boot without `JWT_SECRET`.
- **`JwtAuthenticationFilter`** sets `WWW-Authenticate: Bearer error="invalid_token"` so the front can distinguish "session expired" from "no session".
- **30-second clock-skew leeway** on both the JWT parser and the front-end's `isTokenExpired` to avoid spurious 401s when client and server drift apart.
- **CORS allowed origins** now read from `app.cors.allowed-origins` env-driven CSV instead of localhost-only literals.

### Performance

- **N+1 elimination** on stop and message listings via `countByStopIdIn` and bulk `findAllById`.
- **V5 migration** : added `idx_stop_lines_line` and `idx_devices_stop` for the FKs that were forcing seq scans.
- **Targeted NETWORK fan-out** : `recalculateAndPushAll` intersects affected stops with active subscribers, no longer recalculating thousands of unwatched displays per network-wide message.
- **Aggregated dashboard endpoint** `/api/admin/dashboard` replaces the legacy `forkJoin` of five non-paginated GETs that downloaded the entire domain on every dashboard open.
- **`/topic/network-map` subscriber tracking** : `NetworkMapService` skips the recompute and broadcast when nobody is listening.
- **ETag / 304 Not Modified** on `/api/network-map`, `/api/lines`, `/api/stops`, `/api/itineraries`.
- **`pg_trgm` GIN indexes** (Postgres-only opt-in via `db/migration-postgres/`) for fast `LIKE '%term%'` admin search.

### Changed

- `BroadcastMessage.isActiveAt` is now half-open `[start, end)` to align with the SQL repository, removing the one-nanosecond hole between domain and DB.
- `app.timezone` (default `Europe/Paris`) drives `DisplayStateCalculator.LocalTime.now(zone)` so a JVM running in UTC no longer offsets every kiosk by an hour.
- `DisplayStateCalculator.versionMap` is purged when a stop is deleted (no more unbounded growth on long-lived processes).
- Frontend kiosk + hub ignore out-of-order WS pushes (incoming `version < current`).
- 401 race in the auth interceptor : a module-level `isLoggingOut` flag guards against N parallel 401s triggering N redirects.
- Self-hosted fonts (`@fontsource/inter`, `@fontsource/roboto`, `material-icons`) replace the Google Fonts CDN — privacy + offline resilience + faster initial paint.
- `JwtAuthenticationFilter` now uses `org.jspecify.annotations.NonNull` instead of the deprecated `org.springframework.lang.NonNull`.

---

## [0.1.0] - 2026-02-01

### Added

#### Backend
- Initialized Spring Boot 3.3.5 project with Java 21
- Domain entities: Line, Stop, TimedEntry, BroadcastMessage, Device, User
- JPA repositories for all entities
- Business services: LineService, StopService, ScheduleService, MessageService, DeviceService
- DisplayState service with real-time arrival calculation
- JWT authentication with JwtService and security filter
- STOMP WebSocket configuration for real-time updates
- Domain events to trigger display state recalculation
- REST controllers: Auth, Lines, Stops, Schedules, Messages, Devices, Display
- GlobalExceptionHandler for unified error handling
- DataLoader creating default admin and agent users
- H2 (development) and PostgreSQL (production) support

#### Frontend
- Initialized Angular 18 project with standalone components
- Tailwind CSS configuration for styling
- Authentication service with JWT management
- Guard and interceptor for route protection
- API services for all resources (Lines, Stops, Schedules, Messages, Devices, Display)
- WebSocket service with automatic reconnection
- Admin layout with sidebar navigation
- Dashboard with statistics and alerts
- Line management screen (CRUD)
- Stop management screen with line filtering
- Schedule management screen with day selection
- Broadcast message management screen with scope
- Device management screen with token display
- Kiosk component for real-time public display
- Angular Signals support for reactivity

#### Documentation
- Main project README
- Installation guide
- REST API documentation
- Developer guide
- Deployment guide
- User guide

#### BMad Artifacts
- PRD (Product Requirements Document)
- UX Design Specification
- Architecture Document
- 10 Epics with 37 Stories
- Implementation Readiness Report
- Sprint Status tracking

### Technical
- Gradle 9.3.1 for backend build
- Angular CLI for frontend build
- TypeScript strict mode
- Bean Validation (backend)
- Signals and computed for reactivity (frontend)

---

## Change Types

- `Added`: new features
- `Changed`: changes to existing features
- `Deprecated`: features soon to be removed
- `Removed`: removed features
- `Fixed`: bug fixes
- `Security`: vulnerability fixes
