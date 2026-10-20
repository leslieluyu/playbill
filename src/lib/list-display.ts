import { lists as listCopy } from "../i18n";
import { listBadgeLabel } from "./list-labels";

/** Primary label on person/work “收录于” badges — the list name, not chart/year tags. */
export function listPageTitle(listId: string, dbTitle?: string) {
  const zh = dbTitle ?? listId;
  const en = listCopy[listId]?.title ?? dbTitle ?? listId;
  return { zh, en };
}

/** Secondary line for a specific row (旬报 year/chart, NYT rank, Criterion spine, …). */
export function listEntryDetail(
  listId: string,
  rank: number,
  sectionId?: string | null,
  chart?: string | null,
  position?: number | null,
) {
  return listBadgeLabel(listId, rank, sectionId, chart, position);
}
