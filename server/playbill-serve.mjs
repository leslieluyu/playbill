#!/usr/bin/env node
/**
 * Production server: static site + GET /api/search (SQLite FTS5).
 *
 * Env:
 *   PLAYBILL_STATIC — path to dist/ or deployed static root
 *   PLAYBILL_DB     — path to playbill.db (default: repo db/playbill.db)
 *   PLAYBILL_PORT   — listen port (default 8787)
 *   PLAYBILL_HOST   — bind address (default 127.0.0.1)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { searchCatalog } from "./search.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const apiOnly = process.argv.includes("--api-only");
const STATIC = process.env.PLAYBILL_STATIC ?? path.join(ROOT, "dist");
const DB_PATH = process.env.PLAYBILL_DB ?? path.join(ROOT, "db/playbill.db");
const PORT = Number(process.env.PLAYBILL_PORT ?? 8787);
const HOST = process.env.PLAYBILL_HOST ?? "127.0.0.1";

let db;
function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH, { readOnly: true });
  }
  return db;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded.replace(/^\//, "") || "index.html";
  const normalized = path.normalize(rel);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return null;
  return path.join(STATIC, normalized);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function handleSearch(req, res, url) {
  const q = url.searchParams.get("q") ?? "";
  if (q.length > 120) {
    sendJson(res, 400, { error: "query too long" });
    return;
  }
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 24) || 24, 40);
  try {
    getDb();
  } catch (e) {
    sendJson(res, 503, { error: "database unavailable", detail: String(e.message ?? e) });
    return;
  }
  const hits = searchCatalog(getDb(), q, limit);
  sendJson(res, 200, { hits });
}

function serveStatic(req, res, urlPath) {
  let filePath = safePath(urlPath);
  if (!filePath) {
    res.writeHead(400);
    res.end("bad path");
    return;
  }
  if (urlPath.endsWith("/") || !path.extname(filePath)) {
    const asDir = path.join(filePath, "index.html");
    if (fs.existsSync(asDir)) filePath = asDir;
    else if (fs.existsSync(filePath + ".html")) filePath = filePath + ".html";
    else if (fs.existsSync(path.join(filePath, "index.html"))) filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400",
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    res.writeHead(204, { "Access-Control-Allow-Methods": "GET, OPTIONS" });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/search") {
    handleSearch(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (apiOnly) {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  const mode = apiOnly ? "api-only" : "static+api";
  console.log(`playbill-serve [${mode}] http://${HOST}:${PORT}/`);
  console.log(`  static: ${STATIC}`);
  console.log(`  db:     ${DB_PATH}`);
});
