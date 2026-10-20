/** Canonical URL for a work (internal `works.id`). */
export function workPath(kind: "movie" | "tv", id: string) {
  const seg = kind === "tv" ? "tvs" : "movies";
  return `/${seg}/${encodeURIComponent(id)}/`;
}
