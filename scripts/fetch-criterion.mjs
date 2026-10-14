// Refreshes db/seed/criterion-spine.tsv from Criterion's spine-number browse list.
// Criterion sits behind Cloudflare, so a plain fetch often fails; pass a saved
// HTML (or markdown table) dump of the page when that happens.
//
// Usage:
//   npm run criterion
//   npm run criterion -- /path/to/saved.html
//   npm run criterion -- --seed          (also run npm run seed -- criterion-spine)
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "db/seed/criterion-spine.tsv");
const URL = "https://www.criterion.com/shop/browse/list?sort=spine_number";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const args = process.argv.slice(2);
const doSeed = args.includes("--seed");
const fileArg = args.find((a) => !a.startsWith("--"));

function clean(s) {
  return (s ?? "").replace(/\t/g, " ").replace(/[\r\n]+/g, " ").trim();
}

function yearOf(s) {
  const t = clean(s);
  return /^\d{4}$/.test(t) ? t : "";
}

/** Parse Criterion browse HTML (table rows) or a markdown table dump of the same. */
export function parseCriterionCatalog(text) {
  const bySpine = new Map();

  // HTML: <tr>…</tr> with spine # in the first numeric cell.
  for (const tr of text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      clean(m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")),
    );
    if (cells.length < 4) continue;
    const spineIdx = cells.findIndex((c) => /^\d+$/.test(c));
    if (spineIdx < 0) continue;
    const spine = Number(cells[spineIdx]);
    // Typical columns: Spine # | (poster) | Title | Director | Country | Year
    const rest = cells.slice(spineIdx + 1).filter((c) => c && !/^https?:/.test(c));
    // Drop empty image/placeholder cells; title is the first substantial text cell.
    const title = rest.find((c) => c && !/^\d{4}$/.test(c)) ?? "";
    if (!title || /^spine/i.test(title) || title === "Title") continue;
    const year = [...rest].reverse().map(yearOf).find(Boolean) ?? "";
    const director =
      rest.find((c, i) => i > 0 && c !== title && !yearOf(c) && !/,\s*$/.test(c) && c.length < 80) ?? "";
    // Prefer director cell: usually the one after title.
    const titleIdx = rest.indexOf(title);
    const dir = titleIdx >= 0 && rest[titleIdx + 1] && !yearOf(rest[titleIdx + 1]) ? rest[titleIdx + 1] : director;
    if (!bySpine.has(spine)) bySpine.set(spine, { spine_number: spine, title, year, director: dir });
  }

  // Markdown table fallback (e.g. from a browser "copy as markdown" or WebFetch).
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => clean(c));
    if (!cells.length || !/^\d+$/.test(cells[0])) continue;
    const spine = Number(cells[0]);
    const body = cells.length >= 6 ? cells.slice(2) : cells.slice(1);
    const title = body[0] ?? "";
    if (!title || title === "Title") continue;
    const year = yearOf(body[body.length - 1] ?? "");
    const director = body[1] ?? "";
    if (!bySpine.has(spine)) bySpine.set(spine, { spine_number: spine, title, year, director });
  }

  return [...bySpine.values()].sort((a, b) => a.spine_number - b.spine_number);
}

function writeTsv(rows) {
  const lines = ["spine_number\ttitle\tyear\tdirector"];
  for (const r of rows) {
    lines.push([r.spine_number, clean(r.title), r.year, clean(r.director)].join("\t"));
  }
  writeFileSync(OUT, lines.join("\n") + "\n");
}

async function loadText() {
  if (fileArg) {
    const p = path.resolve(fileArg);
    console.log(`reading ${p}`);
    return readFileSync(p, "utf8");
  }
  console.log(`fetching ${URL}`);
  const res = await fetch(URL, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
  });
  const text = await res.text();
  if (!res.ok || /just a moment|cf-chl|challenge-platform/i.test(text)) {
    throw new Error(
      `Criterion blocked the request (HTTP ${res.status}). Save the browse page HTML from a browser and rerun:\n  npm run criterion -- /path/to/list.html`,
    );
  }
  return text;
}

async function main() {
  const text = await loadText();
  const rows = parseCriterionCatalog(text);
  if (!rows.length) throw new Error("no spine rows parsed — is this the Criterion browse list?");
  writeTsv(rows);
  const withYear = rows.filter((r) => r.year).length;
  console.log(
    `wrote ${OUT}: ${rows.length} spines (max ${rows.at(-1).spine_number}), ${withYear} with year, ${rows.length - withYear} box-sets/no-year`,
  );

  if (doSeed) {
    const r = spawnSync("npm", ["run", "seed", "--", "criterion-spine"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (r.status) process.exit(r.status);
  }
}

const isMain =
  !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
