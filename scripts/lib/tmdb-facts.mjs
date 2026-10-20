/** TMDB overview + credits; optional EN→ZH translation and Wikipedia fallback. */

import { wikipediaPlot } from "./wikipedia.mjs";

const han = /\p{Script=Han}/u;

export const COUNTRIES = {
  US: "美国", GB: "英国", FR: "法国", DE: "德国", IT: "意大利", ES: "西班牙", JP: "日本", KR: "韩国", CN: "中国大陆",
  HK: "中国香港", TW: "中国台湾", CA: "加拿大", AU: "澳大利亚", NZ: "新西兰", IE: "爱尔兰", MX: "墨西哥", BR: "巴西",
  AR: "阿根廷", IR: "伊朗", IN: "印度", SE: "瑞典", DK: "丹麦", NO: "挪威", FI: "芬兰", PL: "波兰", AT: "奥地利",
  BE: "比利时", NL: "荷兰", CH: "瑞士", RU: "俄罗斯", RO: "罗马尼亚", HU: "匈牙利", CZ: "捷克", IL: "以色列",
  TH: "泰国", ZA: "南非", CL: "智利", CO: "哥伦比亚", TR: "土耳其", GR: "希腊", PT: "葡萄牙", ID: "印度尼西亚",
  SU: "苏联", XC: "捷克斯洛伐克", YU: "南斯拉夫", XG: "东德", PH: "菲律宾", LV: "拉脱维亚", DZ: "阿尔及利亚",
  SN: "塞内加尔", QA: "卡塔尔", ET: "埃塞俄比亚", NG: "尼日利亚", JM: "牙买加", EG: "埃及", CU: "古巴",
  CM: "喀麦隆", MK: "北马其顿", TN: "突尼斯", GT: "危地马拉", BD: "孟加拉国", AO: "安哥拉",
};

export function saveGenres(db, workId, enGenres, zhGenres) {
  const zhById = new Map((zhGenres ?? []).map((g) => [g.id, g.name]));
  db.prepare("DELETE FROM work_genres WHERE work_id = ?").run(workId);
  const insert = db.prepare("INSERT INTO work_genres (work_id, genre_id, name_zh, name_en) VALUES (?, ?, ?, ?)");
  for (const g of enGenres ?? []) {
    if (!g?.id || !g.name) continue;
    insert.run(workId, g.id, zhById.get(g.id) || g.name, g.name);
  }
}

function savePlot(db, workId, plotZh, plotEn) {
  if (!plotZh && !plotEn) return false;
  const ed = db.prepare("SELECT plot, plot_en, reviewed FROM editorial WHERE work_id = ?").get(workId);
  if (!ed) {
    db.prepare("INSERT INTO editorial (work_id, plot, plot_en, reviewed) VALUES (?, ?, ?, 1)").run(
      workId,
      plotZh || null,
      plotEn || null,
    );
    return true;
  }
  if (ed.reviewed && ed.plot && ed.plot_en) return false;
  db.prepare(
    `UPDATE editorial SET
       plot = coalesce(nullif(plot, ''), ?),
       plot_en = coalesce(nullif(plot_en, ''), ?),
       reviewed = CASE WHEN reviewed = 1 THEN 1 ELSE 1 END
     WHERE work_id = ?`,
  ).run(plotZh || null, plotEn || null, workId);
  return true;
}

export async function resolveOverviews(w, d, zhDetail, { translate, useWiki = true }) {
  let overviewEn = (d.overview || "").trim();
  let overviewZh = (zhDetail?.overview || "").trim();
  if (!overviewEn && useWiki) {
    overviewEn = (await wikipediaPlot(w, { lang: "en" })) || "";
  }
  if (overviewZh && han.test(overviewZh)) {
    // keep TMDB zh
  } else if (!overviewZh && overviewEn && translate) {
    try {
      overviewZh = await translate(overviewEn.slice(0, 1200));
    } catch {
      overviewZh = "";
    }
  }
  if (!overviewZh && useWiki && w.zh) {
    overviewZh = (await wikipediaPlot(w, { lang: "zh" })) || "";
  }
  return { overviewZh: overviewZh?.trim() || null, overviewEn: overviewEn?.trim() || null };
}

export async function fillCreditsIfEmpty(db, w, tmdb, tmdbId) {
  if (db.prepare("SELECT 1 FROM credits WHERE work_id = ?").get(w.id)) return false;
  const person = (p) => {
    const row = db.prepare("SELECT id FROM people WHERE tmdb_id = ?").get(p.id);
    if (row) return row.id;
    return Number(db.prepare("INSERT INTO people (en, tmdb_id) VALUES (?, ?)").run(p.name, p.id).lastInsertRowid);
  };
  if (w.kind === "movie") {
    const { cast, crew } = await tmdb(`/movie/${tmdbId}/credits`);
    crew.filter((c) => c.job === "Director").slice(0, 2).forEach((p, i) =>
      db.prepare("INSERT INTO credits VALUES (?, 'director', ?, ?)").run(w.id, i, person(p)),
    );
    cast.slice(0, 6).forEach((p, i) => db.prepare("INSERT INTO credits VALUES (?, 'cast', ?, ?)").run(w.id, i, person(p)));
    return true;
  }
  const detail = await tmdb(`/tv/${tmdbId}`);
  const { cast, crew } = await tmdb(`/tv/${tmdbId}/credits`);
  const creators = (detail.created_by?.length ? detail.created_by : crew.filter((c) => c.job === "Creator" || c.job === "Director")).slice(0, 2);
  creators.forEach((p, i) => db.prepare("INSERT INTO credits VALUES (?, 'creator', ?, ?)").run(w.id, i, person(p)));
  cast.slice(0, 6).forEach((p, i) => db.prepare("INSERT INTO credits VALUES (?, 'cast', ?, ?)").run(w.id, i, person(p)));
  return true;
}

/** Fills zh title, place, genres, plot (TMDB → translate → Wikipedia), and credits. */
export async function fillWorkFacts(db, w, d, { tmdb, translate, useWiki = true, credits = true } = {}) {
  const sets = {};
  const zh = await tmdb(`/${w.kind}/${d.id}`, { language: "zh-CN" });
  if (!w.zh) {
    const title = zh.title ?? zh.name;
    if (title && han.test(title)) sets.zh = title;
  }
  if (!w.place) {
    const codes = d.origin_country?.length ? d.origin_country : (d.production_countries ?? []).map((c) => c.iso_3166_1);
    const names = [...new Set(codes.map((c) => COUNTRIES[c] ?? c))].slice(0, 2);
    if (names.length) sets.place = names.join("、");
  }
  if (!w.form && w.kind === "movie") {
    const genres = (d.genres ?? []).map((g) => g.id);
    sets.form = genres.includes(99) ? "纪录片" : genres.includes(16) ? "动画" : "电影";
  }
  for (const [k, v] of Object.entries(sets)) db.prepare(`UPDATE works SET ${k} = ? WHERE id = ?`).run(v, w.id);
  saveGenres(db, w.id, d.genres, zh.genres);

  const { overviewZh, overviewEn } = await resolveOverviews(w, d, zh, { translate, useWiki });
  const plotSaved = savePlot(db, w.id, overviewZh, overviewEn);

  let creditsSaved = false;
  if (credits) creditsSaved = await fillCreditsIfEmpty(db, w, tmdb, d.id);

  return { plotSaved, creditsSaved, overviewZh, overviewEn };
}

export function workNeedsFacts(db, workId) {
  const hasPlot = db
    .prepare("SELECT 1 FROM editorial WHERE work_id = ? AND plot IS NOT NULL AND trim(plot) != ''")
    .get(workId);
  const hasCredits = db.prepare("SELECT 1 FROM credits WHERE work_id = ?").get(workId);
  return { needsPlot: !hasPlot, needsCredits: !hasCredits };
}
