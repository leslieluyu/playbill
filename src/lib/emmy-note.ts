/** Parse / format Emmy list_entries.note season tokens (e.g. s4, s5b). */

export type EmmySeason = {
  /** 1-based season number */
  n: number;
  /** a = 上半部, b = 下半部 (e.g. Breaking Bad S5) */
  half?: "a" | "b";
};

const TOKEN_RE = /^s(\d+)([ab])?(?:\s*·\s*(.*))?$/i;

export function parseEmmyNote(note?: string | null): {
  season: EmmySeason | null;
  rest: string;
} {
  if (!note?.trim()) return { season: null, rest: "" };
  const m = note.trim().match(TOKEN_RE);
  if (!m) return { season: null, rest: note.trim() };
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1) return { season: null, rest: note.trim() };
  const half = m[2] ? (m[2].toLowerCase() as "a" | "b") : undefined;
  return { season: { n, half }, rest: (m[3] ?? "").trim() };
}

export function formatEmmySeasonZh(season: EmmySeason | null | undefined, unknown = "待核实"): string {
  if (!season) return unknown;
  const half = season.half === "a" ? "上半部" : season.half === "b" ? "下半部" : "";
  return half ? `第${season.n}季${half}` : `第${season.n}季`;
}

export function formatEmmySeasonEn(season: EmmySeason | null | undefined, unknown = "season TBD"): string {
  if (!season) return unknown;
  const half = season.half === "a" ? "A" : season.half === "b" ? "B" : "";
  return half ? `Season ${season.n}${half}` : `Season ${season.n}`;
}

export function formatEmmyWinLineZh(
  year: number,
  chartZh: string,
  season: EmmySeason | null | undefined,
): string {
  return [String(year), chartZh, formatEmmySeasonZh(season)].filter(Boolean).join(" · ");
}

export function formatEmmyWinLineEn(
  year: number,
  chartEn: string,
  season: EmmySeason | null | undefined,
): string {
  return [String(year), chartEn, formatEmmySeasonEn(season)].filter(Boolean).join(" · ");
}
