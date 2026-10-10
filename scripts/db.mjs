// npm run db -- export   write db/export/*.jsonl from db/playbill.db
// npm run db -- import   rebuild db/playbill.db from db/export/*.jsonl
import { openDb, exportDb, importDb } from "./lib/db.mjs";

const cmd = process.argv[2];
if (cmd === "export") {
  exportDb(openDb());
} else if (cmd === "import") {
  importDb();
} else {
  console.error("usage: npm run db -- export|import");
  process.exit(1);
}
