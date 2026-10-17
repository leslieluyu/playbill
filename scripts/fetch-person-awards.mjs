// Fetch celebrity awards from Douban into person_awards (POC).
// Resolves Douban celebrity id via subject_suggest when people.douban_id is missing;
// HINTS cover well-known POC names.
//
// Usage:
//   npm run people-awards -- 2106 1143 1125 978 511
//   npm run people-awards -- --limit 5
import { openDb, exportDb, cachedJson } from "./lib/db.mjs";

const GAP_MS = 1500;
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const cookie = process.env.DOUBAN_COOKIE ? { Cookie: process.env.DOUBAN_COOKIE } : {};

// people.id → Douban celebrity id (when search is flaky / not yet linked)
const HINTS = {
  2106: "1025185", // Alfred Hitchcock
  1143: "1049566", // Ingrid Bergman
  1125: "1053563", // Cary Grant
  978: "1054529", // Akira Kurosawa
  511: "1041024", // Wong Kar-Wai
  1058: "1036727", // Yasujirō Ozu
};

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const skipArgs = new Set(limitIdx >= 0 ? ["--limit", String(args[limitIdx + 1])] : []);
const only = args.filter((a) => !a.startsWith("--") && !skipArgs.has(a));

const doubanJson = (path, key, maxAgeDays = Infinity) =>
  cachedJson("douban", key, `https://m.douban.com/rexxar/api/v2${path}`, {
    headers: { "User-Agent": UA, Referer: "https://m.douban.com/movie/", ...cookie },
    gap: GAP_MS,
    maxAgeDays,
  });

async function suggestCelebrityId(en, zh) {
  const q = zh || en;
  if (!q) return null;
  const key = `suggest/celeb/${q}`;
  const hits = await cachedJson(
    "douban",
    key,
    `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(q)}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://movie.douban.com/",
        ...cookie,
      },
      gap: GAP_MS,
      maxAgeDays: Infinity,
    },
  );
  if (!Array.isArray(hits)) return null;
  const celeb = hits.find((h) => h.type === "celebrity");
  return celeb?.id ? String(celeb.id) : null;
}

function parseAwards(payload) {
  const rows = [];
  let ord = 0;
  for (const yearBlock of payload?.awards ?? []) {
    const year = yearBlock.year != null ? Number(yearBlock.year) : null;
    for (const mod of yearBlock.modules ?? []) {
      if (!mod?.category?.title || !mod?.ceremony?.title) continue;
      const category = `${mod.ceremony.title} · ${mod.category.title}`;
      const result = mod.is_won ? "won" : "nominated";
      const workTitle =
        typeof mod.title === "string" && mod.title.trim() ? mod.title.trim() : null;
      rows.push({ year, category, result, workTitle, ord: ord++ });
    }
  }
  return rows;
}

const db = openDb();
const setDouban = db.prepare("UPDATE people SET douban_id = coalesce(douban_id, ?) WHERE id = ?");
const clearAwards = db.prepare("DELETE FROM person_awards WHERE person_id = ? AND source = 'douban'");
const insertAward = db.prepare(
  `INSERT INTO person_awards (person_id, source, year, category, result, work_title, work_id, ord)
   VALUES (?, 'douban', ?, ?, ?, ?, NULL, ?)`,
);

let people = db.prepare("SELECT id, en, zh, douban_id FROM people ORDER BY id").all();
if (only.length) {
  const want = new Set(only.map(String));
  people = people.filter((p) => want.has(String(p.id)));
} else if (Number.isFinite(limit)) {
  // Prefer HINTS people for default POC, then others with douban_id.
  const hinted = people.filter((p) => HINTS[p.id]);
  const rest = people.filter((p) => p.douban_id && !HINTS[p.id]);
  people = [...hinted, ...rest].slice(0, limit);
}

console.log(`fetching awards for ${people.length} people`);

let ok = 0;
let fail = 0;
for (const p of people) {
  try {
    let doubanId = p.douban_id || HINTS[p.id] || null;
    if (!doubanId) {
      doubanId = await suggestCelebrityId(p.en, p.zh);
    }
    if (!doubanId) {
      console.error(`MISS  ${p.id}  ${p.en}  no douban celebrity id`);
      fail++;
      continue;
    }
    if (!p.douban_id) setDouban.run(doubanId, p.id);

    const data = await doubanJson(`/celebrity/${doubanId}/awards`, `celebrity/${doubanId}/awards`);
    const rows = parseAwards(data);
    clearAwards.run(p.id);
    for (const row of rows) {
      insertAward.run(p.id, row.year, row.category, row.result, row.workTitle, row.ord);
    }
    ok++;
    console.log(
      `ok    ${String(p.id).padStart(4)}  douban/${doubanId}  ${(p.zh || p.en).slice(0, 20).padEnd(20)}  awards=${rows.length}`,
    );
  } catch (e) {
    fail++;
    console.error(`FAIL  ${p.id}  ${p.en}: ${e.message}`);
  }
}

exportDb(db);
db.close();
console.log(`done ok=${ok} fail=${fail}`);
if (fail && !ok) process.exitCode = 1;
