// Read-only completeness inventory over playbill.db (+ poster/photo files on disk).
// Usage: node --no-warnings scripts/lib/coverage.mjs   (prints JSON)
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openDb, DB_PATH } from "./db.mjs";

// Walk up from this file (or cwd) so Astro prerender bundles still find the repo root.
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
  return process.cwd();
}
const ROOT = findRoot();
const PUBLIC = path.join(ROOT, "public");
const MISSING_CAP = 200;

const LIST_METRICS = [
  { id: "hook", label: "看点" },
  { id: "plot", label: "剧情" },
  { id: "playbill", label: "场刊" },
  { id: "poster", label: "海报" },
  { id: "imdb", label: "IMDb" },
  { id: "douban", label: "豆瓣" },
];

function publicExists(urlPath) {
  if (!urlPath || !urlPath.startsWith("/")) return false;
  return existsSync(path.join(PUBLIC, urlPath.slice(1)));
}

function workTitle(w) {
  return (w.zh || w.en || w.id).trim();
}

function personTitle(p) {
  return (p.zh || p.en || String(p.id)).trim();
}

function capMissing(items) {
  return {
    missing: items.slice(0, MISSING_CAP),
    missingTotal: items.length,
  };
}

function coverage(id, label, scope, total, done, missingItems, extra = {}) {
  const { missing, missingTotal } = capMissing(missingItems);
  return { id, label, scope, total, done, missing, missingTotal, ...extra };
}

function listEntries(db, listId) {
  return db
    .prepare(
      `SELECT le.rank, w.id, w.zh, w.en, w.poster
       FROM list_entries le
       JOIN works w ON w.id = le.work_id
       WHERE le.list_id = ?
       ORDER BY le.rank`,
    )
    .all(listId);
}

function hookCoverage(db, list) {
  const entries = listEntries(db, list.id);
  const hooks = new Map(
    db
      .prepare("SELECT work_id, hook, hook_en FROM list_highlights WHERE list_id = ?")
      .all(list.id)
      .map((h) => [h.work_id, h]),
  );
  const missing = [];
  let done = 0;
  for (const e of entries) {
    const h = hooks.get(e.id);
    const hasZh = Boolean(h?.hook);
    const hasEn = Boolean(h?.hook_en);
    if (hasZh && hasEn) {
      done++;
      continue;
    }
    const gaps = !h ? ["无记录"] : [...(!hasZh ? ["缺中文"] : []), ...(!hasEn ? ["缺英文"] : [])];
    missing.push({
      kind: "work",
      id: e.id,
      title: workTitle(e),
      rank: e.rank,
      detail: gaps.join(" · "),
      href: `/${list.id}/#show-${e.rank}`,
    });
  }
  return coverage("hook", "看点", "list", entries.length, done, missing, { listId: list.id, listTitle: list.title });
}

function editorialCoverage(db, list, field) {
  const id = field === "plot" ? "plot" : "playbill";
  const label = field === "plot" ? "剧情" : "场刊";
  const entries = listEntries(db, list.id);
  const rows = new Map(
    db
      .prepare(
        `SELECT e.work_id, e.reviewed, e.plot, e.plot_en, e.playbill, e.playbill_en
         FROM editorial e
         JOIN list_entries le ON le.work_id = e.work_id
         WHERE le.list_id = ?`,
      )
      .all(list.id)
      .map((r) => [r.work_id, r]),
  );
  const missing = [];
  let done = 0;
  for (const e of entries) {
    const ed = rows.get(e.id);
    const reviewed = ed?.reviewed === 1;
    const ok =
      field === "plot"
        ? reviewed && Boolean(ed?.plot || ed?.plot_en)
        : reviewed && Boolean(ed?.playbill || ed?.playbill_en);
    if (ok) {
      done++;
      continue;
    }
    const gaps = [];
    if (!ed) gaps.push("无 editorial");
    else if (!reviewed) gaps.push("未审 reviewed=0");
    else if (field === "plot") gaps.push("缺剧情");
    else gaps.push("缺场刊");
    missing.push({
      kind: "work",
      id: e.id,
      title: workTitle(e),
      rank: e.rank,
      detail: gaps.join(" · "),
      href: `/${list.id}/#show-${e.rank}`,
    });
  }
  return coverage(id, label, "list", entries.length, done, missing, { listId: list.id, listTitle: list.title });
}

function posterCoverage(db, list) {
  const entries = listEntries(db, list.id);
  const missing = [];
  let done = 0;
  for (const e of entries) {
    if (e.poster && publicExists(e.poster)) {
      done++;
      continue;
    }
    missing.push({
      kind: "work",
      id: e.id,
      title: workTitle(e),
      rank: e.rank,
      detail: e.poster ? "文件缺失" : "无 poster 路径",
      href: `/${list.id}/#show-${e.rank}`,
    });
  }
  return coverage("poster", "海报", "list", entries.length, done, missing, { listId: list.id, listTitle: list.title });
}

function ratingCoverage(db, list, source) {
  const id = source;
  const label = source === "imdb" ? "IMDb" : "豆瓣";
  const entries = listEntries(db, list.id);
  const rated = new Set(
    db
      .prepare(
        `SELECT DISTINCT r.work_id FROM ratings r
         JOIN list_entries le ON le.work_id = r.work_id
         WHERE le.list_id = ? AND r.source = ?`,
      )
      .all(list.id, source)
      .map((r) => r.work_id),
  );
  const missing = [];
  let done = 0;
  for (const e of entries) {
    if (rated.has(e.id)) {
      done++;
      continue;
    }
    missing.push({
      kind: "work",
      id: e.id,
      title: workTitle(e),
      rank: e.rank,
      detail: `无 ${label} 评分`,
      href: `/${list.id}/#show-${e.rank}`,
    });
  }
  return coverage(id, label, "list", entries.length, done, missing, { listId: list.id, listTitle: list.title });
}

function creditedPeople(db) {
  return db
    .prepare(
      `SELECT DISTINCT p.id, p.zh, p.en, p.photo
       FROM list_entries le
       JOIN credits c ON c.work_id = le.work_id
       JOIN people p ON p.id = c.person_id
       ORDER BY p.id`,
    )
    .all();
}

function personPhotoCoverage(db) {
  const people = creditedPeople(db);
  const missing = [];
  let done = 0;
  for (const p of people) {
    if (p.photo && publicExists(p.photo)) {
      done++;
      continue;
    }
    missing.push({
      kind: "person",
      id: String(p.id),
      title: personTitle(p),
      detail: p.photo ? "文件缺失" : "无 photo 路径",
      href: `/people/${p.id}/`,
    });
  }
  return coverage("person-photo", "人物照片", "catalog", people.length, done, missing);
}

function personAwardsCoverage(db) {
  const people = creditedPeople(db);
  const awarded = new Set(
    db.prepare("SELECT DISTINCT person_id FROM person_awards").all().map((r) => r.person_id),
  );
  const missing = [];
  let done = 0;
  for (const p of people) {
    if (awarded.has(p.id)) {
      done++;
      continue;
    }
    missing.push({
      kind: "person",
      id: String(p.id),
      title: personTitle(p),
      detail: "无获奖记录",
      href: `/people/${p.id}/`,
    });
  }
  return coverage("person-awards", "人物获奖", "catalog", people.length, done, missing);
}

/** Full inventory snapshot. */
export function collectCoverage(db = openDb()) {
  const lists = db.prepare("SELECT id, title, ord FROM lists ORDER BY ord").all();
  const listReports = lists.map((list) => {
    const entryCount = db.prepare("SELECT count(*) c FROM list_entries WHERE list_id = ?").get(list.id).c;
    const metrics = {
      hook: hookCoverage(db, list),
      plot: editorialCoverage(db, list, "plot"),
      playbill: editorialCoverage(db, list, "playbill"),
      poster: posterCoverage(db, list),
      imdb: ratingCoverage(db, list, "imdb"),
      douban: ratingCoverage(db, list, "douban"),
    };
    return { id: list.id, title: list.title, ord: list.ord, entryCount, metrics };
  });
  const people = {
    photo: personPhotoCoverage(db),
    awards: personAwardsCoverage(db),
  };
  return {
    generatedAt: new Date().toISOString(),
    dbPath: DB_PATH,
    listMetrics: LIST_METRICS,
    lists: listReports,
    people,
  };
}

export { LIST_METRICS, MISSING_CAP };

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const db = openDb();
  try {
    console.log(JSON.stringify(collectCoverage(db), null, 2));
  } finally {
    db.close();
  }
}
