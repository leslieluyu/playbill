// Matches works to TMDB, then fills original title, runtime, IMDb id and the poster.
// Usage: npm run tmdb                    (works missing any of those)
//        npm run tmdb -- breaking-bad    (only these works)
//        npm run tmdb -- --force         (re-search and re-download everything)
//        npm run tmdb -- --genres        (backfill work_genres for works that already have tmdb_id)
//        npm run tmdb -- --list kinema-junpo-ten   (only works on that list)
import { writeFile, mkdir, access } from "node:fs/promises";
import { openDb, exportDb, cachedJson } from "./lib/db.mjs";
import {
  preferredWorkId,
  shouldAdoptWorkId,
  renameWork,
  renamePosterFile,
} from "./lib/work-id.mjs";
import { createTranslator } from "./lib/translate.mjs";
import { COUNTRIES, fillWorkFacts, saveGenres, workNeedsFacts } from "./lib/tmdb-facts.mjs";

const OUT = "public/posters";
const SIZE = "w342";
const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
if (!token) throw new Error("TMDB_API_READ_ACCESS_TOKEN missing; put it in .env");

// Search hints where the English title or start year alone picks the wrong show or season.
// Keys are canonical work ids (tmdb-m- / tmdb-tv-); keep legacy slugs only if a row is not yet adopted.
const HINTS = {
  "tmdb-tv-1920": { query: "Twin Peaks", year: 1990, season: 3, imdb: "tt4093826" },
  "tmdb-tv-46648": { season: 1 }, // True Detective
  "tmdb-tv-154385": { season: 1 }, // Beef
  "tmdb-tv-2316": { query: "The Office", year: 2005 },
  "tmdb-tv-2996": { query: "The Office", year: 2001 },
  "tmdb-tv-1408": { query: "House", year: 2004 },
  "tmdb-tv-34549": { query: "The Great British Bake Off", year: 2010 },
  // A 19-minute Brazilian film shares the English title and the 2013 search year.
  "tmdb-m-97370": { id: 97370 }, // Under the Skin
  // Criterion spines whose shop titles / years do not match TMDB search alone.
  "local-all-that-money-can-buy-aka-the-devil-and-daniel-webster": { id: 29451 },
  "local-fanny-and-alexander-theatrical-version": { id: 5961 },
  "local-fanny-and-alexander-television-version": { id: 33153 },
  "tmdb-tv-33153": { id: 33153 },
  "local-jeanne-dielman-23-quai-du-commerce-1080-bruxelles": { id: 44012, query: "Jeanne Dielman, 23", year: 1976 },
  "tmdb-m-44012": { id: 44012 },
  "local-jimi-plays-monterey-and-shake-otis-at-monterey": { id: 26028 },
  "local-les-blank-always-for-pleasure": { id: 85637, year: 1978 },
  "local-symbiopsychotaxiplasm-two-takes-by-william-greaves": { id: 44783 },
  "local-tanner-88": { id: 1804 },
  "tmdb-tv-1804": { id: 1804 },
  "local-the-complete-mr-arkadin": { id: 44026 },
  // AFI ballot lists 1926; TMDB dates the silent film 1925-12-25.
  "local-ben-hur-1926": { id: 31510, query: "Ben-Hur: A Tale of the Christ", year: 1925 },
  "tmdb-m-31510": { id: 31510 },
  // Bare “Hotel Rwanda” search can hit the making-of short instead of the feature.
  "tmdb-m-1550256": { id: 205, query: "Hotel Rwanda", year: 2004 },
  "tmdb-m-205": { id: 205, query: "Hotel Rwanda", year: 2004 },
  // 1967 Mel Brooks original (TMDB dates 1968); bare search prefers the 2005 musical remake.
  "tmdb-m-9899": { id: 30197, query: "The Producers", year: 1968 },
  "tmdb-m-30197": { id: 30197, query: "The Producers", year: 1968 },
  "douban-1433079": { id: 318346, imdb: "tt0442256", query: "Half a Confession", year: 2004 },
  "tmdb-m-58156": { id: 318346, imdb: "tt0442256", query: "Half a Confession", year: 2004 },
};

const args = process.argv.slice(2);
const force = args.includes("--force");
const genresOnly = args.includes("--genres");
const listIdx = args.indexOf("--list");
const listId = listIdx >= 0 ? args[listIdx + 1] : null;
const only = new Set(args.filter((a) => !a.startsWith("--") && a !== listId));

function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const key = url.pathname.replace("/3/", "") + url.search;
  return cachedJson("tmdb", key, url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    gap: 50,
    maxAgeDays: force ? 0 : Infinity,
  });
}

const norm = (s) =>
  (s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

function pickSearchQuery(w, hint) {
  if (hint.query) return hint.query;
  const en = (w.en ?? "").trim();
  if (en && !han.test(en) && /[A-Za-z]{2,}/.test(en)) return en;
  const orig = (w.original ?? "").trim();
  if (orig && !han.test(orig) && /[A-Za-z]{2,}/.test(orig)) return orig;
  return w.en;
}

async function search(w, hint) {
  const type = w.kind;
  const imdb = hint.imdb ?? w.imdb_id;
  if (imdb) {
    const found = await tmdb(`/find/${imdb}`, { external_source: "imdb_id" });
    // Never cross media types: movie/206647 and tv/206647 are different works.
    const hit = (type === "tv" ? found.tv_results : found.movie_results)?.[0];
    if (hit?.id) return { id: hit.id, exact: true };
  }
  const query = pickSearchQuery(w, hint);
  const year = hint.year ?? w.year_start;
  const yearKey = type === "tv" ? "first_air_date_year" : "primary_release_year";
  let { results } = await tmdb(`/search/${type}`, { query, [yearKey]: year });
  if (!results.length) ({ results } = await tmdb(`/search/${type}`, { query }));
  if (!results.length) return null;
  const want = norm(query);
  const matches = (r) => [r.name, r.title, r.original_name, r.original_title].some((t) => t && norm(t) === want);
  const best = results.find(matches) ?? results[0];
  return { id: best.id, exact: matches(best) };
}

const exists = (f) => access(f).then(() => true, () => false);

const han = /\p{Script=Han}/u;
const translatePlot = createTranslator(process.env.TRANSLATE_ENGINE || "google");

await mkdir(OUT, { recursive: true });
const db = openDb();
let works = db.prepare("SELECT * FROM works ORDER BY id").all();
if (listId) {
  const ids = new Set(
    db.prepare("SELECT work_id FROM list_entries WHERE list_id = ?").all(listId).map((r) => r.work_id),
  );
  works = works.filter((w) => ids.has(w.id));
}
const update = db.prepare(
  `UPDATE works SET tmdb_id = ?, tmdb_type = ?, tmdb_season = ?, imdb_id = ?, original = ?, runtime = ?, poster = ? WHERE id = ?`,
);
const report = [];

if (genresOnly) {
  let n = 0;
  for (const w of works) {
    if (!w.tmdb_id) continue;
    if (only.size && !only.has(w.id)) continue;
    if (!force && db.prepare("SELECT 1 FROM work_genres WHERE work_id = ?").get(w.id)) continue;
    const d = await tmdb(`/${w.kind}/${w.tmdb_id}`);
    const zh = await tmdb(`/${w.kind}/${w.tmdb_id}`, { language: "zh-CN" });
    saveGenres(db, w.id, d.genres, zh.genres);
    // Repair bare ISO leftovers in place when we can map them.
    if (w.place && /[A-Z]{2}/.test(w.place)) {
      const fixed = w.place
        .split("、")
        .map((p) => COUNTRIES[p.trim()] ?? p.trim())
        .filter(Boolean)
        .join("、");
      if (fixed !== w.place) db.prepare("UPDATE works SET place = ? WHERE id = ?").run(fixed, w.id);
    }
    n++;
    report.push(`genre ${w.id}`);
  }
  exportDb(db);
  console.log(report.length ? `${report.length} works tagged (${n} updated)\n` + report.slice(0, 20).join("\n") + (report.length > 20 ? `\n… ${report.length} total` : "") : "nothing to do");
  process.exit(0);
}

for (const w of works) {
  if (only.size && !only.has(w.id)) continue;
  let dest = `${OUT}/${w.id}.jpg`;
  const { needsPlot, needsCredits } = workNeedsFacts(db, w.id);
  const complete = w.tmdb_id && w.imdb_id && w.original && w.poster && (await exists(dest));
  if (complete && !force && !only.size && !needsPlot && !needsCredits) {
    // Still adopt a canonical id if this row is on a legacy/local slug.
    const want = preferredWorkId({ kind: w.kind, tmdbId: w.tmdb_id, currentId: w.id });
    if (shouldAdoptWorkId(w.id, want)) {
      renameWork(db, w.id, want);
      await renamePosterFile(w.id, want);
      report.push(`id    ${w.id} → ${want}`);
    }
    continue;
  }

  const hint = HINTS[w.id] ?? HINTS[preferredWorkId({ kind: w.kind, tmdbId: w.tmdb_id, currentId: w.id })] ?? {};
  let tmdbId = hint.id ?? w.tmdb_id;
  let note = "";
  if (!tmdbId || (force && !hint.id)) {
    const hit = await search(w, hint);
    if (!hit) {
      report.push(`MISS  ${w.id}  (${w.en} ${w.year_start})`);
      continue;
    }
    tmdbId = hit.id;
    if (!hit.exact) note = "?? fuzzy match";
  }
  const type = w.kind;
  const want = preferredWorkId({ kind: type, tmdbId, currentId: w.id });
  if (shouldAdoptWorkId(w.id, want)) {
    renameWork(db, w.id, want);
    await renamePosterFile(w.id, want);
    note = `${note} id←${w.id}`.trim();
    w.id = want;
    dest = `${OUT}/${w.id}.jpg`;
  }
  const season = hint.season ?? w.tmdb_season ?? null;
  const d = await tmdb(`/${type}/${tmdbId}`, { append_to_response: "external_ids" });
  const imdbId = hint.imdb ?? d.imdb_id ?? d.external_ids?.imdb_id ?? null;
  const original = d.original_name ?? d.original_title ?? null;
  const runtime = type === "movie" ? d.runtime || null : null;

  let posterPath = d.poster_path;
  if (season) {
    const s = await tmdb(`/tv/${tmdbId}/season/${season}`);
    if (s.poster_path) posterPath = s.poster_path;
  }
  if (posterPath && (force || !(await exists(dest)))) {
    const img = await fetch(`https://image.tmdb.org/t/p/${SIZE}${posterPath}`);
    if (!img.ok) throw new Error(`image ${img.status} for ${w.id}`);
    await writeFile(dest, Buffer.from(await img.arrayBuffer()));
  }
  const poster = posterPath ? `/posters/${w.id}.jpg` : null;

  update.run(tmdbId, type, season, imdbId, original, runtime, poster, w.id);
  await fillWorkFacts(db, w, d, { tmdb, translate: translatePlot, useWiki: true, credits: true });
  report.push(`ok    ${w.id.padEnd(36)} ${type}/${tmdbId} ${imdbId ?? "no-imdb"}  ${d.name ?? d.title} ${note}`);
}

if (!only.size) {
  const unnamed = db.prepare("SELECT id, tmdb_id, en FROM people WHERE zh IS NULL AND tmdb_id IS NOT NULL").all();
  const setZh = db.prepare("UPDATE people SET zh = ? WHERE id = ?");
  let named = 0;
  for (const p of unnamed) {
    const d = await tmdb(`/person/${p.tmdb_id}`, { language: "zh-CN" });
    const zh = [d.name, ...(d.also_known_as ?? [])].find((s) => s && han.test(s));
    if (!zh) {
      report.push(`noname ${p.en}`);
      continue;
    }
    setZh.run(zh.replace(/\s+/g, ""), p.id);
    named++;
  }
  if (unnamed.length) report.push(`names ${named}/${unnamed.length}`);
}

exportDb(db);
console.log(report.join("\n") || "nothing to do");
