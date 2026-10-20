// Merge Douban doulist scrapes (sort=time + sort=seq) into one deduped JSONL.
import { readFileSync, writeFileSync } from "node:fs";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { parseComment, parseDoulistItems } from "./lib/doulist.mjs";

setGlobalDispatcher(new EnvHttpProxyAgent());

const listId = "145457359";
const outPath = "db/seed/kinema-junpo-ten.raw.jsonl";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function scrapeSort(sort) {
  const seen = new Set();
  const all = [];
  for (let start = 0; start < 10000; ) {
    const url = `https://www.douban.com/doulist/${listId}/?start=${start}&sort=${sort}&sub_type=`;
    let res;
    for (let attempt = 0; attempt < 8; attempt++) {
      res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) break;
      process.stderr.write(`${sort} start=${start} HTTP ${res.status}, retry ${attempt + 1}\n`);
      await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)));
    }
    if (!res.ok) break;
    const batch = parseDoulistItems(await res.text());
    if (!batch.length) break;
    let added = 0;
    for (const row of batch) {
      const key = `${row.doubanId}\t${row.comment}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(row);
      added++;
    }
    process.stderr.write(`${sort} start=${start} +${batch.length} new=${added} total=${all.length}\n`);
    if (added === 0) break;
    start += batch.length;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return all;
}

function loadJsonl(path) {
  try {
    return readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

const fromDisk = loadJsonl("db/seed/kinema-junpo-ten-seq.jsonl");

const merged = new Map();
for (const row of fromDisk) {
  const key = `${row.doubanId}\t${row.raw ?? row.comment}`;
  merged.set(key, row);
}

for (const row of await scrapeSort("time")) {
  const key = `${row.doubanId}\t${row.comment}`;
  if (merged.has(key)) continue;
  merged.set(key, { ...row, ...parseComment(row.comment) });
}

const all = [...merged.values()].map((row, i) => {
  const comment = row.raw ?? row.comment ?? "";
  const parsed = row.kjYear != null ? row : { ...row, ...parseComment(comment) };
  return { ord: i + 1, doubanId: row.doubanId, title: row.title, filmYear: row.filmYear ?? row.year, comment, ...parsed };
});

writeFileSync(
  outPath,
  all.map((r) => JSON.stringify(r)).join("\n") + (all.length ? "\n" : ""),
);
const years = all.map((r) => r.kjYear).filter(Boolean);
console.log(`merged ${all.length} rows; kjYear ${Math.min(...years)}–${Math.max(...years)}`);
