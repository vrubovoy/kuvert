#!/bin/sh
set -eu

tmp="/config/config.js.$$"
trap 'rm -f "$tmp"' EXIT HUP INT TERM

jq -nr \
  --arg schlusselUrl "${SCHLUSSEL_WEB_URL:-http://localhost:4001}" \
  --arg schlossUrl "${SCHLOSS_URL:-http://localhost:3000}" \
  --arg glockeUrl "${GLOCKE_URL:-http://localhost:5177}" \
  '"window.__HOF_CONFIG__ = " + ({schemaVersion: 1, $schlusselUrl, $schlossUrl, $glockeUrl} | tojson) + ";"' \
  > "$tmp"
chmod 644 "$tmp"
mv "$tmp" /config/config.js
trap - EXIT HUP INT TERM

exec "$@"
