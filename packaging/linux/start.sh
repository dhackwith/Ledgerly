#!/usr/bin/env bash
# Ledgerly launcher for Linux.
# Serves the app on this computer only (127.0.0.1) and opens it in your browser.
#
#   ./start.sh                     start Ledgerly
#   ./start.sh --install-shortcut  add Ledgerly to your applications menu
#   LEDGERLY_PORT=9000 ./start.sh  use a different port
#
# Your expenses are saved in the browser for this exact address, so keep using
# the same port (and the same browser) to see the same data.

set -euo pipefail

HOST="127.0.0.1"
PORT="${LEDGERLY_PORT:-8765}"
URL="http://${HOST}:${PORT}/"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$DIR/app"
LOG_FILE="${TMPDIR:-/tmp}/ledgerly-server.log"

say() { printf '%s\n' "$*"; }
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }

install_shortcut() {
  local apps="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  mkdir -p "$apps"
  local file="$apps/ledgerly.desktop"
  cat >"$file" <<EOF
[Desktop Entry]
Type=Application
Name=Ledgerly
Comment=Personal expense tracker
Exec=bash "$DIR/start.sh"
Path=$DIR
Icon=accessories-calculator
Terminal=true
Categories=Office;Finance;
EOF
  chmod +x "$file"
  say "Added Ledgerly to your applications menu ($file)."
  say "If you move this folder, run ./start.sh --install-shortcut again."
}

port_open() {
  (exec 3<>"/dev/tcp/${HOST}/${PORT}") 2>/dev/null
}

# True if the thing already listening on the port is a running copy of Ledgerly.
is_ledgerly_running() {
  local reply
  reply="$(
    exec 3<>"/dev/tcp/${HOST}/${PORT}" || exit 1
    printf 'GET /ledgerly.txt HTTP/1.0\r\nHost: %s\r\n\r\n' "$HOST" >&3
    if command -v timeout >/dev/null 2>&1; then
      timeout 3 cat <&3 2>/dev/null || true
    else
      cat <&3 2>/dev/null || true
    fi
  )" 2>/dev/null || return 1
  [[ "$reply" == *"ledgerly-app"* ]]
}

open_browser() {
  local opener
  for opener in xdg-open gio sensible-browser x-www-browser firefox google-chrome chromium; do
    if command -v "$opener" >/dev/null 2>&1; then
      if [[ "$opener" == "gio" ]]; then
        gio open "$URL" >/dev/null 2>&1 &
      else
        "$opener" "$URL" >/dev/null 2>&1 &
      fi
      return 0
    fi
  done
  say "Couldn't find a browser to open automatically. Open this address yourself:"
  say "  $URL"
}

# Prints the command (one word per line) that will serve the app.
find_server() {
  local py
  for py in python3 python; do
    if command -v "$py" >/dev/null 2>&1 &&
      "$py" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)' >/dev/null 2>&1; then
      printf '%s\n' "$py" -m http.server "$PORT" --bind "$HOST" --directory "$APP_DIR"
      return 0
    fi
  done
  if command -v node >/dev/null 2>&1; then
    printf '%s\n' node "$DIR/server.js" "$PORT" "$HOST" "$APP_DIR"
    return 0
  fi
  return 1
}

main() {
  if [[ "${1:-}" == "--install-shortcut" ]]; then
    install_shortcut
    exit 0
  fi
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
  fi

  [[ -f "$APP_DIR/index.html" ]] || fail "The app files are missing. Re-extract the whole download and try again."
  [[ "$PORT" =~ ^[0-9]+$ ]] && ((PORT > 0 && PORT < 65536)) || fail "LEDGERLY_PORT must be a number between 1 and 65535."

  if port_open; then
    if is_ledgerly_running; then
      say "Ledgerly is already running at $URL"
      open_browser
      exit 0
    fi
    fail "Port $PORT is used by another program. Close it, or run: LEDGERLY_PORT=8766 ./start.sh
       (Expenses saved under one port won't show up under another.)"
  fi

  local -a server
  mapfile -t server < <(find_server) || true
  ((${#server[@]})) || fail "Ledgerly needs Python 3 (or Node.js) to run.
       Install it with your package manager, for example:
         sudo apt install python3      (Debian, Ubuntu, Mint)
         sudo dnf install python3      (Fedora)
         sudo pacman -S python         (Arch)"

  "${server[@]}" >"$LOG_FILE" 2>&1 &
  local pid=$!
  trap 'kill "$pid" 2>/dev/null || true' EXIT
  trap 'say ""; say "Stopping Ledgerly. Your expenses stay saved in your browser."; exit 0' INT TERM

  local i
  for ((i = 0; i < 50; i++)); do
    port_open && break
    kill -0 "$pid" 2>/dev/null || { cat "$LOG_FILE" >&2; fail "The web server stopped unexpectedly (details above)."; }
    sleep 0.1
  done
  port_open || fail "The web server didn't start within 5 seconds. See $LOG_FILE"

  say ""
  say "  Ledgerly is running at $URL"
  say "  Keep this window open while you use it. Press Ctrl+C to stop."
  say ""
  open_browser

  wait "$pid" || true
}

main "$@"
