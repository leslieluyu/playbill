// Merge duplicate people rows: move credits/awards onto keep id, coalesce metadata, delete dup.
// usage: node scripts/merge-person.mjs <fromId> <toId> [<fromId> <toId> ...]
import { openDb } from "./lib/db.mjs";
import { mergePersonInto } from "./lib/person-merge.mjs";

const args = process.argv.slice(2).map(Number);
if (args.length < 2 || args.length % 2 !== 0 || args.some((n) => !Number.isInteger(n))) {
  console.error("usage: node scripts/merge-person.mjs <fromId> <toId> [...]");
  process.exit(1);
}

const db = openDb();
for (let i = 0; i < args.length; i += 2) {
  mergePersonInto(db, args[i], args[i + 1]);
  const to = db.prepare("SELECT zh, en FROM people WHERE id = ?").get(args[i + 1]);
  const n = db.prepare("SELECT COUNT(DISTINCT work_id) AS n FROM credits WHERE person_id = ?").get(args[i + 1]).n;
  console.log(`merged person ${args[i]} → ${args[i + 1]} (${to?.zh || to?.en}): ${n} works on keep row`);
}
