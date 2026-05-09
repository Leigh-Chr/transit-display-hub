# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.8.1] - 2026-05-09

Quality pass on top of 0.8.0: the after-Phase-1.3 / Fares-v2 work is now
backed by regression tests, every REST controller has integration
coverage, the dev boot logs zero warnings, and the admin pagination
paths no longer drag the entire result set into memory.

### Added
- **Regression tests on the post-Phase-1.3 surface.**
  `NetworkMapServiceTest` gets eleven new tests pinning parent /
  platform collapse, itinerary-stop UUID remap, intra-station transfer
  drop, parent-area / parent-line / hasOnDemand / wheelchair
  aggregation. `schematic-map.component.spec` adds thirteen tests on
  the accessibility filter, the zone chip filter, and the
  frequency-scaled stroke width. All previously shipped without
  coverage.
- **Integration coverage for the fifteen previously-untested REST
  controllers.** One `*ControllerIntegrationTest` per controller —
  AgencyController, AttributionController, BookingRuleController,
  DashboardController, DataOverviewController, FareController,
  FaresV2Controller, FeedInfoController, GtfsAdminController,
  ImportAuditController, PathwayController, RealtimeAlertController,
  RealtimeVehicleController, ShapeController, TranslationController.
  Every test asserts the auth tier (anon / agent / admin), the happy
  path shape, and the error edges (missing query param, unknown id,
  disabled feed). GtfsAdminController's reimport endpoint uses
  `@MockitoBean` on the orchestrator to pin the SUCCESS / FAILED /
  SKIPPED_UNCHANGED branches deterministically.
- **ADR 0023, 0024, 0025** documenting the two-step pagination
  pattern, the `Clock` injection rule for time-sensitive domain
  services, and the section-boundary flush strategy in the GTFS
  importer.

### Changed
- **Two-step pagination** across `LineRepository`,
  `ItineraryRepository` and `StopRepository`. Pages over ids first
  (no JOIN FETCH so SQL paginates), then hydrates the page's entities
  with their collections via `WHERE id IN (:ids)`. Replaces the
  paginated `WithStopsAndRoutes` / `WithLineAndStops` /
  `WithLinesAndDevices` queries that emitted HHH90003004
  ("firstResult/maxResults specified with collection fetch; applying
  in memory") on every paginated admin call. Pagination now scales
  with page size, not with table size.
- **`DisplayStateCalculator` takes a `Clock` dependency** instead of
  reading `LocalTime.now()` / `Instant.now()` directly. Production
  wires `Clock.systemDefaultZone()` via a new `ClockConfig` bean;
  tests pin `Clock.fixed(2026-01-15T10:00:00Z, Europe/Paris)` so the
  30-minute upcoming-departure window never crosses midnight at
  test-time. Fixes a pre-existing flake where running the suite past
  23:30 local rerouted the calculator to its cross-midnight branch
  and tripped Mockito's strict-stubbing audit on every DSC test.
- **Bounded persistence context during the GTFS seed.**
  `GtfsImportService` now flushes at section boundaries (between
  parent / platform stop passes, after `importStops`, after
  `importShapes`, after `importItineraries`). Eliminates the
  HHH90032022 "batch could not be sorted (might indicate a circular
  entity relationship)" warning that fired on every dev boot, without
  disabling `order_inserts` (which would have broken the scheduled
  re-import with FK violations).
- **Caffeine caches enable `recordStats()`** so Micrometer's
  `CaffeineCacheMetrics` binder gets the hit / miss / load counters
  it expected at startup.
- **`spring.jpa.open-in-view: false`** in the dev profile. Every
  controller path either reads through a JOIN-FETCH query or sits
  behind a service `@Transactional`, so OSIV was masking missing
  fetches with silent N+1 lazy loads at JSON-serialization time.
  Verified against the seeded Grenoble feed: every API endpoint
  exercising lazy collections still returns 200 with no
  `LazyInitializationException`.

### Fixed
- **Kiosk `formatRelativeTime` / `getMinutesUntil` flake.** Tests
  that captured `now` at file-load time and asserted on the relative
  minute count could straddle a minute boundary if execution started
  late. Pinned via `vi.useFakeTimers({ toFake: ['Date'] })` plus
  `vi.setSystemTime` in the affected describes; assertions now use
  hard-coded times against the frozen clock.
- **`GlobalExceptionHandler` no longer dumps 500 on client mistakes.**
  Three new handlers map predictable client-side errors to the
  appropriate 4xx code: `MissingServletRequestParameterException` →
  400 with the missing parameter name in the body,
  `MethodArgumentTypeMismatchException` → 400 (a malformed UUID in a
  path variable used to bubble up as 500), and
  `NoResourceFoundException` → 404 (typo'd path now looks like
  not-found instead of server bug). Surfaced while writing the
  TranslationController + DisplayController integration tests.

## [0.8.0] - 2026-05-07

GTFS Fares v2 lands alongside v1, the admin UI gains read-only
browsers for every previously-headless backend endpoint (realtime,
fares, TAD, translations, import history, pathways, shapes), and the
schedule import produces real per-departure rows from
`frequencies.txt` instead of a single annotated row.

### Added
- **GTFS Fares v2** (ADR 0021). Eight new tables persist the v2 model
  alongside v1: `areas`, `stop_areas`, `timeframes`, `fare_products`,
  `fare_leg_rules`, `fare_transfer_rules`, plus `networks` /
  `route_networks` and `fare_media` from the V31 follow-up. Coexists
  with v1 — feeds in transition publish both, both get persisted.
  V34 adds `fare_leg_join_rules.txt` — closing the v2 spec — as its
  own table with stop FKs (network references stay raw strings).
- **Schematic network-map enrichment** (Phase 1.3 follow-up). The
  map collapses parent_station + child platforms back into one
  logical node — fixing the duplicate-dots regression introduced by
  Phase 1.3's per-platform persistence. Parent stations gather the
  union of their children's line codes, transfers between platforms
  collapse to transfers between parents (intra-station transfers
  drop off as they're walking inside the same node). Each
  `NetworkStop` now carries `wheelchairBoarding` and `hasOnDemand`
  so the popup surfaces accessibility / TAD pills, and the
  schematic adds a dashed ring around on-request stops to flag
  booking-required service at a glance.
- **Per-arrival platform badge on the kiosk** (ADR 0022 follow-up).
  `ArrivalInfo.platformCode` carries the actual stop's platform_code
  through DisplayState; the kiosk renders a badge between the line
  code and the destination when the per-arrival platform differs
  from the stop's own (parent-station kiosks aggregating multiple
  quays). On regular per-platform kiosks the value is suppressed to
  avoid redundancy. Hub display now prefers the per-arrival platform
  over the stop-level one too.
- **Per-platform Stops** (V33, ADR 0022). The importer no longer
  collapses parent_station chains. Each GTFS platform persists as
  its own Stop with `parent_stop_id` pointing at its station, plus
  the station itself. Schedules anchor to the actual platform; a
  kiosk bound to a parent station aggregates schedules from every
  child platform via a new `findChildIds` repo + `IN`-based
  schedule query. Existing devices bound to a previously-collapsed
  parent keep their UUID and start aggregating their newly-created
  platforms automatically — no rebinding needed. The downstream
  importers (itineraries, schedules, transfers, pathways, areas)
  shed their `rootStopIdByGtfsId` parent-walk: a GTFS `stop_id`
  resolves directly to the persisted Stop now.
- **TAD booking link on schedules** (V32). Each `Schedule` now carries
  optional `pickupBookingRule` / `dropOffBookingRule` FKs from
  `stop_times.pickup_booking_rule_id` / `drop_off_booking_rule_id`,
  populated at import. Closes the previously-orphaned link between
  `booking_rules.txt` (Phase 5.3) and individual arrivals.
- **Kiosk booking CTA on TAD arrivals**. When an arrival's pickup is
  `ON_REQUEST_AGENCY` / `ON_REQUEST_DRIVER` and a booking rule is
  attached, the kiosk renders a prominent badge with the phone
  number and minimum prior notice ("≥ 30 min"). `ArrivalInfo.booking`
  surfaces the booking rule's phone, URL, info URL, message and
  prior-notice minutes; null on regular fixed-route trips.
  HubArrivalInfo carries the same field. Drop-off bookings stay
  internal — surfacing them to a passenger boarding the trip would
  confuse more than it helps.
- **Aggregate browse endpoint** `GET /api/admin/fares-v2` returns the
  entire v2 graph (areas, timeframes, products, leg rules, transfer
  rules) in a single round-trip.
- **Admin browser pages** for every previously-headless endpoint —
  `/admin/realtime` (alerts + vehicles), `/admin/gtfs-data` (Fares v1,
  Fares v2, TAD, Translations), `/admin/import-audit`,
  `/admin/pathways` (per-stop autocomplete), `/admin/shapes` (SVG
  polyline preview, no Leaflet dependency).
- **Frequency fan-out** at import (ADR 0020). `frequencies.txt`
  windows now expand into per-departure `Schedule` rows
  (`windowStart + (stopTime - tripStart)` for every trip start in
  `[start_time, end_time)` step `headway_secs`). Trips with multiple
  windows (peak / off-peak / late) emit per-window rows with the
  right headway each.
- **OpenAPI tags** on the eight remaining admin controllers (Lines,
  Stops, Itineraries, Schedules, Devices, Messages, Users,
  Dashboard). Swagger UI groups every route under an explicit
  `Administration — *` heading; no more "default" bucket.

### Changed
- `loadFrequencies` returns `Map<String, List<FrequencyWindow>>`
  (start, end, headway, exact_times) instead of collapsing to the
  smallest declared headway. Loaded windows feed the fan-out
  iterator in `importSchedules`.
- Schedule importer makes one extra streaming pass over
  `stop_times.txt` to anchor trip start times — restricted to trips
  with frequency windows, so feeds without `frequencies.txt` pay
  zero overhead.

## [0.7.0] - 2026-05-07

OpenAPI documentation reaches feature parity with the controller surface
— every admin route is now grouped under a tag — and `frequencies.txt`
finally drives actual departures, not just an "every X min" badge.

### Added
- **Frequency fan-out at import** (ADR 0020). High-frequency lines
  declared with `frequencies.txt` windows now persist one `Schedule`
  per generated departure (`windowStart + (stopTime - tripStart)` for
  every trip start in `[start_time, end_time)` step `headway_secs`)
  instead of a single annotated row per stop_time. The kiosk shows
  real upcoming times on metro / BRT lines, the hub display can
  aggregate frequency-mode arrivals, and the "every X min" badge
  keeps appearing because the headway annotation is preserved on
  every fan-out row. Trips with multiple windows (peak / off-peak /
  late) emit per-window rows with the right headway each.
- **OpenAPI tags** on the eight remaining admin controllers
  (Lines, Stops, Itineraries, Schedules, Devices, Messages, Users,
  Dashboard). Swagger UI groups every route under an explicit
  `Administration — *` heading; no more "default" bucket.

### Changed
- `loadFrequencies` returns `Map<String, List<FrequencyWindow>>`
  (start, end, headway, exact_times) instead of collapsing to the
  smallest declared headway. Loaded windows feed the fan-out
  iterator in `importSchedules`.
- Schedule importer makes one extra streaming pass over
  `stop_times.txt` to anchor trip start times — restricted to trips
  with frequency windows, so feeds without `frequencies.txt` pay
  zero overhead.

## [0.6.0] - 2026-05-07

The kiosk turns "live". GTFS-Realtime ServiceAlerts and TripUpdates
are polled from the agency's feed every 30 s, alerts overlay onto
the existing message ticker, and per-arrival delays surface as a
green / amber / red badge with the projected time. Static GTFS gets
its remaining major files persisted (location groups, booking rules,
fare attributes, shapes), and the import becomes idempotent —
re-imports preserve UUIDs so kiosks no longer unbind on the nightly
refresh. Architecture decisions captured in `docs/adr/0012..0018`.

### Added

#### GTFS-Realtime alerts (Phase 3 light)
- **`gtfs-realtime.proto` vendored** at
  `backend/src/main/proto/gtfs-realtime.proto`. The Gradle Protobuf
  plugin generates the Java bindings at build time — no system-wide
  `protoc` install required, no non-Maven-Central repos.
- **`RealtimeAlertCache`** holds the parsed snapshot atomically;
  `RealtimeAlertScheduler` polls the configured URL on
  `app.gtfs-rt.alerts-poll-cron` (default every 30 s) and on
  `ApplicationReadyEvent` so the first kiosk request after boot
  sees alerts immediately. See ADR 0017.
- **Display overlay** — alerts matching the stop / line / agency
  external_id append to the existing `MessageInfo` list with a
  GTFS-RT-derived severity (`SEVERE` → `CRITICAL`,
  `WARNING` → `WARNING`, otherwise inferred from `effect`).
- **`GET /api/admin/realtime/alerts`** + `POST .../refresh` for
  admin browse and on-demand re-poll.

#### GTFS-Realtime trip updates (Phase 3.2)
- **`RealtimeTripUpdateCache`** indexes per-trip / per-stop
  delay seconds (`Map<tripId, TripAdjustment>`), polled at the same
  cadence as alerts via `app.gtfs-rt.trip-updates-url`.
- **`ArrivalInfo.realtimeDelaySeconds`** — positive late, negative
  early, null when no update covers the arrival. Mirrored on
  `HubArrivalInfo`. The kiosk renders a "live" badge whenever it's
  non-null and projects the displayed time as
  `scheduledTime + delay` so passengers see both numbers when they
  matter. See ADR 0018.
- **SKIPPED stop_time_updates** drop the schedule entirely — the
  kiosk doesn't show a phantom departure with a delay badge.

#### Demand-responsive transit (Phase 5.3)
- **`LocationGroup` + `LocationGroupStop`** persist location
  bundles for flexible-route services.
- **`BookingRule` entity** captures the booking channel (phone /
  URL), advance-notice duration window, and prior-day cutoff.
- **`GET /api/admin/booking-rules`** sorts rules by booking type
  (real-time → same-day → prior-days). See ADR 0015.

### Changed
- **GTFS import is now idempotent** (Phase 0.5c) — `Agency` /
  `Line` / `Stop` / `Itinerary` upsert by `external_id` so
  `Device.stop_id` and `BroadcastMessage.scope_id` stay stable
  across re-imports. Stops that disappear from the feed are
  flagged `disabled = true` rather than deleted, preserving the FK
  for any kiosk still pointing at them. Re-enabled automatically
  if the stop reappears. See ADR 0013.
- **Schedules are wiped on every import** — required to keep them
  consistent with the wiped-and-rebuilt `service_calendars` table
  introduced in 0.4.0.
- **OpenAPI controllers tagged in French** (Phase 7b) — see
  ADR 0016 for the convention.

### Frontend
- **Kiosk renders the live badge** with projected time. Late
  arrivals (>60 s) get a red tint, early (<−60 s) amber, on-time a
  green pulse. The scheduled time remains in the payload so a
  future "scheduled / live" tooltip can compare both.

---

## [0.5.0] - 2026-05-07

Round of GTFS coverage hardening: imports now preserve UUIDs across
runs (so kiosks no longer unbind on the nightly refresh), Fares v1
and shapes are persisted, and operators get a Swagger-UI shortcut to
the API. Five new Flyway migrations (V24 already shipped in 0.4.0;
V25–V28 land here for pathways/levels, translations, fares,
shapes), all additive. Architecture decisions captured in
`docs/adr/0009..0014`.

### Added

#### Idempotent import (Phase 0.5c)
- **Upsert by `external_id`** for `Agency`, `Line`, `Stop`,
  `Itinerary`. Re-imports update the same rows in place rather than
  recreating them — UUIDs stay stable, `Device.stop_id` and
  `BroadcastMessage.scope_id` survive. See ADR 0013.
- **Stops dropped from the feed** are now flagged
  `disabled = true` instead of being deleted, so kiosks holding the
  FK don't lose their binding. Re-enabled automatically when the
  stop reappears.
- **Lines / Itineraries dropped** are hard-deleted (cascade clears
  their schedules / itinerary stops / stop_lines).
- **Schedules wiped on every import** (no `external_id`, no outside
  FK) — Phase 1.4's calendar refactor made this necessary so
  schedules with a nulled-out `service_calendar_id` don't become
  "always active" zombies.
- **`stop_lines` rebuilt** on every import so a line dropped from
  the feed actually disappears from `stop.getLines()`.

#### GTFS Fares v1 (Phase 4.1)
- **`FareAttribute` entity** persists `fare_attributes.txt`: price
  (`BigDecimal`, scale 4), currency (ISO-4217), payment method
  (`ON_BOARD` | `PREPAID`), transfer policy (`null` = unlimited
  per spec), optional agency FK.
- **`FareRule` entity** persists `fare_rules.txt` with optional
  route FK plus three free-form zone strings (`origin_id`,
  `destination_id`, `contains_id`). See ADR 0012.
- **`GET /api/admin/fares`** returns every fare attribute with its
  rules inline, sorted cheapest first.

#### GTFS shapes (Phase 2.1)
- **`Shape` + `ShapePoint` entities** persist `shapes.txt`. The
  `(shape_id, sequence)` pair is unique by spec; we enforce it at
  the schema level so a malformed feed surfaces immediately.
- **`Itinerary.shape`** FK (nullable) links to the representative
  trip's `shape_id`. Null = the feed didn't ship a shape for this
  trip. See ADR 0014.
- **`GET /api/itineraries/{id}/shape`** exposes the polyline as
  `[{lat, lon, distTraveled?}]`. Returns 204 (not 404) when the
  itinerary exists but has no shape, so a future map view falls
  back to stop-to-stop lines without distinguishing
  itinerary-not-found from feed-shipped-no-shape.

### Changed
- `GtfsImportService.TripInfo` now carries `shapeId` so the
  itinerary loop can wire the shape FK during the same upsert.
- `importItineraries()` clears `stop.getLines()` before rebuilding
  to honour the idempotent-import contract.
- `importSchedules()` now wipes the schedules table at the start
  (was implicit before — the boot loader's seed-once guard masked
  the issue).

---

## [0.4.0] - 2026-05-07

Second wave of GTFS integration: the kiosk now respects the day of
the week, surfaces indoor topology, supports localised feeds, and the
API gains a bundled Swagger UI. Three new Flyway migrations (V24–V26),
all additive except for `schedules`'s unique key swap to allow
multiple service calendars to share `(stop, itinerary, time)` triples.
Architecture decisions are captured in `docs/adr/0008..0011`.

### Added

#### Multi-day service calendars (Phase 1.4)
- **`ServiceCalendar` and `ServiceCalendarException` entities** mirror
  GTFS `calendar.txt` and `calendar_dates.txt`. Persisted instead of
  collapsed onto a single representative day as before.
- **`Schedule.service_calendar_id`** FK (nullable) ties each row to
  its calendar. Null = "always active" so admin-created and legacy
  rows keep showing every day. See ADR 0008.
- **`ServiceCalendarMatcher` domain util** decides whether a calendar
  is active on a given date — exception > validity range > weekly
  pattern, matching the GTFS resolution order.
- **`DisplayStateCalculator` filters arrivals by day**, with the
  cross-midnight tail evaluated against tomorrow's calendar.
- Unique key on `schedules` swapped from
  `(stop, itinerary, time)` to
  `(stop, itinerary, time, service_calendar_id)` so two services
  can share a triple as long as they run on different days.

#### Indoor topology (Phase 5.1)
- **`StationLevel` entity** persists `levels.txt` (level_index plus
  level_name) for every floor of a station.
- **`Pathway` entity** persists `pathways.txt` with the full GTFS
  payload: `pathway_mode` (`WALKWAY` / `STAIRS` / `MOVING_SIDEWALK` /
  `ESCALATOR` / `ELEVATOR` / `FARE_GATE` / `EXIT_GATE`), bidirectional
  flag, optional length / traversal time / stair count / max slope /
  min width / signpost text. See ADR 0009.
- **`GET /api/stops/{id}/pathways`** returns every pathway touching
  the stop, outgoing first, then sorted by mode and signpost text.

#### Translations (Phase 4.2)
- **`Translation` entity** persists `translations.txt` polymorphically
  (`table_name`, `record_id`, `field_value`, `field_name`, `language`,
  `translation`).
- **`TranslationLookup` domain util** loads the chosen language into
  an in-memory map keyed by `(table, record_id, field)` for O(1)
  resolution at render time.
- **`app.translations.preferred-language`** config (BCP-47 tag, empty
  by default) drives stop / line / destination translation across
  the kiosk and hub displays. Empty = no behaviour change. See
  ADR 0010.
- **`GET /api/admin/translations?lang=fr&table=stops`** lets admins
  audit which rows are localised before flipping the property.

#### API discoverability (Phase 7)
- **Springdoc OpenAPI** bundled at `/swagger-ui.html` and
  `/v3/api-docs`. Bearer-JWT security scheme declared so the
  "Authorize" button on Swagger UI takes a token from
  `POST /api/auth/login` and re-uses it on every "Try it out" call.
  See ADR 0011.

### Changed
- `GtfsImportService` now imports schedules for **every** active
  service rather than collapsing onto a single representative day,
  multiplying the schedule volume by the number of services in the
  feed (typically 3–10×). Postgres handles it without indexing
  changes; the kiosk SQL still returns ≤ 50 rows per stop per
  30-minute window before filtering.
- `GtfsImportService` adds top-level imports for `levels.txt`,
  `pathways.txt` and `translations.txt`.

---

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
