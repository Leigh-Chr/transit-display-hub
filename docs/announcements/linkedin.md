# LinkedIn post draft

LinkedIn rewards longer posts (1300-2000 characters works
better than the 280-char twitter style). Lead with a
"why this matters" hook, follow with concrete deliverables.

## Personal launch post

```
Cut the 1.0.0 of Transit Display Hub today — an
open-source GTFS platform I've been building on the
side. One codebase covers three personas at once: a
back-office for transit operators (admin app), a real-
time kiosk for passengers at stops, and an interactive
schematic map of the network.

Most open-source GTFS tooling stops at "parsing" —
validators, exporters, route-finders. If you want a
deployable back-office (admin UI + kiosk + map +
observability), you typically end up gluing several
tools together or paying for a closed SaaS.
Transit Display Hub is the all-in-one alternative.

What ships in 1.0:

— 100% GTFS spec coverage (Schedule v1, Fares v1+v2,
   GTFS-flex, GTFS-Realtime), validated on every
   import by the canonical MobilityData runner.

— WCAG 2.2 AA accessibility built in: high-contrast
   palette, large-text mode, vocal next-departure
   announcements via Web Speech API, tabular
   alternative to the SVG schematic.

— Runtime FR/EN switching, so a kiosk in a multilingual
   station flips languages without redeploying.

— Turnkey deployment on a Raspberry Pi: one curl | bash
   sets up Docker, brings up PostgreSQL + Spring Boot
   API + Angular frontend, and launches Chromium in
   fullscreen kiosk mode. Tested on a Pi 4.

— 38 Architecture Decision Records explaining the non-
   obvious choices, from the in-memory point-in-polygon
   over JTS to the three orthogonal accessibility
   signals.

Stack: Spring Boot 4 + Java 21 + Angular 21 + Material
M3 + PostgreSQL + Transloco + Playwright + JaCoCo.

Repo: https://github.com/Leigh-Chr/transit-display-hub

If you work in mobility / public transport, give it a
spin against your network's GTFS feed. Bug reports and
feature ideas welcome.

#GTFS #PublicTransit #OpenSource #Accessibility
#SpringBoot #Angular
```

**Notes:**

- Post weekday morning (Tue–Thu, 9–10 a.m. local time).
- Reply to early comments within 30 min — LinkedIn ranks
  posts by initial engagement velocity.
- Don't tag people unless they explicitly opted in.
