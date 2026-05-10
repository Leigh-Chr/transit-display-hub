## ADR 0036 — Runtime i18n via Transloco

**Status:** Accepted

## Context

The project shipped FR-only until milestone 0.11.0. Two pressures
to add internationalisation:

1. Kiosks deployed in international stations need to switch
   languages on the fly — without a redeploy and without a
   double-bundle.
2. The recognition-driven goal of the project (cf. `project_goal`
   memory) implies a wider potential audience than just the
   French-speaking community.

The Angular ecosystem offers two paths:

- **`@angular/localize`** (official): build-time string
  extraction, one bundle per locale, switch language = full
  reload. Zero runtime overhead.
- **`@jsverse/transloco`** (community-maintained, MIT): runtime
  switching via a translation service, one bundle for every
  locale, JSON dictionaries fetched lazily. Small runtime
  overhead per pipe call.

## Decision

Adopt **Transloco** as the i18n layer. Two reasons:

1. **Runtime switching is essential for the kiosk persona.** A
   passenger landing at a tourist station must be able to flip
   FR ↔ EN without rebooting the kiosk binary. `@angular/localize`
   would force one binary per language, and the kiosk install.sh
   recipe would need to know up-front which language the operator
   wants.
2. **Translation dictionaries become editable artifacts.** A
   non-developer (translator, agency operator) can drop a new
   `assets/i18n/<lang>.json` file and add the language code to
   `TRANSLOCO_AVAILABLE_LANGS` without touching components.
   `@angular/localize` requires re-running the extractor and
   re-shipping the bundle.

The runtime cost (≈ 5 KB gzipped + a function call per pipe
evaluation) is irrelevant on the kiosk's 1080p display where the
typical screen evaluates < 200 pipes per render.

## Implementation

### One service, three concerns

- `transloco.providers.ts` declares `TRANSLOCO_AVAILABLE_LANGS =
  ['fr', 'en']`, the default and fallback language ('fr'), the
  loader and the dev-mode flag.
- `transloco.loader.ts` is a thin `HttpTranslocoLoader` pulling
  `assets/i18n/<lang>.json` once per language per session
  (Transloco's built-in cache).
- `locale.service.ts` wraps `TranslocoService` behind a signal
  API. Components depend on this signal, never directly on the
  Transloco surface — keeps the lib swappable behind a small
  in-house facade.

### First-load language resolution

The `LocaleService` constructor resolves the active language in
this order:

1. `localStorage[lang]` if a previous session set it.
2. `navigator.language` first two characters when supported.
3. Transloco's default ('fr').

A future query-parameter override (`?lang=en` for the kiosk URL)
lives on the consuming component, not in the service — different
routes have different deployment models (kiosk vs admin).

### Incremental migration

Components migrate to Transloco one at a time. The first batch
covers the surface a non-French-speaking visitor lands on:

- Kiosk a11y toolbar labels (visible to every passenger).
- Network map header link to the tabular view.
- Network list page (entire template).

Admin browsers, login, and the individual feature pages keep
their French literals for now. The translation files already
ship the `admin.*` namespace so a follow-up batch can drop the
literals in place without touching `fr.json` again.

## Consequences

- **Bundle size**: +18 KB gzipped for transloco core +
  per-language JSON (`fr.json` ~1 KB, `en.json` ~1 KB). Both
  dictionaries lazy-load on first reference, so the cold start
  cost stays under 2 KB until the user actually switches.
- **Test boot**: components consuming the `transloco` pipe need
  `TranslocoTestingModule.forRoot({...})` plus the pipe in their
  `overrideComponent` imports. Documented inline on the
  network-map spec.
- **No double-render on language change**: `reRenderOnLangChange:
  true` lets every consuming pipe react to the active-lang
  signal. CDK breakpoint observers and the schematic SVG are
  unaffected — they don't read translations.

## Alternatives considered

- **`@angular/localize` (official)**: rejected for the kiosk
  reason above. We may reconsider for the admin app alone if
  the surface ever stabilises (low-churn, multi-language,
  static-bundle deployment).
- **Custom JSON resolver via signals**: would have saved the 18
  KB transloco overhead, but reinventing pluralisation, lazy
  language loading, missing-key handling and runtime mode
  switching is not worth the bytes.
- **Hard-code FR + put EN strings inline next to French ones via
  conditional**: rejected, scales horribly past two languages and
  pollutes every component.
