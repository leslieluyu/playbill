// Scrape a Douban doulist into JSONL (one object per line).
// Usage: node scripts/scrape-doulist.mjs <doulist_id> [out.jsonl] [time|seq]
import { writeFileSync } from "node:fs";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { parseComment, parseDoulistItems } from "./lib/doulist.mjs";

setGlobalDispatcher(new EnvHttpProxyAgent());

const listId = process.argv[2];
const outPath = process.argv[3] ?? `db/seed/doulist-${listId}.jsonl`;
if (!listId) throw new Error("usage: node scripts/scrape-doulist.mjs <doulist_id> [out.jsonl] [time|seq]");

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchPage(start, sort = "time") {
  const url = `https://www.douban.com/doulist/${listId}/?start=${start}&sort=${sort}&sub_type=`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

const sort = process.argv[4] === "seq" ? "seq" : "time";
const seen = new Set();
const all = [];
for (let start = 0; start < 5000; ) {
  const html = await fetchPage(start, sort);
  const batch = parseDoulistItems(html);
  if (!batch.length) break;
  let added = 0;
  for (const row of batch) {
    const key = `${row.doubanId}\t${row.comment}`;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(row);
    added++;
  }
  process.stderr.write(`start=${start} +${batch.length} new=${added} (total ${all.length})\n`);
  if (added === 0) break;
  start += batch.length;
  await new Promise((r) => setTimeout(r, 700));
}

const lines = all.map((row, i) => {
  const parsed = parseComment(row.comment);
  return JSON.stringify({ ord: i + 1, ...row, ...parsed });
});
writeFileSync(outPath, lines.join("\n") + (lines.length ? "\n" : ""));
console.log(`wrote ${lines.length} unique rows (sort=${sort}) → ${outPath}`);
