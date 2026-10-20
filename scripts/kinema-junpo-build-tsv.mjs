// Build kinema-junpo-ten.tsv + section defs from merged raw JSONL.
import { readFileSync, writeFileSync } from "node:fs";

const rawPath = "db/seed/kinema-junpo-ten.raw.jsonl";
const rows = readFileSync(rawPath, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const chartOrd = { jp: 0, foreign: 1, art: 2, ent: 3, other: 4 };

rows.sort((a, b) => {
  const ya = a.kjYear ?? 0;
  const yb = b.kjYear ?? 0;
  if (yb !== ya) return yb - ya;
  const ca = chartOrd[a.chart] ?? 9;
  const cb = chartOrd[b.chart] ?? 9;
  if (ca !== cb) return ca - cb;
  return (a.position ?? 99) - (b.position ?? 99);
});

const years = [...new Set(rows.map((r) => r.kjYear).filter(Boolean))].sort((a, b) => b - a);
const decadeColor = (d) => {
  const palette = ["#2f6b45", "#1f6f7a", "#5b45a0", "#a65f18", "#b33a2a", "#a8456e", "#9a7a12", "#4a5568"];
  return palette[Math.floor(d / 10) % palette.length];
};

const sections = [];
for (const y of years) {
  const id = `y${y}`;
  sections.push({ id, order: -y, name: `${y}年度`, blurb: "", color: decadeColor(y) });
}

const lines = ["rank\ttitle\tyear\tdouban_id\tsection\tchart\tposition\tnote"];
let rank = 0;
for (const r of rows) {
  if (!r.kjYear || !r.doubanId) continue;
  rank++;
  const filmYear = r.filmYear ?? r.year ?? r.kjYear ?? "";
  const note = r.missing ? "暂缺（豆列标注）" : "";
  lines.push(
    [rank, r.title, filmYear, r.doubanId, `y${r.kjYear}`, r.chart ?? "other", r.position ?? "", note].join("\t"),
  );
}

writeFileSync(
  "db/seed/kinema-junpo-ten.json",
  JSON.stringify(
    {
      id: "kinema-junpo-ten",
      title: "《电影旬报》历年十佳",
      kicker: "キネマ旬報 · Best Ten",
      dek: "日本《电影旬报》历年十佳整理（艺术性／娱乐性、日本／外国等分榜）。按旬报年度从新到旧排列；左侧可按年代与年度筛选，并按榜单类型标签过滤。",
      source: {
        name: "豆瓣豆列 · 《电影旬报》历年十佳",
        url: "https://www.douban.com/doulist/145457359/",
      },
      kind: "movie",
      order: 7,
      entries: "kinema-junpo-ten.tsv",
      sections,
      footnotes: [
        "第85回（2011年度）外国电影 Best Ten 第4位、第92回（2018年度）外国电影 Best Ten 第8位：豆列标注暂缺，页面仅保留脚注。",
      ],
    },
    null,
    2,
  ) + "\n",
);
writeFileSync("db/seed/kinema-junpo-ten.tsv", lines.join("\n") + "\n");
console.log(`${rank} entries, ${sections.length} year sections, kj ${years.at(-1)}–${years[0]}`);
