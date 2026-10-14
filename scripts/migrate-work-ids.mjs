// One-shot: rename legacy slug work ids to tmdb-m- / tmdb-tv- (or douban-),
// rename poster files, and rewrite seed JSON keys that used the old ids.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { openDb, exportDb, tx } from "./lib/db.mjs";
import {
  preferredWorkId,
  shouldAdoptWorkId,
  renameWork,
  renamePosterFile,
} from "./lib/work-id.mjs";

const db = openDb();
const works = db.prepare("SELECT id, kind, tmdb_id FROM works ORDER BY id").all();
const map = new Map();

for (const w of works) {
  let doubanId = null;
  if (!w.tmdb_id) {
    doubanId = db
      .prepare("SELECT douban_id FROM douban_subjects WHERE work_id = ? ORDER BY season LIMIT 1")
      .get(w.id)?.douban_id;
  }
  const want = preferredWorkId({
    kind: w.kind,
    tmdbId: w.tmdb_id,
    doubanId,
    currentId: w.id,
  });
  if (shouldAdoptWorkId(w.id, want)) map.set(w.id, want);
}

tx(db, () => {
  for (const [from, to] of map) renameWork(db, from, to);
});

for (const [from, to] of map) await renamePosterFile(from, to);

function remapJsonKeys(file) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (Array.isArray(raw) || raw === null || typeof raw !== "object") return 0;
  let n = 0;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = map.get(k) ?? k;
    if (nk !== k) n++;
    if (Object.hasOwn(out, nk)) throw new Error(`${file}: colliding key ${nk}`);
    out[nk] = v;
  }
  if (n) writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  return n;
}

const seedDir = "db/seed";
const seedReport = [];
for (const name of readdirSync(seedDir)) {
  if (!name.endsWith(".json")) continue;
  // List meta files are not keyed by work id.
  if (name === "nyt-100-movies.json") continue;
  const file = path.join(seedDir, name);
  const n = remapJsonKeys(file);
  if (n) seedReport.push(`${name}: ${n} keys`);
}

exportDb(db);
console.log(`renamed ${map.size} works`);
if (seedReport.length) console.log(seedReport.join("\n"));
else console.log("no seed JSON keys to rewrite");
// Sample of the map for sanity.
console.log(
  [...map.entries()]
    .slice(0, 5)
    .map(([a, b]) => `${a} → ${b}`)
    .join("\n"),
);
