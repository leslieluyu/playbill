/** TSPDT director countries (中文) → continent for sidebar grouping. */

export type GdContinentId = "asia" | "europe" | "americas" | "oceania" | "africa";

export const GD_CONTINENT_ORDER: GdContinentId[] = [
  "asia",
  "europe",
  "americas",
  "oceania",
  "africa",
];

export const GD_CONTINENT_LABEL: Record<GdContinentId, { zh: string; en: string }> = {
  asia: { zh: "亚洲", en: "Asia" },
  europe: { zh: "欧洲", en: "Europe" },
  americas: { zh: "美洲", en: "Americas" },
  oceania: { zh: "大洋洲", en: "Oceania" },
  africa: { zh: "非洲", en: "Africa" },
};

/** Canonical country label → continent */
const COUNTRY_CONTINENT: Record<string, GdContinentId> = {
  中国: "asia",
  香港: "asia",
  中国台湾: "asia",
  中国香港: "asia",
  日本: "asia",
  韩国: "asia",
  印度: "asia",
  伊朗: "asia",
  泰国: "asia",
  马来西亚: "asia",
  土耳其: "asia",
  格鲁吉亚: "asia",
  亚美尼亚: "asia",
  立陶宛: "europe",
  乌克兰: "europe",
  台湾: "asia",
  苏联: "europe",
  俄罗斯: "europe",
  英国: "europe",
  法国: "europe",
  德国: "europe",
  西德: "europe",
  意大利: "europe",
  西班牙: "europe",
  葡萄牙: "europe",
  荷兰: "europe",
  比利时: "europe",
  瑞士: "europe",
  奥地利: "europe",
  瑞典: "europe",
  芬兰: "europe",
  丹麦: "europe",
  挪威: "europe",
  波兰: "europe",
  捷克: "europe",
  捷克斯洛伐克: "europe",
  匈牙利: "europe",
  希腊: "europe",
  塞尔维亚: "europe",
  南斯拉夫: "europe",
  美国: "americas",
  加拿大: "americas",
  墨西哥: "americas",
  古巴: "americas",
  巴西: "americas",
  阿根廷: "americas",
  智利: "americas",
  澳大利亚: "oceania",
  新西兰: "oceania",
  塞内加尔: "africa",
};

const KNOWN_COUNTRIES = new Set(Object.keys(COUNTRY_CONTINENT));

const ALIAS: Record<string, string> = {
  西德: "德国",
  捷克斯洛伐克: "捷克",
  苏联: "俄罗斯",
  中国香港: "香港",
  中国台湾: "台湾",
  亚美尼亚裔: "亚美尼亚",
};

function stripBirthNote(s: string): string[] {
  const t = s.trim();
  if (!t) return [];
  if (/^\d+$/.test(t)) return [];

  const out: string[] = [];
  const paren = t.match(/^([^（(]+)(?:[（(]([^）)]+)[）)])?$/);
  if (!paren) {
    out.push(t.replace(/[）)]$/, "").replace(/^[（(]/, ""));
    return out.filter(Boolean);
  }
  const main = paren[1].trim();
  const note = (paren[2] ?? "").trim();
  if (main) out.push(main);
  if (note) {
    const born = note.replace(/出生$/, "").trim();
    if (born && born !== main) out.push(born);
  }
  return out;
}

/** Fix docx parse glitches and expand dual-nationality notes. */
export function normalizeDirectorCountries(raw: string[]): string[] {
  const merged = raw.join("、").replace(/\s+/g, "");
  const pieces =
    merged.includes("、") || merged.includes("/")
      ? merged.split(/[/、]/)
      : raw;

  const out: string[] = [];
  for (let p of pieces) {
    p = p.trim();
    if (!p || /^\d+$/.test(p) || p.includes("与")) continue;
    if (p === "台湾)") p = "台湾";
    if (p.startsWith("中国(香港") || p.startsWith("中国（香港")) {
      out.push("中国", "香港");
      continue;
    }
    for (const part of stripBirthNote(p)) {
      const canon = ALIAS[part] ?? part;
      if (canon && !/^\d+$/.test(canon) && (KNOWN_COUNTRIES.has(canon) || canon.length <= 8)) {
        out.push(canon);
      }
    }
  }
  return [...new Set(out)];
}

export function continentOfCountry(country: string): GdContinentId {
  return COUNTRY_CONTINENT[country] ?? "europe";
}

export function groupCountriesByContinent(
  countries: string[],
): { id: GdContinentId; countries: string[] }[] {
  const byCont = new Map<GdContinentId, string[]>();
  for (const c of countries) {
    const id = continentOfCountry(c);
    const list = byCont.get(id) ?? [];
    list.push(c);
    byCont.set(id, list);
  }
  return GD_CONTINENT_ORDER.filter((id) => byCont.has(id)).map((id) => ({
    id,
    countries: (byCont.get(id) ?? []).sort((a, b) => a.localeCompare(b, "zh")),
  }));
}

export function countDirectorsPerCountry(
  directors: { countries: string[] }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of directors) {
    const cs = normalizeDirectorCountries(d.countries);
    for (const c of cs) m.set(c, (m.get(c) ?? 0) + 1);
  }
  return m;
}
