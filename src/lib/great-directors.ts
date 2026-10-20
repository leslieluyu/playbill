/** Tag ids for /great-directors/ filters (keep in sync with scripts/lib/great-directors-tags.mjs). */

export type GdTag = { id: string; zh: string; en: string };

export const GD_MASTER_TAGS: GdTag[] = [
  { id: "ss2002", zh: "《视与听》2002 大师", en: "Sight & Sound 2002 directors" },
  { id: "ss2002-critic", zh: "视与听 · 影评人十佳", en: "S&S 2002 · critics' poll" },
  { id: "ss2002-director", zh: "视与听 · 导演十佳", en: "S&S 2002 · directors' poll" },
];

export const GD_STYLE_TAGS: GdTag[] = [
  { id: "german-expressionism", zh: "德国表现主义", en: "German Expressionism" },
  { id: "soviet-montage", zh: "苏联蒙太奇学派", en: "Soviet montage" },
  { id: "french-impressionism", zh: "法国印象主义", en: "French Impressionism" },
  { id: "surrealism", zh: "超现实主义", en: "Surrealism" },
  { id: "film-noir", zh: "黑色电影", en: "Film noir" },
  { id: "neue-sachlichkeit", zh: "新客观派", en: "Neue Sachlichkeit" },
  { id: "new-german", zh: "新德国电影", en: "New German Cinema" },
  { id: "cinema-novo", zh: "巴西新电影", en: "Cinema Novo" },
  { id: "japanese-new-wave", zh: "日本新浪潮", en: "Japanese New Wave" },
  { id: "nouvelle-vague", zh: "法国新浪潮", en: "French New Wave" },
  { id: "czech-new-wave", zh: "捷克新浪潮", en: "Czech New Wave" },
  { id: "italian-neorealism", zh: "意大利新现实主义", en: "Italian neorealism" },
  { id: "swedish-classical", zh: "瑞典古典电影学派", en: "Swedish classical cinema" },
  { id: "dogme95", zh: "道格玛 95", en: "Dogme 95" },
  { id: "finnish-minimal", zh: "芬兰沉默 / 极简派", en: "Finnish minimalism" },
  { id: "chinese-new", zh: "华语新电影", en: "Chinese New Wave" },
];

export const GD_AWARD_TAGS: GdTag[] = [
  { id: "oscar", zh: "奥斯卡", en: "Oscar" },
  { id: "cannes", zh: "戛纳", en: "Cannes" },
  { id: "berlin", zh: "柏林", en: "Berlin" },
  { id: "venice", zh: "威尼斯", en: "Venice" },
  { id: "golden-globe", zh: "金球奖", en: "Golden Globe" },
  { id: "bafta", zh: "BAFTA", en: "BAFTA" },
  { id: "cesar", zh: "凯撒奖", en: "César" },
];

export function parseChartTags(chart?: string | null): string[] {
  if (!chart) return [];
  return chart.split("|").map((s) => s.trim()).filter(Boolean);
}
