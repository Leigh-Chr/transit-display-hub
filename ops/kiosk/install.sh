#!/usr/bin/env bash
# Transit Display Hub — kiosk installer
#
# Bootstraps a single-host kiosk on a Linux box: installs Docker if
# missing, clones the repository, builds the images locally, brings the
# stack up, and (when X / Wayland are available) launches Chromium
# pointed at http://localhost in fullscreen kiosk mode. Idempotent:
# re-running the script pulls the latest source and rebuilds.
#
# Usage (interactive):
#   curl -fsSL https://raw.githubusercontent.com/Leigh-Chr/transit-display-hub/main/ops/kiosk/install.sh | bash
#
# Usage (with a feed URL preset):
#   GTFS_FEED_URL=https://transport.data.gouv.fr/… ./install.sh
#
# Usage (skip the chromium auto-launch — useful for headless servers):
#   KIOSK_BROWSER=none ./install.sh
#
# The release workflow publishes multi-arch (amd64 + arm64) images to
# ghcr.io/leigh-chr/transit-display-hub-{backend,frontend}. This script
# clones the repository for the compose file but pulls the images.

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/.transit-display-hub}"
REPO_URL="${REPO_URL:-https://github.com/Leigh-Chr/transit-display-hub.git}"
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

clone_or_update_repo() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating existing clone in $INSTALL_DIR…"
    git -C "$INSTALL_DIR" pull --ff-only
  else
    log "Cloning repository to $INSTALL_DIR…"
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
}

start_stack() {
  log "Building images and bringing up the stack…"
  (cd "$INSTALL_DIR" && \
    JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 48)}" \
    GTFS_FEED_URL="${GTFS_FEED_URL:-}" \
    docker compose -f ops/kiosk/docker-compose.kiosk.yml up -d --build)
}

wait_for_frontend() {
  log "Waiting for the frontend to answer at $KIOSK_URL …"
  local tries=60
  while ! curl -fsS -o /dev/null "$KIOSK_URL" && [ $tries -gt 0 ]; do
    sleep 2
    tries=$((tries - 1))
  done
  if [ $tries -eq 0 ]; then
    err "Frontend did not respond after 120 s. Run 'docker compose -f $INSTALL_DIR/ops/kiosk/docker-compose.kiosk.yml logs' to investigate."
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
  clone_or_update_repo
  start_stack
  wait_for_frontend
  launch_browser
  log "Done. The stack will restart on reboot via the 'unless-stopped' policy."
}

main "$@"
