# ADR 0041 — Design system tokens enforcement (M3 typography, motion, palette)

**Status:** Accepted (2026-05-18, shipped in v1.25.0).

## Context

The Material 3 token system in `frontend/src/styles.scss` has been
in place since the 1.x cycle: a 13-step typescale (`--m3-type-*`),
M3 motion tokens (`--m3-easing-*`, `--m3-duration-*`,
`--m3-spring-bounce`), and a semantic palette covering surface
hierarchy, status colors, chip palettes, kiosk overrides, map
overlays, and dashboard stat icons. The marathon refactors from
v1.6.0 onwards migrated the vast majority of component styles to
those tokens.

A re-audit on 2026-05-18 nevertheless flagged that a handful of
component-level styles still bypassed the system:

- 7 `font-size: 0.85em` literals in admin tables and the public
  departures row (the same "secondary suffix" pattern repeated in
  `.platform`, `.muted`, `.hash`, `.booking-notice`, etc.).
- 10 hardcoded transitions (`0.15s`, `120ms ease`, `0.2s`) inside
  inline component styles, mostly in `network-map/components/*`
  and `admin/itineraries/*`.
- 3 hex literals on the schematic-map's departure / arrival /
  transfer SVG markers (`#4caf50`, `#f44336`, `#333`), bypassing
  the palette because SVG `fill` attributes do not resolve
  `var()`.
- 1 hex literal (`#1a1a1a`) on the kiosk stale-warning banner.

The deferred-items memory previously estimated this at "64 `font-size`
+ 119 hex" — a pre-marathon count that was no longer accurate.

The principle "every style passes through a token" is worth defending
because:

1. **Future theming work** (light/dark variants, high-contrast,
   large-text) only has to touch the token definitions.
2. **Reduced-motion enforcement** is centralised through the
   M3 motion tokens; ad-hoc `200ms cubic-bezier(...)` strings
   escape it.
3. **Visual regression** is cheaper to spot in a diff against
   the token block than across dozens of components.

## Decision

**Migrate the 21 real violations to tokens, document the
intentional exemptions, and stop there.**

### What was migrated

| Violation                                     | New token / mechanism                                          |
|-----------------------------------------------|----------------------------------------------------------------|
| `font-size: 0.85em` (×7)                       | `--app-type-meta: 0.85em` (relative, follows large-text-theme) |
| `transition: ... 0.15s / 120ms / 0.2s` (×10) | `var(--m3-duration-short3/4) var(--m3-easing-standard)`        |
| SVG `fill="#4caf50"` (departure marker)        | CSS class on `.route-marker-departure circle` + `--app-map-route-departure` |
| SVG `fill="#f44336"` (arrival marker)          | CSS class on `.route-marker-arrival circle` + `--app-map-route-arrival`     |
| SVG `fill="#333"` (transfer marker, interchange dot) | `--app-map-interchange-stroke` via CSS classes           |
| `color: #1a1a1a` (kiosk stale-warning text)    | `--app-on-kiosk-warning: #1a1a1a`                              |

### What was intentionally left untouched

- **`mat-icon font-size` (4 sites: 32 / 40 / 48 / 64 px).** Material
  Icons size their glyph through `font-size`, but the value drives
  the icon box dimension, not text typography. The existing
  comments ("matches container box") make this explicit. These
  do not belong on the M3 typescale.

- **Animation cycle durations (`pulse 2s`, `shimmer 1.5s`,
  `wheel-hint-fade 3s`, `connectionPulse 2.4s`, `live-pulse 2s`,
  `imminentPulse 1.4s`, `search-pulse 1.5s`).** The M3 motion
  scale covers transition durations (50 – 300 ms). Looping
  ambient animations live on a different axis (artistic timing,
  measured in seconds) and should not be forced into the
  transition tokens.

- **CDK drag-drop defaults (`transition: transform 250ms
  cubic-bezier(0, 0, 0.2, 1)` ×2 in `itinerary-stops-dialog`).**
  These mirror Angular CDK's published drag animation contract;
  altering them risks UX drift when CDK is upgraded.

- **Decorative legend grays (`#888`, `#666`, `#333` in
  `map-legend.component.ts`).** The legend renders neutral icon
  proxies on purpose — they must not collide with any real line
  color or status token. Tokenising them as
  `--app-map-legend-icon` would create single-use tokens and
  obscure the intent.

- **Reduced-motion overrides (`animation-duration: 0.01ms`,
  `transition-duration: 0.01ms`).** Required literal value for
  the accessibility override; the M3 tokens are explicitly
  what the override is bypassing.

- **Hex `var()` fallbacks (`var(--app-warning, #c97a17)`).**
  Defensive fallback for ancient browsers without
  CSS custom-property support. Best-practice pattern.

- **GTFS-sourced colors (`line.color` bindings, `network-list`'s
  `[style.color]="line.textColor || '#fff'"`).** The line colors
  come from the operator's GTFS feed; they cannot pass through
  the design token system without erasing the operator's
  branding.

- **PWA `theme-color` meta in `index.html`.** Static hex required
  by the browser PWA pipeline; cannot read CSS variables.

- **`line-dialog` color-picker default (`'#0078D4'`).** User-input
  default for new lines; the line color stored in the database
  must be an immutable hex literal.

- **Test fixtures (specs + `*-spec.helpers.ts`).** Mock data
  values, not production styles.

## Consequences

- **All themable styles route through tokens now.** A subsequent
  theme variant (e.g. high-contrast extension, brand variant)
  only has to override the existing token blocks in `styles.scss`.

- **The `--app-type-meta` token (0.85em) replaces a pattern
  duplicated seven times** with no semantic anchor. Future
  "secondary suffix" styling should use it instead of repeating
  the literal.

- **The map markers' route colors are now first-class tokens
  (`--app-map-route-departure / -arrival`).** Designers can
  rebrand the route-finder feedback without touching the SVG
  template.

- **No new CI guardrail was added.** A grep-based gate on
  `font-size:` literals or `#[0-9a-fA-F]{6}` would mostly
  flag the legitimate exemptions documented above (mat-icon
  dimensions, GTFS data bindings, `var()` fallbacks). The
  cost of false positives outweighs the benefit; the audit
  cadence (every minor or two) catches genuine drift.

- **No visual change is expected** beyond what the tokens
  themselves already render. The migrated map markers,
  transitions, and meta text reuse the values that were
  hardcoded before; nothing was repainted.

## Alternatives considered

- **Add a stylelint config + CI guardrail.** Rejected because
  the legitimate exemptions are numerous and context-dependent
  (mat-icon sizing, GTFS data, SVG attribute fallbacks). An
  allowlist would have to cover dozens of patterns; the
  ROI is poor.

- **Tokenise everything (including the cycle durations and
  legend grays).** Rejected as it would create single-use
  tokens with no semantic anchor; the design system grows
  noisier without becoming more flexible.

- **Refactor the schematic-map's SVG to bind every attribute via
  Angular computed properties.** Rejected — it works for `fill`
  / `stroke` colors but requires shadow-property plumbing for
  each attribute. CSS classes give the same expressiveness
  for the static cases that matter, with no template churn.

## References

- `frontend/src/styles.scss` (canonical token block).
- ADR [0040](0040-maintainability-guardrails.md) (the
  guardrails framework that flagged the gap on each audit).
- Migration commit: `2751564` (`refactor(design-system):
  tokenise remaining hardcoded fonts, motion and SVG fills`).
