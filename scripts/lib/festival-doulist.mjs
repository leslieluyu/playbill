/** Crawl Douban doulists for festival top-prize winners (fills award-page gaps). */

import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { parseDoulistItems } from "./doulist.mjs";

setGlobalDispatcher(new EnvHttpProxyAgent());

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const cookieRaw = (process.env.DOUBAN_COOKIE ?? "").trim();
const cookieHdr = cookieRaw.length > 20 ? { Cookie: cookieRaw } : {};
const YEAR = "(19|20)\\d{2}";

function parseEditionYear(comment, filmYear) {
  const c = comment.replace(/\s+/g, " ");
  let edition = null;
  let festYear = null;
  let m = c.match(new RegExp(`第(\\d+)届[^0-9]{0,4}(${YEAR})`));
  if (m) {
    edition = Number(m[1]);
    festYear = Number(m[2]);
  }
  if (!edition || !festYear) {
    m = c.match(new RegExp(`(${YEAR})[^0-9]{0,4}第(\\d+)届`));
    if (m) {
      festYear = Number(m[1]);
      edition = Number(m[2]);
    }
  }
  if (!edition) {
    m = c.match(/第(\d+)届/);
    if (m) edition = Number(m[1]);
  }
  if (!festYear) {
    m = c.match(new RegExp(`【(${YEAR})】`));
    if (m) festYear = Number(m[1]);
  }
  if (!festYear) {
    m = c.match(new RegExp(`(${YEAR})年`));
    if (m) festYear = Number(m[1]);
  }
  if (!festYear) {
    m = c.match(new RegExp(`(${YEAR})\\(\\d+\\)`));
    if (m) festYear = Number(m[1]);
  }
  if (!festYear && filmYear && filmYear >= 1920 && filmYear <= 2035) festYear = filmYear;
  if (!edition || !festYear) return null;
  return { edition, festYear };
}

/** Doulist ids whose items are Palme / Golden Bear / Golden Lion winners. */
export const DOULIST_WINNERS = {
  "cannes-palme-dor": ["41544177"],
  "berlin-golden-bear": ["3151119", "118245852"],
  "venice-golden-lion": ["142836015", "119589522"],
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchDoulistAll(doulistId, gapMs = 800) {
  const seen = new Set();
  const all = [];
  for (let start = 0; start < 8000; ) {
    const url = `https://www.douban.com/doulist/${doulistId}/?start=${start}&sort=time&sub_type=`;
    let res;
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html", ...cookieHdr } });
      if (res.status !== 403) break;
      await sleep(gapMs * (attempt + 2));
    }
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
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
    if (added === 0) break;
    start += batch.length;
    await sleep(gapMs);
  }
  return all;
}

export function parseCannesPalmeWinner(row) {
  const c = (row.comment ?? "").replace(/\s+/g, " ");
  if (/短片金棕榈/.test(c)) return null;
  if (/1939年12部|二战被迫取消|追授/.test(c)) return null;

  const ey = parseEditionYear(c, row.filmYear);
  if (!ey) return null;
  const { edition, festYear } = ey;

  // Palme-only doulist (41544177): short “第N届，YYYY年” comments.
  if (/^第\d+届/.test(c) || /^\d{4}[，,]\s*第\d+届/.test(c)) {
    return winnerRow(row, edition, festYear);
  }
  if (!/主竞赛单元\s*金棕榈奖/.test(c)) return null;
  if (/金棕榈奖提名/.test(c) || (/提名/.test(c) && !/金棕榈奖[：:]/.test(c))) return null;

  return winnerRow(row, edition, festYear);
}

function winnerRow(row, edition, festYear) {
  return {
    doubanId: row.doubanId,
    title: row.title,
    edition,
    festYear,
    chart: "won",
    position: 1,
    source: "doulist",
  };
}

export function parseBerlinGoldenBearWinner(row) {
  const c = (row.comment ?? "").replace(/\s+/g, " ");
  const ey = parseEditionYear(c, row.filmYear);
  if (!ey) return null;
  return winnerRow(row, ey.edition, ey.festYear);
}

export function parseVeniceGoldenLionWinner(row) {
  const c = (row.comment ?? "").replace(/\s+/g, " ");
  const ey = parseEditionYear(c, row.filmYear);
  if (!ey) return null;
  return winnerRow(row, ey.edition, ey.festYear);
}

const PARSERS = {
  "cannes-palme-dor": parseCannesPalmeWinner,
  "berlin-golden-bear": parseBerlinGoldenBearWinner,
  "venice-golden-lion": parseVeniceGoldenLionWinner,
};

export async function fetchDoulistWinners(listId, gapMs = 800) {
  const parse = PARSERS[listId];
  const ids = DOULIST_WINNERS[listId];
  if (!parse || !ids?.length) return [];

  const out = [];
  const seen = new Set();
  for (const doulistId of ids) {
    const rows = await fetchDoulistAll(doulistId, gapMs);
    for (const row of rows) {
      const parsed = parse(row);
      if (!parsed) continue;
      const key = `${parsed.edition}\t${parsed.doubanId}\t${parsed.chart}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(parsed);
    }
  }
  return out;
}

/** Prefer award-page rows; add doulist winners for missing editions or missing winner rows. */
export function mergeAwardAndDoulist(awardEntries, doulistWins) {
  const map = new Map();
  for (const e of awardEntries) {
    map.set(`${e.edition}\t${e.doubanId}\t${e.chart}`, e);
  }
  const byEdition = new Map();
  for (const e of awardEntries) {
    const list = byEdition.get(e.edition) ?? [];
    list.push(e);
    byEdition.set(e.edition, list);
  }

  for (const w of doulistWins) {
    const k = `${w.edition}\t${w.doubanId}\t${w.chart}`;
    if (map.has(k)) continue;
    const edRows = byEdition.get(w.edition) ?? [];
    const hasWinner = edRows.some((e) => e.chart === "won");
    const editionMissing = edRows.length === 0;
    if (w.chart === "won" && (editionMissing || !hasWinner)) {
      map.set(k, w);
      if (!byEdition.has(w.edition)) byEdition.set(w.edition, [w]);
      else byEdition.get(w.edition).push(w);
    }
  }

  const merged = [...map.values()];
  merged.sort((a, b) => {
    if (b.edition !== a.edition) return b.edition - a.edition;
    const ca = a.chart === "won" ? 0 : 1;
    const cb = b.chart === "won" ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return (a.position ?? 0) - (b.position ?? 0);
  });
  return merged;
}
