/** Latin / original line under Chinese title (avoid repeating zh inside works.en). */
export function workSubtitle(w: { zh?: string; en: string; original?: string }) {
  const zh = w.zh?.trim();
  const en = w.en.trim();
  if (!zh) return en;
  if (en === zh) {
    const o = w.original?.trim();
    return o && o !== zh ? o : undefined;
  }
  if (en.startsWith(zh)) {
    const rest = en.slice(zh.length).trim();
    if (rest) return rest;
  }
  if (en.includes(zh)) return en.replace(zh, "").trim() || undefined;
  return en;
}
