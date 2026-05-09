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

## Suggested alerts (not committed here)

- `sum(increase(gtfs_import_completed_total{status="success"}[24h])) == 0`
  — no successful GTFS import in the last 24 hours.
- `histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket[5m]))) > 1`
  — p95 HTTP latency over one second sustained for 10 minutes.
- `sum(rate(http_server_requests_seconds_count{outcome="SERVER_ERROR"}[5m])) > 0.01`
  — server-side error rate above 1 % for 10 minutes.
