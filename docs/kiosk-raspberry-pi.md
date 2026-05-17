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

## Install (build from source)

```bash
git clone https://github.com/Leigh-Chr/transit-display-hub.git
cd transit-display-hub
export JWT_SECRET=$(openssl rand -base64 48)
GTFS_FEED_URL=https://your-feed.example.com/gtfs JWT_SECRET=$JWT_SECRET \
  docker compose -f ops/kiosk/docker-compose.kiosk.yml up -d --build
```

> **Pre-built images** are published per release to
> `ghcr.io/leigh-chr/transit-display-hub-{backend,frontend}` (multi-arch
> amd64 + arm64). The `install.sh` script and the kiosk compose file
> default to pulling the latest tagged image; pass `BUILD_FROM_SOURCE=1`
> to compile from the local checkout instead (slower on Pi 4 — ~20-40 min
> vs ~1 min for a pull).

Alternatively, the automated installer script handles Docker setup,
cloning, and the browser launch for you:

```bash
curl -fsSL https://raw.githubusercontent.com/Leigh-Chr/transit-display-hub/main/ops/kiosk/install.sh | bash
```

The script:

1. Installs Docker if missing (uses the upstream
   `get.docker.com` script).
2. Clones the repository to `~/.transit-display-hub/`.
3. Builds the backend and frontend images locally and starts
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

| Variable             | Purpose                                                                                  |
|----------------------|------------------------------------------------------------------------------------------|
| `GTFS_FEED_URL`      | URL to a GTFS .zip imported on first boot.                                               |
| `KIOSK_URL`          | URL Chromium points at — defaults to `http://localhost`.                                 |
| `KIOSK_BROWSER`      | Set to `none` for headless deployments.                                                  |
| `INSTALL_DIR`        | Where to drop the compose file. Default `~/.transit-display-hub`.                        |
| `JWT_SECRET`         | JWT signing key. Auto-generated with `openssl rand -base64 48` when unset.               |
| `POSTGRES_PASSWORD`  | Postgres user password. Auto-generated with `openssl rand -base64 24` when unset.        |
| `BUILD_FROM_SOURCE`  | Set to `1` to compile images locally instead of pulling from GHCR. Slow on Pi 4.         |
| `TDH_VERSION`        | Pin a specific image tag (e.g. `v1.20.2`). Defaults to `latest`.                         |

## Verifying

After the script finishes, three containers should be running:

```bash
docker compose -f ~/.transit-display-hub/ops/kiosk/docker-compose.kiosk.yml ps
```

The default credentials (Admin / `admin123`) load on first boot. The
backend forces a password rotation on the first login (minimum 12
characters), so visit `http://<host>/login`, sign in as `admin`, and
follow the prompt **before opening the kiosk to the public**.

## Updating

```bash
cd ~/.transit-display-hub
git pull --ff-only
docker compose -f ops/kiosk/docker-compose.kiosk.yml up -d --build
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
docker compose -f ~/.transit-display-hub/ops/kiosk/docker-compose.kiosk.yml logs -f
```
