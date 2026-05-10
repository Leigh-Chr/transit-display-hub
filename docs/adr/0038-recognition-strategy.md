## ADR 0038 — Recognition strategy: scope of public surface

**Status:** Accepted

## Context

The project is non-commercial and explicitly aimed at recognition rather
than revenue. Two visibility options were considered and declined:

- **Online live demo** (Fly.io / Railway / VPS): rejected to avoid
  hosting cost and on-call demand.
- **Standalone marketing site / landing page** (GitHub Pages): rejected
  to avoid a maintenance surface that lags releases.

## Decision

The README is the only canonical entry point. The repository ships:

- A pinned tagline documenting the unique combination (GTFS Schedule +
  Fares v2 + GTFS-flex + GTFS-Realtime + WCAG 2.2 AA + Pi installer).
- A `docs/screenshots/` scaffold with capture conventions; the captures
  themselves are deferred until a kiosk can be photographed.
- The standard community surface: `.github/ISSUE_TEMPLATE/`, PR
  template, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
- Two CI badges and an ADR-count badge so README claims are anchored
  in observable build state.

Channel-specific announcement drafts (Show HN, Reddit, Mastodon,
LinkedIn, awesome-transit, transport.data.gouv, Devoxx CFP) live
outside the repo as personal copy-paste artifacts and are not part
of the project's public surface.

## Consequences

- **Zero hosting cost.** No demo VPS, no Pages site to update.
- **Slower discovery curve.** Visitors land on a markdown page rather
  than a styled hero. We accept this — the target audience navigates
  GitHub natively.
- **Conferences are the long arc** (CFPs open Q4 2026 → Q2 2027).
