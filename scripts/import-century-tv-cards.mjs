#!/usr/bin/env node
/** Import plot + list highlight hooks from db/seed/century-tv-20th-cards.jsonl */
import { readFileSync } from "node:fs";
import { openDb, tx } from "./lib/db.mjs";

const LIST = "century-tv-20th";
const CARDS = "db/seed/century-tv-20th-cards.jsonl";

const db = openDb();
const byRank = new Map(
  db
    .prepare("SELECT rank, work_id FROM list_entries WHERE list_id = ?")
    .all(LIST)
    .map((r) => [r.rank, r.work_id]),
);

const upsertHighlight = db.prepare(
  `INSERT INTO list_highlights (list_id, work_id, hook, hook_en)
   VALUES (?, ?, ?, NULL)
   ON CONFLICT(list_id, work_id) DO UPDATE SET hook = excluded.hook`,
);
const upsertPlot = db.prepare(
  `INSERT INTO editorial (work_id, plot, reviewed)
   VALUES (?, ?, 1)
   ON CONFLICT(work_id) DO UPDATE SET
     plot = CASE WHEN length(coalesce(editorial.plot, '')) < length(excluded.plot) THEN excluded.plot ELSE editorial.plot END,
     reviewed = 1`,
);

let n = 0;
tx(db, () => {
  for (const line of readFileSync(CARDS, "utf8").trim().split("\n")) {
    if (!line.trim()) continue;
    const card = JSON.parse(line);
    const workId = byRank.get(card.rank);
    if (!workId) continue;
    const plot = (card.plot ?? "").trim();
    const hook = (card.hook ?? "").trim();
    if (plot) upsertPlot.run(workId, plot);
    if (hook) upsertHighlight.run(LIST, workId, hook);
    n++;
  }
});
console.log(`import-century-tv-cards: ${n} rows processed for ${LIST}`);