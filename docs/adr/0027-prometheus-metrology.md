# ADR 0027 — Prometheus scrape via Micrometer, no in-house metrics layer

**Status:** Accepted — **Updated v1.5.0:** `/actuator/prometheus`,
`/actuator/metrics` and `/actuator/info` now require the `ADMIN` role
(`SecurityConfig.requestMatchers(...).hasRole("ADMIN")`). Only
`/actuator/health` stays public. The "unauthenticated inside the
deployment" stance below is therefore obsolete — Prometheus needs to
scrape with admin credentials (basic-auth at the proxy or a
service-account JWT). See the *Consequences* section for the updated
trust posture.

## Context

The system already records Caffeine cache stats (`recordStats()` in
`CacheConfig`) and the GTFS import flow already writes an
`ImportAudit` row per attempt. The audit table answers
"what happened the last time we tried to import" — it does not answer
"are we importing successfully on a sustained cadence" or "are caches
hot enough to absorb traffic" or "did the p95 of HTTP latency just
double". Those questions require time-series data.

Spring Boot Actuator already ships Micrometer auto-configuration:
HTTP request timings (`http.server.requests`), JVM memory and GC
counters, datasource pool gauges, and cache hit/miss/eviction series
via `CacheMetricsAutoConfiguration` (which auto-binds any cache
managed by a Spring `CacheManager` if Micrometer is on the classpath).
What's missing is the export side — by default, the registry is
in-memory only.

The standard scraping protocol in this stack is Prometheus, with
Grafana on top.

## Decision

**Add `io.micrometer:micrometer-registry-prometheus` as a runtime
dependency** and expose `/actuator/prometheus` (originally as a public
endpoint sharing the trust posture of `/actuator/health`; tightened to
`hasRole("ADMIN")` in v1.5.0 — see the status banner above).

Wire one custom instrumentation point on top of the auto-discovery
covers: a `GtfsImportMetrics` component owning a `Timer` for
`gtfs.import.duration`, a `Counter` for `gtfs.import.completed`
sliced by status (`success`, `failed`, `skipped`), and a distribution
summary for `gtfs.import.entities` (lines / stops / schedules per
import). The orchestrator drives the start/stop/increment calls
directly — annotation-style `@Timed` was rejected because the
success/failure branch already exists in human-readable form there
and adding annotations would scatter the labelling.

Application yaml:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,metrics
  metrics:
    tags:
      application: transit-display-hub
    distribution:
      percentiles-histogram:
        http.server.requests: true
        gtfs.import.duration: true
```

The `application=transit-display-hub` tag is inherited by every meter
so a multi-deployment Grafana instance can disambiguate.

## Consequences

- **Zero new bean wiring beyond the metrics class.** Spring Boot's
  Actuator already auto-binds the JVM, HTTP, datasource and cache
  meters; the Prometheus registry attaches itself as soon as the
  dependency is present. The scrape endpoint is allow-listed in
  `SecurityConfig` next to `/actuator/health`.
- **No "metrics platform" maintenance burden.** Micrometer is a
  passive registry — it doesn't run threads, doesn't poll, doesn't
  push. The Prometheus side does the polling. The footprint is one
  jar (~200 KB) and the scrape endpoint serializing the meter snapshot.
- **Dashboards are portable.** Every deployment publishes the same
  meter names with the same tag schema. A Grafana dashboard built
  against one environment works against another after switching the
  `instance` tag.
- **Production-side trust (v1.5.0+).** `/actuator/prometheus`,
  `/actuator/metrics` and `/actuator/info` require the `ADMIN` role.
  Prometheus scrapes must therefore carry admin credentials — either
  basic-auth handled at the reverse proxy or a service-account JWT
  cookie attached to the scrape request. Only `/actuator/health`
  stays public for load-balancer probes. The endpoint contains no
  business data, but the meter values can leak operational signal
  (request volume, error rate) so the lock-down is a defence-in-depth
  measure, not a confidentiality one.
- **Loss: no Grafana board shipped with this ADR.** Building the
  initial dashboards is intentionally out of scope. The metric
  catalogue is documented here; a follow-up will provision the JSON.
- **Future PromQL examples** (for the upcoming dashboard):
  - `sum(rate(http_server_requests_seconds_count{outcome="SERVER_ERROR"}[5m]))`
    — server-side error rate
  - `histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket[5m])) by (le))`
    — p95 HTTP latency
  - `sum by (status) (rate(gtfs_import_completed_total[1h]))` —
    import success rate per hour
  - `cache_gets_total{result="hit"} / (cache_gets_total{result="hit"} + cache_gets_total{result="miss"})`
    — cache hit ratio (Caffeine binding via `CacheMetricsAutoConfiguration`)
