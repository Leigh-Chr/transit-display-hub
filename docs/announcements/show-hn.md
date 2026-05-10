# Show HN draft

**Title (max 80 chars):**

> Show HN: Transit Display Hub – open-source GTFS back-office with WCAG 2.2 AA kiosks

**URL:** `https://github.com/Leigh-Chr/transit-display-hub`

**First comment (post immediately as the OP — HN convention):**

```
Hi HN,

I've been building Transit Display Hub for the past months — an
open-source platform that combines a GTFS back-office (admin
import, validation, fares v1+v2, GTFS-flex, GTFS-Realtime), a
real-time kiosk for stop displays, and an interactive schematic
network map. One codebase, three personas (operator, passenger,
SRE), one Raspberry Pi to run the whole stack.

Why I think it's worth a look:

- 100% GTFS spec coverage, validated on every import by the
  canonical MobilityData runner. No gluing six tools together.
- WCAG 2.2 AA accessibility shipped by default — high-contrast
  palette, large-text mode, vocal announcements via Web Speech
  API, tabular alternative to the SVG schematic. Built in,
  not bolted on.
- Runtime FR/EN switching via Transloco (no per-language
  bundle), so a kiosk in a multilingual station flips
  languages without redeploying.
- Turnkey kiosk deployment: a single curl | bash sets up
  Docker, pulls the multi-arch images, and launches Chromium
  in fullscreen mode. Tested on a Raspberry Pi 4.

Stack: Spring Boot 4 + Java 21 backend, Angular 21 + Material
M3 frontend, PostgreSQL in production, H2 in dev. JaCoCo +
Vitest coverage, Playwright smoke E2E, two GitHub Actions
workflows.

The 38 ADRs in docs/adr/ are probably the most useful thing
to read if you want the engineering rationale behind each
non-obvious decision.

Happy to answer questions, take feedback, or hear about
anyone who tries it on a real feed.
```

**Notes:**

- Post Tuesday–Thursday, 8am–11am Pacific for max visibility.
- Don't oversell — HN punishes hype. The bullet list above
  states three specific facts before mentioning the differentiator.
- Be ready to answer in the thread within the first 90 minutes.
  Top-of-page time on HN is short.
- If the post gets traction, follow up in the same thread when
  bugs are filed — visible responsiveness signals "real, alive
  project" more than the launch post itself.
