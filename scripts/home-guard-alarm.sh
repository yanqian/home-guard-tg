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

exec /usr/bin/afplay -v 1.0 -t "$seconds" "$sound"
