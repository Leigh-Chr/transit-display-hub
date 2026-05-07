# Architecture Decision Records

Each ADR captures a single non-obvious choice that shaped the GTFS
integration: what we picked, what we rejected, and why future readers
should think twice before reverting.

| # | Title |
|---|---|
| [0001](0001-line-type-mapping.md) | LineType enum and the GTFS `route_type` mapping |
| [0002](0002-multi-agency-and-timezone.md) | Multi-agency model and timezone resolution chain |
| [0003](0003-feed-info-and-import-audit.md) | FeedInfo singleton vs. ImportAudit append-only log |
| [0004](0004-stop-headsign-resolution.md) | Resolving the destination shown to passengers |
| [0005](0005-pickup-and-wheelchair-storage.md) | Per-schedule overrides for accessibility / pickup metadata |
| [0006](0006-transfer-weighting.md) | Route-finder transfer cost from `transfers.txt` |
| [0007](0007-import-orchestrator.md) | Single orchestrator for boot, scheduler and manual reimport |
| [0008](0008-multi-day-service-calendars.md) | Multi-day service calendars and per-day display filtering |
| [0009](0009-pathways-and-levels.md) | Persisting station levels and pathways for indoor topology |
| [0010](0010-translations.md) | GTFS translations and the per-installation language |
| [0011](0011-openapi-swagger.md) | Bundled OpenAPI / Swagger UI for API discoverability |
| [0012](0012-fares-v1.md) | GTFS Fares v1 (fare_attributes + fare_rules) |
| [0013](0013-idempotent-import-by-external-id.md) | Idempotent GTFS import keyed by external_id |
| [0014](0014-shapes-and-polylines.md) | Persisting GTFS shapes for future map views |

ADRs are written in present tense; they describe the state of the code
**at the moment they were merged**. When a decision is reversed, mark
the old ADR `Status: Superseded by NNNN` and write a new one — never
edit history in place.
