// Reads IMDb's free daily ratings file (non-commercial use) and records a rating
// for every work with an imdb_id. The file is re-downloaded when older than a day.
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { openDb, exportDb, tx } from "./lib/db.mjs";

const URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const FILE = "db/.cache/title.ratings.tsv.gz";

mkdirSync("db/.cache", { recursive: true });
if (!existsSync(FILE) || Date.now() - statSync(FILE).mtimeMs > 864e5) {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`IMDb dataset ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(FILE));
}

const db = openDb();
const wanted = new Map(db.prepare("SELECT imdb_id, id FROM works WHERE imdb_id IS NOT NULL").all().map((r) => [r.imdb_id, r.id]));
const found = new Map();
const lines = createInterface({ input: createReadStream(FILE).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of lines) {
  const tab = line.indexOf("\t");
  const id = line.slice(0, tab);
  if (!wanted.has(id)) continue;
  const [, value, votes] = line.split("\t");
  found.set(id, { value: Number(value), votes: Number(votes) });
}

const day = new Date(statSync(FILE).mtimeMs).toISOString().slice(0, 10);
const insert = db.prepare("INSERT OR REPLACE INTO ratings (work_id, source, value, votes, fetched_at) VALUES (?, 'imdb', ?, ?, ?)");
tx(db, () => {
  for (const [imdbId, r] of found) insert.run(wanted.get(imdbId), r.value, r.votes, day);
});
exportDb(db);

const missing = [...wanted].filter(([imdbId]) => !found.has(imdbId)).map(([, id]) => id);
console.log(`imdb: ${found.size}/${wanted.size} rated on ${day}${missing.length ? `; no rating: ${missing.join(", ")}` : ""}`);
