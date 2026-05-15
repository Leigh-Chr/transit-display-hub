# ADR 0040 — Maintainability guardrails as a CI gate, with a frozen allowlist

**Status:** Accepted (2026-05-12, shipped in v1.6.0) — **Updated v1.11.0:**
the rotation cadence has lowered the active thresholds. PMD
CyclomaticComplexity now runs at **method = 19, class = 107** (the
high-water marks after v1.11.0 splits, see `backend/config/pmd/ruleset.xml`).
The `*Importer.java` / `*Calculator.java` file-size block ceiling moved
from 700 to 650 lines and now sits comfortably above the live HWM
(488 for `ScheduleImporter` after the v1.11.1 split). Both the ArchUnit
allowlist and `scripts/oversized-allowlist.txt` remain empty — the
"30 / 110" numbers in the *Decision* section are kept for archival
fidelity; the live values are in the linked config files.

## Context

After v1.5.1 the project was, on every objective axis, clean: zero
TODO/FIXME, zero unused exports (knip), zero PMD/SpotBugs violations,
zero ESLint warnings, drift between conventions ≈ 0, JaCoCo 70.4 % /
54.4 %, ratio test:prod 1.06×. The 2026-05-12 re-audit nevertheless
identified three sources of perceived "lourdeur" that no automated
gate was catching:

1. **Six Angular components above 1000 lines** (`kiosk` 1516,
   `schematic-map` 1449, `network-map` 1168, `dashboard` 1132,
   `hub` 1067, `stop-popup` 1024), all with inline templates.
   Editing any of them is painful and they had grown silently
   over the 1.x cycle.
2. **`DisplayStateCalculator`** (612 LOC) is the only domain class
   that imports `infrastructure.persistence.*`,
   `infrastructure.realtime.*` and `application.dto.*` — the sole
   architectural exception to the layered structure documented
   in the developer guide. It accumulated those imports without
   ever failing a check.
3. **`jscpd`** had been used once on 2026-05-10 to bring the
   duplication ratio from 9.21 % to ~1.2 %, then dropped from the
   workflow. Nothing would notice a regression.

A "milestone hardening sprint" (refactor everything at once) was
considered but rejected: the project is a non-commercial,
recognition-driven side project marching towards 1.0, and stopping
feature work for two to three weeks to refactor without a safety
net would risk both regressions and momentum. A purely opportunistic
"boy scout" approach was also rejected: the six monoliths are
exactly the files an opportunistic refactor would avoid, so they
would never shrink.

## Decision

Adopt **strategy C: guardrails first, then rotation**.

### Phase 1 — install the missing detectors (this ADR)

- **`LayeredArchitectureTest`** (`backend/src/test/java/com/transit/hub/architecture/`)
  uses ArchUnit to pin four package boundaries: `domain → ¬infrastructure`,
  `domain → ¬application`, `application.dto → ¬infrastructure`,
  `application.dto → ¬application.service`. The three known
  violations (`DisplayStateCalculator`, `VehiclePositionResponse`,
  `RealtimeAlertResponse`) are exempt by fully-qualified name in
  the test itself, so each exception stays visible at review time
  and can be removed in the same commit as the underlying refactor.

- **PMD `CyclomaticComplexity`** (in `backend/config/pmd/ruleset.xml`)
  is activated with a method threshold of 30 and a class threshold
  of 110 — exactly one tick above the current high-water marks
  (`ScheduleImporter.importSchedules` at 29, `DisplayStateCalculator`
  class total at 107). Any further growth fails `./gradlew check`.

- **File-size guardrail** (`scripts/check-file-size.sh` +
  `scripts/oversized-allowlist.txt`, wired into
  `.github/workflows/file-size.yml`) blocks new files past the
  per-extension ceilings and reads its allowlist from a tracked
  text file. The allowlist is seeded with the seven known monoliths
  and is expected to shrink, not grow.

- **`jscpd`** is re-wired in `.github/workflows/frontend.yml`
  with a 6 % duplication threshold. The current run reports
  ~1.2 %.

- **`knip`** was already in CI but switched to the
  `github-actions` reporter so future violations are surfaced as
  inline PR annotations.

### Phase 2 — rotation by minor version

Each minor allocates ~30-40 % of its effort to removing one
allowlist entry / lifting one architectural exception. The
indicative roadmap, recorded in
`.planning/refactors/2026-05-12-maintainability-guardrails.md`:

| Tag    | Cleanup target                                                                                 |
|--------|-------------------------------------------------------------------------------------------------|
| 1.7.0  | `AbstractGtfsImporter<T>`, kiosk/hub merge via `<display-board>`, relocate `DisplayStateCalculator` to `application.service` |
| 1.8.0  | `AdminPageBase` + migrate the seven admin pages that do not yet use `AdminTableState`           |
| 1.9.0  | Decompose `schematic-map` (Dijkstra + layout services), externalise its template / SCSS         |
| 1.10.0 | Design system v2 (M3 typo / palette / motion tokens), externalise the last three component templates |

The exact ordering can shift; the rule is that each release must
remove at least one allowlist entry (or one PMD class-level cyclo
exception, or the ArchUnit frozen exception) and never add one
silently.

## Consequences

- **CI runtime** grows by ~30 s (jscpd ~10 s, ArchUnit ~3 s,
  file-size script ~1 s, PMD cyclo within the existing pmdMain
  step). Acceptable.
- **Allowlist files are tracked** (`scripts/oversized-allowlist.txt`,
  inline FQN exclusions in `LayeredArchitectureTest`) — reviewers
  see additions in the diff and can challenge them.
- **Adding a new monolith is no longer free**: a contributor who
  ships a 1200-line `*.component.ts` must either split it or
  amend the allowlist in the same PR, with a referenced phase
  that will retire the entry.
- **PMD cyclo gate is loose by design** (30 / 110). Tightening it
  before phase 1.7.0 would mean adding NOPMD suppressions, which
  defeats the point. Once the post-1.7.0 high-water mark drops,
  the thresholds should drop with it.
- The strategy is reversible: dropping the gates is one commit
  away. The cost of keeping them is essentially zero.

## Alternatives considered

- **Boy-scout cleanup only**: rejected because the six monoliths
  are precisely the files routine work avoids.
- **Big-bang refactor in 1.7.0**: rejected because of regression
  risk and the lack of a safety net for the next drift.
- **External code-climate / sonar service**: rejected to keep CI
  fully self-hosted and the rule set in the repo.

## References

- `.planning/refactors/2026-05-12-maintainability-guardrails.md`
- `.planning/audits/2026-05-12-post-1.5.1/MASTER-REPORT.md`
- ADR [0023](0023-two-step-pagination.md) and
  [0037](0037-quality-gates-and-ci.md) (existing quality gate posture)
