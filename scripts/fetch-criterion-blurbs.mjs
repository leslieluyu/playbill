// Pull Criterion film-page blurbs into list_highlights for a small POC set.
// Cloudflare often blocks; pass saved HTML files as spine=path pairs.
//
// Usage:
//   npm run criterion-blurbs
//   npm run criterion-blurbs -- 1=/path/to/grand-illusion.html
//   npm run criterion-blurbs -- --spine 1 --spine 2
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, exportDb } from "./lib/db.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST = "criterion-spine";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const URL_MAP = path.join(ROOT, "db/seed/criterion-film-urls.tsv");

/** Load spine→URL map from seed TSV (preferred) or fall back to the small POC table. */
function loadUrlMap() {
  if (existsSync(URL_MAP)) {
    const rows = [];
    for (const line of readFileSync(URL_MAP, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("spine")) continue;
      const [spine, url] = line.split("\t");
      if (!spine || !url) continue;
      rows.push({ spine: Number(spine), url: url.trim() });
    }
    return rows;
  }
  return [
    { spine: 1, url: "https://www.criterion.com/films/351-grand-illusion" },
    { spine: 2, url: "https://www.criterion.com/films/165-seven-samurai" },
    { spine: 3, url: "https://www.criterion.com/films/358-the-lady-vanishes" },
    { spine: 4, url: "https://www.criterion.com/films/208-amarcord" },
    { spine: 5, url: "https://www.criterion.com/films/151-the-400-blows" },
    { spine: 6, url: "https://www.criterion.com/films/177-beauty-and-the-beast" },
    { spine: 7, url: "https://www.criterion.com/films/521-a-night-to-remember" },
    { spine: 8, url: "https://www.criterion.com/films/231-the-killer" },
    { spine: 9, url: "https://www.criterion.com/films/523-hard-boiled" },
    { spine: 10, url: "https://www.criterion.com/films/522-walkabout" },
    { spine: 11, url: "https://www.criterion.com/films/173-the-seventh-seal" },
    { spine: 12, url: "https://www.criterion.com/films/317-this-is-spinal-tap" },
    { spine: 13, url: "https://www.criterion.com/films/528-the-silence-of-the-lambs" },
    { spine: 14, url: "https://www.criterion.com/films/529-samurai-i-musashi-miyamoto" },
    { spine: 15, url: "https://www.criterion.com/films/530-samurai-ii-duel-at-ichijoji-temple" },
    { spine: 16, url: "https://www.criterion.com/films/531-samurai-iii-duel-at-ganryu-island" },
    { spine: 21, url: "https://www.criterion.com/films/541-dead-ringers" },
    { spine: 24, url: "https://www.criterion.com/films/543-high-and-low" },
    { spine: 25, url: "https://www.criterion.com/films/207-alphaville" },
    { spine: 30, url: "https://www.criterion.com/films/558-m" },
    { spine: 65, url: "https://www.criterion.com/films/333-rushmore" },
    { spine: 174, url: "https://www.criterion.com/films/291-band-of-outsiders" },
    { spine: 1104, url: "https://www.criterion.com/films/32250-citizen-kane" },
  ];
}

const POC = loadUrlMap();

const args = process.argv.slice(2);
const fileBySpine = new Map();
const onlySpines = new Set();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--spine" && args[i + 1]) {
    onlySpines.add(Number(args[++i]));
    continue;
  }
  const m = a.match(/^(\d+)=(.+)$/);
  if (m) fileBySpine.set(Number(m[1]), path.resolve(m[2]));
}

function clean(s) {
  return (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract the hero synopsis from a Criterion film page HTML (or markdown dump). */
export function parseCriterionBlurb(html) {
  // JSON-LD description
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes = Array.isArray(data) ? data : [data];
      for (const n of nodes) {
        const d = n.description || n.abstract;
        if (typeof d === "string" && d.trim().length > 80) return clean(d);
      }
    } catch {
      /* ignore */
    }
  }
  // Meta description
  const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (meta?.[1] && clean(meta[1]).length > 80) return clean(meta[1]);

  // Common product/synopsis containers
  const blocks = [
    ...html.matchAll(/<div[^>]*class=["'][^"']*(?:product-summary|film-synopsis|synopsis|description)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi),
    ...html.matchAll(/<p[^>]*class=["'][^"']*(?:product-summary|film-synopsis|synopsis|description)[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi),
  ];
  let best = "";
  for (const m of blocks) {
    const t = clean(m[1]);
    if (t.length > best.length) best = t;
  }
  if (best.length > 80) return best;

  // Fallback: longest paragraph under main-ish content (skip nav noise)
  for (const m of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = clean(m[1]);
    if (t.length > best.length && t.length < 2000 && !/cookie|subscribe|cart/i.test(t)) best = t;
  }
  return best.length > 80 ? best : "";
}

async function loadHtml(item) {
  const file = fileBySpine.get(item.spine);
  if (file) {
    console.log(`spine ${item.spine}: reading ${file}`);
    return readFileSync(file, "utf8");
  }
  console.log(`spine ${item.spine}: fetching ${item.url}`);
  const res = await fetch(item.url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
  });
  const text = await res.text();
  if (!res.ok || /just a moment|cf-chl|challenge-platform/i.test(text)) {
    throw new Error(
      `Criterion blocked spine ${item.spine} (HTTP ${res.status}). Save the film page HTML and rerun:\n` +
        `  npm run criterion-blurbs -- ${item.spine}=/path/to/page.html`,
    );
  }
  return text;
}

const db = openDb();
const workOf = db.prepare("SELECT work_id FROM list_entries WHERE list_id = ? AND rank = ?");
const upsert = db.prepare(
  `INSERT INTO list_highlights (list_id, work_id, hook, hook_en) VALUES (?, ?, NULL, ?)
   ON CONFLICT(list_id, work_id) DO UPDATE SET hook_en = excluded.hook_en`,
);

// If spine=path files are passed, only those spines (unless --spine further narrows).
const scope = fileBySpine.size
  ? POC.filter((p) => fileBySpine.has(p.spine))
  : POC;
const items = scope.filter((p) => !onlySpines.size || onlySpines.has(p.spine));
// Allow unknown spines that only appear as file args (not yet in POC URL table).
for (const spine of fileBySpine.keys()) {
  if (!items.some((p) => p.spine === spine)) {
    items.push({ spine, url: "" });
  }
}
const report = [];
for (const item of items) {
  const row = workOf.get(LIST, item.spine);
  if (!row) {
    report.push(`MISS  spine ${item.spine}: not in list_entries`);
    continue;
  }
  try {
    const html = await loadHtml(item);
    const blurb = parseCriterionBlurb(html);
    if (!blurb) {
      report.push(`EMPTY spine ${item.spine} ${row.work_id}`);
      continue;
    }
    upsert.run(LIST, row.work_id, blurb);
    report.push(`ok    spine ${String(item.spine).padStart(4)}  ${row.work_id}  ${blurb.slice(0, 72)}…`);
  } catch (e) {
    report.push(`FAIL  spine ${item.spine}: ${e.message}`);
  }
}

exportDb(db);
db.close();
console.log(report.join("\n") || "nothing to do");
if (report.some((l) => l.startsWith("FAIL"))) process.exitCode = 1;
