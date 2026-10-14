// Creates a list and any missing works from db/seed/<name>.json and its TSV of
// rank|spine_number / title / year [, tmdb_id] [, douban_id] [, id] [, director].
// `spine_number` is accepted as the list rank (Criterion Collection).
// Rows with an empty year are skipped (box sets / incomplete catalog rows).
// Work ids: tmdb-m-{id} / tmdb-tv-{id} when TMDB is known, else douban-{id},
// else an existing same-title/year work if one is already in the catalog,
// else provisional local-{slug|list-rank}. Afterwards run `npm run tmdb` (and
// douban) so provisional rows can adopt a canonical id.
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
const iId = idx("id");
if (iRank < 0 || iTitle < 0 || iYear < 0) {
  throw new Error(`seed TSV needs rank (or spine_number), title, year columns; got ${cols.join(", ")}`);
}

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
  entries.push({
    rank: Number(cells[iRank]),
    title: cells[iTitle],
    year: Number(yearRaw),
    tmdbId: iTmdb >= 0 && cells[iTmdb] ? Number(cells[iTmdb]) : null,
    doubanId: iDouban >= 0 && cells[iDouban] ? String(cells[iDouban]).trim() : null,
    id: iId >= 0 && cells[iId] ? String(cells[iId]).trim() : null,
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

  for (const e of entries) {
    const matched = findExisting(e);
    let id = matched ?? assignId(e);
    if (matched) reused.push(id);
    const existing = db.prepare("SELECT kind, en, year_start, tmdb_id FROM works WHERE id = ?").get(id);
    if (existing && (existing.kind !== meta.kind || Math.abs(existing.year_start - e.year) > 1)) {
      id = `${id}-${e.year}`;
    }
    if (!db.prepare("SELECT 1 FROM works WHERE id = ?").get(id)) {
      db.prepare(
        "INSERT INTO works (id, kind, en, year_start, year_end, tmdb_id, tmdb_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(id, meta.kind, e.title, e.year, e.year, e.tmdbId, e.tmdbId ? meta.kind : null);
      created.push(id);
      catalog.push({ id, kind: meta.kind, en: e.title, year_start: e.year, key: loose(e.title) });
    } else if (e.tmdbId) {
      db.prepare("UPDATE works SET tmdb_id = coalesce(tmdb_id, ?), tmdb_type = coalesce(tmdb_type, ?) WHERE id = ?").run(
        e.tmdbId, meta.kind, id);
    }
    db.prepare("INSERT INTO list_entries (list_id, rank, work_id) VALUES (?, ?, ?)").run(meta.id, e.rank, id);
  }
});
exportDb(db);
console.log(
  `${meta.id}: ${entries.length} entries, ${created.length} new works, ${new Set(reused).size} reused` +
    (skipped.length ? `, skipped ${skipped.length} without year` : ""),
);
