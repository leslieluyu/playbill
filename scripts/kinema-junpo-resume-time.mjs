import { readFileSync, writeFileSync } from "node:fs";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { parseComment, parseDoulistItems } from "./lib/doulist.mjs";

setGlobalDispatcher(new EnvHttpProxyAgent());
const listId = "145457359";
const path = "db/seed/kinema-junpo-ten.raw.jsonl";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120";

const merged = new Map();
for (const line of readFileSync(path, "utf8").trim().split("\n")) {
  if (!line) continue;
  const row = JSON.parse(line);
  merged.set(`${row.doubanId}\t${row.raw ?? row.comment}`, row);
}

let start = 0;
for (;;) {
  const url = `https://www.douban.com/doulist/${listId}/?start=${start}&sort=time&sub_type=`;
  let res;
  for (let attempt = 0; attempt < 10; attempt++) {
    res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) break;
    await new Promise((r) => setTimeout(r, 20000));
  }
  if (!res.ok) {
    console.error("stopped at", start, res.status);
    break;
  }
  const batch = parseDoulistItems(await res.text());
  if (!batch.length) break;
  let added = 0;
  for (const row of batch) {
    const key = `${row.doubanId}\t${row.comment}`;
    if (merged.has(key)) continue;
    merged.set(key, { ...row, ...parseComment(row.comment) });
    added++;
  }
  console.error(`start=${start} batch=${batch.length} added=${added} total=${merged.size}`);
  start += batch.length;
  await new Promise((r) => setTimeout(r, 2500));
}

const all = [...merged.values()];
writeFileSync(path, all.map((r) => JSON.stringify(r)).join("\n") + "\n");
const years = all.map((r) => r.kjYear).filter(Boolean);
console.log(`total ${all.length}, kjYear ${Math.min(...years)}–${Math.max(...years)}`);
