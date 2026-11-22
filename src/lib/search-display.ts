export const SEARCH_TYPE_ORDER = ["movie", "tv", "director", "person"] as const;

export type SearchDocType = (typeof SEARCH_TYPE_ORDER)[number];

export const SEARCH_TYPE_ZH: Record<SearchDocType, string> = {
  movie: "电影",
  tv: "剧集",
  director: "导演",
  person: "人物",
};

export const SEARCH_TYPE_EN: Record<SearchDocType, string> = {
  movie: "Films",
  tv: "TV",
  director: "Directors",
  person: "People",
};

/** One meta line — avoids duplicating subtitle and tagsLabel. */
export function searchHitMeta(subtitle: string, tagsLabel: string): string {
  const sub = (subtitle ?? "").trim();
  const tags = (tagsLabel ?? "").trim();
  if (!tags) return sub;
  if (!sub || tags.includes(sub)) return tags;
  return `${sub} · ${tags}`;
}
