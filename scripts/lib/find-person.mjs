import { loosePersonName, personNameTokenKey, pickBestPerson } from "./person-match.mjs";

/** @param {import("node:sqlite").DatabaseSync} db */
export function findExistingPerson(db, { en, zh, tmdbId, doubanId }) {
  if (doubanId != null) {
    const row = db.prepare("SELECT id FROM people WHERE douban_id = ?").get(String(doubanId));
    if (row) return row.id;
  }
  if (tmdbId != null) {
    const row = db.prepare("SELECT id FROM people WHERE tmdb_id = ?").get(tmdbId);
    if (row) return row.id;
  }
  if (en) {
    const exact = db.prepare("SELECT id, en, zh, photo, bio_zh, tmdb_id FROM people WHERE en = ?").get(en);
    if (exact) return exact.id;
    const key = loosePersonName(en);
    const tok = personNameTokenKey(en);
    const all = db.prepare("SELECT id, en, zh, photo, bio_zh, tmdb_id FROM people").all();
    const hits = all.filter((p) => {
      if (tmdbId != null && p.tmdb_id && p.tmdb_id !== tmdbId) return false;
      return loosePersonName(p.en) === key || (tok && personNameTokenKey(p.en) === tok);
    });
    if (hits.length) return pickBestPerson(hits).id;
  }
  if (zh && zh.trim().length >= 2) {
    const hits = db
      .prepare("SELECT id, en, zh, photo, bio_zh, tmdb_id FROM people WHERE zh = ?")
      .all(zh.trim());
    if (hits.length === 1) return hits[0].id;
    if (hits.length > 1 && en) {
      const filtered = hits.filter((p) => !p.tmdb_id || !tmdbId || p.tmdb_id === tmdbId);
      if (filtered.length) return pickBestPerson(filtered).id;
    }
  }
  return null;
}

/** Prefer existing row; optional zh backfill on match. */
export function ensurePerson(db, { en, zh, tmdbId, doubanId }) {
  const existing = findExistingPerson(db, { en, zh, tmdbId, doubanId });
  if (existing != null) {
    if (zh) db.prepare("UPDATE people SET zh = coalesce(zh, ?) WHERE id = ?").run(zh, existing);
    if (doubanId != null) {
      db.prepare("UPDATE people SET douban_id = coalesce(douban_id, ?) WHERE id = ?").run(String(doubanId), existing);
    }
    if (tmdbId != null) {
      db.prepare("UPDATE people SET tmdb_id = coalesce(tmdb_id, ?) WHERE id = ?").run(tmdbId, existing);
    }
    return existing;
  }
  const r = db
    .prepare("INSERT INTO people (en, zh, tmdb_id, douban_id) VALUES (?, ?, ?, ?)")
    .run(en ?? "", zh ?? null, tmdbId ?? null, doubanId != null ? String(doubanId) : null);
  return Number(r.lastInsertRowid);
}
