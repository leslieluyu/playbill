/** Facet tags for Criterion-style list filtering. */

export type WorkGenre = { id: number; zh: string; en: string };

export type FacetTag = {
  id: string;
  group: "country" | "genre" | "form";
  zh: string;
  en: string;
};

const PLACE_EN: Record<string, string> = {
  美国: "United States",
  英国: "United Kingdom",
  法国: "France",
  日本: "Japan",
  意大利: "Italy",
  德国: "Germany",
  瑞典: "Sweden",
  墨西哥: "Mexico",
  苏联: "Soviet Union",
  捷克斯洛伐克: "Czechoslovakia",
  南斯拉夫: "Yugoslavia",
  东德: "East Germany",
  丹麦: "Denmark",
  印度: "India",
  西班牙: "Spain",
  伊朗: "Iran",
  加拿大: "Canada",
  波兰: "Poland",
  韩国: "South Korea",
  巴西: "Brazil",
  匈牙利: "Hungary",
  阿根廷: "Argentina",
  葡萄牙: "Portugal",
  芬兰: "Finland",
  比利时: "Belgium",
  挪威: "Norway",
  土耳其: "Turkey",
  荷兰: "Netherlands",
  瑞士: "Switzerland",
  新西兰: "New Zealand",
  奥地利: "Austria",
  南非: "South Africa",
  中国大陆: "China",
  中国香港: "Hong Kong",
  中国台湾: "Taiwan",
  爱尔兰: "Ireland",
  澳大利亚: "Australia",
  希腊: "Greece",
  菲律宾: "Philippines",
  拉脱维亚: "Latvia",
  阿尔及利亚: "Algeria",
  塞内加尔: "Senegal",
  卡塔尔: "Qatar",
  埃塞俄比亚: "Ethiopia",
  尼日利亚: "Nigeria",
  牙买加: "Jamaica",
  埃及: "Egypt",
  古巴: "Cuba",
  喀麦隆: "Cameroon",
  北马其顿: "North Macedonia",
  突尼斯: "Tunisia",
  危地马拉: "Guatemala",
  孟加拉国: "Bangladesh",
  安哥拉: "Angola",
  俄罗斯: "Russia",
  泰国: "Thailand",
};

const FORM_EN: Record<string, string> = {
  电影: "Film",
  纪录片: "Documentary",
  动画: "Animation",
};

const ISO_ZH: Record<string, string> = {
  SU: "苏联",
  XC: "捷克斯洛伐克",
  YU: "南斯拉夫",
  XG: "东德",
  PH: "菲律宾",
  LV: "拉脱维亚",
  DZ: "阿尔及利亚",
  SN: "塞内加尔",
  QA: "卡塔尔",
  ET: "埃塞俄比亚",
  NG: "尼日利亚",
  JM: "牙买加",
  EG: "埃及",
  CU: "古巴",
  CM: "喀麦隆",
  MK: "北马其顿",
  TN: "突尼斯",
  GT: "危地马拉",
  BD: "孟加拉国",
  AO: "安哥拉",
  US: "美国",
  GB: "英国",
  FR: "法国",
  DE: "德国",
  IT: "意大利",
  ES: "西班牙",
  JP: "日本",
  KR: "韩国",
  CN: "中国大陆",
  HK: "中国香港",
  TW: "中国台湾",
  CA: "加拿大",
  AU: "澳大利亚",
  NZ: "新西兰",
  IE: "爱尔兰",
  MX: "墨西哥",
  BR: "巴西",
  AR: "阿根廷",
  IR: "伊朗",
  IN: "印度",
  SE: "瑞典",
  DK: "丹麦",
  NO: "挪威",
  FI: "芬兰",
  PL: "波兰",
  AT: "奥地利",
  BE: "比利时",
  NL: "荷兰",
  CH: "瑞士",
  RU: "俄罗斯",
  HU: "匈牙利",
  GR: "希腊",
  PT: "葡萄牙",
  TH: "泰国",
  ZA: "南非",
  TR: "土耳其",
};

export function normalizePlacePart(part: string): string {
  const t = part.trim();
  if (!t) return "";
  return ISO_ZH[t] ?? t;
}

export function splitPlaces(place?: string): string[] {
  if (!place) return [];
  return [...new Set(place.split("、").map(normalizePlacePart).filter(Boolean))];
}

export function placeLabelEn(zh: string): string {
  return PLACE_EN[zh] ?? zh;
}

export function formLabelEn(zh: string): string {
  return FORM_EN[zh] ?? zh;
}

export function tagsForWork(work: {
  place?: string;
  form?: string;
  genres?: WorkGenre[];
}): FacetTag[] {
  const tags: FacetTag[] = [];
  for (const zh of splitPlaces(work.place)) {
    tags.push({ id: `country:${zh}`, group: "country", zh, en: placeLabelEn(zh) });
  }
  for (const g of work.genres ?? []) {
    tags.push({ id: `genre:${g.id}`, group: "genre", zh: g.zh, en: g.en });
  }
  if (work.form) {
    tags.push({ id: `form:${work.form}`, group: "form", zh: work.form, en: formLabelEn(work.form) });
  }
  return tags;
}

export type TagGroup = {
  id: "country" | "genre" | "form";
  zh: string;
  en: string;
  color: string;
  tags: { id: string; zh: string; en: string; count: number }[];
};

/** Build left-rail groups with counts from a list of works' tag arrays. */
export function buildTagGroups(tagLists: FacetTag[][]): TagGroup[] {
  const counts = new Map<string, { group: FacetTag["group"]; zh: string; en: string; count: number }>();
  for (const tags of tagLists) {
    const seen = new Set<string>();
    for (const t of tags) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      const cur = counts.get(t.id);
      if (cur) cur.count++;
      else counts.set(t.id, { group: t.group, zh: t.zh, en: t.en, count: 1 });
    }
  }
  const meta: { id: TagGroup["id"]; zh: string; en: string; color: string }[] = [
    { id: "country", zh: "国家", en: "Country", color: "#a65d3b" },
    { id: "genre", zh: "类型", en: "Genre", color: "#2f6f5e" },
    { id: "form", zh: "形式", en: "Form", color: "#3f4f8a" },
  ];
  return meta.map((m) => ({
    ...m,
    tags: [...counts.entries()]
      .filter(([, v]) => v.group === m.id)
      .map(([id, v]) => ({ id, zh: v.zh, en: v.en, count: v.count }))
      .sort((a, b) => b.count - a.count || a.zh.localeCompare(b.zh, "zh")),
  }));
}
