#!/usr/bin/env node
// TMDB then Douban for the three festival lists (slow Douban gap to reduce IP clashes).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lists = ["oscar-best-picture", "cannes-palme-dor", "berlin-golden-bear", "venice-golden-lion"];
const doubanGap = process.env.DOUBAN_GAP_MS ?? "28000";

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} → ${code}`))));
  });
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

for (const listId of lists) {
  console.error(`\n=== tmdb ${listId} ===`);
  await run(npm, ["run", "tmdb", "--", "--list", listId]);
}

console.error("\n=== fill-plots (TMDB + translate + wiki) for festival lists ===");
for (const listId of lists) {
  await run(npm, ["run", "fill-plots", "--", "--list", listId]);
}

for (const listId of lists) {
  console.error(`\n=== douban ${listId} (gap ${doubanGap}ms) ===`);
  await run(npm, ["run", "douban", "--", "--list", listId], { DOUBAN_GAP_MS: doubanGap });
}

console.error("\nfestival-enrich: done");
