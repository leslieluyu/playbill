import { workPath } from "./work-path";

/** Lists that use a custom catalog UI instead of #show-N rows. */
export const TILE_LIST_IDS = ["great-directors"] as const;

export function listEntryHref(
  listId: string,
  rank: number,
  workId: string,
  kind: "movie" | "tv",
): string {
  if ((TILE_LIST_IDS as readonly string[]).includes(listId)) {
    return workPath(kind, workId);
  }
  return `/${listId}/#show-${rank}`;
}
