/** Fetch intro plot text from Wikipedia (REST summary, then MediaWiki extract). */

const UA = "Mozilla/5.0 (compatible; Playbill/1.0; +https://playbill.icdp.uk)";
const han = /\p{Script=Han}/u;

async function wikiJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  return res.json();
}

export async function wikipediaSummary(title, lang = "en") {
  const slug = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = await res.json();
  const text = (data.extract || "").trim();
  if (!text || /may refer to:/i.test(text)) return null;
  return text;
}

export async function wikipediaSearchExtract(query, lang = "en") {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const search = await wikiJson(
    `${base}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`,
  );
  const hit = search?.query?.search?.[0]?.title;
  if (!hit) return null;
  const page = await wikiJson(
    `${base}?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(hit)}&format=json&origin=*`,
  );
  const pages = page?.query?.pages;
  if (!pages) return null;
  const first = Object.values(pages)[0];
  const text = (first?.extract || "").trim();
  if (!text || first?.missing) return null;
  return text;
}

/** Best-effort plot blurb for a film/show. */
export async function wikipediaPlot(work, { lang = "en" } = {}) {
  const year = work.year_start;
  const titles = [
    work.en,
    work.original,
    work.zh && han.test(work.zh) ? work.zh : null,
  ].filter(Boolean);
  for (const t of titles) {
    const q = `${t}${year ? ` (${year} film)` : ""}`;
    const fromSummary = await wikipediaSummary(`${t}${year ? ` (${year} film)` : ""}`, lang);
    if (fromSummary) return fromSummary;
    const fromSearch = await wikipediaSearchExtract(q, lang);
    if (fromSearch) return fromSearch;
    if (year) {
      const plain = await wikipediaSearchExtract(`${t} ${year}`, lang);
      if (plain) return plain;
    }
  }
  return null;
}
