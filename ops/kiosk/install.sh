#!/usr/bin/env bash
# Transit Display Hub — kiosk installer
#
# Bootstraps a single-host kiosk on a Linux box: installs Docker if
# missing, pulls the docker-compose.kiosk.yml file, brings the stack
# up, and (when X / Wayland are available) launches Chromium pointed
# at http://localhost in fullscreen kiosk mode. Idempotent: re-running
# the script restarts the stack on the latest tag.
#
# Usage (interactive):
#   curl -fsSL https://raw.githubusercontent.com/Leigh-Chr/transit-display-hub/main/ops/kiosk/install.sh | bash
#
# Usage (with a feed URL preset):
#   GTFS_FEED_URL=https://transport.data.gouv.fr/… ./install.sh
#
# Usage (skip the chromium auto-launch — useful for headless servers):
#   KIOSK_BROWSER=none ./install.sh

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/.transit-display-hub}"
COMPOSE_URL="${COMPOSE_URL:-https://raw.githubusercontent.com/Leigh-Chr/transit-display-hub/main/ops/kiosk/docker-compose.kiosk.yml}"
KIOSK_URL="${KIOSK_URL:-http://localhost}"
KIOSK_BROWSER="${KIOSK_BROWSER:-auto}"

log() { printf '\033[1;34m[install]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$1"; }
err() { printf '\033[1;31m[error]\033[0m %s\n' "$1" >&2; }

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker already installed."
    return
  fi
  log "Installing Docker (https://docs.docker.com/get-docker/)…"
  curl -fsSL https://get.docker.com | sh
  if [ -n "${SUDO_USER:-}" ]; then
    sudo usermod -aG docker "$SUDO_USER" || true
    warn "Added $SUDO_USER to the docker group; log out and back in for it to take effect."
  fi
}

fetch_compose() {
  mkdir -p "$INSTALL_DIR"
  log "Downloading docker-compose.kiosk.yml to $INSTALL_DIR…"
  curl -fsSL "$COMPOSE_URL" -o "$INSTALL_DIR/docker-compose.kiosk.yml"
}

start_stack() {
  log "Pulling images…"
  (cd "$INSTALL_DIR" && docker compose -f docker-compose.kiosk.yml pull)
  log "Bringing up the stack…"
  (cd "$INSTALL_DIR" && docker compose -f docker-compose.kiosk.yml up -d)
}

wait_for_frontend() {
  log "Waiting for the frontend to answer at $KIOSK_URL …"
  local tries=60
  while ! curl -fsS -o /dev/null "$KIOSK_URL" && [ $tries -gt 0 ]; do
    sleep 2
    tries=$((tries - 1))
  done
  if [ $tries -eq 0 ]; then
    err "Frontend did not respond after 120 s. Run 'docker compose -f $INSTALL_DIR/docker-compose.kiosk.yml logs' to investigate."
    exit 1
  fi
  log "Frontend reachable."
}

launch_browser() {
  if [ "$KIOSK_BROWSER" = "none" ]; then
    log "KIOSK_BROWSER=none, skipping browser launch."
    return
  fi
  if [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    warn "No DISPLAY / WAYLAND_DISPLAY found, skipping Chromium auto-launch. Open $KIOSK_URL manually."
    return
  fi
  for binary in chromium chromium-browser google-chrome firefox; do
    if command -v "$binary" >/dev/null 2>&1; then
      log "Launching $binary in kiosk mode against $KIOSK_URL …"
      nohup "$binary" --kiosk --noerrdialogs --disable-infobars "$KIOSK_URL" >/dev/null 2>&1 &
      return
    fi
  done
  warn "No supported browser found (chromium, chromium-browser, google-chrome, firefox). Install one and open $KIOSK_URL manually."
}

main() {
  if [ "${EUID:-$(id -u)}" -eq 0 ]; then
    warn "Running as root; the installer recommends running as a regular user."
  fi
  ensure_docker
  fetch_compose
  start_stack
  wait_for_frontend
  launch_browser
  log "Done. The stack will restart on reboot via the 'unless-stopped' policy."
}

main "$@"
