/** Per-list entry tags (Kinema charts, festival won/nom, etc.). */

export type ListChartId = "art" | "ent" | "jp" | "foreign" | "other" | "won" | "nom";

export const FESTIVAL_LIST_IDS = [
  "oscar-best-picture",
  "cannes-palme-dor",
  "berlin-golden-bear",
  "venice-golden-lion",
] as const;

export const FESTIVAL_AWARD_CHARTS: ListChartTag[] = [
  { id: "won", zh: "获奖", en: "Winner" },
  { id: "nom", zh: "提名", en: "Nominated" },
];

export type ListChartTag = {
  id: ListChartId;
  zh: string;
  en: string;
};

export const KINEMA_JUNPO_CHARTS: ListChartTag[] = [
  { id: "jp", zh: "日本", en: "Japanese" },
  { id: "foreign", zh: "外国", en: "Foreign" },
  { id: "art", zh: "艺术", en: "Artistic" },
  { id: "ent", zh: "娱乐", en: "Entertainment" },
  { id: "other", zh: "其他", en: "Other" },
];

export function chartsForList(listId: string): ListChartTag[] {
  if (listId === "kinema-junpo-ten") return KINEMA_JUNPO_CHARTS;
  if ((FESTIVAL_LIST_IDS as readonly string[]).includes(listId)) return FESTIVAL_AWARD_CHARTS;
  return [];
}

export function chartTag(id?: string | null, listId?: string): ListChartTag | undefined {
  if (!id) return undefined;
  const pool = listId ? chartsForList(listId) : [...KINEMA_JUNPO_CHARTS, ...FESTIVAL_AWARD_CHARTS];
  return pool.find((c) => c.id === id);
}

export function usesYearNav(listId: string) {
  return listId === "kinema-junpo-ten" || (FESTIVAL_LIST_IDS as readonly string[]).includes(listId);
}

export function kjYearFromSection(section?: string): number | undefined {
  if (!section?.startsWith("y")) return undefined;
  const y = Number(section.slice(1));
  return Number.isInteger(y) ? y : undefined;
}

export function decadeOfYear(year: number) {
  return Math.floor(year / 10) * 10;
}

export type YearNavDecade = {
  decade: number;
  years: number[];
  count: number;
};

export function buildYearNav(years: number[]): YearNavDecade[] {
  const map = new Map<number, number[]>();
  for (const y of years) {
    const d = decadeOfYear(y);
    const list = map.get(d) ?? [];
    list.push(y);
    map.set(d, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b - a)
    .map(([decade, ys]) => ({
      decade,
      years: [...new Set(ys)].sort((a, b) => b - a),
      count: ys.length,
    }));
}
