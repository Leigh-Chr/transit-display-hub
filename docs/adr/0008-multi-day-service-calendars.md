# ADR 0008 — Multi-day service calendars

**Status:** Accepted

## Context

GTFS expresses *which days a trip runs* through `calendar.txt` (weekly
pattern over a date range) and `calendar_dates.txt` (per-date
exceptions). A typical feed declares 5–15 services — `weekday`,
`saturday`, `sunday`, `holiday`, `summer-weekday`, etc. — and every
trip references one of them via `trips.service_id`.

Until Phase 1.4 our importer collapsed all of this onto a single
*representative day*: it scanned ±30 days from `LocalDate.now()`,
picked the first date with active services, and imported only the
trips of those services. The result: kiosks showed the same arrival
list every day, regardless of the actual day of the week. A Sunday
morning with a "weekday" service active in the system would still
display weekday-only departures.

## Decision

**Persist every service calendar and link each schedule to its
calendar; let the display calculator filter by the current day.**

### 1. Domain model

Two new entities:

- `ServiceCalendar` — `external_id` (= GTFS `service_id`),
  `start_date`, `end_date`, seven `boolean` weekday flags. Helper
  `daysOfWeek()` rebuilds an `EnumSet<DayOfWeek>` for matchers.
- `ServiceCalendarException` — child of `ServiceCalendar`, mirrors a
  single row of `calendar_dates.txt` with `(date, ADDED|REMOVED)`.

`Schedule.serviceCalendar` is a **nullable** `@ManyToOne`. A null FK
means "always active" — it covers admin-created schedules and any
legacy row imported before this phase. The display matcher treats
`null` as "show every day", so existing installs keep working without
a backfill.

### 2. Unique-key migration

The previous `uk_schedule_stop_itinerary_time` constraint disallowed
two services running the same `(stop, itinerary, time)` triple. With
multi-day persistence that combination is legitimate — `weekday` and
`saturday` can both run a 14:00 departure on the same line at the
same stop. V24 drops the old UK and creates
`uk_schedule_stop_itinerary_time_calendar` over
`(stop_id, itinerary_id, time, service_calendar_id)`. Standard SQL
treats `NULL ≠ NULL` inside a unique constraint, so admin-created
schedules with no calendar still uniquify on the original triple.

### 3. Import pipeline

`GtfsImportService`:

- Renamed the in-memory parsing record to `ServiceCalendarSnapshot` to
  free the entity name.
- New `persistServiceCalendars()` wipes the calendar tables (so
  re-imports start clean) and saves one `ServiceCalendar` plus its
  `ServiceCalendarException` rows per service.
- `importSchedules()` no longer filters by `pickActiveServices` — it
  imports schedules for **every** service the feed declares and tags
  each row with the right `serviceCalendar`. The old
  reference-date logic is kept only as an info-log so admins still
  see "feed valid for $date" in the boot summary.

### 4. Display filtering

`DisplayStateCalculator`:

- Pre-loads every calendar with its exceptions in one query
  (`findAllWithExceptions()`) at the start of `calculateForStop`. The
  count is bounded (~10–20), so we keep the matcher in memory rather
  than complicating the schedule SQL with a service-active subquery.
- Calls `ServiceCalendarMatcher.isActive(calendar, effectiveDate)`
  per arrival. Schedules pulled from the cross-midnight tail are
  matched against tomorrow's calendar instead of today's.

`ServiceCalendarMatcher`:

```
exception (ADDED|REMOVED) > validity range > weekly pattern
```

The exception check runs first because GTFS lets `calendar_dates.txt`
override everything else for that exact date — it's how feeds
encode public holidays and one-off cancellations.

## Why filter in Java rather than in SQL

Two reasons:

1. **Bounded calendar count.** A feed has 10–20 calendars max; the
   matcher cost is dwarfed by the schedule round-trip. Pushing the
   filter into SQL would mean joining `service_calendars` and
   `service_calendar_exceptions` on every display-state query, which
   complicates the existing fetch joins (Hibernate "cannot fetch
   multiple bags" with `itinerary_stops` already in the FROM).

2. **Pre-loaded cache reusable across schedules.** Loading the full
   calendar set once per kiosk request keeps the matcher work
   in-memory. With Spring caching (next phase) the load itself can
   become a no-op outside import windows.

We can revisit this in SQL if benchmarks show the schedule-fetch
volume becoming a problem on dense networks; for now, the Java path
is simpler to reason about.

## Why we keep `Schedule.service_calendar_id` nullable

The kiosk has to keep working for two pre-existing populations:

- **Admin-created schedules** — the manual `/api/schedules` endpoint
  doesn't know about service calendars. Forcing a calendar would
  break those installs.
- **Legacy rows** — anyone running 0.2.x today has schedules without
  this FK. Migration V24 doesn't rewrite them.

The matcher's `calendar == null → true` branch handles both.

## Why we wipe calendars on every import

`persistServiceCalendars()` calls `deleteAllInBatch()` first because
the simplest correctness contract is "the calendar table reflects the
last successfully imported feed". The `ON DELETE SET NULL` on
`schedules.service_calendar_id` means stale schedule rows from a
prior import won't blow up — they'll appear as "always active" until
the rest of the import refreshes them. A re-import of a feed whose
SHA hasn't changed is short-circuited upstream by the orchestrator,
so this delete-then-write loop only runs when there's actual new
data.

## Trade-offs accepted

- **Schedule volume × number of services.** A feed with five services
  produces 5× the schedules of the previous import. Bordeaux-class
  feeds (~60k schedules previously) jump to ~300k. Postgres handles
  it without indexing changes, and the kiosk SQL still returns at
  most ~50 rows per stop per 30-minute window before filtering.
- **Cross-midnight is per-schedule.** Each schedule pulled from the
  cross-midnight tail evaluates against tomorrow's calendar. Same
  service running on tuesday-only with a wednesday-morning trip
  bleed-over now correctly disappears at 00:00 on wednesday — that's
  the intended behaviour, not a regression.
