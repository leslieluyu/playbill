// Canonical work ids: prefer TMDB, else Douban. Hyphens only (safe for poster filenames).
//   tmdb-m-{id}   movie
//   tmdb-tv-{id}  TV
//   douban-{id}   when TMDB is missing
//   local-…       provisional until one of the above is known
import { rename as fsRename, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const POSTER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/posters");

const WORK_ID_COLS = [
  ["work_aliases", "work_id"],
  ["credits", "work_id"],
  ["editorial", "work_id"],
  ["douban_subjects", "work_id"],
  ["ratings", "work_id"],
  ["list_entries", "work_id"],
  ["list_highlights", "work_id"],
];

export const workIdFromTmdb = (kind, tmdbId) =>
  kind === "tv" ? `tmdb-tv-${tmdbId}` : `tmdb-m-${tmdbId}`;

export const workIdFromDouban = (doubanId) => `douban-${doubanId}`;

export const isTmdbWorkId = (id) => /^tmdb-(m|tv)-\d+$/.test(id);
export const isDoubanWorkId = (id) => /^douban-\d+$/.test(id);
export const isLocalWorkId = (id) => id.startsWith("local-");

/** Pick the stable id we want this work to have, given what we know. */
export function preferredWorkId({ kind, tmdbId, doubanId, currentId }) {
  if (tmdbId) return workIdFromTmdb(kind, tmdbId);
  if (doubanId) return workIdFromDouban(doubanId);
  return currentId;
}

/**
 * Move current → preferred when that is an upgrade (local/legacy/douban → tmdb,
 * or local/legacy → douban). Never replace a TMDB id with a Douban id.
 */
export function shouldAdoptWorkId(current, preferred) {
  if (!preferred || current === preferred) return false;
  if (isTmdbWorkId(current) && !isTmdbWorkId(preferred)) return false;
  return true;
}

/** Rewrites works.id and every work_id foreign key. Caller should rename the poster file. */
export function renameWork(db, from, to) {
  if (from === to) return false;
  if (db.prepare("SELECT 1 FROM works WHERE id = ?").get(to)) {
    throw new Error(`work id already exists: ${to} (from ${from})`);
  }
  const row = db.prepare("SELECT * FROM works WHERE id = ?").get(from);
  if (!row) throw new Error(`work not found: ${from}`);
  const next = {
    ...row,
    id: to,
    poster: row.poster ? `/posters/${to}.jpg` : null,
  };
  const cols = Object.keys(next);
  // Insert the new parent first so FK updates succeed with foreign_keys ON.
  db.prepare(`INSERT INTO works (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(
    ...cols.map((c) => next[c]),
  );
  for (const [table, col] of WORK_ID_COLS) {
    db.prepare(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`).run(to, from);
  }
  db.prepare("DELETE FROM works WHERE id = ?").run(from);
  return true;
}

const exists = (f) => access(f).then(() => true, () => false);

export async function renamePosterFile(fromId, toId) {
  if (fromId === toId) return;
  const from = path.join(POSTER_DIR, `${fromId}.jpg`);
  const to = path.join(POSTER_DIR, `${toId}.jpg`);
  if (!(await exists(from))) return;
  if (await exists(to)) return;
  await fsRename(from, to);
}
