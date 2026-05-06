# ADR 0003 — `FeedInfo` singleton vs. `ImportAudit` append-only log

**Status:** Accepted

## Context

After every GTFS import, two unrelated operational questions need
answering:

1. **What feed is currently loaded?** Publisher, declared validity
   window, language, version, source URL — used by the admin dashboard
   to render "Feed v2026.04.27 — valid until 2026-12-15".
2. **Did the last refresh succeed?** When did imports run, how long
   did each take, what changed, did any fail — used to triage when the
   nightly cron returned silently.

Conflating both into the same table either bloats the per-feed metadata
with audit columns or pollutes the audit timeline with always-the-same
publisher info.

## Decision

Two tables, one row each in semantic terms:

- **`feed_info`** — singleton replaced in place at every successful
  import. Mirrors GTFS `feed_info.txt` plus three operational fields
  (`source_url`, `source_hash`, `imported_at`). The
  `findSingleton()` helper hides the "we never have more than one row"
  invariant from callers; the importer enforces it via
  `deleteAllInBatch()` then `save()`.
- **`import_audit`** — append-only log. One row per attempt:
  successful, skipped, or failed. Captures source URL, source hash
  (when known), wall-clock start/end, duration, the four entity
  counters (lines / stops / itineraries / schedules), the
  `ImportStatus` enum (`RUNNING`/`SUCCESS`/`SKIPPED_UNCHANGED`/`FAILED`),
  a truncated error message, and the trigger identifier
  (`"boot"`/`"scheduler"`/admin username).

Both tables share the orchestrator (`GtfsImportOrchestrator`) which
owns the lock, computes the SHA-256 in streaming mode, and calls
`feedInfoRepository.save()` and `auditRepository.save()` symmetrically.

## Consequences

**Admin UI.** The dashboard reads `feed_info` for the validity card
(green/orange/red border). A future admin timeline reads `import_audit`
sorted by `started_at desc`, capped at 200 rows.

**Recovery.** When an import fails halfway, the audit row stays in
`RUNNING` state until the orchestrator's `finally` block flips it to
`FAILED`. A crash mid-import would leave a stale `RUNNING` row; the
healthcheck (planned in Phase 7) will surface that as a warning.

**Concurrency.** `GtfsImportOrchestrator` uses a `ReentrantLock`
shared across the boot loader, the cron scheduler and the manual admin
trigger. `tryLock()` (not `lock()`) returns immediately with a
`SKIPPED_UNCHANGED` outcome when another import is already running —
better than queuing a second attempt that would race the first on the
schedules table.

## Alternatives rejected

- **Use Spring Boot Actuator `/info` for feed metadata.** Too tied to
  Spring's startup-time properties; we want the live database state
  visible to non-technical admins.
- **Single hybrid table with an `is_current` flag.** Couples replace
  semantics with append semantics; deletions of historical rows would
  need a retention policy that doesn't currently exist.
