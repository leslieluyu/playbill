#!/usr/bin/env node
// Pre-deploy list integrity: DB nav counts, ranks, deep-link targets, person badges.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runListVerify } from "./lib/list-verify.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const withDist = process.argv.includes("--dist");
const distDir = withDist ? path.join(ROOT, "dist") : undefined;

const { ok, errors, listIds } = runListVerify({ distDir });

if (ok) {
  console.log(`verify-lists: OK (${listIds.length} lists${withDist ? ", dist checked" : ", db only"})`);
  process.exit(0);
}

console.error(`verify-lists: FAILED (${errors.length} issues)`);
for (const e of errors) {
  console.error(`  [${e.listId}] ${e.message}`);
}
process.exit(1);
