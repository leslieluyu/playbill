// Creates a list and any missing works from db/seed/<name>.json and its TSV of
// rank|spine_number / title / year [, tmdb_id] [, douban_id] [, imdb_id] [, id]
// [, section] [, director].
// `spine_number` is accepted as the list rank (Criterion Collection).
// Optional `meta.sections` rebuilds list_sections; TSV `section` sets
// list_entries.section_id (must match a section id).
// Rows with an empty year are skipped (box sets / incomplete catalog rows).
// Work ids: tmdb-m-{id} / tmdb-tv-{id} when TMDB is known, else douban-{id},
// else an existing same-title/year (or same imdb_id) work if one is already in
// the catalog, else provisional local-{slug|list-rank}. Afterwards run
// `npm run tmdb` (and douban) so provisional rows can adopt a canonical id.
// Usage: npm run seed -- nyt-100-movies
import { readFileSync } from "node:fs";
import { openDb, exportDb, tx } from "./lib/db.mjs";
import { workIdFromTmdb, workIdFromDouban } from "./lib/work-id.mjs";

const name = process.argv[2];
if (!name) throw new Error("usage: npm run seed -- <name>   (reads db/seed/<name>.json)");
const meta = JSON.parse(readFileSync(`db/seed/${name}.json`, "utf8"));
const [header, ...rows] = readFileSync(`db/seed/${meta.entries}`, "utf8").trim().split("\n");
const cols = header.split("\t").map((c) => c.trim());
const idx = (name) => cols.indexOf(name);
const iRank = idx("rank") >= 0 ? idx("rank") : idx("spine_number");
const iTitle = idx("title");
const iYear = idx("year");
const iTmdb = idx("tmdb_id");
const iDouban = idx("douban_id");
const iImdb = idx("imdb_id");
const iId = idx("id");
const iSection = idx("section");
const iChart = idx("chart");
const iPosition = idx("position");
const iNote = idx("note");
const iWikidata = idx("wikidata");
const iDirectorEn = idx("director_en");
if (iRank < 0 || iTitle < 0 || iYear < 0) {
  throw new Error(`seed TSV needs rank (or spine_number), title, year columns; got ${cols.join(", ")}`);
}

const sectionDefs = Array.isArray(meta.sections) ? meta.sections : [];
const sectionIds = new Set(sectionDefs.map((s) => s.id));

const skipped = [];
const entries = [];
for (const line of rows) {
  if (!line.trim()) continue;
  const cells = line.split("\t");
  const yearRaw = (cells[iYear] ?? "").trim();
  if (!yearRaw) {
    skipped.push(`${cells[iRank]}\t${cells[iTitle]}`);
    continue;
  }
  const section = iSection >= 0 && cells[iSection] ? String(cells[iSection]).trim() : null;
  if (section && sectionIds.size && !sectionIds.has(section)) {
    throw new Error(`${meta.id} rank ${cells[iRank]}: unknown section "${section}"`);
  }
  entries.push({
    rank: Number(cells[iRank]),
    title: cells[iTitle],
    year: Number(yearRaw),
    tmdbId: iTmdb >= 0 && cells[iTmdb] ? Number(cells[iTmdb]) : null,
    doubanId: iDouban >= 0 && cells[iDouban] ? String(cells[iDouban]).trim() : null,
    imdbId: iImdb >= 0 && cells[iImdb] ? String(cells[iImdb]).trim() : null,
    id: iId >= 0 && cells[iId] ? String(cells[iId]).trim() : null,
    section,
    chart: iChart >= 0 && cells[iChart] ? String(cells[iChart]).trim() : null,
    position: iPosition >= 0 && cells[iPosition] ? Number(cells[iPosition]) : null,
    note: iNote >= 0 && cells[iNote] ? String(cells[iNote]).trim() : null,
    wikidata: iWikidata >= 0 && cells[iWikidata] ? String(cells[iWikidata]).trim() : null,
    directorEn: iDirectorEn >= 0 && cells[iDirectorEn] ? String(cells[iDirectorEn]).trim() : null,
  });
}

const slugify = (s) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const loose = (s) =>
  (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");

function assignId(e) {
  if (e.id) return e.id;
  if (e.tmdbId) return workIdFromTmdb(meta.kind, e.tmdbId);
  if (e.doubanId) return workIdFromDouban(e.doubanId);
  if (e.wikidata) return `wd-${String(e.wikidata).replace(/^Q/i, "Q")}`;
  const slug = slugify(e.title);
  return slug ? `local-${slug}` : `local-${meta.id}-${e.rank}`;
}

const db = openDb();
const created = [];
const reused = [];
const catalog = db
  .prepare("SELECT id, kind, en, year_start FROM works WHERE kind = ?")
  .all(meta.kind)
  .map((w) => ({ ...w, key: loose(w.en) }));

function findExisting(e) {
  if (e.imdbId) {
    // IMDb ids are unique across movie/TV; prefer same kind, else any match.
    const byImdb =
      db.prepare("SELECT id FROM works WHERE imdb_id = ? AND kind = ?").get(e.imdbId, meta.kind) ??
      db.prepare("SELECT id FROM works WHERE imdb_id = ?").get(e.imdbId);
    if (byImdb) return byImdb.id;
  }
  const key = loose(e.title);
  if (!key) return null;
  const hits = catalog.filter((w) => Math.abs(w.year_start - e.year) <= 1 && (w.key === key || w.key.includes(key) || key.includes(w.key)));
  if (hits.length === 1) return hits[0].id;
  // Prefer exact loose match when several are close.
  const exact = hits.filter((w) => w.key === key);
  return exact.length === 1 ? exact[0].id : null;
}

tx(db, () => {
  db.prepare("DELETE FROM list_entries WHERE list_id = ?").run(meta.id);
  db.prepare(
    `INSERT INTO lists (id, title, kicker, dek, source_name, source_url, kind, ord) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, kicker = excluded.kicker, dek = excluded.dek,
       source_name = excluded.source_name, source_url = excluded.source_url, kind = excluded.kind, ord = excluded.ord`,
  ).run(meta.id, meta.title, meta.kicker, meta.dek, meta.source.name, meta.source.url, meta.kind, meta.order);

  if (sectionDefs.length) {
    db.prepare("DELETE FROM list_sections WHERE list_id = ?").run(meta.id);
    const insertSec = db.prepare(
      "INSERT INTO list_sections (list_id, id, ord, name, blurb, color) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const s of sectionDefs) {
      insertSec.run(meta.id, s.id, s.order ?? s.ord ?? 0, s.name, s.blurb ?? "", s.color);
    }
  }

  const insertEntry = db.prepare(
    "INSERT INTO list_entries (list_id, rank, work_id, section_id, chart, position, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const personByEn = new Map();
  const findPerson = db.prepare("SELECT id, zh, en, photo, bio_zh, tmdb_id FROM people WHERE en = ?");
  const allPeople = () => db.prepare("SELECT id, zh, en, photo, bio_zh, tmdb_id FROM people").all();
  const insertPerson = db.prepare("INSERT INTO people (en, zh) VALUES (?, ?)");
  const updatePersonZh = db.prepare("UPDATE people SET zh = coalesce(zh, ?) WHERE id = ?");
  const personScore = (row) =>
    (row.photo ? 100 : 0) +
    (row.tmdb_id ? 40 : 0) +
    Math.min((row.bio_zh ?? "").length, 400) / 4 +
    (row.bio_zh && /克\/美国|^.{1,2}\//.test(row.bio_zh) ? -500 : 0);
  const findPersonLoose = (en) => {
    let row = findPerson.get(en);
    if (row) return row;
    const key = loose(en);
    const hits = allPeople().filter((p) => loose(p.en) === key);
    if (!hits.length) return null;
    return hits.sort((a, b) => personScore(b) - personScore(a))[0];
  };
  const mergePersonDuplicates = (en) => {
    const key = loose(en);
    const hits = allPeople().filter((p) => loose(p.en) === key);
    if (hits.length <= 1) return hits[0]?.id ?? null;
    const keep = hits.sort((a, b) => personScore(b) - personScore(a))[0];
    for (const dup of hits) {
      if (dup.id === keep.id) continue;
      db.prepare("UPDATE credits SET person_id = ? WHERE person_id = ?").run(keep.id, dup.id);
      db.prepare("DELETE FROM people WHERE id = ?").run(dup.id);
    }
    return keep.id;
  };
  const isGoodCuratedBio = (bio) =>
    bio && bio.length >= 12 && !/克\/美国/.test(bio) && !/^.{1,2}\//.test(bio);
  const mergeCuratedBio = (personId, bioZh) => {
    if (!isGoodCuratedBio(bioZh)) return;
    const row = db.prepare("SELECT bio_zh FROM people WHERE id = ?").get(personId);
    const cur = row?.bio_zh ?? "";
    if (!cur || cur.length < bioZh.length || /克\/美国/.test(cur)) {
      db.prepare("UPDATE people SET bio_zh = ? WHERE id = ?").run(bioZh, personId);
    }
  };
  const ensurePerson = (en, zh) => {
    let row = findPersonLoose(en);
    if (row) {
      if (zh && !row.zh) updatePersonZh.run(zh, row.id);
      return row.id;
    }
    const id = insertPerson.run(en, zh).lastInsertRowid;
    return id;
  };
  const insertCredit = db.prepare(
    "INSERT OR IGNORE INTO credits (work_id, role, ord, person_id) VALUES (?, 'director', 0, ?)",
  );
  let directorsMeta = null;
  if (meta.id === "great-directors") {
    try {
      directorsMeta = JSON.parse(readFileSync(`db/seed/great-directors-directors.json`, "utf8")).directors;
      for (const d of directorsMeta) {
        const pid = mergePersonDuplicates(d.en) ?? ensurePerson(d.en, d.zh);
        personByEn.set(d.en, pid);
        mergeCuratedBio(pid, d.bioZh);
      }
    } catch {
      /* optional */
    }
  }

  for (const e of entries) {
    const matched = findExisting(e);
    let id = matched ?? assignId(e);
    if (matched) reused.push(id);
    const existing = db.prepare("SELECT kind, en, year_start, tmdb_id, imdb_id FROM works WHERE id = ?").get(id);
    const sameImdb = e.imdbId && existing?.imdb_id === e.imdbId;
    if (existing && !sameImdb && (existing.kind !== meta.kind || Math.abs(existing.year_start - e.year) > 1)) {
      id = `${id}-${e.year}`;
    }
    if (!db.prepare("SELECT 1 FROM works WHERE id = ?").get(id)) {
      db.prepare(
        "INSERT INTO works (id, kind, en, year_start, year_end, tmdb_id, tmdb_type, imdb_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(id, meta.kind, e.title, e.year, e.year, e.tmdbId, e.tmdbId ? meta.kind : null, e.imdbId);
      created.push(id);
      catalog.push({ id, kind: meta.kind, en: e.title, year_start: e.year, key: loose(e.title) });
    } else {
      if (e.tmdbId) {
        db.prepare("UPDATE works SET tmdb_id = coalesce(tmdb_id, ?), tmdb_type = coalesce(tmdb_type, ?) WHERE id = ?").run(
          e.tmdbId, meta.kind, id);
      }
      if (e.imdbId) {
        db.prepare("UPDATE works SET imdb_id = coalesce(imdb_id, ?) WHERE id = ?").run(e.imdbId, id);
      }
    }
    insertEntry.run(meta.id, e.rank, id, e.section, e.chart, e.position, e.note);
    if (e.directorEn && meta.id === "great-directors") {
      const personId = personByEn.get(e.directorEn) ?? ensurePerson(e.directorEn, null);
      personByEn.set(e.directorEn, personId);
      insertCredit.run(id, personId);
    }
  }
});
exportDb(db);
console.log(
  `${meta.id}: ${entries.length} entries, ${created.length} new works, ${new Set(reused).size} reused` +
    (sectionDefs.length ? `, ${sectionDefs.length} sections` : "") +
    (skipped.length ? `, skipped ${skipped.length} without year` : ""),
);
