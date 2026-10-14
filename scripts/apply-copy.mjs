// Applies English plots, TV playbill notes, and NYT movie list 看点 from seed JSON.
import { readFileSync } from "node:fs";
import { exportDb, openDb, tx } from "./lib/db.mjs";

const db = openDb();
const cols = new Set(db.prepare("PRAGMA table_info(editorial)").all().map((c) => c.name));
if (!cols.has("plot_en")) db.exec("ALTER TABLE editorial ADD COLUMN plot_en TEXT");
if (!cols.has("playbill")) db.exec("ALTER TABLE editorial ADD COLUMN playbill TEXT");
if (!cols.has("playbill_en")) db.exec("ALTER TABLE editorial ADD COLUMN playbill_en TEXT");
db.exec(`CREATE TABLE IF NOT EXISTS list_highlights (
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  hook    TEXT,
  hook_en TEXT,
  PRIMARY KEY (list_id, work_id)
)`);

const hooksZh = JSON.parse(readFileSync("db/seed/nyt-movie-hooks-zh.json", "utf8"));
const hooksEn = JSON.parse(readFileSync("db/seed/nyt-movie-hooks-en.json", "utf8"));
const editorialEn = JSON.parse(readFileSync("db/seed/editorial-en.json", "utf8"));
const works = new Set(db.prepare("SELECT id FROM works").all().map((r) => r.id));

const zhIds = Object.keys(hooksZh);
const enIds = Object.keys(hooksEn);
if (zhIds.length !== 100 || enIds.length !== 100) throw new Error(`hook counts zh=${zhIds.length} en=${enIds.length}`);
for (const id of zhIds) {
  if (!hooksEn[id]) throw new Error(`missing English hook for ${id}`);
  if (!works.has(id)) throw new Error(`unknown work ${id}`);
}
for (const id of Object.keys(editorialEn)) {
  if (!works.has(id)) throw new Error(`unknown editorial work ${id}`);
}
const missingEn = [...works].filter((id) => !editorialEn[id]?.plot);
if (missingEn.length) throw new Error(`missing English plot: ${missingEn.join(", ")}`);

const setPlot = db.prepare("UPDATE editorial SET plot_en = ? WHERE work_id = ?");
const setPlaybillEn = db.prepare("UPDATE editorial SET playbill_en = ? WHERE work_id = ?");
const setHighlight = db.prepare(
  `INSERT INTO list_highlights (list_id, work_id, hook, hook_en) VALUES ('nyt-100-movies', ?, ?, ?)
   ON CONFLICT(list_id, work_id) DO UPDATE SET hook = excluded.hook, hook_en = excluded.hook_en`,
);

tx(db, () => {
  for (const [id, row] of Object.entries(editorialEn)) {
    setPlot.run(row.plot, id);
    // TV English 场刊 lives in editorial-en as hook; movies omit it so NYT 看点 is not overwritten.
    if (row.hook) setPlaybillEn.run(row.hook, id);
  }
  for (const id of zhIds) setHighlight.run(id, hooksZh[id], hooksEn[id]);
});

const check = db
  .prepare(
    `SELECT
       SUM(plot_en IS NULL OR plot_en = '') AS missing_plot,
       SUM(kind = 'tv' AND (playbill_en IS NULL OR playbill_en = '')) AS missing_tv_playbill_en,
       (SELECT count(*) FROM list_highlights WHERE list_id = 'nyt-100-movies') AS movie_highlights
     FROM editorial e JOIN works w ON w.id = e.work_id`,
  )
  .get();
if (check.missing_plot || check.missing_tv_playbill_en || check.movie_highlights !== 100) {
  throw new Error(JSON.stringify(check));
}
exportDb(db);
db.close();
console.log("copy applied", zhIds.length, "movie 看点,", Object.keys(editorialEn).length, "English plots");
