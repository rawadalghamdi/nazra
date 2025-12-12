#!/usr/bin/env bash
#
# Stop Nazra website (backend + frontend) and free ports.
# - Kills processes listening on ports: 3000 (Vite dev), 8000 (FastAPI), and common Vite fallbacks (5173/5174).
# - Tries graceful stop first (SIGTERM), then SIGKILL if still running.
#
# Usage:
#   ./stop_website.sh
#

set -euo pipefail

PORTS_DEFAULT=(3000 8000 5173 5174)
PORTS=("${PORTS_DEFAULT[@]}")

say() { printf "%s\n" "$*"; }
have_cmd() { command -v "$1" >/dev/null 2>&1; }

list_pids_on_port() {
  local port="$1"
  if have_cmd lsof; then
    lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  else
    return 1
  fi
}

kill_pids() {
  local sig="$1"; shift
  local pids=("$@")
  ((${#pids[@]} == 0)) && return 0
  kill -"${sig}" "${pids[@]}" 2>/dev/null || true
}

wait_gone() {
  local timeout_s="$1"; shift
  local pids=("$@")
  local start now
  start="$(date +%s)"
  while :; do
    local alive=()
    for pid in "${pids[@]}"; do
      kill -0 "$pid" 2>/dev/null && alive+=("$pid")
    done
    ((${#alive[@]} == 0)) && return 0
    now="$(date +%s)"
    (( now - start >= timeout_s )) && return 1
    sleep 0.2
  done
}

show_ps() {
  local pid="$1"
  ps -p "$pid" -o pid=,ppid=,command= 2>/dev/null || true
}

main() {
  if ! have_cmd lsof; then
    say "Error: 'lsof' is required to free ports (install it, e.g. via Xcode Command Line Tools)."
    exit 1
  fi

  say "Stopping Nazra website processes and freeing ports: ${PORTS[*]}"

  # Note: macOS ships Bash 3.2, so avoid Bash 4+ features like `mapfile`.
  local all_pids_lines=""
  for port in "${PORTS[@]}"; do
    local pids_text
    pids_text="$(list_pids_on_port "$port" || true)"
    if [[ -n "${pids_text}" ]]; then
      say ""
      say "Port ${port} is in use by:"
      while IFS= read -r pid; do
        [[ -z "${pid}" ]] && continue
        show_ps "$pid"
        all_pids_lines+="${pid}"$'\n'
      done <<< "${pids_text}"
    fi
  done

  local all_pids_unique
  all_pids_unique="$(printf "%s" "${all_pids_lines}" | awk 'NF' | sort -u || true)"

  local all_pids=()
  if [[ -n "${all_pids_unique}" ]]; then
    while IFS= read -r pid; do
      [[ -z "${pid}" ]] && continue
      all_pids+=("${pid}")
    done <<< "${all_pids_unique}"
  fi

  if ((${#all_pids[@]} == 0)); then
    say ""
    say "No listeners found on ports: ${PORTS[*]} (nothing to stop)."
    exit 0
  fi

  say ""
  say "Sending SIGTERM to: ${all_pids[*]}"
  kill_pids TERM "${all_pids[@]}"

  if wait_gone 5 "${all_pids[@]}"; then
    say "Stopped successfully."
    exit 0
  fi

  say "Some processes are still running; sending SIGKILL..."
  kill_pids KILL "${all_pids[@]}"

  if wait_gone 3 "${all_pids[@]}"; then
    say "Force-stopped successfully."
    exit 0
  fi

  say "Warning: some processes could not be killed."
  exit 1
}

main "$@"

