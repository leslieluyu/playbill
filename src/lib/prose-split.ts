/** Split long bios into readable paragraphs for display. */
export function paragraphsFromBio(text: string): string[] {
  const t = (text ?? "").trim();
  if (!t) return [];
  if (/\n\s*\n/.test(t)) {
    return t
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  const sentences = t.split(/(?<=[。！？!?])\s*/).filter((s) => s.trim());
  if (sentences.length <= 2) return [t];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    out.push(sentences.slice(i, i + 2).join("").trim());
  }
  return out.filter(Boolean);
}
