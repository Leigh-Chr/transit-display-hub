## ADR 0042 — `LocalTime` storage vs GTFS "24h-overflow" times

**Status:** Accepted (2026-05-18, post-v1.30.0).

## Context

GTFS Schedule defines `stop_times.arrival_time`, `stop_times.departure_time`
and `frequencies.start_time` / `end_time` in `HH:MM:SS`, **explicitly
allowing values greater than 24:00:00** to model trips that run past
midnight while staying attached to the previous "service day":

> *"Time in the HH:MM:SS format (H:MM:SS is also accepted). The time
> is measured from "noon minus 12h" of the service day (effectively
> midnight except for days on which daylight saving time changes
> occur). For times occurring after midnight on the service day, enter
> the time as a value greater than 24:00:00 in HH:MM:SS."*

The same convention covers GTFS-Flex `start_pickup_drop_off_window` /
`end_pickup_drop_off_window` on `stop_times` and GTFS-Fares-v2
`booking_rules.prior_notice_last_time`.

The project models these columns with `java.time.LocalTime`, whose
range is `00:00:00` to `23:59:59.999_999_999`. Times above 24h are
**not representable**.

## Decision

We accept the limitation. The importer (`GtfsParse.parseGtfsTime`)
performs `int h = parts[0] % 24` and re-bases the time inside the
24h window, then emits a `WARN` log when the original hour was
≥ 24 so the operator sees the truncation in the import audit trail.

Rationale for not refactoring:

- Every entity that carries a time field would have to switch from
  `LocalTime` to either `Duration` (mappable to `BIGINT` seconds)
  or a `(LocalTime time, short dayOffset)` pair. That touches
  `Schedule`, `FlexStopTime`, `BookingRule`, `Timeframe`,
  `Frequency`, plus the entire ScheduleService / DisplayStateCalculator
  / NetworkMapService / fare evaluator stack and the corresponding
  DTOs and TS models. Estimated effort: ≥ 1 week.
- The kiosk-facing display only ever renders the time-of-day part
  (`"01:30"`), so the lost "+1 day" indicator is invisible to the
  passenger. The risk is therefore confined to the kiosk possibly
  treating a re-based time as "already past" near 1 AM on a
  midnight-overlapping service.
- Most French networks (the project's reference footprint) end
  service before 01:30, well within the `LocalTime` window when
  treated as wall-clock. The few late-night services (TBM night
  buses, RATP Noctilien if ever onboarded) are documented as known
  limitations rather than active bugs.

## Consequences

- **Mitigated by**: the `WARN` log surfaces every truncation event
  in `ImportAudit`, so an admin onboarding a feed with night services
  immediately sees the count and can decide whether the limitation
  is acceptable.
- **Documented as known limitation** in the project README and in
  the import audit error surface, so a passenger-facing regression
  on a tram noctambule is not a surprise.
- **Future migration path**: should a deployment require correct
  >24h handling, switch the affected columns to a `BIGINT seconds`
  representation and re-derive `LocalTime` on the way out via a
  `GtfsTime` helper record (sketched in `application/support/`).
  All formatters and comparisons would consume the helper rather
  than `LocalTime` directly. Out of scope for v1.x.

## Related

- [B2 / B3 in the 2026-05-18 GTFS conformance audit](../../.planning/audits/)
- `backend/src/main/java/com/transit/hub/infrastructure/seed/gtfs/GtfsParse.java#parseGtfsTime`
- `backend/src/main/java/com/transit/hub/domain/model/Schedule.java#time` / `#departureTime`
- `backend/src/main/java/com/transit/hub/domain/model/Timeframe.java#startTime` / `#endTime`
- `backend/src/main/java/com/transit/hub/domain/model/FlexStopTime.java#startPickupDropOffWindow` / `#endPickupDropOffWindow`
- `backend/src/main/java/com/transit/hub/domain/model/BookingRule.java#priorNoticeLastTime`
