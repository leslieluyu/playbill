/** Douban subject helpers (rexxar API + work id parsing). */
import { isDoubanWorkId } from "./work-id.mjs";

const han = /\p{Script=Han}/u;

export function doubanIdFromWorkId(workId) {
  if (!isDoubanWorkId(workId)) return null;
  return workId.slice("douban-".length);
}

/** Prefer original_title when it is already Latin; else the first Latin aka (e.g. 夜明け → All the Long Nights). */
export function pickLatinTitle(d) {
  const candidates = [(d.original_title ?? "").trim(), ...(d.aka ?? []).map((a) => String(a).trim())];
  for (const t of candidates) {
    if (!t || han.test(t)) continue;
    if (/[A-Za-z]{2,}/.test(t)) return t.replace(/\s*\(\d{4}\).*$/, "").trim();
  }
  return null;
}

export function pickSearchTitles(d) {
  const latin = pickLatinTitle(d);
  const zh = (d.title ?? "").trim();
  const original = (d.original_title ?? "").trim();
  const queries = [...new Set([latin, original, zh].filter(Boolean))];
  return { latin, zh, original, queries };
}
