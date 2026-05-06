# ADR 0007 — Single orchestrator for boot, scheduler and manual reimport

**Status:** Accepted

## Context

GTFS imports run from three triggers:

1. **Boot loader** (`GtfsDataLoader`) — fires once at startup if the
   database is empty.
2. **Cron scheduler** (`GtfsRefreshScheduler`) — refreshes the feed
   nightly at 04:00.
3. **Admin endpoint** (`POST /api/admin/gtfs/reimport`) — manual
   trigger for emergency updates.

Each does the same work: download (or cache-hit), compute the SHA-256,
persist the `feed_info.txt` metadata, run the import, evict the
network-map and alerts caches, write an audit row.

The original implementation did all of that inline in
`GtfsDataLoader.run()`. Adding the scheduler meant copying the same
~50-line procedure. Adding the manual endpoint meant copying it again.
Each copy diverged subtly (different exception handling, different
log formats, different cache-eviction lists).

## Decision

**Extract the procedure into `GtfsImportOrchestrator`** in the
`application.service` package. Three callers, one implementation:

```
GtfsDataLoader  ──┐
GtfsRefreshScheduler ─┼──> GtfsImportOrchestrator.runImport(url, triggeredBy)
GtfsAdminController ──┘
```

The orchestrator owns:

- The `ReentrantLock` that prevents overlapping imports across all
  three callers — `tryLock()` returns immediately with a
  `SKIPPED_UNCHANGED` outcome rather than queueing a second attempt.
- The streaming SHA-256 computation (8 KB buffer, no full-file load).
- The `ImportAudit` row lifecycle: pre-import row in `RUNNING` state,
  post-import update with `SUCCESS`/`SKIPPED_UNCHANGED`/`FAILED`,
  `errorMessage` truncated to 1000 chars on failure.
- Cache eviction (`networkMap`, `networkAlerts`).

Callers handle only their own context: the boot loader creates the
default users first, the scheduler reads its cron schedule, the
admin controller forwards the authenticated principal as the
`triggeredBy` identifier.

## Consequences

**Concurrency.** All three triggers serialise through one lock. The
scheduler firing while a manual reimport is in flight returns
`SKIPPED_UNCHANGED` instead of corrupting the schedules table.

**Observability.** Every attempt — successful, skipped or failed —
writes an audit row. The admin dashboard's timeline becomes the single
source of truth for "what happened with this feed".

**Testability.** The lock is private to the orchestrator instance.
Tests construct one without a Spring context, mock the downloader
and importer, and verify the orchestration semantics in isolation.

## Alternatives rejected

- **Static helper class.** Can't hold the lock state cleanly. Spring
  bean is the obvious choice.
- **Use `@Async` and queue overlapping requests.** Adds latency for the
  manual trigger (admin clicks "reimport", waits 4 minutes for the
  scheduled one to finish, then waits another 4 minutes for theirs —
  worst of both worlds). Skip-when-busy is the right semantic here.
