// List integrity checks for DB + optional built dist/ HTML.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { openDb } from "./db.mjs";
import {
  FESTIVAL_LIST_IDS,
  chartLabel,
  decadeOfYear,
  kjYearFromSection,
  usesYearNav,
} from "./list-charts.mjs";

const FEATURED = { "afi-100-movies": 100 };
/** Custom catalog pages (tile grid); no #show-N articles in list HTML. */
const TILE_LIST_IDS = new Set(["great-directors"]);

function fail(errors, listId, msg) {
  errors.push({ listId, message: msg });
}

export function verifyDbList(db, listId, errors) {
  const list = db.prepare("SELECT id, title FROM lists WHERE id = ?").get(listId);
  if (!list) {
    fail(errors, listId, "missing lists row");
    return;
  }

  const sections = new Set(
    db.prepare("SELECT id FROM list_sections WHERE list_id = ?").all(listId).map((r) => r.id),
  );
  const entries = db
    .prepare(
      `SELECT rank, work_id, section_id, chart, position, note
       FROM list_entries WHERE list_id = ? ORDER BY rank`,
    )
    .all(listId);

  if (!entries.length) {
    fail(errors, listId, "no list_entries");
    return;
  }

  const ranks = entries.map((e) => e.rank);
  const rankSet = new Set(ranks);
  if (rankSet.size !== ranks.length) {
    fail(errors, listId, "duplicate rank values in list_entries");
  }
  if (listId === "criterion-spine") {
    const sorted = [...rankSet].sort((a, b) => a - b);
    if (sorted.some((r) => r < 1)) fail(errors, listId, "criterion spine rank < 1");
  } else {
    const expected = entries.length;
    for (let i = 0; i < expected; i++) {
      if (ranks[i] !== i + 1) {
        fail(
          errors,
          listId,
          `ranks not 1..${expected} consecutive (first gap at index ${i}, got ${ranks[i]})`,
        );
        break;
      }
    }
  }

  const workIds = new Set(db.prepare("SELECT id FROM works").all().map((r) => r.id));
  for (const e of entries) {
    if (!workIds.has(e.work_id)) fail(errors, listId, `rank ${e.rank}: unknown work ${e.work_id}`);
    if (e.section_id && !sections.has(e.section_id)) {
      fail(errors, listId, `rank ${e.rank}: unknown section ${e.section_id}`);
    }
  }

  if (usesYearNav(listId)) {
    const byYear = new Map();
    const byDecade = new Map();
    for (const e of entries) {
      const y = kjYearFromSection(e.section_id);
      if (y == null) fail(errors, listId, `rank ${e.rank}: section ${e.section_id} is not yYYYY`);
      else {
        byYear.set(y, (byYear.get(y) ?? 0) + 1);
        const d = decadeOfYear(y);
        byDecade.set(d, (byDecade.get(d) ?? 0) + 1);
      }
      if (listId === "kinema-junpo-ten") {
        if (e.position == null && !e.note) {
          fail(errors, listId, `rank ${e.rank}: missing position (non-footnote entry)`);
        }
      }
      if (FESTIVAL_LIST_IDS.includes(listId)) {
        if (e.chart !== "won" && e.chart !== "nom") {
          fail(errors, listId, `rank ${e.rank}: chart must be won or nom, got ${e.chart}`);
        }
      }
    }
    for (const [y, n] of byYear) {
      const inSec = entries.filter((e) => kjYearFromSection(e.section_id) === y).length;
      if (inSec !== n) fail(errors, listId, `year ${y} count mismatch`);
    }
    for (const [d, n] of byDecade) {
      const inDec = entries.filter((e) => {
        const y = kjYearFromSection(e.section_id);
        return y != null && decadeOfYear(y) === d;
      }).length;
      if (inDec !== n) fail(errors, listId, `decade ${d} count mismatch`);
    }
  }

  const featured = FEATURED[listId];
  if (featured != null && entries.length < featured) {
    fail(errors, listId, `expected at least ${featured} entries, got ${entries.length}`);
  }
}

function parseArticlesFromHtml(html) {
  const articles = new Map();
  const re =
    /<article[^>]*\bid="show-(\d+)"[^>]*\bdata-rank="(\d+)"[^>]*\bdata-work-id="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const id = Number(m[1]);
    const rank = Number(m[2]);
    const workId = m[3];
    if (articles.has(id)) throw new Error(`duplicate show-${id}`);
    if (id !== rank) throw new Error(`show-${id} data-rank=${rank}`);
    articles.set(rank, workId);
  }
  return articles;
}

function splitMainAndTemplate(html) {
  const marker = 'id="catalog-extra-src"';
  const idx = html.indexOf(marker);
  if (idx < 0) return { main: html, template: "" };
  const tplOpen = html.lastIndexOf("<template", idx);
  const tplClose = html.indexOf("</template>", idx);
  if (tplOpen < 0 || tplClose < 0) return { main: html, template: "" };
  return {
    main: html.slice(0, tplOpen) + html.slice(tplClose + "</template>".length),
    template: html.slice(tplOpen, tplClose + "</template>".length),
  };
}

export function verifyDistList(db, listId, distDir, errors) {
  if (TILE_LIST_IDS.has(listId)) {
    const roots = [
      path.join(distDir, listId, "index.html"),
      path.join(distDir, listId, "films", "index.html"),
    ];
    for (const htmlPath of roots) {
      if (!existsSync(htmlPath)) fail(errors, listId, `missing ${htmlPath.replace(distDir, "")}`);
    }
    return;
  }
  const htmlPath = path.join(distDir, listId, "index.html");
  if (!existsSync(htmlPath)) {
    fail(errors, listId, `missing ${htmlPath} (run npm run build)`);
    return;
  }
  const html = readFileSync(htmlPath, "utf8");
  const { main, template } = splitMainAndTemplate(html);
  let articles;
  let tplArticles;
  try {
    articles = parseArticlesFromHtml(main);
    tplArticles = template ? parseArticlesFromHtml(template) : new Map();
  } catch (e) {
    fail(errors, listId, `HTML parse: ${e.message}`);
    return;
  }

  const entries = db
    .prepare("SELECT rank, work_id FROM list_entries WHERE list_id = ? ORDER BY rank")
    .all(listId);
  const featured = FEATURED[listId] ?? 0;

  for (const e of entries) {
    const inFeatured = featured === 0 || e.rank <= featured;
    const workInHtml = articles.get(e.rank);
    if (inFeatured) {
      if (!workInHtml) fail(errors, listId, `rank ${e.rank}: missing article#show-${e.rank} in HTML`);
      else if (workInHtml !== e.work_id) {
        fail(errors, listId, `rank ${e.rank}: HTML work ${workInHtml} != DB ${e.work_id}`);
      }
    } else {
      const tplWork = tplArticles.get(e.rank);
      if (!tplWork) fail(errors, listId, `rank ${e.rank}: missing in catalog-extra template`);
      else if (tplWork !== e.work_id) {
        fail(errors, listId, `rank ${e.rank}: template work ${tplWork} != DB ${e.work_id}`);
      }
      if (workInHtml) {
        fail(errors, listId, `rank ${e.rank}: catalog-extra should be in <template>, found in main HTML`);
      }
    }
  }

  if (featured > 0 && !template) {
    fail(errors, listId, "missing catalog-extra-src template");
  }

  const expectedInMain = featured > 0 ? featured : entries.length;
  if (articles.size !== expectedInMain) {
    fail(errors, listId, `HTML has ${articles.size} main articles, expected ${expectedInMain}`);
  }
}

/** Every person-page list badge href must resolve to the same work in built HTML. */
export function verifyPersonListLinks(db, distDir, errors) {
  const entriesByListRank = new Map();
  for (const row of db
    .prepare("SELECT list_id, rank, work_id FROM list_entries")
    .all()) {
    entriesByListRank.set(`${row.list_id}\t${row.rank}`, row.work_id);
  }

  const peopleDir = path.join(distDir, "people");
  if (!existsSync(peopleDir)) return;

  const articleCache = new Map();
  function workFor(listId, rank) {
    if (!articleCache.has(listId)) {
      const htmlPath = path.join(distDir, listId, "index.html");
      if (!existsSync(htmlPath)) return undefined;
      const html = readFileSync(htmlPath, "utf8");
      const { main, template } = splitMainAndTemplate(html);
      const mainArticles = parseArticlesFromHtml(main);
      const tplArticles = template ? parseArticlesFromHtml(template) : new Map();
      articleCache.set(listId, { main: mainArticles, tpl: tplArticles });
    }
    const { main, tpl } = articleCache.get(listId);
    return main.get(rank) ?? tpl.get(rank);
  }

  for (const personPath of db
    .prepare(
      `SELECT DISTINCT c.person_id FROM credits c
       JOIN list_entries le ON le.work_id = c.work_id`,
    )
    .all()) {
    const pid = personPath.person_id;
    const page = path.join(peopleDir, String(pid), "index.html");
    if (!existsSync(page)) continue;
    const html = readFileSync(page, "utf8");
    const re = /class="list-badge[^"]*"[^>]*href="\/([^/]+)\/#show-(\d+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const listId = m[1];
      if (TILE_LIST_IDS.has(listId)) continue;
      const rank = Number(m[2]);
      const dbWork = entriesByListRank.get(`${listId}\t${rank}`);
      if (!dbWork) {
        fail(errors, listId, `person ${pid}: badge #show-${rank} not in DB`);
        continue;
      }
      const htmlWork = workFor(listId, rank);
      if (!htmlWork) {
        fail(errors, listId, `person ${pid}: badge #show-${rank} missing on list page`);
      } else if (htmlWork !== dbWork) {
        fail(errors, listId, `person ${pid}: #show-${rank} is ${htmlWork}, badge work ${dbWork}`);
      }
    }
  }
}

export function runListVerify({ distDir } = {}) {
  const db = openDb();
  const errors = [];
  const listIds = db.prepare("SELECT id FROM lists ORDER BY ord").all().map((r) => r.id);
  for (const id of listIds) verifyDbList(db, id, errors);
  if (distDir) {
    for (const id of listIds) verifyDistList(db, id, distDir, errors);
    verifyPersonListLinks(db, distDir, errors);
  }
  db.close();
  return { ok: errors.length === 0, errors, listIds };
}
