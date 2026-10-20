import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

// Node's built-in fetch ignores HTTP(S)_PROXY; enrichment runs on the NUC through Clash.
setGlobalDispatcher(new EnvHttpProxyAgent());

// Prefer walking up to a directory that contains db/playbill.db so Astro prerender
// bundles (under dist/.prerender/chunks) still resolve the real repo root.
function findRoot() {
  const starts = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 10; i++) {
      if (existsSync(path.join(dir, "db/playbill.db"))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}
const ROOT = findRoot();
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
  ["work_genres", "work_id, genre_id"],
  ["people", "id"],
  ["credits", "work_id, role, ord"],
  ["editorial", "work_id"],
  ["douban_subjects", "work_id, season, douban_id"],
  ["ratings", "work_id, source, fetched_at"],
  ["list_entries", "list_id, rank"],
  ["list_highlights", "list_id, work_id"],
  ["person_awards", "person_id, ord, year, id"],
];

function migrateListEntries(db) {
  const cols = db.prepare("PRAGMA table_info(list_entries)").all().map((r) => r.name);
  if (!cols.includes("chart")) db.exec("ALTER TABLE list_entries ADD COLUMN chart TEXT");
  if (!cols.includes("position")) db.exec("ALTER TABLE list_entries ADD COLUMN position INTEGER");
  if (!cols.includes("note")) db.exec("ALTER TABLE list_entries ADD COLUMN note TEXT");
}

export function openDb(file = DB_PATH) {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 60000");
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  migrateListEntries(db);
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
    cache.exec("PRAGMA busy_timeout = 60000");
    cache.exec(`CREATE TABLE IF NOT EXISTS raw (
      source TEXT NOT NULL, key TEXT NOT NULL, status INTEGER NOT NULL,
      body TEXT, fetched_at TEXT NOT NULL, PRIMARY KEY (source, key))`);
  }
  return cache;
}

const lastCall = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True when a prior fetch is still in cache.db (200 by default). */
export function hasCachedJson(source, key, { okOnly = true } = {}) {
  const hit = cacheDb().prepare("SELECT status FROM raw WHERE source = ? AND key = ?").get(source, key);
  return okOnly ? hit?.status === 200 : Boolean(hit);
}

let doubanRatePauseMs = 120_000;

/** Live counters for `npm run douban` progress (logged on stderr). */
export const doubanFetchStats = { cache: 0, network: 0, rateWaits: 0 };

export function resetDoubanFetchStats() {
  doubanFetchStats.cache = 0;
  doubanFetchStats.network = 0;
  doubanFetchStats.rateWaits = 0;
}

function logDouban(kind, key, extra = "") {
  console.error(`douban ${kind} ${key}${extra}`);
}

/**
 * Fetches JSON once and keeps the raw response in db/cache.db, so reruns and
 * interrupted crawls never hit the network for something already fetched.
 * `gap` is the minimum delay between live requests to the same source.
 */
export async function cachedJson(source, key, url, { headers = {}, gap = 0, maxAgeDays = Infinity } = {}) {
  const c = cacheDb();
  const hit = c.prepare("SELECT status, body, fetched_at FROM raw WHERE source = ? AND key = ?").get(source, key);
  if (hit && hit.status === 200 && (Date.now() - Date.parse(hit.fetched_at)) / 864e5 < maxAgeDays) {
    if (source === "douban") {
      doubanFetchStats.cache++;
      logDouban("cache", key, ` (#${doubanFetchStats.cache} from cache)`);
    }
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
      if (attempt >= 4) throw new Error(`douban rate limit ${key}`);
      const pause = doubanRatePauseMs;
      doubanRatePauseMs = Math.min(Math.round(doubanRatePauseMs * 1.5), 600_000);
      doubanFetchStats.rateWaits++;
      logDouban(
        "RATE",
        key,
        ` sleep ${Math.round(pause / 1000)}s (attempt ${attempt + 1}/4, waits=${doubanFetchStats.rateWaits}, session cache=${doubanFetchStats.cache} net=${doubanFetchStats.network})`,
      );
      await sleep(pause);
      continue;
    }
    c.prepare("INSERT OR REPLACE INTO raw VALUES (?, ?, ?, ?, ?)").run(source, key, res.status, body, new Date().toISOString());
    if (!res.ok) throw new Error(`${source} ${res.status} ${url}`);
    if (source === "douban") {
      doubanRatePauseMs = Math.max(120_000, Math.round(doubanRatePauseMs * 0.85));
      doubanFetchStats.network++;
      logDouban("fetch OK", key, attempt > 0 ? ` (after ${attempt + 1} tries, network #${doubanFetchStats.network})` : ` (network #${doubanFetchStats.network})`);
    }
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
