import { readFileSync } from "node:fs";
import { exportDb, openDb, tx } from "./lib/db.mjs";

const db = openDb();
const cols = new Set(db.prepare("PRAGMA table_info(editorial)").all().map((c) => c.name));
if (!cols.has("plot_en")) db.exec("ALTER TABLE editorial ADD COLUMN plot_en TEXT");
if (!cols.has("hook_en")) db.exec("ALTER TABLE editorial ADD COLUMN hook_en TEXT");

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
const setHook = db.prepare("UPDATE editorial SET hook_en = ? WHERE work_id = ?");
const setMovieHook = db.prepare("UPDATE editorial SET hook = ?, hook_en = ? WHERE work_id = ?");

tx(db, () => {
  for (const [id, row] of Object.entries(editorialEn)) {
    setPlot.run(row.plot, id);
    if (row.hook) setHook.run(row.hook, id);
  }
  for (const id of zhIds) setMovieHook.run(hooksZh[id], hooksEn[id], id);
});

const check = db.prepare(
  `SELECT
     SUM(plot_en IS NULL OR plot_en = '') AS missing_plot,
     SUM(hook_en IS NULL OR hook_en = '') AS missing_hook,
     SUM(kind = 'movie' AND (hook IS NULL OR hook = '')) AS missing_movie_hook
   FROM editorial e JOIN works w ON w.id = e.work_id`,
).get();
if (check.missing_plot || check.missing_hook || check.missing_movie_hook) {
  throw new Error(JSON.stringify(check));
}
exportDb(db);
db.close();
console.log("copy applied", zhIds.length, "movie hooks,", Object.keys(editorialEn).length, "English plots");
