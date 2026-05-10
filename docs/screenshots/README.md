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
| `import-audit.png`        | `/admin/import-audit` after a successful import |
| `network-list.png`        | `/map/list` accessible alternative   |

When more captures are added (e.g. a fares calculator demo or a
GTFS-Realtime walk-through), update both this table and the one
in the root README.

## How to recapture

```bash
# Boot the stack with the rich fixture
DATA_LOADER_GTFS_URL=classpath:fixtures/gtfs-rich/ \
  ./backend/gradlew -p backend bootRun &
(cd frontend && npm start) &

# Open the URLs above and capture with your OS shortcut, then
# drop the resulting files in this folder.
```

Recordings can use [`vhs`](https://github.com/charmbracelet/vhs)
or [`peek`](https://github.com/phw/peek) for GIFs, or the native
browser DevTools recorder for WebM.
