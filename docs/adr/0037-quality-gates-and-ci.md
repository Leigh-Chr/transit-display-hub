## ADR 0037 — Quality gates and continuous integration

**Status:** Accepted

## Context

Milestone 0.12.0 wires automated quality signals around the
project so a regression below the current baseline is caught
without manual inspection. Until 0.12.0 the suites ran only via
the local pre-push hook; with no CI, a contributor without the
hook (or a forced push) could bypass them entirely.

## Decision

### Backend: JaCoCo + minimum-instruction rule

Standard `jacoco` Gradle plugin. The `check` task pulls in
`jacocoTestReport`, so the same single command (`./gradlew
check`) yields HTML + XML reports and runs the tests. A
`jacocoTestCoverageVerification` rule pins the bundle-level
instruction ratio to ≥ 0.55 — modest by design: the goal is to
trip when a refactor demolishes coverage, not to block PRs on
every uncovered branch.

Generated GtfsRealtime protobuf code is excluded from the
denominator. It's mechanical Java the validator never lands on.

### Frontend: Vitest V8 coverage

`@vitest/coverage-v8` (MIT, official Vitest provider) plus a
new `npm run test:coverage` script. Coverage is on-demand —
the default `npm test` (= `ng test`, watch mode) keeps the
sub-second feedback loop developers rely on.

### E2E: Playwright Chromium-only smoke suite

Playwright was removed in May 2026 during the GTFS-centric
scope cleanup. We bring it back at version 1.59 with a
minimal scope:

- Chromium-only project (the kiosk deployment OS).
- Three to five smoke scenarios (`/map`, `/map/list`, `/login`).
- No `webServer` block: the developer runs backend + frontend
  separately. CI doesn't run E2E either — heavier integration
  test tier that would need an in-pipeline Spring Boot start.

The point isn't to replace unit tests; it's to ship a smoke
guard for the entry routes a passenger lands on.

### CI: GitHub Actions, two workflows

`backend.yml` and `frontend.yml`, each gated on path filters
so doc-only commits don't burn minutes:

- `backend.yml`: JDK 21 (temurin), gradle cache,
  `./gradlew test jacocoTestReport`, JaCoCo HTML uploaded as
  a 7-day artifact.
- `frontend.yml`: Node 20, `npm ci`, lint, knip dead-code
  check, `test:coverage`, production build, coverage
  uploaded.

Only official `actions/*` actions used (checkout, setup-java,
setup-node, upload-artifact). No third-party dependency in the
pipeline.

## Consequences

- A first regression below 55 % bundle coverage is caught at
  `./gradlew check` time and at PR time.
- The frontend coverage report is browsable in the GitHub
  artifact UI without merging the PR.
- Knip stays at 0 findings; ignoring `@playwright/test` and
  `@vitest/coverage-v8` is justified — they're consumed via
  npm scripts, not import statements.
- E2E remains a manual run for now. A future "run E2E in CI"
  evolution would require a `webServer` block and per-job
  caching of the Playwright browsers.

## Alternatives considered

- **Codecov / Coveralls badges** for the README: rejected, adds
  a third-party dependency without changing what's enforced.
  GitHub's own artifact UI is sufficient.
- **Pre-commit hook running coverage**: rejected, multiplies the
  feedback loop time. Coverage stays on `check` (pre-push) and
  on CI.
- **Run Playwright in the pre-push hook**: rejected, would
  require booting both backend and frontend in the hook, which
  is too slow for the smaller benefit.
- **Set the coverage minimum at 80 %**: rejected for now — the
  project is mid-maturity and forcing 80 % would block legit
  PRs on poorly-covered new modules. Plan: revisit at 1.0.0.
