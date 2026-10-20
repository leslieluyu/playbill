// Scrape Douban festival award pages → db/seed/{list-id}.json + .tsv
// Usage: node scripts/build-festival-seed.mjs cannes-palme-dor
//        node scripts/build-festival-seed.mjs --all
import { renameSync, writeFileSync } from "node:fs";
import { FESTIVALS, fetchAwardPage, parseTopAwardEntries } from "./lib/douban-awards.mjs";
import { fetchDoulistWinners, mergeAwardAndDoulist } from "./lib/festival-doulist.mjs";

const GAP_MS = Number(process.env.DOUBAN_GAP_MS) || 1500;
const args = process.argv.slice(2);
const all = args.includes("--all");
const ids = all ? Object.keys(FESTIVALS) : args.filter((a) => !a.startsWith("--"));
if (!ids.length) {
  console.error("usage: node scripts/build-festival-seed.mjs <cannes-palme-dor|berlin-golden-bear|venice-golden-lion|--all>");
  process.exit(1);
}

const EDITION_MAX = { cannes: 79, berlinale: 76, venice: 82 };

const LIST_META = {
  "cannes-palme-dor": {
    id: "cannes-palme-dor",
    title: "戛纳电影节金棕榈奖",
    kicker: "Cannes · Palme d'Or",
    dek: "戛纳国际电影节主竞赛单元金棕榈奖：历届获奖与主竞赛提名，按届次从新到旧排列。左侧可按年代、届次年份筛选，并用「获奖 / 提名」标签过滤。",
    source: { name: "豆瓣电影 · 戛纳电影节获奖/提名", url: "https://movie.douban.com/awards/cannes/" },
    kind: "movie",
    order: 8,
  },
  "berlin-golden-bear": {
    id: "berlin-golden-bear",
    title: "柏林电影节金熊奖",
    kicker: "Berlin · Golden Bear",
    dek: "柏林国际电影节主竞赛单元金熊奖：历届获奖与主竞赛提名，按届次从新到旧排列。左侧可按年代、届次年份筛选，并用「获奖 / 提名」标签过滤。",
    source: { name: "豆瓣电影 · 柏林电影节获奖/提名", url: "https://movie.douban.com/awards/berlinale/" },
    kind: "movie",
    order: 9,
  },
  "venice-golden-lion": {
    id: "venice-golden-lion",
    title: "威尼斯电影节金狮奖",
    kicker: "Venice · Golden Lion",
    dek: "威尼斯国际电影节主竞赛单元金狮奖：历届获奖与主竞赛提名，按届次从新到旧排列。左侧可按年代、届次年份筛选，并用「获奖 / 提名」标签过滤。",
    source: { name: "豆瓣电影 · 威尼斯电影节获奖/提名", url: "https://movie.douban.com/awards/venice/" },
    kind: "movie",
    order: 10,
  },
};

function decadeColor(d) {
  const palette = ["#2f6b45", "#1f6f7a", "#5b45a0", "#a65f18", "#b33a2a", "#a8456e", "#9a7a12", "#4a5568"];
  return palette[Math.floor(d / 10) % palette.length];
}

for (const listId of ids) {
  const cfg = FESTIVALS[listId];
  const meta = LIST_META[listId];
  if (!cfg || !meta) throw new Error(`unknown list ${listId}`);

  const maxEd = EDITION_MAX[cfg.slug] ?? 80;
  const raw = [];
  for (let edition = maxEd; edition >= 1; edition--) {
    let page;
    try {
      page = await fetchAwardPage(cfg.slug, edition, GAP_MS);
    } catch (e) {
      console.error(`edition ${edition}: ${e.message}`);
      continue;
    }
    if (!page) continue;
    const entries = parseTopAwardEntries(page, listId);
    if (!entries.length) {
      console.error(`edition ${edition}: no ${cfg.zh} entries`);
      continue;
    }
    raw.push(...entries);
    console.error(`edition ${edition} (${page.festYear ?? "?"}): ${entries.length} (${entries.filter((e) => e.chart === "won").length} won)`);
  }

  const doulistWins = await fetchDoulistWinners(listId, GAP_MS);
  console.error(`${listId}: doulist winners ${doulistWins.length}`);
  const merged = mergeAwardAndDoulist(raw, doulistWins);
  const added = merged.length - raw.length;
  if (added > 0) console.error(`${listId}: +${added} rows from doulist (winners / gap fill)`);
  raw.length = 0;
  raw.push(...merged);

  const years = [...new Set(raw.map((r) => r.festYear).filter(Boolean))].sort((a, b) => b - a);
  const sections = years.map((y) => ({
    id: `y${y}`,
    order: -y,
    name: `${y}年`,
    blurb: "",
    color: decadeColor(y),
  }));

  const lines = ["rank\ttitle\tyear\tdouban_id\tsection\tchart\tposition\tnote"];
  let rank = 0;
  for (const r of raw) {
    if (!r.doubanId || !r.festYear) continue;
    rank++;
    const filmYear = r.festYear;
    lines.push(
      [rank, r.title, filmYear, r.doubanId, `y${r.festYear}`, r.chart, r.position, `第${r.edition}届`].join("\t"),
    );
  }

  if (rank === 0) {
    console.error(`${listId}: 0 entries — keeping existing seed files`);
    continue;
  }

  const jsonPath = `db/seed/${listId}.json`;
  const tsvPath = `db/seed/${listId}.tsv`;
  const jsonTmp = `${jsonPath}.tmp`;
  const tsvTmp = `${tsvPath}.tmp`;
  writeFileSync(jsonTmp, JSON.stringify({ ...meta, entries: `${listId}.tsv`, sections }, null, 2) + "\n");
  writeFileSync(tsvTmp, lines.join("\n") + "\n");
  renameSync(jsonTmp, jsonPath);
  renameSync(tsvTmp, tsvPath);
  console.error(`${listId}: ${rank} entries, ${sections.length} year sections`);
}
