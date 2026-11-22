import { tokenize } from "./search-tokenize.mjs";

export function tokenBlob(text, fieldName) {
  return tokenize(text ?? "", fieldName).join(" ");
}

export function normalizeSearchQuery(raw) {
  const parts = String(raw ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const kept = parts.filter((p) => {
    if (/[\u3400-\u9fff]/.test(p)) return p.length >= 1;
    return p.length >= 2;
  });
  return kept.join(" ");
}

/** Single Han character: too many body hits; rank by title prefix instead of raw bm25. */
export function isSingleHanQuery(raw) {
  const n = normalizeSearchQuery(raw);
  return n.length === 1 && /^[\u3400-\u9fff\uf900-\ufaff]$/u.test(n);
}

function ftsTermsFromQuery(query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  const terms = new Set();
  for (const part of normalized.split(/\s+/)) {
    for (const t of tokenize(part, "titleZh")) terms.add(t);
    for (const t of tokenize(part, "titleEn")) terms.add(t);
  }
  return [...terms];
}

export function ftsEscapeTerm(term) {
  return String(term).replace(/"/g, '""');
}

/** Build FTS5 MATCH (pre-tokenized unicode61 index; AND across query tokens). */
export function buildFtsMatch(query) {
  const terms = ftsTermsFromQuery(query);
  if (!terms.length) return null;
  return terms.map((t) => `"${ftsEscapeTerm(t)}"`).join(" AND ");
}

/** Title + tags only (skip long bios that flood single-character Han queries). */
export function buildFtsMatchTitleTags(query) {
  const terms = ftsTermsFromQuery(query);
  if (!terms.length) return null;
  const clause = terms.map((t) => `"${ftsEscapeTerm(t)}"`).join(" AND ");
  return `{title_tok tags_tok} : ${clause}`;
}
