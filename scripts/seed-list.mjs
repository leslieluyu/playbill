// Creates a list and any missing works from db/seed/<name>.json and its TSV of
// rank / title / year. Afterwards run `npm run tmdb` to fill in the facts.
// Usage: npm run seed -- nyt-100-movies
import { readFileSync } from "node:fs";
import { openDb, exportDb, tx } from "./lib/db.mjs";

const name = process.argv[2];
if (!name) throw new Error("usage: npm run seed -- <name>   (reads db/seed/<name>.json)");
const meta = JSON.parse(readFileSync(`db/seed/${name}.json`, "utf8"));
const [, ...rows] = readFileSync(`db/seed/${meta.entries}`, "utf8").trim().split("\n");
const entries = rows.map((line) => {
  const [rank, title, year] = line.split("\t");
  return { rank: Number(rank), title, year: Number(year) };
});

const slugify = (s) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const db = openDb();
const created = [];
tx(db, () => {
  db.prepare("DELETE FROM list_entries WHERE list_id = ?").run(meta.id);
  db.prepare(
    `INSERT INTO lists (id, title, kicker, dek, source_name, source_url, kind, ord) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, kicker = excluded.kicker, dek = excluded.dek,
       source_name = excluded.source_name, source_url = excluded.source_url, kind = excluded.kind, ord = excluded.ord`,
  ).run(meta.id, meta.title, meta.kicker, meta.dek, meta.source.name, meta.source.url, meta.kind, meta.order);

  for (const e of entries) {
    let id = slugify(e.title);
    const existing = db.prepare("SELECT kind, en, year_start FROM works WHERE id = ?").get(id);
    if (existing && (existing.kind !== meta.kind || Math.abs(existing.year_start - e.year) > 1)) id = `${id}-${e.year}`;
    if (!db.prepare("SELECT 1 FROM works WHERE id = ?").get(id)) {
      db.prepare("INSERT INTO works (id, kind, en, year_start, year_end) VALUES (?, ?, ?, ?, ?)").run(
        id, meta.kind, e.title, e.year, e.year);
      created.push(id);
    }
    db.prepare("INSERT INTO list_entries (list_id, rank, work_id) VALUES (?, ?, ?)").run(meta.id, e.rank, id);
  }
});
exportDb(db);
console.log(`${meta.id}: ${entries.length} entries, ${created.length} new works`);
