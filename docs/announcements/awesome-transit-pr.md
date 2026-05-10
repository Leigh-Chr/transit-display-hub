# Awesome-transit PR

Target repository:
https://github.com/MobilityData/awesome-transit

The list groups projects by category. Transit Display Hub
fits under both **GTFS — Tools** (since it imports + validates
GTFS) and **Realtime — Producers / Consumers** (it consumes
GTFS-Realtime feeds). Submit one PR with both entries.

## PR title

```
Add Transit Display Hub — open-source GTFS back-office with kiosk + schematic map
```

## PR body

```
## What is Transit Display Hub

Transit Display Hub is an end-to-end open-source GTFS
platform: an admin back-office (with the canonical
MobilityData validator integrated), a real-time kiosk,
and an interactive schematic network map. Single
codebase, deployable on a Raspberry Pi.

Repo: https://github.com/Leigh-Chr/transit-display-hub
Latest stable: v1.0.0

## What's added

- Under "GTFS — Tools":
  - Transit Display Hub — GTFS admin back-office with import,
    validation (via MobilityData gtfs-validator), Fares v1+v2,
    GTFS-flex, schematic map and a passenger kiosk.

- Under "Realtime — Consumers":
  - Same project entry. Consumes the three GTFS-Realtime feeds
    (Alerts, TripUpdates, VehiclePositions) and surfaces them
    on the kiosk + admin UI.

## Why I think it's a good fit for the list

- Permissive license: project README documents the licence
  terms.
- Active development: 1.0.0 just cut, CI workflows in place,
  issue templates and SECURITY.md present.
- Distinct angle: most listed entries are either pure
  validators / parsers or single-feature consumers; this one
  combines back-office + kiosk + map + Pi deployment in a
  single deliverable.

Happy to make any edit the maintainers prefer.
```

## Diff to the README of awesome-transit

Find the relevant section (probably under "GTFS Schedule —
Tools and Software") and add a bullet:

```
- [Transit Display Hub](https://github.com/Leigh-Chr/transit-display-hub) — Open-source GTFS administrative back-office with real-time kiosk display, interactive schematic map and Raspberry-Pi installer. Includes the MobilityData GTFS validator on every import, Fares v1+v2, GTFS-flex and three GTFS-Realtime feeds.
```

Mirror the bullet under the GTFS-Realtime consumers section.

## Notes

- Read the awesome-transit `CONTRIBUTING.md` before opening
  the PR — they may have a strict ordering convention
  (alphabetical) and a 200-character description cap.
- Don't bundle unrelated changes (typo fixes elsewhere,
  formatting). Keep the PR scope to "add Transit Display Hub".
