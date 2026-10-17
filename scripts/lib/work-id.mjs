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
  ["work_genres", "work_id"],
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

/**
 * Point every FK from `from` at `to`, then delete `from`.
 * Used when a provisional local row matches a work that already has the canonical id.
 * list_entries / highlights that would duplicate (same list_id+rank / list_id+work) are dropped.
 */
export function mergeWorkInto(db, from, to) {
  if (from === to) return false;
  if (!db.prepare("SELECT 1 FROM works WHERE id = ?").get(from)) throw new Error(`work not found: ${from}`);
  if (!db.prepare("SELECT 1 FROM works WHERE id = ?").get(to)) throw new Error(`work not found: ${to}`);

  // list_entries: same list may already hold `to` at another rank — drop the local row.
  const listsWithTo = db.prepare("SELECT list_id FROM list_entries WHERE work_id = ?").all(to).map((r) => r.list_id);
  for (const listId of listsWithTo) {
    db.prepare("DELETE FROM list_entries WHERE work_id = ? AND list_id = ?").run(from, listId);
  }
  db.prepare("UPDATE list_entries SET work_id = ? WHERE work_id = ?").run(to, from);

  const highlightLists = db.prepare("SELECT list_id FROM list_highlights WHERE work_id = ?").all(to).map((r) => r.list_id);
  for (const listId of highlightLists) {
    db.prepare("DELETE FROM list_highlights WHERE work_id = ? AND list_id = ?").run(from, listId);
  }
  db.prepare("UPDATE list_highlights SET work_id = ? WHERE work_id = ?").run(to, from);

  // 1:1 tables: keep the canonical row if both exist.
  for (const table of ["editorial", "work_aliases", "work_genres", "credits", "douban_subjects", "ratings"]) {
    if (table === "editorial") {
      db.prepare("DELETE FROM editorial WHERE work_id = ? AND EXISTS (SELECT 1 FROM editorial WHERE work_id = ?)").run(from, to);
      db.prepare("UPDATE editorial SET work_id = ? WHERE work_id = ?").run(to, from);
    } else if (table === "work_aliases") {
      db.prepare("DELETE FROM work_aliases WHERE work_id = ?").run(from);
    } else if (table === "work_genres") {
      db.prepare("DELETE FROM work_genres WHERE work_id = ?").run(from);
    } else if (table === "credits") {
      db.prepare("DELETE FROM credits WHERE work_id = ?").run(from);
    } else if (table === "douban_subjects") {
      db.prepare("UPDATE douban_subjects SET work_id = ? WHERE work_id = ?").run(to, from);
    } else if (table === "ratings") {
      db.prepare(
        `DELETE FROM ratings WHERE work_id = ? AND source IN (SELECT source FROM ratings WHERE work_id = ?)`,
      ).run(from, to);
      db.prepare("UPDATE ratings SET work_id = ? WHERE work_id = ?").run(to, from);
    }
  }

  db.prepare("UPDATE person_awards SET work_id = ? WHERE work_id = ?").run(to, from);
  db.prepare("DELETE FROM works WHERE id = ?").run(from);
  return true;
}

/** Rewrites works.id and every work_id foreign key. Caller should rename the poster file. */
export function renameWork(db, from, to) {
  if (from === to) return false;
  if (db.prepare("SELECT 1 FROM works WHERE id = ?").get(to)) {
    return mergeWorkInto(db, from, to);
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
