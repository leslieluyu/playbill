/** Shared chart / year-nav helpers (mirrors src/lib/list-charts.ts). */

export const KINEMA_JUNPO_CHARTS = [
  { id: "jp", zh: "日本", en: "Japanese" },
  { id: "foreign", zh: "外国", en: "Foreign" },
  { id: "art", zh: "艺术", en: "Artistic" },
  { id: "ent", zh: "娱乐", en: "Entertainment" },
  { id: "other", zh: "其他", en: "Other" },
];

export const FESTIVAL_LIST_IDS = [
  "oscar-best-picture",
  "cannes-palme-dor",
  "berlin-golden-bear",
  "venice-golden-lion",
];

export const SERIES_AWARD_LIST_IDS = [
  "emmy-outstanding-series",
  "critics-choice-tv",
  "bafta-tv",
  "tca-awards",
  "galaxy-awards-drama",
];

/** @deprecated Prefer SERIES_AWARD_LIST_IDS */
export const EMMY_LIST_IDS = SERIES_AWARD_LIST_IDS;

export const CRITICS_CHOICE_FILM_LIST_IDS = ["critics-choice-film"];

export const BEST_FILM_AWARD_LIST_IDS = [
  "critics-choice-film",
  "golden-horse-best-film",
  "hkfa-best-film",
  "bafta-best-film",
  "cesar-best-film",
];

export const SIMPLE_TV_AWARD_LIST_IDS = ["peabody-entertainment", "baeksang-best-drama"];

export const FESTIVAL_AWARD_CHARTS = [
  { id: "won", zh: "获奖", en: "Winner" },
  { id: "nom", zh: "提名", en: "Nominated" },
];

export const EMMY_SERIES_CHARTS = [
  { id: "drama", zh: "剧情", en: "Drama" },
  { id: "comedy", zh: "喜剧", en: "Comedy" },
];

export const BAFTA_TV_CHARTS = [
  { id: "drama", zh: "剧情", en: "Drama" },
  { id: "comedy", zh: "喜剧", en: "Comedy" },
  { id: "limited", zh: "限定", en: "Limited" },
];

export const TCA_AWARD_CHARTS = [
  { id: "poty", zh: "年度", en: "Program of the Year" },
  { id: "drama", zh: "剧情", en: "Drama" },
  { id: "comedy", zh: "喜剧", en: "Comedy" },
];

export const GALAXY_DRAMA_CHARTS = [
  { id: "grand", zh: "大赏", en: "Grand Prix" },
  { id: "outstanding", zh: "优秀", en: "Outstanding" },
];

export function chartsForList(listId) {
  if (listId === "kinema-junpo-ten") return KINEMA_JUNPO_CHARTS;
  if (FESTIVAL_LIST_IDS.includes(listId)) return FESTIVAL_AWARD_CHARTS;
  if (listId === "bafta-tv") return BAFTA_TV_CHARTS;
  if (listId === "tca-awards") return TCA_AWARD_CHARTS;
  if (listId === "galaxy-awards-drama") return GALAXY_DRAMA_CHARTS;
  if (listId === "emmy-outstanding-series" || listId === "critics-choice-tv") return EMMY_SERIES_CHARTS;
  return [];
}

export function chartLabel(id, listId) {
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

export function usesYearNav(listId) {
  return (
    listId === "kinema-junpo-ten" ||
    FESTIVAL_LIST_IDS.includes(listId) ||
    SERIES_AWARD_LIST_IDS.includes(listId) ||
    BEST_FILM_AWARD_LIST_IDS.includes(listId) ||
    SIMPLE_TV_AWARD_LIST_IDS.includes(listId)
  );
}

export function kjYearFromSection(section) {
  if (!section?.startsWith("y")) return undefined;
  const y = Number(section.slice(1));
  return Number.isInteger(y) ? y : undefined;
}

export function decadeOfYear(year) {
  return Math.floor(year / 10) * 10;
}
