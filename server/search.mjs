import { DatabaseSync } from "node:sqlite";
import { buildFtsMatch, buildFtsMatchTitleTags, isSingleHanQuery } from "../scripts/lib/search-fts.mjs";

const TYPE_ORDER = ["movie", "tv", "director", "person"];
const TYPE_RANK = Object.fromEntries(TYPE_ORDER.map((t, i) => [t, i]));

function relatedWorkCount(subtitle) {
  const m = String(subtitle ?? "").match(/(\d+)\s*部关联/);
  return m ? Number(m[1]) : 0;
}

/** bm25 favors tiny title_tok blobs; boost title prefix + directors with more credits. */
function rankSingleHanHit(hit, han) {
  const zh = hit.titleZh ?? "";
  let s = 0;
  if (zh.startsWith(han)) s += 10_000;
  else if (zh.includes(han)) s += 500;
  if (hit.type === "director") s += 800;
  else if (hit.type === "movie" || hit.type === "tv") s += 400;
  s += Math.min(relatedWorkCount(hit.subtitle), 40) * 10;
  s -= TYPE_RANK[hit.type] ?? 9;
  return s;
}

/**
 * @param {DatabaseSync} db
 * @param {string} query
 * @param {number} limit
 */
export function searchCatalog(db, query, limit = 24) {
  const singleHan = isSingleHanQuery(query);
  const match = singleHan ? buildFtsMatchTitleTags(query) : buildFtsMatch(query);
  if (!match) return [];

  const fetchLimit = singleHan ? 160 : Math.min(limit * 3, 80);

  let rows;
  try {
    rows = db
      .prepare(
        `SELECT doc_id, type, href, title_zh, title_en, subtitle, tags_label, person_key,
                bm25(search_fts, 10.0, 5.0, 1.0) AS rank
         FROM search_fts
         WHERE search_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(match, fetchLimit);
  } catch {
    return [];
  }

  const seenHref = new Set();
  const seenPerson = new Set();
  const hits = [];
  for (const r of rows) {
    if (seenHref.has(r.href)) continue;
    if ((r.type === "person" || r.type === "director") && r.person_key) {
      if (seenPerson.has(r.person_key)) continue;
      seenPerson.add(r.person_key);
    }
    seenHref.add(r.href);
    hits.push({
      type: r.type,
      href: r.href,
      titleZh: r.title_zh ?? "",
      titleEn: r.title_en ?? "",
      subtitle: r.subtitle ?? "",
      tagsLabel: r.tags_label ?? "",
      score: r.rank,
    });
  }

  if (singleHan) {
    const han = query.trim();
    hits.sort(
      (a, b) =>
        rankSingleHanHit(b, han) - rankSingleHanHit(a, han) || a.score - b.score,
    );
  }

  return hits.slice(0, limit);
}

export { TYPE_ORDER };
