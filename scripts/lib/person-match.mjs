/** Shared person name matching for seed, douban, TMDB, dedupe. */

export function loosePersonName(s) {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

/** "Zhang Fengyi" and "Fengyi Zhang" → same key. */
export function personNameTokenKey(en) {
  const parts = (en ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.sort().join("");
}

export function personScore(row) {
  return (
    (row.photo ? 100 : 0) +
    (row.tmdb_id ? 40 : 0) +
    Math.min((row.bio_zh ?? "").length, 400) / 4 +
    (row.bio_zh && /克\/美国|^.{1,2}\//.test(row.bio_zh) ? -500 : 0)
  );
}

export function pickBestPerson(rows) {
  return [...rows].sort((a, b) => personScore(b) - personScore(a))[0];
}

/** Same real person; false for homonyms (e.g. actor vs director Steve McQueen). */
export function shouldMergePeople(a, b) {
  if (a.id === b.id) return false;
  if (a.tmdb_id && b.tmdb_id && String(a.tmdb_id) !== String(b.tmdb_id)) return false;

  const looseA = loosePersonName(a.en);
  const looseB = loosePersonName(b.en);
  if (looseA && looseA === looseB) return true;

  const tokA = personNameTokenKey(a.en);
  const tokB = personNameTokenKey(b.en);
  if (tokA && tokA === tokB) return true;

  const zhA = (a.zh ?? "").trim();
  const zhB = (b.zh ?? "").trim();
  if (zhA.length >= 2 && zhA === zhB) {
    if (!looseA || !looseB) return true;
    if (looseA === looseB || tokA === tokB) return true;
  }

  return false;
}
