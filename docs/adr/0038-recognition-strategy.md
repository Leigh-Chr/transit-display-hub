## ADR 0038 — Recognition strategy: how the project gets seen

**Status:** Accepted

## Context

The project is non-commercial, free, and explicitly aimed at
**recognition** rather than revenue (cf. the project goal
captured in the persistent memory file). The owner refused both
of the two heaviest visibility chantiers proposed in the
original Phase B plan:

- **Online live demo** (Fly.io / Railway / VPS): "pas de démo
  en ligne maintenant".
- **Standalone marketing site / landing page** (GitHub Pages
  with an `index.html`): "je ne veux pas de site vitrine".

This ADR records what we ship instead, and why each lighter
artifact is enough for the recognition goal.

## Decision

### One canonical entry point: the GitHub README

The README is the only landing surface. No
`docs/site/index.html`, no GitHub Pages, no separate domain.

Trade-off accepted: visitors land on a markdown page rather
than a styled hero section. We mitigate by:

- A pinned tagline at the top documenting the unique
  combination (GTFS Schedule + Fares v2 + GTFS-flex +
  GTFS-Realtime + WCAG 2.2 AA + Pi installer).
- A "Why this exists" section answering the visitor's first
  question in three sentences.
- A `docs/screenshots/` folder with capture conventions
  documented; the README references six expected captures
  (admin dashboard, schematic, popup, kiosk, audit, list).
  The captures themselves are deferred to the moment we
  actually have a kiosk to photograph.

### Channel-specific drafts pre-written under `docs/announcements/`

Seven ready-to-paste files (Show HN, Reddit ×4, Mastodon
EN+FR, LinkedIn, awesome-transit PR, transport.data.gouv,
Devoxx talk proposal) sit in the repo. Each respects the
target's conventions (length, tone, posting window). The
owner copies / pastes / edits when they decide to publish.

Why drafts rather than a single template: each channel
weighs different signals. Hacker News punishes hype; r/programming
rewards engineering depth; Mastodon is character-capped;
LinkedIn rewards length; Devoxx wants 1500-char abstracts.
A single template would force the owner to rewrite seven
times anyway.

### Community surface in place: templates, code of conduct, security

`.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`,
`SECURITY.md`, plus the pre-existing `CONTRIBUTING.md` and
`CODE_OF_CONDUCT.md`. A first-time contributor lands on
structured forms rather than blank prompts.

### Quality signals make the README earned, not claimed

The two CI badges (backend + frontend) and the ADR-count
badge (38) at the top of the README anchor the README's
claims in observable build state. Any visitor can click the
badge and verify the workflows are green.

## Consequences

- **Zero hosting cost**: no demo VPS, no Pages site to update.
  Re-org of the 1.0 release into a 1.1 release doesn't break a
  marketing page that says "1.0".
- **Slower discovery curve**: a visitor who lands on the
  GitHub repo directly converts well; one who would need a
  styled hero to understand the project bounces. We accept
  that — the recognition target is the dev community, who
  navigates GitHub natively.
- **Submission timing remains owner-controlled**: drafts are
  there, but the owner picks the day, edits the abstract for
  recent context (a 0.13.x release between drafting and
  posting must be reflected in the body), and posts.
- **Conferences are the long arc**: CFPs open Q4 2026 → Q2
  2027. The `devoxx-talk-proposal.md` draft anchors three
  formats (talk, lightning, workshop) so the owner can adapt
  to whichever the comité retains.

## Alternatives considered

- **Online demo**: rejected by owner. Would have unlocked
  copy-and-paste demonstrations on social posts but adds
  hosting cost and on-call demand.
- **GitHub Pages site**: rejected by owner mid-Phase B. Would
  have been a one-time CSS effort but adds a maintenance
  surface that lags releases.
- **Twitter / X presence**: not pursued. The owner did not
  request it and the platform's discoverability for tech
  projects has degraded since 2023.
- **Demo video on the README**: not pursued for the launch
  commit; the screenshot scaffolding is a precursor that lets
  the owner add a Loom embed later without restructuring.
