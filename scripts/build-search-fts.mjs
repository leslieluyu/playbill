#!/usr/bin/env node
/** Rebuild SQLite FTS5 index in playbill.db for server-side search. */
import { openDb } from "./lib/db.mjs";
import { buildSearchDocs } from "./lib/search-docs.mjs";
import { tokenBlob } from "./lib/search-fts.mjs";

const db = openDb();

db.exec("DROP TABLE IF EXISTS search_fts");
db.exec(`
  CREATE VIRTUAL TABLE search_fts USING fts5(
    doc_id UNINDEXED,
    type UNINDEXED,
    href UNINDEXED,
    title_zh UNINDEXED,
    title_en UNINDEXED,
    subtitle UNINDEXED,
    tags_label UNINDEXED,
    person_key UNINDEXED,
    title_tok,
    tags_tok,
    body_tok,
    tokenize='unicode61'
  )
`);

const docs = buildSearchDocs(db);
const insert = db.prepare(`
  INSERT INTO search_fts(
    doc_id, type, href, title_zh, title_en, subtitle, tags_label, person_key,
    title_tok, tags_tok, body_tok
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec("BEGIN");
for (const d of docs) {
  const titleSrc = `${d.titleZh}\n${d.titleEn}`.trim();
  insert.run(
    d.id,
    d.type,
    d.href,
    d.titleZh,
    d.titleEn,
    d.subtitle,
    d.tagsLabel,
    d.personKey ?? "",
    tokenBlob(titleSrc, "titleZh"),
    tokenBlob(d.tags, "tags"),
    tokenBlob(d.body, "body"),
  );
}
db.exec("COMMIT");

console.log(
  `search-fts: ${docs.length} docs (${docs.filter((d) => d.type === "movie").length} movies, ` +
    `${docs.filter((d) => d.type === "tv").length} tv, ` +
    `${docs.filter((d) => d.type === "director").length} directors, ` +
    `${docs.filter((d) => d.type === "person").length} people) in playbill.db`,
);
