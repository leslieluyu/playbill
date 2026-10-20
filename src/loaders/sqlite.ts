import type { Loader } from "astro/loaders";
import { openDb, yearsLabel } from "../../scripts/lib/db.mjs";
import { listEntryDetail, listPageTitle } from "../lib/list-display";

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

function person(p: Row) {
  return { id: String(p.id), zh: p.zh ?? undefined, en: p.en };
}

function textField(row: Row | undefined, key: string) {
  const v = row?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function worksLoader(): Loader {
  return {
    name: "sqlite-works",
    load: async ({ store, parseData }) => {
      const db = openDb();
      const people = db.prepare(
        `SELECT p.id, p.zh, p.en FROM credits c JOIN people p ON p.id = c.person_id WHERE c.work_id = ? AND c.role = ? ORDER BY c.ord`,
      );
      const listHits = db.prepare(
        `SELECT le.list_id AS list_id, le.rank AS rank, le.section_id AS section_id,
                le.chart AS chart, le.position AS position, l.title AS list_title
         FROM list_entries le
         JOIN lists l ON l.id = le.list_id
         WHERE le.work_id = ?
         ORDER BY l.ord, le.rank`,
      );
      const listHighlight = db.prepare(
        "SELECT hook, hook_en FROM list_highlights WHERE list_id = ? AND work_id = ?",
      );
      store.clear();
      for (const w of db.prepare("SELECT * FROM works ORDER BY id").all() as Row[]) {
        const ed = db
          .prepare("SELECT plot, plot_en, playbill, playbill_en FROM editorial WHERE work_id = ?")
          .get(w.id) as Row | undefined;
        const aliases = db.prepare("SELECT alias FROM work_aliases WHERE work_id = ? ORDER BY ord").all(w.id) as Row[];
        const genres = db
          .prepare("SELECT genre_id AS id, name_zh AS zh, name_en AS en FROM work_genres WHERE work_id = ? ORDER BY genre_id")
          .all(w.id) as Row[];
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
          genres: genres.map((g) => ({ id: g.id, zh: g.zh, en: g.en })),
          creators: (people.all(w.id, w.kind === "movie" ? "director" : "creator") as Row[]).map(person),
          writers: (people.all(w.id, "writer") as Row[]).map(person),
          cast: (people.all(w.id, "cast") as Row[]).map(person),
          plot: textField(ed, "plot"),
          plotEn: textField(ed, "plot_en"),
          playbill: textField(ed, "playbill"),
          playbillEn: textField(ed, "playbill_en"),
          poster: w.poster ?? undefined,
          imdbId: w.imdb_id ?? undefined,
          ratings: latestRatings(db, w.id),
          listAppearances: (listHits.all(w.id) as Row[]).map((h) => {
            const listId = String(h.list_id);
            const rank = Number(h.rank);
            const titles = listPageTitle(listId, h.list_title as string);
            const detail = listEntryDetail(
              listId,
              rank,
              h.section_id as string | null,
              h.chart as string | null,
              h.position != null ? Number(h.position) : null,
            );
            const hi = listHighlight.get(h.list_id, w.id) as Row | undefined;
            return {
              listId,
              rank,
              listZh: titles.zh,
              listEn: titles.en,
              detailZh: detail.zh,
              detailEn: detail.en,
              hook: textField(hi, "hook"),
              hookEn: textField(hi, "hook_en"),
            };
          }),
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
      const highlight = db.prepare("SELECT hook, hook_en FROM list_highlights WHERE list_id = ? AND work_id = ?");
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
            db.prepare(
              "SELECT rank, work_id, section_id, chart, position, note FROM list_entries WHERE list_id = ? ORDER BY rank",
            ).all(l.id) as Row[]
          ).map((e) => {
            const h = highlight.get(l.id, e.work_id) as Row | undefined;
            return {
              rank: e.rank,
              work: e.work_id,
              section: e.section_id ?? undefined,
              chart: e.chart ?? undefined,
              position: e.position ?? undefined,
              note: e.note ?? undefined,
              hook: h?.hook ?? undefined,
              hookEn: h?.hook_en ?? undefined,
            };
          }),
        };
        const data = await parseData({ id: l.id, data: raw });
        store.set({ id: l.id, data });
      }
      db.close();
    },
  };
}

export function peopleLoader(): Loader {
  return {
    name: "sqlite-people",
    load: async ({ store, parseData }) => {
      const db = openDb();
      const credited = db.prepare(
        `SELECT DISTINCT person_id FROM credits ORDER BY person_id`,
      );
      const worksFor = db.prepare(
        `SELECT w.id, w.zh, w.en, w.poster, w.kind, w.year_start, c.role, MIN(c.ord) AS ord
         FROM credits c JOIN works w ON w.id = c.work_id
         WHERE c.person_id = ?
         GROUP BY w.id, c.role
         ORDER BY w.year_start, w.id, c.role`,
      );
      const listHits = db.prepare(
        `SELECT le.list_id AS list_id, le.rank AS rank, le.section_id AS section_id,
                le.chart AS chart, le.position AS position, l.title AS list_title, l.ord AS list_ord
         FROM list_entries le
         JOIN lists l ON l.id = le.list_id
         WHERE le.work_id = ?
         ORDER BY l.ord, le.rank`,
      );

      const collabsFor = db.prepare(
        `SELECT p2.id AS id, p2.zh, p2.en, p2.photo,
                COUNT(DISTINCT c1.work_id) AS n
         FROM credits c1
         JOIN credits c2 ON c1.work_id = c2.work_id AND c1.person_id != c2.person_id
         JOIN people p2 ON p2.id = c2.person_id
         WHERE c1.person_id = ?
         GROUP BY p2.id
         ORDER BY n DESC, p2.en
         LIMIT 24`,
      );
      const sharedWorks = db.prepare(
        `SELECT w.id, w.zh, w.en
         FROM credits c1
         JOIN credits c2 ON c1.work_id = c2.work_id AND c2.person_id = ?
         JOIN works w ON w.id = c1.work_id
         WHERE c1.person_id = ?
         GROUP BY w.id
         ORDER BY w.year_start, w.id
         LIMIT 6`,
      );
      store.clear();
      for (const row of credited.all() as Row[]) {
        const p = db.prepare("SELECT * FROM people WHERE id = ?").get(row.person_id) as Row;
        if (!p) continue;
        const works = (worksFor.all(p.id) as Row[]).map((w) => {
          const hits = (listHits.all(w.id) as Row[]).map((h) => {
            const listId = String(h.list_id);
            const rank = Number(h.rank);
            const titles = listPageTitle(listId, h.list_title as string);
            const detail = listEntryDetail(
              listId,
              rank,
              h.section_id as string | null,
              h.chart as string | null,
              h.position != null ? Number(h.position) : null,
            );
            return {
              listId,
              rank,
              zh: titles.zh,
              en: titles.en,
              detailZh: detail.zh,
              detailEn: detail.en,
            };
          });
          const primary = hits[0];
          return {
            id: w.id,
            zh: w.zh ?? undefined,
            en: w.en,
            poster: w.poster ?? undefined,
            kind: w.kind,
            role: w.role,
            yearStart: w.year_start,
            listId: primary?.listId,
            rank: primary?.rank,
            lists: hits,
          };
        });
        const awards = (
          db
            .prepare(
              `SELECT year, category, result, work_title, work_id, ord
               FROM person_awards WHERE person_id = ? ORDER BY ord, year DESC, category`,
            )
            .all(p.id) as Row[]
        ).map((a) => ({
          year: a.year != null ? Number(a.year) : undefined,
          category: String(a.category),
          result: String(a.result) as "won" | "nominated",
          workTitle: (a.work_title as string | null) ?? undefined,
          workId: (a.work_id as string | null) ?? undefined,
        }));
        const collaborators = (collabsFor.all(p.id) as Row[]).map((c) => ({
          id: String(c.id),
          zh: c.zh ?? undefined,
          en: c.en as string,
          photo: c.photo ?? undefined,
          count: Number(c.n),
          works: (sharedWorks.all(c.id, p.id) as Row[]).map((w) => ({
            id: w.id as string,
            zh: (w.zh as string | null) ?? undefined,
            en: w.en as string,
          })),
        }));
        const raw = {
          zh: p.zh ?? undefined,
          en: p.en,
          photo: p.photo ?? undefined,
          bioZh: p.bio_zh ?? undefined,
          bioEn: p.bio_en ?? undefined,
          works,
          awards,
          collaborators,
        };
        const data = await parseData({ id: String(p.id), data: raw });
        store.set({ id: String(p.id), data });
      }
      db.close();
    },
  };
}
