#!/usr/bin/env bash
# Build static site, refresh FTS index, sync to PLAYBILL_STATIC, restart playbill.service (if installed).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATIC="${PLAYBILL_STATIC:-/home/luyu/services/playbill}"

cd "$ROOT"
npm run build
npm run build-search-fts
rsync -a --delete dist/ "$STATIC/"

if [[ -f "$ROOT/deploy/playbill.service" ]] && command -v systemctl >/dev/null; then
  sudo cp "$ROOT/deploy/playbill.service" /etc/systemd/system/playbill.service
  sudo systemctl daemon-reload
  sudo systemctl enable playbill.service
  sudo systemctl restart playbill.service
  echo "playbill.service restarted (api-only on :8787)"
fi
if ! systemctl is-active playbill.service &>/dev/null; then
  echo "WARN: playbill.service not active — check: systemctl status playbill.service"
fi
