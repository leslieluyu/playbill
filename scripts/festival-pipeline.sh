#!/usr/bin/env bash
# Re-scrape festival seeds (awards + doulist gap fill), re-seed DB, deploy, then TMDB+Douban enrich + redeploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${HOME}/.local/node/bin:${PATH}"
LOG="${1:-/tmp/festival-pipeline.log}"
exec >>"$LOG" 2>&1

echo "=== festival-pipeline $(date -Is) ==="

npm run festival-seed -- --all

for id in cannes-palme-dor berlin-golden-bear venice-golden-lion; do
  echo "=== seed $id ==="
  npm run seed -- "$id"
done

npm run db -- export

rm -rf .astro node_modules/.astro
npm run build
rsync -a --delete dist/ /home/luyu/services/playbill/
echo "=== deployed after seed $(date -Is) ==="

npm run festival-enrich

npm run db -- export
rm -rf .astro node_modules/.astro
npm run build
rsync -a --delete dist/ /home/luyu/services/playbill/
echo "=== deployed after enrich $(date -Is) ==="
