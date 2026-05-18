# Screenshots

This folder hosts the PNG / GIF assets the README references.
Drop new files here and update the markdown table in the
project README — keeps the README diff small and the assets
versioned.

## Capture conventions

- **Format**: PNG for static frames, animated GIF (≤ 4 MB) or
  WebM (≤ 6 MB) for short walk-throughs. Avoid MP4 — GitHub
  doesn't render it inline.
- **Resolution**: 1920×1080 capture rendered at 50 % display.
  Drop the `@2x` suffix for retina sources.
- **Theme**: light theme by default. Add a `_dark` suffix when
  shipping a dark variant alongside.
- **Privacy**: every screenshot must be taken against the
  `gtfs-rich` fixture or the public Grenoble feed. Never
  publish a customer's data.

## Expected files (tracked in the README)

| Filename                  | Source surface                        |
|---------------------------|---------------------------------------|
| `admin-dashboard.png`     | `/admin/dashboard` after a fresh import |
| `network-map.png`         | `/map` with the schematic visible    |
| `stop-popup.png`          | `/map` with a stop popup open        |
| `kiosk.png`               | `/display/STA_CENTRAL` from the fixture |
| `import-audit.png`        | `/admin/operations/import-history` after a successful import |
| `network-list.png`        | `/map/list` accessible alternative   |

When more captures are added (e.g. a fares calculator demo or a
GTFS-Realtime walk-through), update both this table and the one
in the root README.

## Regenerating screenshots

Screenshots are captured by Playwright via a dedicated spec
(`frontend/e2e/screenshots.spec.ts`) gated by the
`SCREENSHOTS_ENABLED` env var. It self-skips in default CI / local
runs so a normal `npm test` does not overwrite the committed PNGs.

```bash
# 1. Boot the backend with the rich fixture and an ephemeral JWT secret
JWT_SECRET=$(openssl rand -base64 48) \
SPRING_PROFILES_ACTIVE=dev \
DATA_LOADER_GTFS_URL=classpath:fixtures/gtfs-rich/ \
  ./backend/gradlew -p backend bootRun &

# 2. Run the Playwright spec — the spec auto-starts the frontend dev
# server via its `webServer` config and writes PNGs straight into
# this folder.
cd frontend
SCREENSHOTS_ENABLED=1 npx playwright test screenshots.spec.ts --project=chromium
```

For multi-language captures, switch the default Transloco locale
before running the spec (e.g. via the language menu in the admin
layout, or by tweaking the fixture). See [`../i18n.md`](../i18n.md)
for the i18n contributor flow.

Commit the resulting diff like any other change. Walk-through
recordings (GIF / WebM) can use [`vhs`](https://github.com/charmbracelet/vhs)
or [`peek`](https://github.com/phw/peek), or the native browser
DevTools recorder.
