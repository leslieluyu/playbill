// Fills people.photo / bio_zh / bio_en from TMDB; links missing tmdb_id via name search.
// Usage: npm run people
//        npm run people -- --force
//        npm run people -- 1 56323   (people.id or tmdb_id)
import { writeFile, mkdir, access } from "node:fs/promises";
import { openDb, exportDb, cachedJson } from "./lib/db.mjs";

const OUT = "public/people";
const SIZE = "w342";
const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
if (!token) throw new Error("TMDB_API_READ_ACCESS_TOKEN missing; put it in .env");

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = new Set(args.filter((a) => !a.startsWith("--")));

// Hard matches where English credit text or TMDB naming diverges.
const HINTS = {
  143: 78597, // Rob McElhenney / Rob Mac
  243: 1557181, // Wi Ha-joon / Wi Ha-jun
  335: 39390, // Michael K. Williams
  200: 86543, // David Attenborough (narrator)
  208: 78589, // RuPaul (host)
  258: 43896, // Jeff Probst (host)
};

// Ensemble / placeholder credit lines — not real people.
const SKIP = new Set([47, 294, 331]);

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

const exists = (f) => access(f).then(() => true, () => false);
const han = /\p{Script=Han}/u;
const norm = (s) =>
  (s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function searchQuery(en) {
  return en
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchTmdbId(en) {
  const query = searchQuery(en);
  if (!query) return null;
  const { results } = await tmdb("/search/person", { query });
  if (!results?.length) return null;
  const want = norm(query);
  const exact = results.find((r) => norm(r.name) === want);
  return exact?.id ?? null;
}

await mkdir(OUT, { recursive: true });
const db = openDb();
const people = db.prepare("SELECT * FROM people ORDER BY id").all();
const setTmdb = db.prepare("UPDATE people SET tmdb_id = ? WHERE id = ?");
const setRow = db.prepare(
  "UPDATE people SET zh = coalesce(?, zh), photo = ?, bio_zh = ?, bio_en = ? WHERE id = ?",
);
const report = [];
let filled = 0;
let linked = 0;

for (const p of people) {
  if (only.size && !only.has(String(p.id)) && !only.has(String(p.tmdb_id))) continue;
  if (SKIP.has(p.id)) {
    report.push(`skip  ${p.id}  ${p.en}`);
    continue;
  }

  const dest = `${OUT}/${p.id}.jpg`;
  const complete = p.tmdb_id && p.photo && p.bio_en && (await exists(dest));
  if (complete && !force && !only.size) continue;

  let tmdbId = p.tmdb_id ?? HINTS[p.id] ?? null;
  if (!tmdbId) {
    tmdbId = await searchTmdbId(p.en);
    if (!tmdbId) {
      report.push(`MISS  ${p.id}  ${p.en}`);
      continue;
    }
  }
  if (!p.tmdb_id || p.tmdb_id !== tmdbId) {
    const taken = db.prepare("SELECT id, en FROM people WHERE tmdb_id = ?").get(tmdbId);
    if (taken && taken.id !== p.id) {
      report.push(`CLASH ${p.id}  ${p.en} → tmdb ${tmdbId} owned by ${taken.id} ${taken.en}`);
      continue;
    }
    setTmdb.run(tmdbId, p.id);
    if (!p.tmdb_id) linked++;
  }

  const en = await tmdb(`/person/${tmdbId}`, { language: "en-US" });
  const zh = await tmdb(`/person/${tmdbId}`, { language: "zh-CN" });
  const bioEn = (en.biography || "").trim() || null;
  const bioZh = (zh.biography || "").trim() || null;
  const zhName = [zh.name, ...(zh.also_known_as ?? [])].find((s) => s && han.test(s));
  const cleanZh = zhName ? zhName.replace(/\s+/g, "") : null;

  let photo = p.photo;
  const profilePath = en.profile_path || zh.profile_path;
  if (profilePath && (force || !(await exists(dest)))) {
    const img = await fetch(`https://image.tmdb.org/t/p/${SIZE}${profilePath}`);
    if (img.ok) {
      await writeFile(dest, Buffer.from(await img.arrayBuffer()));
      photo = `/people/${p.id}.jpg`;
    } else {
      report.push(
        `img404 ${String(p.id).padStart(4)}  tmdb/${tmdbId}  ${p.en}  ${img.status} ${profilePath}`,
      );
      // Keep any existing local photo; otherwise leave null.
      if (await exists(dest)) photo = `/people/${p.id}.jpg`;
    }
  } else if (profilePath && (await exists(dest))) {
    photo = `/people/${p.id}.jpg`;
  }

  setRow.run(cleanZh, photo, bioZh, bioEn, p.id);
  filled++;
  report.push(
    `ok    ${String(p.id).padStart(4)}  tmdb/${tmdbId}  ${(p.zh || cleanZh || p.en).slice(0, 24).padEnd(24)}  photo=${photo ? "yes" : "no"}  zhBio=${bioZh ? bioZh.length : 0}  enBio=${bioEn ? bioEn.length : 0}`,
  );
}

exportDb(db);
console.log(report.join("\n") || "nothing to do");
console.log(`filled ${filled}, linked ${linked}, miss/clash in report above`);
