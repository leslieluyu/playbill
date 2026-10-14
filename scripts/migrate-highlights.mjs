// One-shot: split list 看点 from work 场刊, add people bio/photo columns, allow writer credits.
import { exportDb, openDb, tx } from "./lib/db.mjs";

const db = openDb();

function cols(table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}

tx(db, () => {
  db.exec(`CREATE TABLE IF NOT EXISTS list_highlights (
    list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    hook    TEXT,
    hook_en TEXT,
    PRIMARY KEY (list_id, work_id)
  )`);

  const peopleCols = cols("people");
  if (!peopleCols.has("photo")) db.exec("ALTER TABLE people ADD COLUMN photo TEXT");
  if (!peopleCols.has("bio_zh")) db.exec("ALTER TABLE people ADD COLUMN bio_zh TEXT");
  if (!peopleCols.has("bio_en")) db.exec("ALTER TABLE people ADD COLUMN bio_en TEXT");

  // Recreate credits so the CHECK allows writer.
  db.exec(`
    CREATE TABLE credits_new (
      work_id   TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      role      TEXT NOT NULL CHECK (role IN ('creator', 'director', 'writer', 'cast')),
      ord       INTEGER NOT NULL,
      person_id INTEGER NOT NULL REFERENCES people(id),
      PRIMARY KEY (work_id, role, ord)
    );
    INSERT INTO credits_new SELECT work_id, role, ord, person_id FROM credits;
    DROP TABLE credits;
    ALTER TABLE credits_new RENAME TO credits;
  `);

  const edCols = cols("editorial");
  if (edCols.has("hook") && !edCols.has("playbill")) {
    db.exec(`
      CREATE TABLE editorial_new (
        work_id     TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
        plot        TEXT,
        plot_en     TEXT,
        playbill    TEXT,
        playbill_en TEXT,
        reviewed    INTEGER NOT NULL DEFAULT 0
      );
    `);

    const insert = db.prepare(
      `INSERT INTO editorial_new (work_id, plot, plot_en, playbill, playbill_en, reviewed)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const upsertHighlight = db.prepare(
      `INSERT INTO list_highlights (list_id, work_id, hook, hook_en) VALUES (?, ?, ?, ?)
       ON CONFLICT(list_id, work_id) DO UPDATE SET hook = excluded.hook, hook_en = excluded.hook_en`,
    );

    const rows = db
      .prepare(
        `SELECT e.work_id, e.plot, e.plot_en, e.hook, e.hook_en, e.reviewed, w.kind
         FROM editorial e JOIN works w ON w.id = e.work_id`,
      )
      .all();

    for (const r of rows) {
      if (r.kind === "movie") {
        if (r.hook || r.hook_en) {
          upsertHighlight.run("nyt-100-movies", r.work_id, r.hook ?? null, r.hook_en ?? null);
        }
        insert.run(r.work_id, r.plot ?? null, r.plot_en ?? null, null, null, r.reviewed);
      } else {
        insert.run(r.work_id, r.plot ?? null, r.plot_en ?? null, r.hook ?? null, r.hook_en ?? null, r.reviewed);
      }
    }

    db.exec("DROP TABLE editorial; ALTER TABLE editorial_new RENAME TO editorial;");
  } else if (!edCols.has("playbill")) {
    if (!edCols.has("playbill")) db.exec("ALTER TABLE editorial ADD COLUMN playbill TEXT");
    if (!cols("editorial").has("playbill_en")) db.exec("ALTER TABLE editorial ADD COLUMN playbill_en TEXT");
  }
});

const movieHighlights = db.prepare("SELECT count(*) n FROM list_highlights WHERE list_id = 'nyt-100-movies'").get().n;
const tvPlaybill = db
  .prepare(
    `SELECT count(*) n FROM editorial e JOIN works w ON w.id = e.work_id
     WHERE w.kind = 'tv' AND e.playbill IS NOT NULL AND e.playbill != ''`,
  )
  .get().n;
const moviePlaybill = db
  .prepare(
    `SELECT count(*) n FROM editorial e JOIN works w ON w.id = e.work_id
     WHERE w.kind = 'movie' AND e.playbill IS NOT NULL AND e.playbill != ''`,
  )
  .get().n;

if (movieHighlights !== 100) throw new Error(`expected 100 movie list highlights, got ${movieHighlights}`);
if (tvPlaybill !== 100) throw new Error(`expected 100 TV playbill notes, got ${tvPlaybill}`);
if (moviePlaybill !== 0) throw new Error(`expected 0 movie playbill notes, got ${moviePlaybill}`);

exportDb(db);
db.close();
console.log("migrated", movieHighlights, "movie 看点,", tvPlaybill, "TV 场刊");
