## ADR 0033 — FareCalculator combining V1 and V2

**Status:** Accepted. **Amended 2026-05-18**: the dedicated admin
page `/admin/fare-calculator` mentioned below was dropped — the
network-map stop-popup is the primary consumer of
`/api/fares/calculate` and offers a more contextual UX (origin +
destination picked spatially). The public endpoint and the underlying
service are unchanged.

## Context

Operators ship GTFS fares in either V1 (`fare_attributes` +
`fare_rules`), V2 (`areas` + `fare_leg_rules` + `fare_products`), or
both for backward compatibility. A passenger surface needs to answer
"how much for this trip?" without knowing which the feed uses.

## Decision

A single endpoint `GET /api/fares/calculate?from=…&to=…` runs both
pipelines and returns both result sets:

- **V1** — for each `FareAttribute`, every rule that matches on
  `(origin_id, destination_id)` against the stops' `zone_id` qualifies.
  Empty rule lists mean network-wide applicability.
- **V2** — map each stop to its `Area` set, then return every
  `FareLegRule` whose `(from_area, to_area)` matches. `null` on
  either side of the rule means "any area" per spec.

Results are sorted (V1 by ascending price, V2 by `rule_priority`)
and the public endpoint accepts unauthenticated calls — passengers
shouldn't have to log in to see a fare.

## Consequences

- Timeframe (`from_timeframe_group_id` / `to_timeframe_group_id`),
  rider category and transfer-rule chaining are exposed as raw
  fields but not filtered server-side. Callers can post-filter; a
  future iteration can lift this into the service when feeds with
  rich V2 data show up.
- The original admin page `/admin/fare-calculator` was kept as a
  manual test surface but was removed 2026-05-18 once the stop-popup
  proved to be a more contextual consumer of the same endpoint.
- No new persistence — only reads. The pipelines are
  `@Transactional(readOnly = true)`.
