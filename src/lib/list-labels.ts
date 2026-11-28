import { formatEmmySeasonEn, formatEmmySeasonZh, parseEmmyNote } from "./emmy-note";

/** Short badge labels for list_entries (shared by people + work pages). */
export function listBadgeLabel(
  listId: string,
  rank: number,
  sectionId?: string | null,
  chart?: string | null,
  position?: number | null,
  note?: string | null,
) {
  if (listId === "criterion-spine") {
    const n = String(rank).padStart(3, "0");
    return { zh: `标准收藏 #${n}`, en: `Criterion #${n}` };
  }
  if (listId === "nyt-100-movies") {
    return { zh: `21世纪电影 ${rank}`, en: `NYT Movies ${rank}` };
  }
  if (listId === "nyt-100-tv") {
    return { zh: `21世纪剧集 ${rank}`, en: `NYT TV ${rank}` };
  }
  if (
    listId === "oscar-best-picture" ||
    listId === "cannes-palme-dor" ||
    listId === "berlin-golden-bear" ||
    listId === "venice-golden-lion"
  ) {
    const year = sectionId?.startsWith("y") ? sectionId.slice(1) : "";
    const tagZh = chart === "won" ? "获奖" : chart === "nom" ? "提名" : "";
    const tagEn = chart === "won" ? "Winner" : chart === "nom" ? "Nominated" : "";
    if (year && tagZh) return { zh: `${year} · ${tagZh}`, en: `${year} · ${tagEn}` };
    const short = {
      "oscar-best-picture": { zh: "奥斯卡最佳影片", en: "Oscar Best Picture" },
      "cannes-palme-dor": { zh: "戛纳金棕榈", en: "Cannes Palme d'Or" },
      "berlin-golden-bear": { zh: "柏林金熊", en: "Berlin Golden Bear" },
      "venice-golden-lion": { zh: "威尼斯金狮", en: "Venice Golden Lion" },
    } as const;
    return short[listId as keyof typeof short];
  }
  if (
    listId === "emmy-outstanding-series" ||
    listId === "critics-choice-tv" ||
    listId === "bafta-tv" ||
    listId === "tca-awards" ||
    listId === "galaxy-awards-drama"
  ) {
    const year = sectionId?.startsWith("y") ? sectionId.slice(1) : "";
    const tagZh =
      chart === "drama"
        ? "剧情"
        : chart === "comedy"
          ? "喜剧"
          : chart === "limited"
            ? "限定"
            : chart === "poty"
              ? "年度"
              : chart === "grand"
                ? "大赏"
                : chart === "outstanding"
                  ? "优秀"
                  : "";
    const tagEn =
      chart === "drama"
        ? "Drama"
        : chart === "comedy"
          ? "Comedy"
          : chart === "limited"
            ? "Limited"
            : chart === "poty"
              ? "Program of the Year"
              : chart === "grand"
                ? "Grand Prix"
                : chart === "outstanding"
                  ? "Outstanding"
                  : "";
    const { season } = parseEmmyNote(note);
    const seasonZh = season ? formatEmmySeasonZh(season) : "";
    const seasonEn = season ? formatEmmySeasonEn(season) : "";
    if (year && tagZh) {
      return {
        zh: [year, tagZh, seasonZh].filter(Boolean).join(" · "),
        en: [year, tagEn, seasonEn].filter(Boolean).join(" · "),
      };
    }
    const short = {
      "emmy-outstanding-series": { zh: "艾美奖最佳剧集", en: "Emmy Outstanding Series" },
      "critics-choice-tv": { zh: "评论家选择奖最佳剧集", en: "Critics Choice Best Series" },
      "bafta-tv": { zh: "英国电视学院奖", en: "BAFTA Television" },
      "tca-awards": { zh: "电视评论家协会奖", en: "TCA Awards" },
      "galaxy-awards-drama": { zh: "银河奖 · 电视剧", en: "Galaxy Awards · Drama" },
    } as const;
    return short[listId as keyof typeof short];
  }
  if (listId === "peabody-entertainment") {
    const year = sectionId?.startsWith("y") ? sectionId.slice(1) : "";
    if (year) return { zh: `${year} · 皮博迪`, en: `${year} · Peabody` };
    return { zh: "皮博迪奖 · 娱乐剧集", en: "Peabody · Entertainment" };
  }
  if (listId === "baeksang-best-drama") {
    const year = sectionId?.startsWith("y") ? sectionId.slice(1) : "";
    if (year) return { zh: `${year} · 最佳电视剧`, en: `${year} · Best Drama` };
    return { zh: "百想艺术大赏最佳电视剧", en: "Baeksang Best Drama" };
  }
  if (listId === "critics-choice-film") {
    const year = sectionId?.startsWith("y") ? sectionId.slice(1) : "";
    if (year) return { zh: `${year} · 最佳影片`, en: `${year} · Best Picture` };
    return { zh: "评论家选择奖最佳影片", en: "Critics Choice Best Picture" };
  }
  if (
    listId === "golden-horse-best-film" ||
    listId === "hkfa-best-film" ||
    listId === "bafta-best-film" ||
    listId === "cesar-best-film"
  ) {
    const year = sectionId?.startsWith("y") ? sectionId.slice(1) : "";
    const short = {
      "golden-horse-best-film": { zh: "金马奖最佳剧情片", en: "Golden Horse Best Film" },
      "hkfa-best-film": { zh: "香港金像奖最佳电影", en: "HKFA Best Film" },
      "bafta-best-film": { zh: "英国电影学院奖最佳影片", en: "BAFTA Best Film" },
      "cesar-best-film": { zh: "凯撒奖最佳影片", en: "César Best Film" },
    } as const;
    if (year) return { zh: `${year} · 最佳影片`, en: `${year} · Best Film` };
    return short[listId];
  }
  if (listId === "tspdt-1000") {
    return { zh: `TSPDT ${rank}`, en: `TSPDT ${rank}` };
  }
  if (listId === "kinema-junpo-ten") {
    const year = sectionId?.startsWith("y") ? sectionId.slice(1) : "";
    const chartZh =
      chart === "jp"
        ? "日本"
        : chart === "foreign"
          ? "外国"
          : chart === "art"
            ? "艺术"
            : chart === "ent"
              ? "娱乐"
              : chart === "other"
                ? "其他"
                : "";
    const chartEn =
      chart === "jp"
        ? "JP"
        : chart === "foreign"
          ? "Foreign"
          : chart === "art"
            ? "Art"
            : chart === "ent"
              ? "Ent"
              : chart === "other"
                ? "Other"
                : "";
    const pos = position != null ? `#${position}` : "";
    if (year && chartZh) {
      return {
        zh: `${year} ${chartZh} ${pos}`.trim(),
        en: `${year} ${chartEn} ${pos}`.trim(),
      };
    }
    return { zh: `旬报 ${rank}`, en: `KJ ${rank}` };
  }
  return { zh: `${listId} ${rank}`, en: `${listId} ${rank}` };
}
