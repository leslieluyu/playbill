# Playbill (场刊) — Engineering handoff for autonomous runs

**Repo:** `/home/luyu/projects/playbill`  
**Host:** NUC (`luyu-NUC`), Linux  
**Production static site:** `/home/luyu/services/playbill/` (deploy via `rsync -a --delete dist/ …`)  
**Node:** ≥ 22.13 (uses built-in `node:sqlite`)  
**As of:** 2026-10-20 (Asia/Shanghai)

Give this file + `README.md` to an agent (e.g. Grok). Do **not** commit `.env` or paste secrets into chat.

---

## 1. What this project is

**Playbill / 场刊** is a static Astro site of curated film/TV lists. Each list is one page with posters, bilingual titles, credits, ratings, and Chinese plot blurbs.

- **Frontend:** Astro 7, content loaded at build time from SQLite (`src/loaders/sqlite.ts`).
- **Data:** `db/playbill.db` (canonical), `db/export/*.jsonl` (git-friendly dumps), `db/cache.db` (HTTP cache for Douban/TMDB/etc., not in git).
- **Posters:** `public/posters/`, people photos: `public/people/`.
- **Seeds:** `db/seed/<list-id>.json` + `<list-id>.tsv` → `npm run seed -- <list-id>`.

Site does not hit the DB at runtime; every deploy is `npm run build` → static HTML in `dist/`.

---

## 2. Architecture (data flow)

```text
Sources (Douban awards/doulists, NYT, Criterion, …)
    → db/seed/*.tsv (+ optional festival-seed scrape)
    → npm run seed  →  db/playbill.db
    → enrichment scripts (tmdb, fill-plots, douban, people, imdb)
    → npm run db -- export
    → npm run build  →  dist/
    → rsync  →  /home/luyu/services/playbill/
```

**Work IDs:** Prefer TMDB (`tmdb-m-{id}` / `tmdb-tv-{id}`); else Douban (`douban-{id}`). Scripts may **rename** work rows when TMDB/Douban links are resolved — **do not run `npm run build` while `douban` or `tmdb` is mutating the same works**, or Astro can fail with missing work references. Stop enrichment, build, deploy, then restart enrichment.

**Plots (`editorial.plot`):** Priority in `fill-plots` / `tmdb-facts`: TMDB zh-CN overview → TMDB EN translated (Google / Ollama / MyMemory) → Wikipedia extract + translate. Douban movie intro also fills plot when Douban runs.

**Festival lists:** Three list IDs share the same UX (year/decade filter, 获奖/提名 tags):

| List ID | Route | Seed source |
|--------|--------|-------------|
| `cannes-palme-dor` | `/cannes-palme-dor/` | Douban Cannes awards + winner doulist gap-fill |
| `berlin-golden-bear` | `/berlin-golden-bear/` | Douban Berlin awards + doulist |
| `venice-golden-lion` | `/venice-golden-lion/` | Douban Venice awards + doulist |

Scrapers: `scripts/lib/douban-awards.mjs`, `scripts/lib/festival-doulist.mjs`, orchestrated by `npm run festival-seed`.

---

## 3. Environment (`.env` in repo root, not committed)

Required / common variables (values already on the NUC — **read from local `.env`, do not log cookies**):

| Variable | Purpose |
|----------|---------|
| `TMDB_API_READ_ACCESS_TOKEN` | TMDB v4 read token — `tmdb`, `fill-plots`, `people` |
| `DOUBAN_COOKIE` | Full browser Cookie string for logged-in Douban — awards scrape + higher rate limits |
| `DOUBAN_GAP_MS` | Ms between Douban requests (Kinema used `30000`; festival-enrich defaults `28000`) |
| `HTTP_PROXY` / `HTTPS_PROXY` | Node `undici` uses these (Clash on `127.0.0.1:7890` on this machine) |
| `TRANSLATE_ENGINE` | `google` (default), `ollama`, `mymemory` for EN→ZH plot translation |
| `OLLAMA_HOST` | If using Ollama for translation |

Scripts load env via `node --env-file=.env` where noted in `package.json`.

---

## 4. Key npm commands

```bash
cd /home/luyu/projects/playbill
export PATH="${HOME}/.local/bin:${HOME}/.local/node/bin:${PATH}"

# Verify DB integrity (also runs automatically before/after build)
npm run verify
npm run verify:dist

# Festival: refresh TSV from Douban (needs DOUBAN_COOKIE)
npm run festival-seed -- --all

# Import TSV → DB (safe to re-run; merges works)
npm run seed -- cannes-palme-dor
npm run seed -- berlin-golden-bear
npm run seed -- venice-golden-lion

# Enrichment (per list: --list <id>)
npm run tmdb -- --list <list-id>
npm run fill-plots -- --list <list-id>
npm run douban -- --list <list-id>
npm run people   # all people in DB — network heavy; failed once on proxy socket error

# Festival bundle: TMDB → fill-plots → douban for all three lists
npm run festival-enrich

# Full automation (seed + deploy + enrich + deploy): 
./scripts/festival-pipeline.sh /tmp/festival-pipeline.log

# DB export after mutations
npm run db -- export

# Build & deploy (see section 6)
rm -rf .astro node_modules/.astro && npm run build
rsync -a --delete dist/ /home/luyu/services/playbill/
```

**Douban logging:** Success lines go to **stderr**. Always tee stderr:

```bash
npm run douban -- --list kinema-junpo-ten 2>&1 | tee -a /tmp/douban-kinema.log
```

Interpretation: `douban OK` = work updated; `douban SKIP` = already linked; `douban RATE` = IP backoff; **`douban done:`** = job finished.

**festival-seed safety:** Writes TSV via `.tmp` and refuses to overwrite if scrape returns 0 rows (see `scripts/build-festival-seed.mjs`).

---

## 5. Current status summary (2026-10-20)

### Done

| Item | Status |
|------|--------|
| Festival **seed TSV** (full scrape + doulist gap fill) | **Done** 2026-10-19 ~09:06 — Cannes **1823**, Berlin **1453**, Venice **1269** entries in `db/seed/*.tsv` |
| Festival **seed → DB** | **Done** 2026-10-19 ~20:45 — same counts in `list_entries` |
| **Production deploy** (lists live with full rosters) | **Done** 2026-10-19 **20:46** — `verify-lists: OK (10 lists, dist checked)` |
| Site pages for three festivals | Deployed under `/home/luyu/services/playbill/{cannes-palme-dor,berlin-golden-bear,venice-golden-lion}/` |

### Not done (agent should run)

| Job | Status | Notes |
|-----|--------|--------|
| **Kinema Douban** `kinema-junpo-ten` | **Stopped mid-run** | Killed 2026-10-19 20:44 for deploy. Log `/tmp/douban-kinema.log` has **no** `douban done`. Last session: ~**331** `douban OK`, **846** `SKIP`, ~**1916** works targeted. |
| **`festival-enrich`** | **Failed / incomplete** | `/tmp/festival-plots.log` — crashed **2026-10-19 10:05** in `people.mjs`: `UND_ERR_SOCKET` via proxy `127.0.0.1:7890`. TMDB/fill-plots partially ran before that; not resumed after full seed. |
| **Post-enrich deploy** | **Not done** | Last deploy was **before** enrichment; plots on festival pages are sparse. |

### DB metrics (plot = `editorial.plot` length > 20 chars)

| List | Entries | With plot | Plot % | With TMDB id |
|------|---------|-----------|--------|--------------|
| `kinema-junpo-ten` | 1918 | 1689 | **88.1%** | 731 |
| `cannes-palme-dor` | 1823 | 673 | **36.9%** | 619 |
| `berlin-golden-bear` | 1453 | 241 | **16.6%** | 233 |
| `venice-golden-lion` | 1269 | 284 | **22.4%** | 292 |

Kinema: **~229** works still missing plot (re-check with SQL below after runs).

**No enrichment processes were running** on 2026-10-20 morning check (`douban.mjs`, `festival-enrich`, etc.).

---

## 6. Recommended run plan for Grok

### Phase A — Kinema Douban (resume)

Goal: finish plots/ratings for 旬报; expect many hours due to Douban IP limits.

```bash
cd /home/luyu/projects/playbill
nohup bash -c 'npm run douban -- --list kinema-junpo-ten 2>&1 | tee -a /tmp/douban-kinema.log' &
```

- Wait until log contains **`douban done:`** or missing-plot count stops dropping.
- **Do not** `npm run build` while this is running unless you stop Douban first.

Optional progress query:

```bash
node --no-warnings -e "
import { openDb } from './scripts/lib/db.mjs';
const db = openDb();
const n = db.prepare(\`
  SELECT COUNT(*) c FROM list_entries le
  LEFT JOIN editorial e ON e.work_id=le.work_id
  WHERE le.list_id='kinema-junpo-ten' AND length(trim(coalesce(e.plot,'')))<=20
\`).get().c;
console.log('kinema missing plot:', n);
"
```

### Phase B — Festival enrichment

Ensure Clash/proxy is stable (`curl -x http://127.0.0.1:7890 -I https://api.themoviedb.org` or similar).

```bash
cd /home/luyu/projects/playbill
nohup bash -c 'npm run festival-enrich 2>&1 | tee -a /tmp/festival-enrich.log' &
```

Order inside script: for each of 3 lists **tmdb** → then **fill-plots** per list → then **douban** per list (`DOUBAN_GAP_MS=28000`).

If `people.mjs` is not required for festival plots, you can **skip** full `npm run people` unless something else invokes it — `festival-enrich.mjs` does **not** call `people`; the old failure was from a different pipeline step. If you run `./scripts/festival-pipeline.sh`, it only calls `festival-enrich`, not `people`. The **10:05** crash was from a manual/long npm chain that included `people` after fill-plots — retry `people` separately only if needed for headshots/bios.

On success, log ends with **`festival-enrich: done`**.

### Phase C — Export, build, deploy

**Stop Kinema Douban** (and any other `tmdb`/`douban`) first:

```bash
pkill -f 'scripts/douban.mjs' || true
pkill -f 'scripts/tmdb.mjs' || true
sleep 2

cd /home/luyu/projects/playbill
npm run db -- export
rm -rf .astro node_modules/.astro
npm run build
rsync -a --delete dist/ /home/luyu/services/playbill/
echo "deployed $(date -Is)"
```

Confirm: `npm run verify:dist` (runs in postbuild too).

### Phase D — Optional: resume Kinema Douban after deploy

If Phase A did not finish, restart Douban after deploy.

---

## 7. Parallelism rules

| OK in parallel | Avoid |
|----------------|--------|
| Kinema Douban + festival **tmdb/fill-plots** on **different** lists (still heavy on network) | **build** + any **douban/tmdb** that renames work ids |
| `festival-seed` scrape while site serves old deploy | Re-seed with **empty** TSV (script guards against 0-row overwrite) |
| Two Douban jobs at once | Same IP → faster rate limits |

Conservative approach: **one Douban job at a time**; run festival-enrich (includes Douban for 3 lists) **after** Kinema Douban **or** run Kinema after festival-enrich completes.

---

## 8. Important files (for debugging)

| Path | Role |
|------|------|
| `scripts/douban.mjs` | Douban fetch, stderr progress, `douban done` summary |
| `scripts/lib/db.mjs` | DB path, proxy dispatcher, Douban cache in `cache.db` |
| `scripts/lib/tmdb-facts.mjs` | TMDB + wiki plot/credits helper |
| `scripts/fill-plots.mjs` | Backfill plots/credits |
| `scripts/festival-enrich.mjs` | Three-list enrichment chain |
| `scripts/festival-pipeline.sh` | Seed + 2× (export/build/deploy) + enrich |
| `/tmp/douban-kinema.log` | Kinema Douban history |
| `/tmp/festival-enrich.log` | Create on next run |
| `/tmp/festival-seed2.log` | Last successful full festival scrape log |
| `/tmp/festival-plots.log` | Older partial run (includes people crash) |

---

## 9. Success criteria (definition of “finished”)

1. `/tmp/douban-kinema.log` contains **`douban done:`** and kinema missing plot **near 0** (some titles may never have intro).
2. `/tmp/festival-enrich.log` contains **`festival-enrich: done`**.
3. Festival plot coverage **substantially higher** than 37% / 17% / 22% (exact target not fixed — aim for TMDB match rate where possible).
4. `npm run build` + `verify:dist` OK; production mtime on list `index.html` updated after final deploy.
5. `npm run db -- export` so `db/export/` reflects final state.

---

## 10. One-paragraph prompt you can paste to Grok

```text
You are operating on the Playbill repo at /home/luyu/projects/playbill on luyu-NUC.
Read docs/GROK-HANDOFF.md and README.md. Use existing .env (TMDB token, DOUBAN_COOKIE, proxy).
Tasks: (1) Resume and complete `npm run douban -- --list kinema-junpo-ten` with logs in /tmp/douban-kinema.log until `douban done`. (2) Run `npm run festival-enrich` logged to /tmp/festival-enrich.log until `festival-enrich: done`; fix proxy if fetch fails. (3) Stop all douban/tmdb, then `npm run db -- export`, `npm run build`, rsync dist/ to /home/luyu/services/playbill/. Never build while douban/tmdb is running. Report final plot coverage per list and deploy timestamp.
```

---

## 11. Human-facing product doc

See **`README.md`** for list URLs, schema overview, and user-visible behavior (中文).
