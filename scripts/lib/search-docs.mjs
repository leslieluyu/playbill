/** Build search document rows from SQLite (shared by FTS index + legacy export). */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { yearsLabel } from "./db.mjs";
import { chartLabel } from "./list-charts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function looseEn(s) {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function loadGdSlugByEn() {
  const p = path.join(ROOT, "db/seed/great-directors-directors.json");
  try {
    const dirs = JSON.parse(readFileSync(p, "utf8")).directors ?? [];
    const m = new Map();
    for (const d of dirs) m.set(looseEn(d.en), d.slug);
    return m;
  } catch {
    return new Map();
  }
}

function joinParts(parts) {
  return parts.filter(Boolean).join("\n");
}

/** @param {import("node:sqlite").DatabaseSync} db */
export function buildSearchDocs(db) {
  const gdSlugs = loadGdSlugByEn();

  const aliasesByWork = new Map();
  for (const { work_id, alias } of db.prepare("SELECT work_id, alias FROM work_aliases ORDER BY ord").all()) {
    const a = aliasesByWork.get(work_id) ?? [];
    a.push(alias);
    aliasesByWork.set(work_id, a);
  }

  const genresByWork = new Map();
  for (const row of db
    .prepare("SELECT work_id, name_zh, name_en FROM work_genres ORDER BY genre_id")
    .all()) {
    const g = genresByWork.get(row.work_id) ?? [];
    g.push(row.name_zh || row.name_en);
    genresByWork.set(row.work_id, g);
  }

  const listTagsByWork = new Map();
  const listStmt = db.prepare(
    `SELECT le.work_id, le.list_id, le.chart, le.section_id, l.title
     FROM list_entries le JOIN lists l ON l.id = le.list_id`,
  );
  for (const row of listStmt.all()) {
    const tags = listTagsByWork.get(row.work_id) ?? [];
    tags.push(row.title);
    const c = chartLabel(row.chart, row.list_id);
    if (c) tags.push(c.zh, c.en);
    if (row.section_id?.startsWith("y")) tags.push(row.section_id.slice(1));
    listTagsByWork.set(row.work_id, tags);
  }

  const creditsByWork = new Map();
  for (const row of db
    .prepare(
      `SELECT c.work_id, c.role, p.zh, p.en FROM credits c JOIN people p ON p.id = c.person_id ORDER BY c.ord`,
    )
    .all()) {
    const list = creditsByWork.get(row.work_id) ?? [];
    list.push(`${row.zh ?? ""} ${row.en}`.trim());
    creditsByWork.set(row.work_id, list);
  }

  const docs = [];

  for (const w of db.prepare("SELECT * FROM works ORDER BY id").all()) {
    const ed = db.prepare("SELECT plot, plot_en, playbill, playbill_en FROM editorial WHERE work_id = ?").get(w.id);
    const aliases = aliasesByWork.get(w.id) ?? [];
    const genres = genresByWork.get(w.id) ?? [];
    const listTags = listTagsByWork.get(w.id) ?? [];
    const people = creditsByWork.get(w.id) ?? [];
    const kind = w.kind === "tv" ? "tv" : "movie";
    const seg = kind === "tv" ? "tvs" : "movies";
    const titleZh = w.zh ?? "";
    const titleEn = w.en ?? "";
    const tagsLabel = [...new Set([...genres, ...listTags])].slice(0, 12).join(" · ");
    const tags = joinParts([...genres, ...listTags, ...aliases]);
    const body = joinParts([
      titleZh,
      titleEn,
      w.original,
      ...aliases,
      ...people,
      ed?.plot,
      ed?.plot_en,
      ed?.playbill,
      ed?.playbill_en,
      w.place,
      w.form,
    ]);

    docs.push({
      id: `work:${w.id}`,
      type: kind,
      href: `/${seg}/${encodeURIComponent(w.id)}/`,
      titleZh,
      titleEn,
      subtitle: yearsLabel(w),
      tagsLabel,
      tags,
      body,
    });
  }

  const directorIds = new Set(
    db.prepare("SELECT DISTINCT person_id FROM credits WHERE role IN ('director', 'creator')").all().map((r) => r.person_id),
  );

  const workCountByPerson = new Map();
  for (const { person_id, n } of db
    .prepare("SELECT person_id, COUNT(DISTINCT work_id) AS n FROM credits GROUP BY person_id")
    .all()) {
    workCountByPerson.set(person_id, n);
  }

  for (const p of db.prepare("SELECT id, zh, en, bio_zh, bio_en, tmdb_id FROM people ORDER BY id").all()) {
    const isDirector = directorIds.has(p.id);
    const nWorks = workCountByPerson.get(p.id) ?? 0;
    const gdSlug = gdSlugs.get(looseEn(p.en));
    const href = gdSlug != null ? `/great-directors/${gdSlug}/` : `/people/${p.id}/`;
    const tags = joinParts([isDirector ? "导演 director" : "", gdSlug ? "TSPDT 大导演" : ""]);
    const tagsLabel = [
      isDirector ? "导演" : "人物",
      gdSlug ? "TSPDT" : "",
      nWorks ? `${nWorks} 部关联` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const personKey = p.tmdb_id ? `tmdb:${p.tmdb_id}` : `person:${p.id}`;

    docs.push({
      id: `person:${p.id}`,
      personKey,
      type: isDirector ? "director" : "person",
      href,
      titleZh: p.zh ?? "",
      titleEn: p.en ?? "",
      subtitle: isDirector ? `导演 · ${nWorks} 部关联` : `${nWorks} 部关联`,
      tagsLabel,
      tags,
      body: joinParts([p.zh, p.en, p.bio_zh, p.bio_en]),
    });
  }

  return docs;
}
