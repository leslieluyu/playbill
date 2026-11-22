import { tx } from "./db.mjs";

/** @param {import("node:sqlite").DatabaseSync} db */
export function mergePersonInto(db, fromId, toId) {
  if (fromId === toId) throw new Error("from and to must differ");
  const from = db.prepare("SELECT * FROM people WHERE id = ?").get(fromId);
  const to = db.prepare("SELECT * FROM people WHERE id = ?").get(toId);
  if (!from) throw new Error(`missing person ${fromId}`);
  if (!to) throw new Error(`missing person ${toId}`);

  tx(db, () => {
    const keysOnKeep = new Set(
      db
        .prepare("SELECT work_id, role, ord FROM credits WHERE person_id = ?")
        .all(toId)
        .map((r) => `${r.work_id}\0${r.role}\0${r.ord}`),
    );
    for (const c of db
      .prepare("SELECT rowid, work_id, role, ord FROM credits WHERE person_id = ?")
      .all(fromId)) {
      const key = `${c.work_id}\0${c.role}\0${c.ord}`;
      if (keysOnKeep.has(key)) {
        db.prepare("DELETE FROM credits WHERE rowid = ?").run(c.rowid);
      } else {
        db.prepare("UPDATE credits SET person_id = ? WHERE rowid = ?").run(toId, c.rowid);
        keysOnKeep.add(key);
      }
    }

    db.prepare("UPDATE person_awards SET person_id = ? WHERE person_id = ?").run(toId, fromId);
    db.prepare("UPDATE people SET douban_id = NULL, tmdb_id = NULL WHERE id = ?").run(fromId);

    db.prepare(
      `UPDATE people SET
         tmdb_id = coalesce(tmdb_id, ?),
         douban_id = coalesce(douban_id, ?),
         zh = coalesce(zh, ?),
         en = coalesce(en, ?),
         photo = coalesce(photo, ?),
         bio_zh = CASE
           WHEN bio_zh IS NULL OR length(bio_zh) < length(coalesce(?, '')) THEN coalesce(?, bio_zh)
           ELSE bio_zh
         END,
         bio_en = CASE
           WHEN bio_en IS NULL OR length(bio_en) < length(coalesce(?, '')) THEN coalesce(?, bio_en)
           ELSE bio_en
         END
       WHERE id = ?`,
    ).run(
      from.tmdb_id,
      from.douban_id,
      from.zh,
      from.en,
      from.photo,
      from.bio_zh,
      from.bio_zh,
      from.bio_en,
      from.bio_en,
      toId,
    );

    db.prepare("DELETE FROM people WHERE id = ?").run(fromId);
  });
}
