import type { Loader } from "astro/loaders";
import { openDb, yearsLabel } from "../../scripts/lib/db.mjs";

type Row = Record<string, any>;

function latestRatings(db: ReturnType<typeof openDb>, workId: string) {
  const rows = db
    .prepare(
      `SELECT source, value, votes, detail, fetched_at FROM ratings r
       WHERE work_id = ? AND fetched_at = (SELECT max(fetched_at) FROM ratings WHERE work_id = r.work_id AND source = r.source)`,
    )
    .all(workId) as Row[];
  return Object.fromEntries(
    rows.map((r) => [
      r.source,
      { value: r.value, votes: r.votes ?? undefined, detail: r.detail ? JSON.parse(r.detail) : undefined, fetchedAt: r.fetched_at },
    ]),
  );
}

export function worksLoader(): Loader {
  return {
    name: "sqlite-works",
    load: async ({ store, parseData }) => {
      const db = openDb();
      const people = db.prepare(
        `SELECT p.zh, p.en FROM credits c JOIN people p ON p.id = c.person_id WHERE c.work_id = ? AND c.role = ? ORDER BY c.ord`,
      );
      store.clear();
      for (const w of db.prepare("SELECT * FROM works ORDER BY id").all() as Row[]) {
        const ed = db.prepare("SELECT plot, hook, plot_en, hook_en FROM editorial WHERE work_id = ? AND reviewed = 1").get(w.id) as Row | undefined;
        const aliases = db.prepare("SELECT alias FROM work_aliases WHERE work_id = ? ORDER BY ord").all(w.id) as Row[];
        const person = (p: Row) => ({ zh: p.zh ?? undefined, en: p.en });
        const raw = {
          kind: w.kind,
          zh: w.zh ?? undefined,
          en: w.en,
          original: w.original ?? undefined,
          alias: aliases.map((a) => a.alias),
          years: yearsLabel(w),
          yearStart: w.year_start,
          place: w.place ?? undefined,
          form: w.form ?? undefined,
          runtime: w.runtime ?? undefined,
          creators: (people.all(w.id, w.kind === "movie" ? "director" : "creator") as Row[]).map(person),
          cast: (people.all(w.id, "cast") as Row[]).map(person),
          plot: ed?.plot ?? undefined,
          hook: ed?.hook ?? undefined,
          plotEn: ed?.plot_en ?? undefined,
          hookEn: ed?.hook_en ?? undefined,
          poster: w.poster ?? undefined,
          imdbId: w.imdb_id ?? undefined,
          ratings: latestRatings(db, w.id),
        };
        const data = await parseData({ id: w.id, data: raw });
        store.set({ id: w.id, data });
      }
      db.close();
    },
  };
}

export function listsLoader(): Loader {
  return {
    name: "sqlite-lists",
    load: async ({ store, parseData }) => {
      const db = openDb();
      store.clear();
      for (const l of db.prepare("SELECT * FROM lists ORDER BY ord").all() as Row[]) {
        const raw = {
          title: l.title,
          kicker: l.kicker,
          dek: l.dek,
          source: { name: l.source_name, url: l.source_url },
          kind: l.kind,
          order: l.ord,
          sections: db
            .prepare("SELECT id, name, blurb, color FROM list_sections WHERE list_id = ? ORDER BY ord")
            .all(l.id),
          entries: (
            db.prepare("SELECT rank, work_id, section_id FROM list_entries WHERE list_id = ? ORDER BY rank").all(l.id) as Row[]
          ).map((e) => ({ rank: e.rank, work: e.work_id, section: e.section_id ?? undefined })),
        };
        const data = await parseData({ id: l.id, data: raw });
        store.set({ id: l.id, data });
      }
      db.close();
    },
  };
}
