#!/bin/sh
set -eu

seconds="${1:-}"
case "$seconds" in
  ''|*[!0-9]*)
    exit 2
    ;;
esac

if [ "$seconds" -lt 1 ] || [ "$seconds" -gt 30 ]; then
  exit 2
fi

sound="$(CDPATH= cd -- "$(dirname "$0")" && pwd)/mixkit-facility-alarm-sound-999.wav"
end_time=$(( $(date +%s) + seconds ))
current_pid=""

cleanup() {
  if [ -n "$current_pid" ] && kill -0 "$current_pid" 2>/dev/null; then
    kill "$current_pid" 2>/dev/null || true
    wait "$current_pid" 2>/dev/null || true
  fi
}

trap 'cleanup; exit 143' INT TERM

while [ "$(date +%s)" -lt "$end_time" ]; do
  /usr/bin/afplay -v 1.0 "$sound" &
  current_pid=$!
  wait "$current_pid" || true
done
