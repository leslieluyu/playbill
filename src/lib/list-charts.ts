/** Per-list entry tags (Kinema charts, festival won/nom, etc.). */

export type ListChartId =
  | "art"
  | "ent"
  | "jp"
  | "foreign"
  | "other"
  | "won"
  | "nom"
  | "drama"
  | "comedy"
  | "limited"
  | "poty"
  | "grand"
  | "outstanding";

export const FESTIVAL_LIST_IDS = [
  "oscar-best-picture",
  "cannes-palme-dor",
  "berlin-golden-bear",
  "venice-golden-lion",
] as const;

/** Multi-year series award rolls with compact win rows (Emmy-style). */
export const SERIES_AWARD_LIST_IDS = [
  "emmy-outstanding-series",
  "critics-choice-tv",
  "bafta-tv",
  "tca-awards",
  "galaxy-awards-drama",
] as const;

/** @deprecated Prefer SERIES_AWARD_LIST_IDS */
export const EMMY_LIST_IDS = SERIES_AWARD_LIST_IDS;

export const CRITICS_CHOICE_FILM_LIST_IDS = ["critics-choice-film"] as const;

/** National / academy Best Film winner rolls (ceremony-year sidebar, no won/nom tags). */
export const BEST_FILM_AWARD_LIST_IDS = [
  "critics-choice-film",
  "golden-horse-best-film",
  "hkfa-best-film",
  "bafta-best-film",
  "cesar-best-film",
] as const;

/** TV award rolls with ceremony-year sidebar and no chart tags. */
export const SIMPLE_TV_AWARD_LIST_IDS = [
  "peabody-entertainment",
  "baeksang-best-drama",
] as const;

export const FESTIVAL_AWARD_CHARTS: ListChartTag[] = [
  { id: "won", zh: "获奖", en: "Winner" },
  { id: "nom", zh: "提名", en: "Nominated" },
];

export const EMMY_SERIES_CHARTS: ListChartTag[] = [
  { id: "drama", zh: "剧情", en: "Drama" },
  { id: "comedy", zh: "喜剧", en: "Comedy" },
];

export const BAFTA_TV_CHARTS: ListChartTag[] = [
  { id: "drama", zh: "剧情", en: "Drama" },
  { id: "comedy", zh: "喜剧", en: "Comedy" },
  { id: "limited", zh: "限定", en: "Limited" },
];

export const TCA_AWARD_CHARTS: ListChartTag[] = [
  { id: "poty", zh: "年度", en: "Program of the Year" },
  { id: "drama", zh: "剧情", en: "Drama" },
  { id: "comedy", zh: "喜剧", en: "Comedy" },
];

export const GALAXY_DRAMA_CHARTS: ListChartTag[] = [
  { id: "grand", zh: "大赏", en: "Grand Prix" },
  { id: "outstanding", zh: "优秀", en: "Outstanding" },
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
  if (listId === "bafta-tv") return BAFTA_TV_CHARTS;
  if (listId === "tca-awards") return TCA_AWARD_CHARTS;
  if (listId === "galaxy-awards-drama") return GALAXY_DRAMA_CHARTS;
  if (listId === "emmy-outstanding-series" || listId === "critics-choice-tv") return EMMY_SERIES_CHARTS;
  return [];
}

export function chartTag(id?: string | null, listId?: string): ListChartTag | undefined {
  if (!id) return undefined;
  const pool = listId
    ? chartsForList(listId)
    : [
        ...KINEMA_JUNPO_CHARTS,
        ...FESTIVAL_AWARD_CHARTS,
        ...EMMY_SERIES_CHARTS,
        ...BAFTA_TV_CHARTS,
        ...TCA_AWARD_CHARTS,
        ...GALAXY_DRAMA_CHARTS,
      ];
  return pool.find((c) => c.id === id);
}

export function usesYearNav(listId: string) {
  return (
    listId === "kinema-junpo-ten" ||
    (FESTIVAL_LIST_IDS as readonly string[]).includes(listId) ||
    (SERIES_AWARD_LIST_IDS as readonly string[]).includes(listId) ||
    (BEST_FILM_AWARD_LIST_IDS as readonly string[]).includes(listId) ||
    (SIMPLE_TV_AWARD_LIST_IDS as readonly string[]).includes(listId)
  );
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
