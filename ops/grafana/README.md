# Grafana provisioning

`transit-display-hub.json` is a ready-to-import Grafana dashboard
consuming the Prometheus scrape exposed by the Spring Boot Actuator
at `/actuator/prometheus` (see [ADR 0027][adr-0027]).

[adr-0027]: ../../docs/adr/0027-prometheus-metrology.md

## Layout

| Row | Panels |
|-----|--------|
| HTTP | Request rate by outcome • Latency p50/p95/p99 |
| GTFS import | Outcome counts (success / failed / skipped) per hour • Duration p50/p95 • Latest entity counts |
| Caffeine cache | Hit ratio (5 min, gauge) • Eviction rate |
| JVM | Heap usage by area • GC pause time by cause |
| GTFS coverage | Live entity-count table grouped by `kind` (translations, pathways, flex_stop_times, fare_*, …) |
| Fare calculator | Request rate per second • Latency p50/p95/p99 of `/api/fares/calculate` |

Every query filters on `application="transit-display-hub"`, the
constant tag injected by the Micrometer registry. Drop it in
multi-deployment instances to see all environments at once.

## Importing

```bash
# Upload via Grafana HTTP API
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Authorization: Bearer $GRAFANA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq '{dashboard: ., overwrite: true, message: "transit-display-hub provisioned"}' transit-display-hub.json)"
```

Or under Grafana UI: `Dashboards → New → Import → Upload JSON file`.

## Datasource

The dashboard expects a Prometheus datasource named `Prometheus` (or
referenced via the `${DS_PROMETHEUS}` template variable). Adjust the
variable on first import if your Prometheus datasource is named
otherwise — Grafana will prompt for it.

## Alerts

See [`../prometheus/alerts.yml`](../prometheus/alerts.yml) for the
canonical alerting rules (GTFS import duration, no successful import
in 24 h, JVM heap pressure). Load that file from your `prometheus.yml`
via the `rule_files` directive.
