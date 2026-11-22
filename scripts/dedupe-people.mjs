#!/usr/bin/env node
/** Merge duplicate people rows (safe: never merge conflicting tmdb_id homonyms). */
import { openDb } from "./lib/db.mjs";
import { mergePersonInto } from "./lib/person-merge.mjs";
import {
  loosePersonName,
  personNameTokenKey,
  pickBestPerson,
  shouldMergePeople,
} from "./lib/person-match.mjs";

function unionFind(size) {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const unite = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  return { find, unite };
}

const db = openDb();
const people = db.prepare("SELECT id, en, zh, tmdb_id, douban_id, photo, bio_zh, bio_en FROM people").all();
const uf = unionFind(people.length);

const buckets = new Map();
for (let i = 0; i < people.length; i++) {
  const p = people[i];
  const keys = [];
  const l = loosePersonName(p.en);
  if (l) keys.push(`loose\0${l}`);
  const t = personNameTokenKey(p.en);
  if (t) keys.push(`tok\0${t}`);
  const zh = (p.zh ?? "").trim();
  if (zh.length >= 2) keys.push(`zh\0${zh}`);
  for (const k of keys) {
    const list = buckets.get(k) ?? [];
    list.push(i);
    buckets.set(k, list);
  }
}

for (const idxs of buckets.values()) {
  if (idxs.length < 2) continue;
  for (let a = 1; a < idxs.length; a++) {
    for (let b = 0; b < a; b++) {
      const i = idxs[a];
      const j = idxs[b];
      if (shouldMergePeople(people[i], people[j])) uf.unite(i, j);
    }
  }
}

const components = new Map();
for (let i = 0; i < people.length; i++) {
  const root = uf.find(i);
  const list = components.get(root) ?? [];
  list.push(i);
  components.set(root, list);
}

let merged = 0;
let groups = 0;
for (const idxs of components.values()) {
  if (idxs.length < 2) continue;
  groups++;
  const rows = idxs.map((i) => people[i]);
  const keep = pickBestPerson(rows);
  for (const p of rows) {
    if (p.id === keep.id) continue;
    mergePersonInto(db, p.id, keep.id);
    merged++;
  }
}

const remaining = db.prepare("SELECT count(*) AS n FROM people").get().n;
console.log(`dedupe-people: merged ${merged} rows in ${groups} groups; ${remaining} people remain`);
