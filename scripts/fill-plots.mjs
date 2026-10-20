#!/usr/bin/env node
// Backfill 剧情 (ZH) + plot_en from TMDB; translate EN→ZH when needed; Wikipedia if TMDB has no overview.
// Also fills director/cast credits when missing.
//
// Usage: npm run fill-plots
//        npm run fill-plots -- --list cannes-palme-dor
//        npm run fill-plots -- --engine ollama --model qwen2.5:3b
//        npm run fill-plots -- --no-wiki --limit 50
import { openDb, exportDb, cachedJson } from "./lib/db.mjs";
import { createTranslator } from "./lib/translate.mjs";
import { fillWorkFacts, workNeedsFacts } from "./lib/tmdb-facts.mjs";

const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
if (!token) throw new Error("TMDB_API_READ_ACCESS_TOKEN missing; put it in .env");

const args = process.argv.slice(2);
const listIdx = args.indexOf("--list");
const listId = listIdx >= 0 ? args[listIdx + 1] : null;
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const engIdx = args.indexOf("--engine");
const engine = engIdx >= 0 ? args[engIdx + 1] : process.env.TRANSLATE_ENGINE || "google";
const modelIdx = args.indexOf("--model");
const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
const useWiki = !args.includes("--no-wiki");
const creditsOnly = args.includes("--credits-only");
const plotsOnly = args.includes("--plots-only");

const translate = createTranslator(engine, { model });
const han = /\p{Script=Han}/u;

function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const key = url.pathname.replace("/3/", "") + url.search;
  return cachedJson("tmdb", key, url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    gap: 50,
  });
}

const db = openDb();
let works = db.prepare("SELECT * FROM works WHERE tmdb_id IS NOT NULL ORDER BY id").all();
if (listId) {
  const ids = new Set(
    db.prepare("SELECT work_id FROM list_entries WHERE list_id = ?").all(listId).map((r) => r.work_id),
  );
  works = works.filter((w) => ids.has(w.id));
}

const report = [];
let done = 0;

for (const w of works) {
  if (done >= limit) break;
  const { needsPlot, needsCredits } = workNeedsFacts(db, w.id);
  if (plotsOnly && !needsPlot) continue;
  if (creditsOnly && !needsCredits) continue;
  if (!plotsOnly && !creditsOnly && !needsPlot && !needsCredits) continue;

  const type = w.kind;
  const d = await tmdb(`/${type}/${w.tmdb_id}`);
  const result = await fillWorkFacts(db, w, d, {
    tmdb,
    translate: needsPlot ? translate : null,
    useWiki: needsPlot && useWiki,
    credits: needsCredits,
  });
  done++;
  const bits = [];
  if (result.plotSaved) bits.push(result.overviewZh ? "plot-zh" : "plot-en");
  if (result.creditsSaved) bits.push("credits");
  report.push(`${bits.join("+") || "skip"}\t${w.id}\t${w.en || w.zh || ""}`);
}

exportDb(db);
console.log(report.length ? report.join("\n") : "nothing to do");
console.error(`fill-plots: ${done} works (${engine}${useWiki ? ", wiki" : ""})`);
