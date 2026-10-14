import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DB_PATH = path.join(ROOT, "db/playbill.db");
const CACHE_PATH = path.join(ROOT, "db/cache.db");
const SCHEMA_PATH = path.join(ROOT, "db/schema.sql");
const EXPORT_DIR = path.join(ROOT, "db/export");

// Insert order respects foreign keys; each table lists its sort key for stable exports.
const TABLES = [
  ["lists", "id"],
  ["list_sections", "list_id, ord"],
  ["works", "id"],
  ["work_aliases", "work_id, ord"],
  ["people", "id"],
  ["credits", "work_id, role, ord"],
  ["editorial", "work_id"],
  ["douban_subjects", "work_id, season, douban_id"],
  ["ratings", "work_id, source, fetched_at"],
  ["list_entries", "list_id, rank"],
  ["list_highlights", "list_id, work_id"],
];

export function openDb(file = DB_PATH) {
  const db = new DatabaseSync(file);
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

export function tx(db, fn) {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Writes one sorted JSONL file per table so changes show up as readable diffs. */
export function exportDb(db) {
  mkdirSync(EXPORT_DIR, { recursive: true });
  for (const [table, order] of TABLES) {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all();
    const body = rows.map((r) => JSON.stringify({ ...r })).join("\n");
    writeFileSync(path.join(EXPORT_DIR, `${table}.jsonl`), body ? body + "\n" : "");
  }
}

/** Rebuilds the database from the JSONL export, e.g. after a merge conflict on the binary file. */
export function importDb() {
  if (existsSync(DB_PATH)) rmSync(DB_PATH);
  const db = openDb();
  const files = new Set(readdirSync(EXPORT_DIR));
  tx(db, () => {
    for (const [table] of TABLES) {
      if (!files.has(`${table}.jsonl`)) continue;
      const lines = readFileSync(path.join(EXPORT_DIR, `${table}.jsonl`), "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        const row = JSON.parse(line);
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(
          ...cols.map((c) => row[c]),
        );
      }
    }
  });
  return db;
}

let cache;
function cacheDb() {
  if (!cache) {
    cache = new DatabaseSync(CACHE_PATH);
    cache.exec(`CREATE TABLE IF NOT EXISTS raw (
      source TEXT NOT NULL, key TEXT NOT NULL, status INTEGER NOT NULL,
      body TEXT, fetched_at TEXT NOT NULL, PRIMARY KEY (source, key))`);
  }
  return cache;
}

const lastCall = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches JSON once and keeps the raw response in db/cache.db, so reruns and
 * interrupted crawls never hit the network for something already fetched.
 * `gap` is the minimum delay between live requests to the same source.
 */
export async function cachedJson(source, key, url, { headers = {}, gap = 0, maxAgeDays = Infinity } = {}) {
  const c = cacheDb();
  const hit = c.prepare("SELECT status, body, fetched_at FROM raw WHERE source = ? AND key = ?").get(source, key);
  if (hit && hit.status === 200 && (Date.now() - Date.parse(hit.fetched_at)) / 864e5 < maxAgeDays) {
    return JSON.parse(hit.body);
  }
  // Douban's rexxar API applies subject_ip_rate_limit (~20 calls / few minutes) even when
  // logged in; wait and retry instead of caching the failure or aborting the crawl.
  for (let attempt = 0; ; attempt++) {
    const wait = (lastCall.get(source) ?? 0) + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall.set(source, Date.now());
    const res = await fetch(url, { headers });
    const body = await res.text();
    if (source === "douban" && res.status === 400 && body.includes("subject_ip_rate_limit")) {
      if (attempt >= 10) throw new Error(`${source} ${res.status} ${url}`);
      const pause = 120_000;
      console.error(`douban IP rate limit on ${key}; sleeping ${pause / 1000}s (attempt ${attempt + 1})`);
      await sleep(pause);
      continue;
    }
    c.prepare("INSERT OR REPLACE INTO raw VALUES (?, ?, ?, ?, ?)").run(source, key, res.status, body, new Date().toISOString());
    if (!res.ok) throw new Error(`${source} ${res.status} ${url}`);
    return JSON.parse(body);
  }
}

/** Drops a cached response, e.g. an empty result that really meant "rate limited". */
export function forget(source, key) {
  cacheDb().prepare("DELETE FROM raw WHERE source = ? AND key = ?").run(source, key);
}

export function yearsLabel({ year_start, year_end, ongoing }) {
  if (ongoing) return `${year_start}–至今`;
  if (year_end && year_end !== year_start) return `${year_start}–${year_end}`;
  return String(year_start);
}
