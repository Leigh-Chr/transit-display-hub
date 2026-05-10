# Kiosk deployment on a Raspberry Pi

This guide walks through turning a Raspberry Pi 4 (or any
Linux-capable mini-PC) into a stand-alone passenger information
kiosk. The full stack — PostgreSQL, the Spring Boot backend, the
Angular frontend served by Nginx, and Chromium in fullscreen
kiosk mode — runs on a single host.

## Hardware

| Component | Recommended |
|-----------|-------------|
| Computer  | Raspberry Pi 4 (4 GB+) or an x86 mini-PC |
| Display   | Any HDMI-capable screen, 1080p or higher |
| Network   | Wired Ethernet preferred for stability |
| Storage   | 16 GB+ SD card or SSD |

## OS

Raspberry Pi OS Lite 64-bit, Debian 12, or Ubuntu Server 24.04.
A graphical desktop is optional — the installer skips the
Chromium auto-launch when no `DISPLAY` is found.

## Required environment variables

The kiosk backend refuses to start without an explicit JWT signing
key. Generate one (≥ 256 bits, base64-encoded) and export it in your
shell before launching the stack:

```bash
export JWT_SECRET=$(openssl rand -base64 48)
```

Then start the stack:

```bash
GTFS_FEED_URL=https://your-feed.example.com/gtfs JWT_SECRET=$JWT_SECRET \
  docker compose -f ops/kiosk/docker-compose.kiosk.yml up -d
```

If `JWT_SECRET` is missing, both Docker Compose (via `:?` syntax) and
Spring Boot (no fallback in the kiosk profile) will fail fast with an
explicit error.

## One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/Leigh-Chr/transit-display-hub/main/ops/kiosk/install.sh | bash
```

The script:

1. Installs Docker if missing (uses the upstream
   `get.docker.com` script).
2. Downloads `docker-compose.kiosk.yml` to
   `~/.transit-display-hub/`.
3. Pulls the two pre-built images from GHCR and starts
   PostgreSQL + backend + frontend.
4. Polls `http://localhost` until the frontend responds.
5. Launches Chromium in `--kiosk` mode against
   `http://localhost` if a graphical session is detected.

## Customisation

Pass an environment variable before running the installer:

```bash
GTFS_FEED_URL=https://transport.data.gouv.fr/.../gtfs.zip \
KIOSK_URL=http://localhost/display/STA_CENTRAL \
./install.sh
```

| Variable          | Purpose                                                  |
|-------------------|----------------------------------------------------------|
| `GTFS_FEED_URL`   | URL to a GTFS .zip imported on first boot.               |
| `KIOSK_URL`       | URL Chromium points at — defaults to `http://localhost`. |
| `KIOSK_BROWSER`   | Set to `none` for headless deployments.                  |
| `INSTALL_DIR`     | Where to drop the compose file. Default `~/.transit-display-hub`. |

## Verifying

After the script finishes, three containers should be running:

```bash
docker compose -f ~/.transit-display-hub/docker-compose.kiosk.yml ps
```

The default credentials (Admin / `admin123`) load on first boot.
Change them via `/admin/users` before opening the kiosk to the
public.

## Updating

```bash
cd ~/.transit-display-hub
docker compose -f docker-compose.kiosk.yml pull
docker compose -f docker-compose.kiosk.yml up -d
```

## Auto-start on boot

The compose file uses `restart: unless-stopped`, so Docker
restarts the stack on reboot automatically. To also re-launch
Chromium after a reboot, add a one-line systemd user service:

```ini
# ~/.config/systemd/user/transit-kiosk.service
[Unit]
Description=Transit Display Hub — kiosk Chromium
After=graphical-session.target

[Service]
ExecStart=/usr/bin/chromium --kiosk --noerrdialogs --disable-infobars http://localhost
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Enable it: `systemctl --user enable --now transit-kiosk.service`.

## Troubleshooting

| Symptom                              | Likely cause                                   |
|--------------------------------------|------------------------------------------------|
| Frontend 502                         | Backend still starting; wait 30 s.             |
| GTFS feed never loads                | `GTFS_FEED_URL` not set or unreachable.        |
| Chromium does not launch             | No DISPLAY found. Run from a graphical session. |
| `docker: command not found` after install | Re-login so the new docker group takes effect. |

Logs:

```bash
docker compose -f ~/.transit-display-hub/docker-compose.kiosk.yml logs -f
```
