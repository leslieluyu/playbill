// Matches works to TMDB, then fills original title, runtime, IMDb id and the poster.
// Usage: npm run tmdb                    (works missing any of those)
//        npm run tmdb -- breaking-bad    (only these works)
//        npm run tmdb -- --force         (re-search and re-download everything)
import { writeFile, mkdir, access } from "node:fs/promises";
import { openDb, exportDb, cachedJson } from "./lib/db.mjs";
import {
  preferredWorkId,
  shouldAdoptWorkId,
  renameWork,
  renamePosterFile,
} from "./lib/work-id.mjs";

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
};

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = new Set(args.filter((a) => !a.startsWith("--")));

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

async function search(w, hint) {
  const type = w.kind;
  const query = hint.query ?? w.en;
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

const COUNTRIES = {
  US: "美国", GB: "英国", FR: "法国", DE: "德国", IT: "意大利", ES: "西班牙", JP: "日本", KR: "韩国", CN: "中国大陆",
  HK: "中国香港", TW: "中国台湾", CA: "加拿大", AU: "澳大利亚", NZ: "新西兰", IE: "爱尔兰", MX: "墨西哥", BR: "巴西",
  AR: "阿根廷", IR: "伊朗", IN: "印度", SE: "瑞典", DK: "丹麦", NO: "挪威", FI: "芬兰", PL: "波兰", AT: "奥地利",
  BE: "比利时", NL: "荷兰", CH: "瑞士", RU: "俄罗斯", RO: "罗马尼亚", HU: "匈牙利", CZ: "捷克", IL: "以色列",
  TH: "泰国", ZA: "南非", CL: "智利", CO: "哥伦比亚", TR: "土耳其", GR: "希腊", PT: "葡萄牙", ID: "印度尼西亚",
};
const han = /\p{Script=Han}/u;

/** Fills the Chinese title, country, format and credits that a freshly seeded work lacks. */
async function fillFacts(w, d) {
  const sets = {};
  if (!w.zh) {
    const zh = await tmdb(`/${w.kind}/${d.id}`, { language: "zh-CN" });
    const title = zh.title ?? zh.name;
    if (title && han.test(title)) sets.zh = title;
  }
  if (!w.place) {
    const codes = d.origin_country?.length ? d.origin_country : (d.production_countries ?? []).map((c) => c.iso_3166_1);
    const names = [...new Set(codes.map((c) => COUNTRIES[c] ?? c))].slice(0, 2);
    if (names.length) sets.place = names.join("、");
  }
  if (!w.form && w.kind === "movie") {
    const genres = (d.genres ?? []).map((g) => g.id);
    sets.form = genres.includes(99) ? "纪录片" : genres.includes(16) ? "动画" : "电影";
  }
  for (const [k, v] of Object.entries(sets)) db.prepare(`UPDATE works SET ${k} = ? WHERE id = ?`).run(v, w.id);

  if (w.kind !== "movie" || db.prepare("SELECT 1 FROM credits WHERE work_id = ?").get(w.id)) return;
  const { cast, crew } = await tmdb(`/movie/${d.id}/credits`);
  const directors = crew.filter((c) => c.job === "Director").slice(0, 2);
  const leads = cast.slice(0, 4);
  const person = (p) => {
    const row = db.prepare("SELECT id FROM people WHERE tmdb_id = ?").get(p.id);
    if (row) return row.id;
    return Number(db.prepare("INSERT INTO people (en, tmdb_id) VALUES (?, ?)").run(p.name, p.id).lastInsertRowid);
  };
  directors.forEach((p, i) => db.prepare("INSERT INTO credits VALUES (?, 'director', ?, ?)").run(w.id, i, person(p)));
  leads.forEach((p, i) => db.prepare("INSERT INTO credits VALUES (?, 'cast', ?, ?)").run(w.id, i, person(p)));
}

await mkdir(OUT, { recursive: true });
const db = openDb();
const works = db.prepare("SELECT * FROM works ORDER BY id").all();
const update = db.prepare(
  `UPDATE works SET tmdb_id = ?, tmdb_type = ?, tmdb_season = ?, imdb_id = ?, original = ?, runtime = ?, poster = ? WHERE id = ?`,
);
const report = [];

for (const w of works) {
  if (only.size && !only.has(w.id)) continue;
  let dest = `${OUT}/${w.id}.jpg`;
  const complete = w.tmdb_id && w.imdb_id && w.original && w.poster && (await exists(dest));
  if (complete && !force && !only.size) {
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
  await fillFacts(w, d);
  report.push(`ok    ${w.id.padEnd(36)} ${type}/${tmdbId} ${imdbId ?? "no-imdb"}  ${d.name ?? d.title} ${note}`);
}

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

exportDb(db);
console.log(report.join("\n") || "nothing to do");
