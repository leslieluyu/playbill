// Translate Criterion English blurbs (hook_en) to Chinese (hook).
// Engines: google (default, free clients5), ollama, mymemory.
// Skips rows that already have hook. Resumes cleanly.
//
// Usage:
//   node scripts/translate-criterion-blurbs.mjs
//   node scripts/translate-criterion-blurbs.mjs --engine ollama --model qwen2.5:3b
//   node scripts/translate-criterion-blurbs.mjs --engine mymemory --limit 50
import { openDb, exportDb } from "./lib/db.mjs";

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const engIdx = args.indexOf("--engine");
const engine = engIdx >= 0 ? args[engIdx + 1] : "google";
const modelIdx = args.indexOf("--model");
const model = modelIdx >= 0 ? args[modelIdx + 1] : "qwen2.5:3b";
const LIST = "criterion-spine";
const OLLAMA = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateMyMemory(text) {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text.slice(0, 450)) +
    "&langpair=en|zh-CN";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (!out || /MYMEMORY WARNING|INVALID SOURCE/i.test(out)) {
    throw new Error(out || "empty translation");
  }
  if (text.length > 450) return out + "…";
  return out;
}

async function translateOllama(text) {
  const prompt =
    "将下面这段电影介绍从英文翻译成简体中文。只输出译文，不要引号、不要解释、不要英文原文。\n\n" +
    text;
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.2, num_predict: 512 },
    }),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
  const data = await res.json();
  const out = (data?.response || "").trim();
  if (!out) throw new Error("empty ollama response");
  return out.replace(/^["「『]|["」』]$/g, "").trim();
}

async function translateGoogle(text) {
  // Unofficial Chrome dict endpoint — no API key; keep polite rate.
  const url =
    "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-CN&q=" +
    encodeURIComponent(text);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // Shape: ["译文"] or [["译文","src"], ...]
  let out = null;
  if (typeof data?.[0] === "string") out = data[0];
  else if (Array.isArray(data?.[0])) out = data.map((x) => x[0]).join("");
  else if (typeof data === "string") out = data;
  if (!out || !String(out).trim()) throw new Error("empty google response");
  return String(out).trim();
}

const translate =
  engine === "mymemory"
    ? translateMyMemory
    : engine === "ollama"
      ? translateOllama
      : translateGoogle;

const delayMs = engine === "mymemory" ? 350 : engine === "ollama" ? 0 : 200;

const db = openDb();
const rows = db
  .prepare(
    `SELECT e.rank AS spine, e.work_id, h.hook_en, h.hook
     FROM list_entries e
     JOIN list_highlights h ON h.list_id = e.list_id AND h.work_id = e.work_id
     WHERE e.list_id = ? AND h.hook_en IS NOT NULL AND h.hook_en != ''
       AND (h.hook IS NULL OR h.hook = '')
     ORDER BY e.rank`,
  )
  .all(LIST);

const upsert = db.prepare(
  `UPDATE list_highlights SET hook = ? WHERE list_id = ? AND work_id = ?`,
);

let ok = 0;
let fail = 0;
const todo = rows.slice(0, Number.isFinite(limit) ? limit : rows.length);
console.log(
  `translating ${todo.length} of ${rows.length} missing ZH via ${engine}` +
    (engine === "ollama" ? ` (${model})` : ""),
);

for (const row of todo) {
  try {
    const zh = await translate(row.hook_en);
    upsert.run(zh, LIST, row.work_id);
    ok++;
    if (ok % 50 === 0) {
      exportDb(db);
      console.log(`… ${ok}/${todo.length} (spine ${row.spine})`);
    }
  } catch (e) {
    fail++;
    console.error(`FAIL spine ${row.spine}: ${e.message}`);
    if (fail >= 8 && ok === 0) break;
    await sleep(engine === "google" ? 3000 : 2000);
  }
  if (delayMs) await sleep(delayMs);
}

exportDb(db);
db.close();
console.log(`done ok=${ok} fail=${fail}`);
if (fail && !ok) process.exitCode = 1;
