/** Short badge labels for list_entries (shared by people + work pages). */
export function listBadgeLabel(
  listId: string,
  rank: number,
  sectionId?: string | null,
  chart?: string | null,
  position?: number | null,
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
