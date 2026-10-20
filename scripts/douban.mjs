// Finds each work's Douban subjects and records their ratings.
// TV seasons are separate subjects on Douban; the work's score is the plain average of
// its seasons, leaving out seasons with too few ratings to be meaningful.
// For films it also fills the Chinese title and, when missing, directors and cast.
//
// Usage: npm run douban                  (works without Douban subjects yet)
//        npm run douban -- --refresh     (re-fetch scores for every work)
//        npm run douban -- --list kinema-junpo-ten   (only works on that list)
//        npm run douban -- breaking-bad  (only these works)
// Works seeded as douban-{id} (e.g. from a Douban doulist) are fetched from the
// subject API directly: Chinese title, intro as 剧情, Latin/English title for TMDB.
import { openDb, exportDb, cachedJson, forget, tx, hasCachedJson, doubanFetchStats, resetDoubanFetchStats } from "./lib/db.mjs";
import {
  preferredWorkId,
  shouldAdoptWorkId,
  renameWork,
  renamePosterFile,
  workIdFromTmdb,
} from "./lib/work-id.mjs";
import { doubanIdFromWorkId, pickSearchTitles } from "./lib/douban-subject.mjs";

const MIN_VOTES = 1000;
const cookieRaw = (process.env.DOUBAN_COOKIE ?? "").trim();
// Real browser Cookie headers are long; placeholders in .env don't lift the IP cap.
const hasDoubanSession = cookieRaw.length > 40;
const GAP_MS = Number(process.env.DOUBAN_GAP_MS) || (hasDoubanSession ? 2000 : 12_000);
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// Douban titles that our Chinese title, aliases and English title don't find on their own.
const HINTS = {
  "tmdb-tv-2316": { query: "办公室" },
  "tmdb-tv-2996": { query: "办公室" },
  "tmdb-tv-1920": { query: "双峰 第三季" },
  "tmdb-tv-34549": { query: "英国家庭烘焙大赛" },
};
const PLACES = { 美英: ["美国", "英国"] };

const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const listIdx = args.indexOf("--list");
const listId = listIdx >= 0 ? args[listIdx + 1] : null;
const only = new Set(args.filter((a) => !a.startsWith("--") && a !== listId));
const tmdbToken = process.env.TMDB_API_READ_ACCESS_TOKEN;

// A logged-in session (the browser's Cookie header for douban.com) lifts the anonymous rate limit.
const cookie = hasDoubanSession ? { Cookie: cookieRaw } : {};

const douban = (path, key = path, maxAgeDays = refresh ? 0 : Infinity) =>
  cachedJson("douban", key, `https://m.douban.com/rexxar/api/v2${path}`, {
    headers: { "User-Agent": UA, Referer: "https://m.douban.com/movie/", ...cookie },
    gap: GAP_MS,
    maxAgeDays,
  });

const tmdb = (path) =>
  cachedJson("tmdb", path.slice(1), `https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${tmdbToken}`, accept: "application/json" },
    gap: 50,
  });

const CN = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnNumber(s) {
  if (/^\d+$/.test(s)) return Number(s);
  let n = 0;
  let cur = 0;
  for (const ch of s) {
    if (ch === "百") (n += (cur || 1) * 100), (cur = 0);
    else if (ch === "十") (n += (cur || 1) * 10), (cur = 0);
    else cur = CN[ch] ?? NaN;
  }
  return n + cur;
}
const SEASON_RE = /\s*第([一二两三四五六七八九十百零\d]+)季\s*$/;
const seasonOf = (title) => (title.match(SEASON_RE) ? cnNumber(title.match(SEASON_RE)[1]) : 1);
const baseOf = (title) => title.replace(SEASON_RE, "").replace(/[：:].*$/, "").replace(/\s+/g, " ").trim();
const loose = (s) => (s ?? "").normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]/gu, "");
const tokens = (s) => [...new Set((s ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? [])].sort().join(" ");

function sameTitle(doubanOriginal, w) {
  const d = loose(doubanOriginal.replace(/\s*season\s*\d+\s*$/i, ""));
  if (!d) return false;
  return [w.en, w.original].some((t) => {
    const x = loose(t);
    return x && (d === x || d.includes(x) || x.includes(d));
  });
}

// The website's suggest endpoint works without login (unlike rexxar search) but returns
// at most five hits, each with the original title and year.
// When rate limited it answers with an empty list instead of an error, so empty
// results are never cached.
async function suggest(q) {
  const key = `suggest/${q}`;
  const hits = await cachedJson("douban", key, `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(q)}`, {
    headers: { "User-Agent": UA.replace(/iPhone.*?\)/, "Macintosh; Intel Mac OS X 10_15_7)"), ...cookie },
    gap: GAP_MS,
  });
  if (!hits.length) forget("douban", key);
  return hits;
}

const DIGITS = "零一二三四五六七八九";
const cnSeason = (n) =>
  n < 10 ? DIGITS[n] : `${n >= 20 ? DIGITS[Math.floor(n / 10)] : ""}十${n % 10 ? DIGITS[n % 10] : ""}`;

function placeOk(w, countries) {
  if (!w.place) return true;
  const wanted = PLACES[w.place] ?? [w.place];
  return wanted.some((p) => (countries ?? []).includes(p));
}

const inRange = (w, year) =>
  year >= w.year_start - 1 && (w.ongoing || !w.year_end || w.tmdb_season || year <= w.year_end + 1);

async function tmdbSeasons(w) {
  if (!tmdbToken || !w.tmdb_id) return null;
  const d = await tmdb(`/tv/${w.tmdb_id}?append_to_response=external_ids`);
  return d.number_of_seasons ?? null;
}

async function findTv(w, queries) {
  let base;
  const found = new Map();
  const accept = (t) => {
    if (!t.episode || !sameTitle(t.sub_title ?? "", w) || !inRange(w, Number(t.year))) return false;
    const n = seasonOf(t.title);
    if (!found.has(n)) found.set(n, t);
    return true;
  };
  for (const query of queries) {
    const hits = (await suggest(query)).filter(accept);
    if (hits.length) {
      base = baseOf(hits[0].title);
      break;
    }
  }
  if (!base) return null;

  const wantedSeasons = w.tmdb_season ? [w.tmdb_season] : [...Array((await tmdbSeasons(w)) ?? Math.max(...found.keys())).keys()].map((i) => i + 1);
  for (const n of wantedSeasons) {
    if (found.has(n)) continue;
    for (const t of await suggest(`${base}第${cnSeason(n)}季`)) if (seasonOf(t.title) === n) accept(t);
  }

  const subjects = [];
  for (const n of wantedSeasons) {
    const t = found.get(n);
    if (!t) continue;
    const d = await douban(`/tv/${t.id}`, `tv/${t.id}`);
    if (!placeOk(w, d.countries)) continue;
    subjects.push({ id: t.id, season: n, title: d.title, year: Number(d.year), rating: d.rating });
  }
  return subjects;
}

async function findMovie(w, queries) {
  for (const query of queries) {
    const hits = (await suggest(query)).filter(
      (t) => !t.episode && Math.abs(Number(t.year) - w.year_start) <= 1 && (sameTitle(t.sub_title ?? "", w) || (w.zh && loose(t.title) === loose(w.zh))),
    );
    for (const t of hits.slice(0, 2)) {
      const d = await douban(`/movie/${t.id}`, `movie/${t.id}`);
      if (d.is_tv) continue;
      return d;
    }
  }
  return null;
}

const db = openDb();
const upsertSubject = db.prepare(
  `INSERT INTO douban_subjects (douban_id, work_id, season, title, year, rating, votes, fetched_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(douban_id) DO UPDATE SET work_id = excluded.work_id, season = excluded.season, title = excluded.title,
     year = excluded.year, rating = excluded.rating, votes = excluded.votes, fetched_at = excluded.fetched_at`,
);
const insertRating = db.prepare(
  "INSERT OR REPLACE INTO ratings (work_id, source, value, votes, detail, fetched_at) VALUES (?, 'douban', ?, ?, ?, ?)",
);
const day = new Date().toISOString().slice(0, 10);

function personFor(dPerson, tmdbPeople) {
  const latin = (dPerson.latin_name ?? "").trim();
  const match = latin && tmdbPeople.find((p) => tokens(p.name) === tokens(latin));
  const en = match?.name ?? (latin || dPerson.name);
  const existing =
    db.prepare("SELECT id FROM people WHERE douban_id = ?").get(dPerson.id) ??
    (match && db.prepare("SELECT id FROM people WHERE tmdb_id = ?").get(match.id));
  if (existing) {
    db.prepare("UPDATE people SET douban_id = coalesce(douban_id, ?), tmdb_id = coalesce(tmdb_id, ?) WHERE id = ?").run(
      dPerson.id, match?.id ?? null, existing.id);
    return existing.id;
  }
  const r = db.prepare("INSERT INTO people (en, zh, tmdb_id, douban_id) VALUES (?, ?, ?, ?)").run(
    en, dPerson.name, match?.id ?? null, dPerson.id);
  return Number(r.lastInsertRowid);
}

function fillDoubanDetail(w, d) {
  const intro = (d.intro ?? "").trim();
  const { latin, original } = pickSearchTitles(d);
  tx(db, () => {
    if (latin) {
      db.prepare(
        "UPDATE works SET zh = coalesce(zh, ?), en = ?, original = coalesce(original, ?) WHERE id = ?",
      ).run(d.title, latin, original || null, w.id);
    } else {
      db.prepare("UPDATE works SET zh = coalesce(zh, ?), original = coalesce(original, ?) WHERE id = ?").run(
        d.title,
        original || null,
        w.id,
      );
    }

    if (intro) {
      const ed = db.prepare("SELECT plot, reviewed FROM editorial WHERE work_id = ?").get(w.id);
      if (!ed) {
        db.prepare("INSERT INTO editorial (work_id, plot, reviewed) VALUES (?, ?, 1)").run(w.id, intro);
      } else if (!ed.reviewed || !ed.plot) {
        db.prepare(
          `UPDATE editorial SET plot = coalesce(nullif(plot, ''), ?), reviewed = 1 WHERE work_id = ?`,
        ).run(intro, w.id);
      }
    }

    const aka = (d.aka ?? []).map((a) => String(a).trim()).filter(Boolean);
    const have = new Set(
      db.prepare("SELECT alias FROM work_aliases WHERE work_id = ?").all(w.id).map((r) => r.alias),
    );
    let ord = db.prepare("SELECT coalesce(max(ord), -1) m FROM work_aliases WHERE work_id = ?").get(w.id).m + 1;
    const ins = db.prepare("INSERT INTO work_aliases (work_id, alias, ord) VALUES (?, ?, ?)");
    for (const a of aka) {
      if (have.has(a)) continue;
      ins.run(w.id, a, ord++);
      have.add(a);
    }
  });
}

async function fillMovieFacts(w, d) {
  const credits = await douban(`/movie/${d.id}/credits`, `movie/${d.id}/credits`, Infinity);
  const people = credits.items.filter((c) => c.category === "导演" || c.category === "演员");
  const credited = db
    .prepare("SELECT p.id, p.en, p.zh FROM credits c JOIN people p ON p.id = c.person_id WHERE c.work_id = ?")
    .all(w.id);
  const tmdbPeople = !credited.length && tmdbToken && w.tmdb_id
    ? (({ cast, crew }) => [...cast, ...crew])(await tmdb(`/movie/${w.tmdb_id}/credits`))
    : [];
  tx(db, () => {
    db.prepare("UPDATE works SET zh = coalesce(zh, ?), place = coalesce(place, ?), form = coalesce(form, ?) WHERE id = ?").run(
      d.title, (d.countries ?? []).slice(0, 2).join("、") || null, d.genres?.includes("纪录片") ? "纪录片" : d.genres?.includes("动画") ? "动画" : "电影", w.id);

    if (credited.length) {
      // Credits came from TMDB in English; take the Chinese names from Douban where the Latin names agree.
      for (const p of credited.filter((p) => !p.zh)) {
        const c = people.find((c) => tokens(c.latin_name) && tokens(c.latin_name) === tokens(p.en));
        if (!c) continue;
        const taken = db.prepare("SELECT id FROM people WHERE douban_id = ?").get(c.id);
        db.prepare("UPDATE people SET zh = ?, douban_id = coalesce(douban_id, ?) WHERE id = ?").run(c.name, taken ? null : c.id, p.id);
      }
      return;
    }
    const directors = people.filter((c) => c.category === "导演").slice(0, 2);
    const cast = people.filter((c) => c.category === "演员").slice(0, 4);
    for (const [role, list] of [["director", directors], ["cast", cast]]) {
      list.forEach((c, i) => db.prepare("INSERT INTO credits VALUES (?, ?, ?, ?)").run(w.id, role, i, personFor(c, tmdbPeople)));
    }
  });
}

const report = [];
const runStats = { ok: 0, miss: 0, err: 0, skip: 0, rate: 0, id: 0 };

function logRun(line) {
  console.error(line);
}

resetDoubanFetchStats();
let works = db.prepare("SELECT * FROM works ORDER BY id").all();
if (listId) {
  const ids = new Set(
    db.prepare("SELECT work_id FROM list_entries WHERE list_id = ?").all(listId).map((r) => r.work_id),
  );
  works = works.filter((w) => ids.has(w.id));
  // Drain cache.db hits first so a rerun makes progress while the IP cools down.
  works.sort((a, b) => {
    const da = doubanIdFromWorkId(a.id);
    const dbId = doubanIdFromWorkId(b.id);
    const ca = da && hasCachedJson("douban", `movie/${da}`) ? 0 : 1;
    const cb = dbId && hasCachedJson("douban", `movie/${dbId}`) ? 0 : 1;
    return ca - cb || a.id.localeCompare(b.id);
  });
}

logRun(
  `douban start: ${works.length} works${listId ? ` list=${listId}` : ""} cookie=${hasDoubanSession ? "yes" : "no"} gap=${GAP_MS}ms refresh=${refresh}`,
);

async function fetchMovieById(doubanId) {
  const d = await douban(`/movie/${doubanId}`, `movie/${doubanId}`);
  if (d.is_tv) return null;
  d.id = d.id ?? doubanId;
  return d;
}

for (const w of works) {
  if (only.size && !only.has(w.id)) continue;

  // Adopt a canonical id from an already-known TMDB match without re-fetching Douban.
  if (w.tmdb_id) {
    const tmdbWant = workIdFromTmdb(w.kind, w.tmdb_id);
    if (shouldAdoptWorkId(w.id, tmdbWant)) {
      const from = w.id;
      renameWork(db, from, tmdbWant);
      await renamePosterFile(from, tmdbWant);
      w.id = tmdbWant;
      report.push(`id    ${from} → ${tmdbWant}`);
      runStats.id++;
      logRun(`douban id   ${from} → ${tmdbWant}`);
    }
  }

  const embeddedDoubanId = doubanIdFromWorkId(w.id);
  const known = db.prepare("SELECT count(*) n FROM douban_subjects WHERE work_id = ?").get(w.id).n;
  const missingPlot = !db.prepare("SELECT plot FROM editorial WHERE work_id = ? AND plot IS NOT NULL AND plot != ''").get(w.id);
  if (known && !refresh && !only.size && !(embeddedDoubanId && missingPlot)) {
    if (!w.tmdb_id) {
      const row = db.prepare(
        "SELECT douban_id FROM douban_subjects WHERE work_id = ? ORDER BY season LIMIT 1",
      ).get(w.id);
      const want = preferredWorkId({ kind: w.kind, doubanId: row?.douban_id, currentId: w.id });
      if (shouldAdoptWorkId(w.id, want)) {
        const from = w.id;
        renameWork(db, from, want);
        await renamePosterFile(from, want);
        report.push(`id    ${from} → ${want}`);
        runStats.id++;
        logRun(`douban id   ${from} → ${want}`);
      }
    }
    runStats.skip++;
    logRun(`douban SKIP ${w.id} (already linked${missingPlot ? ", plot still empty" : ""})`);
    continue;
  }

  const aliases = db.prepare("SELECT alias FROM work_aliases WHERE work_id = ? ORDER BY ord").all(w.id).map((a) => a.alias);
  const hintKey = w.tmdb_id ? workIdFromTmdb(w.kind, w.tmdb_id) : w.id;
  const queries = [...new Set([HINTS[hintKey]?.query ?? HINTS[w.id]?.query, w.zh, ...aliases, w.original, w.en].filter(Boolean))];
  try {
    let subjects;
    if (w.kind === "tv") {
      subjects = await findTv(w, queries);
      if (subjects && w.tmdb_season) subjects = subjects.filter((s) => s.season === w.tmdb_season);
    } else {
      let d = embeddedDoubanId ? await fetchMovieById(embeddedDoubanId) : null;
      if (!d) d = await findMovie(w, queries);
      if (d) {
        fillDoubanDetail(w, d);
        // List seeding only needs title / intro / aka for TMDB — skip credits to halve API calls.
        const skipCredits = Boolean(listId && embeddedDoubanId);
        if (!skipCredits) await fillMovieFacts(w, d);
        else {
          tx(db, () => {
            db.prepare(
              "UPDATE works SET zh = coalesce(zh, ?), place = coalesce(place, ?), form = coalesce(form, ?) WHERE id = ?",
            ).run(
              d.title,
              (d.countries ?? []).slice(0, 2).join("、") || null,
              d.genres?.includes("纪录片") ? "纪录片" : d.genres?.includes("动画") ? "动画" : "电影",
              w.id,
            );
          });
        }
        subjects = [{ id: d.id, season: 0, title: d.title, year: Number(d.year), rating: d.rating }];
      }
    }
    if (!subjects?.length) {
      report.push(`MISS  ${w.id}  (tried ${queries.join(" / ")})`);
      runStats.miss++;
      logRun(`douban MISS ${w.id}  queries=${queries.slice(0, 3).join(" | ")}`);
      continue;
    }

    // No TMDB: adopt Douban subject id as the stable work id.
    if (!w.tmdb_id) {
      const primaryDouban = [...subjects].sort((a, b) => a.season - b.season)[0]?.id;
      const want = preferredWorkId({ kind: w.kind, doubanId: primaryDouban, currentId: w.id });
      if (shouldAdoptWorkId(w.id, want)) {
        const from = w.id;
        renameWork(db, from, want);
        await renamePosterFile(from, want);
        w.id = want;
        report.push(`id    ${from} → ${want}`);
      }
    }

    const seasons = subjects
      .map((s) => ({ id: s.id, season: s.season, value: s.rating?.value || null, votes: s.rating?.count || 0 }))
      .sort((a, b) => a.season - b.season);
    let counted = seasons.filter((s) => s.value && s.votes >= MIN_VOTES);
    if (!counted.length) counted = seasons.filter((s) => s.value).sort((a, b) => b.votes - a.votes).slice(0, 1);
    tx(db, () => {
      for (const s of subjects) {
        upsertSubject.run(s.id, w.id, s.season, s.title, s.year, s.rating?.value || null, s.rating?.count || 0, day);
      }
      if (!counted.length) return;
      const value = Math.round((counted.reduce((sum, s) => sum + s.value, 0) / counted.length) * 10) / 10;
      const votes = counted.reduce((sum, s) => sum + s.votes, 0);
      const detail = w.kind === "tv" && seasons.length > 1 ? JSON.stringify({ seasons: counted, excluded: seasons.length - counted.length }) : null;
      insertRating.run(w.id, value, votes, detail, day);
    });
    const score = counted.length ? (counted.reduce((s, x) => s + x.value, 0) / counted.length).toFixed(1) : "unrated";
    const plotText = db.prepare("SELECT plot FROM editorial WHERE work_id = ?").get(w.id)?.plot?.trim() ?? "";
    const plotTag = plotText.length > 15 ? "yes" : "no";
    report.push(`ok    ${w.id.padEnd(36)} ${score}  seasons ${counted.length}/${seasons.length}  ${subjects[0].title}`);
    runStats.ok++;
    logRun(
      `douban OK   ${w.id}  ${subjects[0].title}  score=${score}  plot=${plotTag}  api(cache=${doubanFetchStats.cache} net=${doubanFetchStats.network})`,
    );
  } catch (e) {
    report.push(`ERR   ${w.id}  ${e.message}`);
    runStats.err++;
    if (/rate limit/i.test(e.message)) {
      runStats.rate++;
      report.push("RATE  skipped (IP limited); rerun later — set DOUBAN_COOKIE or raise DOUBAN_GAP_MS");
      logRun(`douban ERR   ${w.id}  rate limit (skipping work; ok=${runStats.ok} miss=${runStats.miss} err=${runStats.err})`);
      continue;
    }
    logRun(`douban ERR   ${w.id}  ${e.message}`);
    if (/\b(403|418|429)\b/.test(e.message)) {
      report.push("Douban is refusing requests; stopping. Rerun later to continue where this left off.");
      break;
    }
  }
}

exportDb(db);
logRun(
  `douban done: works ok=${runStats.ok} miss=${runStats.miss} skip=${runStats.skip} err=${runStats.err} rate_skip=${runStats.rate} id_renames=${runStats.id} | API cache=${doubanFetchStats.cache} network=${doubanFetchStats.network} rate_waits=${doubanFetchStats.rateWaits}`,
);
console.log(report.join("\n") || "nothing to do");
