## ADR 0035 — Accessibility foundations: high-contrast, large-text, vocal kiosk and tabular map

**Status:** Accepted

## Context

Milestone 0.10.0 raises the project's accessibility floor to
WCAG 2.2 AA on every persona (kiosk passenger, admin operator,
network map visitor). The starting baseline (audit 2026-05-10)
was solid but partial:

- ARIA attributes scattered across the kiosk header and the map
  popup, no systematic coverage.
- Dark-mode toggle, but no high-contrast palette and no large-text
  mode for low-vision passengers.
- No vocal restitution of the next departure on the kiosk.
- No keyboard-friendly alternative to the SVG schematic.
- Skip-link and `MatSnackBar` aria-live polite already in place
  on the admin layout.

This ADR records why we chose specific implementations rather
than the alternatives, and where the remaining gap lives.

## Decision

### Three orthogonal accessibility toggles in `ThemeService`

`isDarkMode`, `isHighContrast`, `isLargeText` are independent
signals, each persisted to localStorage. The high-contrast and
large-text defaults respect `prefers-contrast: more` and the
absence of any system preference (large text doesn't ship a
matching media query yet).

Why three signals instead of a single `mode: 'normal' | 'dark' |
'contrast' | 'large'` enum: a low-vision user at an outdoor
stop may need *both* high contrast (sunlight glare) *and* large
text. Folding the dimensions into a single enum hides that
combination behind a discrete state.

### High-contrast palette overrides M3 surface tokens

`.high-contrast-theme` redefines `--mat-sys-surface`, `--mat-sys-on-
surface`, `--mat-sys-primary` and a handful of supporting tokens
to a black/yellow scheme with WCAG-AAA contrast (≥ 7:1 on body,
≥ 4.5:1 on large text). Material components inherit automatically
because they consume the M3 variables.

Why not a separate Material theme: the runtime swap would force a
full DOM re-render and break the dark-mode signal independence.
Variable overrides are zero-cost and stack with `.dark-theme`.

### Web Speech API rather than server-side TTS

Vocal restitution of the next departure uses
`window.speechSynthesis` directly. Server-side TTS would have
required:

- A new backend endpoint (latency, error budget).
- Audio file caching (storage cost on a small kiosk).
- French-locale voice selection on the server.

The browser API delivers all three for free with a 12-line
component method. The trade-off is that older Safari builds
on iPad kiosks may need polyfilling, but the current LTS
versions all ship the API natively.

### Tabular alternative at `/map/list`

Rather than retrofitting tab-navigation into the SVG schematic
(which would require re-keying every `<g>` element, focusable
markers, and an entirely new keyboard interaction model), we
ship a parallel `NetworkListComponent` route that consumes the
same `NetworkMapDataService` and renders the data as tables.

Why a separate route instead of a toggle on the same component:
the SVG and the table are two different mental models of the
network. Conflating them inside one component would inflate the
bundle, and a separate route makes the URL `/map/list` an
explicit accessibility entry point we can advertise in the
README and link from the map header.

### Skip-link, MatSnackBar polite, MatDialog focus trap kept as-is

Admin already had:
- Skip-link to `#main-content` in `AdminLayoutComponent`.
- `MatSnackBar` (default `aria-live="polite"`).
- `MatDialog` ships `cdkTrapFocus` automatically since Material
  v15.
- ESLint's `template/click-events-have-key-events` rule enforced
  at build time.

We keep this surface unchanged — adding a custom `LiveAnnouncer`
wrapper on top of an already-announced snackbar would yield
double announcements on screen readers.

## Consequences

- **WCAG 2.2 AA on kiosk + map**: high-contrast palette delivers
  AAA on body text, the large-text toggle satisfies the resize-
  text criterion, the speak button covers the success-criterion
  for non-text content, and the tabular alternative the
  graphics-of-text criterion.
- **Bundle size**: the table view ships ~300 lines, none of
  which load on the SVG route (lazy `loadComponent`).
- **Test coverage**: `ThemeService` gets two new describe blocks
  (high-contrast toggle, large-text toggle); `KioskComponent`'s
  matchMedia stub is extended to satisfy CDK breakpoint
  observer; existing 950 frontend tests still green.

## Alternatives considered

- **Single accessibility "preset"** (one button for everything):
  rejected, hides combinable preferences.
- **Server-side TTS via gTTS or AWS Polly**: rejected, latency +
  audio caching cost dwarf any quality gain.
- **In-place SVG keyboard navigation**: rejected, the mental-model
  mismatch with the spatial map and the engineering cost would
  delay the milestone for marginal user value over the tabular
  alternative.
- **`@axe-core/playwright` automated checks**: deferred to 0.12.0
  (qualité dev) where Playwright is being re-introduced for E2E.

> **v1.29.0 footnote (2026-05-18).** The three-toggle pattern
> originally shipped inline in the kiosk template only. It has
> been extracted into a shared `<app-a11y-toolbar>` component
> under `frontend/src/app/shared/components/a11y-toolbar/` and
> propagated to the hub (high-contrast + large-text, no speech)
> and the network map (high-contrast + large-text, no speech).
> The signal model, persistence and ADR rationale are unchanged;
> the only structural difference is that each toggle is now
> opt-in via an `input()` so a surface can omit what doesn't
> make sense for it (a multi-stop hub has no single "next
> departure" to read aloud). The kiosk-only i18n namespace
> (`kiosk.{highContrast,largeText,speakNext}`) was renamed to
> the top-level `a11yToolbar.*`.
