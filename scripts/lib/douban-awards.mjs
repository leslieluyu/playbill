/** Parse Douban festival award pages (/awards/{fest}/{edition}/nominees). */

import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(new EnvHttpProxyAgent());

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const cookieRaw = (process.env.DOUBAN_COOKIE ?? "").trim();
const cookieHdr = cookieRaw.length > 20 ? { Cookie: cookieRaw } : {};

export const FESTIVALS = {
  "cannes-palme-dor": {
    slug: "cannes",
    // JS \b does not work after CJK; headings look like "金棕榈奖 Palme d'Or"
    awardRe: /^金棕榈奖/,
    awardExclude: /短片|Honorary|终身|荣誉/i,
    zh: "戛纳金棕榈",
    en: "Cannes · Palme d'Or",
  },
  "berlin-golden-bear": {
    slug: "berlinale",
    awardRe: /^金熊奖/,
    awardExclude: /短片|纪录/i,
    zh: "柏林金熊",
    en: "Berlin · Golden Bear",
  },
  "venice-golden-lion": {
    slug: "venice",
    awardRe: /^金狮奖/,
    awardExclude: /短片|Honorary|终身/i,
    zh: "威尼斯金狮",
    en: "Venice · Golden Lion",
  },
};

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export async function fetchAwardPage(festSlug, edition, gapMs = 1200) {
  const url = `https://movie.douban.com/awards/${festSlug}/${edition}/nominees`;
  await sleep(gapMs);
  let res;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://movie.douban.com/", ...cookieHdr },
    });
    if (res.status !== 403) break;
    await sleep(gapMs * (attempt + 2));
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const html = await res.text();
  const yearM = html.match(/第\d+届[^(]*\((\d{4})\)/);
  const festYear = yearM ? Number(yearM[1]) : null;
  return { html, festYear, edition, url };
}

function parseCategoryBlock(html, awardRe, awardExclude) {
  const blocks = html.split(/<h4[^>]*>/).slice(1);
  for (const block of blocks) {
    const headEnd = block.indexOf("</h4>");
    if (headEnd < 0) continue;
    const heading = decodeHtml(block.slice(0, headEnd).replace(/<[^>]+>/g, "").trim());
    if (!awardRe.test(heading)) continue;
    if (awardExclude && awardExclude.test(heading)) continue;
    const body = block.slice(headEnd);
    const items = [];
    for (const li of body.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const chunk = li[1];
      const idM = chunk.match(/subject\/(\d+)/);
      if (!idM) continue;
      const titleM = chunk.match(/class="r_main"[\s\S]*?<a[^>]*>\s*([\s\S]*?)\s*<\/a>/);
      const title = titleM ? decodeHtml(titleM[1].replace(/\s+/g, " ").trim()) : "";
      const won = /<div class="won">/.test(chunk);
      items.push({ doubanId: idM[1], title, won });
    }
    return items;
  }
  return null;
}

export function parseTopAwardEntries(page, festKey) {
  const cfg = FESTIVALS[festKey];
  if (!page) return [];
  const items = parseCategoryBlock(page.html, cfg.awardRe, cfg.awardExclude);
  if (!items?.length) return [];
  let pos = 0;
  return items.map((it) => ({
    doubanId: it.doubanId,
    title: it.title,
    edition: page.edition,
    festYear: page.festYear,
    chart: it.won ? "won" : "nom",
    position: ++pos,
  }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
