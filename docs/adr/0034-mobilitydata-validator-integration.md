## ADR 0034 — MobilityData gtfs-validator integration and 100 % spec coverage

**Status:** Accepted

## Context

Transit Display Hub now persists every field documented by the
`gtfs.org` reference of May 2026: Schedule v1 (the 20 canonical
files), Fares v1, Fares v2 (the nine extension files now folded
into the canonical spec), GTFS-flex (likewise canonical since
2024) and GTFS-Realtime (ServiceAlerts, TripUpdates,
VehiclePositions including header metadata, vehicle
descriptors and per-stop occupancy). Closing those last gaps
under milestone 0.9.0 left two questions:

1. How do we *prove* coverage to a third party — an operator
   considering the project, a contributor reviewing a PR, a
   reader landing on the README?
2. How does an operator catch malformed feeds before the kiosk
   silently renders garbled rows?

Both pin to the same answer: invoke the canonical
[MobilityData gtfs-validator] after each import and surface its
report in the admin timeline.

[MobilityData gtfs-validator]: https://github.com/MobilityData/gtfs-validator

## Decision

### Library, not sub-process

We pull `org.mobilitydata.gtfs-validator:gtfs-validator-main:8.0.0`
plus `…-core:8.0.0` as Gradle `implementation` dependencies and
invoke `ValidationRunner.run(ValidationRunnerConfig)` directly
from a Spring `@Service`. The library API is stable enough for
a fixed version pin; sub-processing would require bundling a
40 MB jar in the project tree or downloading it at startup,
which adds operational fragility for no upside.

### Wired into the orchestrator, not a manual button

`GtfsImportOrchestrator` invokes `GtfsValidatorService.validate`
right after a successful import, while it still holds the
downloaded zip. Validation outcomes (status, on-disk report
directory, ERROR/WARNING counts) land on the matching
`ImportAudit` row in the same transaction, so the admin
timeline always reflects the latest state without a second
trigger.

A second-pass "validate again" button is not provided — the
runner is deterministic on a given feed, so re-running it
against an already-imported feed would just re-write the same
report. When an operator wants to re-validate, they re-import.

### Validator failures never demote the import

A crash inside the runner sets `validationStatus = FAILED` on
the audit but the import status stays `SUCCESS`. The two are
orthogonal: the importer's job is to land rows in the database,
the validator's job is to surface notices. Coupling the two
would let a flaky runner block production data.

### Reports stored on disk, served on demand

The runner writes `report.json`, `report.html` and
`system_errors.json` to
`${app.gtfs.validation.report-base-dir:/tmp/gtfs-validation}/{auditId}/`.
Two `GET` endpoints serve them back on demand
(`/validation-report` and `/validation-report.html`). We
deliberately keep them outside the database — the JSON can run
into multi-megabytes on dense feeds and a relational `BLOB`
column would inflate every audit row read.

The service whitelists three filenames to keep a crafted query
string from traversing out of the audit-scoped directory.

### Country code defaults to FR

The reference deployment is Grenoble; the validator's
country-aware checks (`UrlValidator`, agency timezone match)
behave better with a non-`ZZ` setting. Callers can override
per-call when known.

## Consequences

- **README claim:** the project can now back the *"100 %
  spec coverage validated by MobilityData gtfs-validator"*
  positioning factually — the validator either flags a gap or
  it doesn't.
- **Build size:** the validator pulls Guava 31, Gson 2.8 and
  HttpClient 5 transitively. Spring Boot's Jackson is
  unaffected; the runtime overlap is benign.
- **Boot time:** unchanged. The runner is only invoked on import,
  which is already an out-of-band operation.
- **Disabling:** `app.gtfs.validation.enabled = false` skips the
  whole pipeline. The audit row then carries
  `validationStatus = SKIPPED`. Useful on low-resource CI runs.
- **Future extension:** the same `GtfsValidatorService` can be
  exposed as a stand-alone "drop a zip, get a report" page in a
  later milestone. The current wiring is restricted to the
  post-import path on purpose — first prove the integration
  holds in real conditions, then broaden the surface.

## Alternatives considered

- **Custom validators in domain code.** Rejected: re-implementing
  the 200+ MobilityData rules would take months and we would
  drift from the canonical reference within a release.
- **CLI sub-process invocation.** Rejected: bundling the jar in
  the repo bloats the tree; downloading at startup adds an
  Internet dependency to boot.
- **Validating *before* import to gate it.** Rejected:
  WARNING-level notices on real feeds are common and we don't
  want to refuse Grenoble's data because of one
  `attributions.txt` quirk. Validation is observability, not
  gating.
