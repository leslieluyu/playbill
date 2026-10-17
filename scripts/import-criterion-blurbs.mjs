// Import Criterion blurbs from a JSONL of {spine, blurb} (English) into list_highlights.
// Optional second file: {spine, hook} Chinese translations.
//
// Usage:
//   node scripts/import-criterion-blurbs.mjs db/seed/criterion-blurbs-en.jsonl
//   node scripts/import-criterion-blurbs.mjs db/seed/criterion-blurbs-en.jsonl --zh db/seed/criterion-blurbs-zh.jsonl
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, exportDb } from "./lib/db.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST = "criterion-spine";

const args = process.argv.slice(2);
const enPath = args.find((a) => !a.startsWith("--"));
const zhIdx = args.indexOf("--zh");
const zhPath = zhIdx >= 0 ? args[zhIdx + 1] : null;
if (!enPath) {
  console.error("usage: node scripts/import-criterion-blurbs.mjs <en.jsonl> [--zh zh.jsonl]");
  process.exit(1);
}

function loadJsonl(p) {
  return readFileSync(path.resolve(ROOT, p), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const db = openDb();
const workOf = db.prepare("SELECT work_id FROM list_entries WHERE list_id = ? AND rank = ?");
const upsertEn = db.prepare(
  `INSERT INTO list_highlights (list_id, work_id, hook, hook_en) VALUES (?, ?, NULL, ?)
   ON CONFLICT(list_id, work_id) DO UPDATE SET hook_en = excluded.hook_en`,
);
const upsertZh = db.prepare(
  `INSERT INTO list_highlights (list_id, work_id, hook, hook_en) VALUES (?, ?, ?, NULL)
   ON CONFLICT(list_id, work_id) DO UPDATE SET hook = excluded.hook`,
);

let ok = 0;
let miss = 0;
for (const row of loadJsonl(enPath)) {
  const spine = Number(row.spine);
  const blurb = (row.blurb || row.hook_en || "").trim();
  if (!spine || !blurb) continue;
  const w = workOf.get(LIST, spine);
  if (!w) {
    miss++;
    continue;
  }
  upsertEn.run(LIST, w.work_id, blurb);
  ok++;
}

let zhOk = 0;
if (zhPath) {
  for (const row of loadJsonl(zhPath)) {
    const spine = Number(row.spine);
    const hook = (row.hook || row.zh || row.blurb || "").trim();
    if (!spine || !hook) continue;
    const w = workOf.get(LIST, spine);
    if (!w) continue;
    upsertZh.run(LIST, w.work_id, hook);
    zhOk++;
  }
}

exportDb(db);
db.close();
console.log(`imported en=${ok} miss=${miss} zh=${zhOk}`);
