/** Keep in sync with scripts/lib/search-tokenize.mjs */

export function tokenize(text: string, fieldName?: string): string[] {
  if (text == null || text === "") return [];
  const s = String(text).normalize("NFKC").toLowerCase();
  const out = new Set<string>();
  const longBody = fieldName === "body" && s.length > 400;
  for (const m of s.matchAll(/[a-z0-9]+/g)) {
    if (m[0].length >= 2 || /\d/.test(m[0])) out.add(m[0]);
  }
  for (const run of s.matchAll(/[\u3400-\u9fff\uf900-\ufaff]+/g)) {
    const r = run[0];
    for (let i = 0; i < r.length; i++) {
      out.add(r[i]);
      if (!longBody && i + 1 < r.length) out.add(r.slice(i, i + 2));
    }
  }
  return [...out];
}

export function processTerm(term: string) {
  return term;
}

export const MINI_SEARCH_OPTIONS = {
  fields: ["titleZh", "titleEn", "subtitle", "tags", "body"],
  storeFields: ["type", "href", "titleZh", "titleEn", "subtitle", "tagsLabel"],
  tokenize,
  processTerm,
  searchOptions: {
    boost: { titleZh: 4, titleEn: 4, subtitle: 2, tags: 3, body: 1 },
    prefix: true,
    fuzzy: 0.15,
  },
};
