/** Shared Kinema Junpo chart labels (mirrors src/lib/list-charts.ts). */

export const KINEMA_JUNPO_CHARTS = [
  { id: "jp", zh: "日本", en: "Japanese" },
  { id: "foreign", zh: "外国", en: "Foreign" },
  { id: "art", zh: "艺术", en: "Artistic" },
  { id: "ent", zh: "娱乐", en: "Entertainment" },
  { id: "other", zh: "其他", en: "Other" },
];

export const FESTIVAL_LIST_IDS = ["cannes-palme-dor", "berlin-golden-bear", "venice-golden-lion"];

export const FESTIVAL_AWARD_CHARTS = [
  { id: "won", zh: "获奖", en: "Winner" },
  { id: "nom", zh: "提名", en: "Nominated" },
];

export function chartsForList(listId) {
  if (listId === "kinema-junpo-ten") return KINEMA_JUNPO_CHARTS;
  if (FESTIVAL_LIST_IDS.includes(listId)) return FESTIVAL_AWARD_CHARTS;
  return [];
}

export function chartLabel(id, listId) {
  const pool = listId ? chartsForList(listId) : [...KINEMA_JUNPO_CHARTS, ...FESTIVAL_AWARD_CHARTS];
  return pool.find((c) => c.id === id);
}

export function usesYearNav(listId) {
  return listId === "kinema-junpo-ten" || FESTIVAL_LIST_IDS.includes(listId);
}

export function kjYearFromSection(section) {
  if (!section?.startsWith("y")) return undefined;
  const y = Number(section.slice(1));
  return Number.isInteger(y) ? y : undefined;
}

export function decadeOfYear(year) {
  return Math.floor(year / 10) * 10;
}
