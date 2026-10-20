import {
  GD_AWARD_TAGS,
  GD_MASTER_TAGS,
  GD_STYLE_TAGS,
  type GdTag,
} from "./great-directors";

const ALL = [...GD_MASTER_TAGS, ...GD_STYLE_TAGS, ...GD_AWARD_TAGS];

export function gdTagLabel(id: string): GdTag | undefined {
  return ALL.find((t) => t.id === id);
}

export function countDirectorTags(
  directors: { masterTags: string[]; styleTags: string[]; chartTags: string[] }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of directors) {
    const ids = new Set([...d.masterTags, ...d.styleTags, ...d.chartTags]);
    for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}
