/** Match Playbill people rows when Excel/seed ASCII names differ from TMDB diacritics. */
export function loosePersonName(s: string): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

type PersonRow = { id: string; data: { en: string; photo?: string | null; bioZh?: string | null } };

export function findPersonByEn(people: PersonRow[], en: string): PersonRow | undefined {
  const key = loosePersonName(en);
  const exact = people.filter((p) => p.data.en === en);
  if (exact.length === 1) return pickBestPerson(exact);
  const loose = people.filter((p) => loosePersonName(p.data.en) === key);
  if (loose.length) return pickBestPerson(loose);
  return undefined;
}

function pickBestPerson(candidates: PersonRow[]): PersonRow {
  return [...candidates].sort((a, b) => scorePerson(b) - scorePerson(a))[0];
}

function scorePerson(p: PersonRow): number {
  let s = 0;
  if (p.data.photo) s += 100;
  const bio = p.data.bioZh?.trim() ?? "";
  if (bio.length > 80) s += 50;
  else if (bio.length > 0) s += 10;
  if (/克\/美国|^[a-z]\//.test(bio)) s -= 200;
  return s;
}
