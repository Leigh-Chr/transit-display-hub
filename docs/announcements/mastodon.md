# Mastodon drafts

500-character limit per toot. The launch toot fits in one;
follow-ups go in a thread.

## Launch toot (English)

> Just cut 1.0 of Transit Display Hub — open-source GTFS
> back-office with real-time kiosk + schematic map. 100%
> spec coverage validated by @mobilitydata, WCAG 2.2 AA
> accessibility, FR/EN runtime switch, Raspberry-Pi
> installer.
>
> Spring Boot 4 + Angular 21 + 38 ADRs documenting the design.
>
> https://github.com/Leigh-Chr/transit-display-hub
>
> #GTFS #PublicTransit #OpenSource #Accessibility

## Follow-up #1 — accessibility

> 1/ The reason WCAG 2.2 AA is shipped by default and not as
> an opt-in module: a kiosk at a stop is the most adversarial
> a11y context I can think of (sunlight glare, tactile-only
> users, multilingual passengers). Three orthogonal signals
> in ThemeService cover the cases that matter: high-contrast,
> large-text, dark mode. Stackable.

## Follow-up #2 — kiosk install

> 2/ The Raspberry-Pi installer is `curl … | bash`. It
> bootstraps Docker if missing, pulls multi-arch images,
> brings up PostgreSQL + backend + frontend, polls until the
> frontend answers, and (if a graphical session is detected)
> launches Chromium in fullscreen. Headless-server safe via
> `KIOSK_BROWSER=none`.

## Follow-up #3 — what's next

> 3/ 1.0 is the floor, not the ceiling. Next up: more
> language packs in i18n, deeper GTFS-RT extensions support,
> richer route-finder UI. PRs welcome — issue templates and
> a CONTRIBUTING guide are in the repo.

## French toot for transportation.fr / mastodon.iriseden.eu

> Sortie de la 1.0 de Transit Display Hub — back-office GTFS
> open-source avec kiosk temps réel + carte schématique.
> Couverture spec à 100% (validée par le runner MobilityData),
> accessibilité WCAG 2.2 AA, bascule FR/EN à chaud,
> installeur Raspberry Pi.
>
> Spring Boot 4 + Angular 21 + 38 ADRs documentent les choix.
>
> https://github.com/Leigh-Chr/transit-display-hub
>
> #GTFS #TransportPublic #Mobilité
