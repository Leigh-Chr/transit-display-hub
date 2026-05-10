# Reddit drafts

Different subreddits expect different framings. Keep one
sentence in common across all of them: the all-in-one
combination (GTFS spec + accessibility + Pi installer) is the
differentiator.

## /r/opensource

**Title:** `Transit Display Hub 1.0 — open-source GTFS back-office with WCAG 2.2 AA kiosks (Spring Boot + Angular)`

**Body:**

> Released the 1.0.0 of an open-source platform I've been
> working on: it bundles a GTFS administrative back-office,
> a passenger kiosk and a schematic network map in a single
> deployable stack. Targets the gap between "I have a GTFS
> validator" and "I have a deployed kiosk".
>
> Highlights:
>
> - 100% GTFS Schedule v1 / Fares v1+v2 / GTFS-flex /
>   GTFS-Realtime, validated by MobilityData on every import.
> - WCAG 2.2 AA accessibility shipped by default — kiosk
>   high-contrast + large-text + vocal next-departure (Web
>   Speech API) + tabular alternative to the SVG.
> - Runtime FR/EN i18n via Transloco.
> - Raspberry-Pi `curl | bash` installer that brings up
>   PostgreSQL + backend + frontend + Chromium kiosk.
> - 38 ADRs documenting the non-obvious decisions in
>   `docs/adr/`.
>
> Stack: Spring Boot 4 + Java 21 / Angular 21 + Material M3 /
> PostgreSQL / WebSocket-STOMP / JWT.
>
> https://github.com/Leigh-Chr/transit-display-hub
>
> Feedback welcome — happy to answer architectural questions
> in the comments.

## /r/selfhosted

**Title:** `Self-hosted real-time passenger info display for any GTFS feed (1.0)`

**Body:**

> If you've ever wanted to run a real-time bus / metro
> arrivals display on a Raspberry Pi for your local network,
> this might help. Open-source, runs the whole stack
> (PostgreSQL + Spring Boot API + Angular frontend +
> Chromium kiosk) on one Pi 4 with one curl | bash command.
>
> Point it at any GTFS feed (the one liner takes a
> `GTFS_FEED_URL` env var) and you get a live arrivals board
> + schematic map at `http://localhost`.
>
> 100% GTFS spec coverage, validated by the canonical
> MobilityData runner. WCAG 2.2 AA accessibility built in
> (high-contrast, large text, vocal announcements). FR/EN
> runtime switch.
>
> Repo: https://github.com/Leigh-Chr/transit-display-hub
> Pi guide: https://github.com/Leigh-Chr/transit-display-hub/blob/main/docs/kiosk-raspberry-pi.md
>
> Looking for users running it on real feeds — feedback on
> imports of unusual networks especially welcome.

## /r/transit

**Title:** `Open-source schematic network map + accessible kiosk for any GTFS feed`

**Body:**

> Built an open-source platform that turns any GTFS feed
> into a schematic network map and a real-time arrivals
> kiosk. Spec coverage includes the bits most other tools
> skip — Fares v2, GTFS-flex (DRT), GTFS-Realtime alerts +
> trip updates + vehicle positions.
>
> Schematic map highlights:
>
> - Parent / platform collapse so a station with N quays
>   shows as one stop, with platform numbers in the popup.
> - Frequency-scaled stroke width (busier lines look fatter).
> - Fare-zone overlay toggle.
> - Wheelchair-accessibility filter.
> - TAD / on-demand stops shown with a ring indicator.
> - Tabular alternative at `/map/list` for screen readers.
>
> Tested on the Grenoble feed plus the gtfs-rich classpath
> fixture that exercises every spec edge.
>
> https://github.com/Leigh-Chr/transit-display-hub
>
> Curious to hear if anyone tries it on a feed I haven't
> seen — TriMet, MBTA, RATP, anything with quirks I should
> handle.

## /r/programming

**Title:** `Transit Display Hub 1.0 — Spring Boot 4 + Angular 21 GTFS platform, 38 ADRs documenting the design`

**Body:**

> Cut 1.0.0 of an open-source GTFS platform yesterday. The
> repo's most useful artifact for the /r/programming crowd
> is probably the 38 ADRs documenting every non-obvious
> design choice — Fares v2 v.s. legacy fallback, in-memory
> point-in-polygon vs JTS, MobilityData runner integrated as
> a library vs CLI sub-process, Transloco runtime switching
> vs @angular/localize, JaCoCo with a 55% floor instead of
> a heroic 80%, WCAG 2.2 AA via three orthogonal signals
> instead of one mode enum.
>
> Code-wise it's a single-repo Spring Boot 4 + Java 21 +
> Angular 21 + Material M3 setup. Tests run on JaCoCo +
> Vitest with V8 coverage; smoke E2E via Playwright. Two
> GitHub Actions workflows.
>
> https://github.com/Leigh-Chr/transit-display-hub
> ADRs: https://github.com/Leigh-Chr/transit-display-hub/tree/main/docs/adr
>
> Comments / critique welcome.
