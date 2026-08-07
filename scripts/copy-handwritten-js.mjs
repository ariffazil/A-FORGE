/**
 * F1 HARDENING (2026-08-07): Copy hand-written .js files from tracked src/
 * into dist/src/ after tsc.
 *
 * WHY: tsc compiles only .ts files. Hand-written JavaScript modules that live
 * in the tracked src/ tree (e.g. src/interfaces/mcp/stdio-http-bridge.js)
 * would NOT survive a clean build — the same F1 trap as hot-patching dist/.
 *
 * RULE: Any .js file in src/ is source of truth. It must be mirrored to
 * dist/src/ so the runtime (which loads from dist/src/) sees it.
 *
 * REVERSIBILITY: This script is additive (copy, never delete). It runs after
 * every `npm run build`. If a .js file is removed from src/, its stale copy
 * in dist/src/ is untouched by this script (clean builds handle removal via
 * `rm -rf dist` / `make clean`).
 *
 * DITEMPA BUKAN DIBERI
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const SRC_ROOT = new URL("../src/", import.meta.url).pathname;
const DIST_ROOT = new URL("../dist/src/", import.meta.url).pathname;

let copied = 0;

function walk(dir) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full);
    } else if (entry.endsWith(".js") || entry.endsWith(".json")) {
      const rel = relative(SRC_ROOT, full);
      const dest = join(DIST_ROOT, rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(full, dest, { force: true });
      copied += 1;
    }
  }
}

if (existsSync(SRC_ROOT)) {
  walk(SRC_ROOT);
}

console.log(`[copy-handwritten-js] mirrored ${copied} .js/.json file(s) from src/ to dist/src/`);
