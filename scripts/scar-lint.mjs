#!/usr/bin/env node
/**
 * scar-lint — executable form of SCAR 2026-10-31 (A-FORGE repair tree would not compile).
 *
 * The failure: one test file was repointed at `../dist/src/*` while tsc emits INTO
 * `dist`. That makes the emitted declaration an *input* while being written
 * (TS5055) and breaks the runtime path too. Every other test uses `../src/*`,
 * which compiled output resolves to `dist/src` correctly.
 *
 * A receipt in Markdown has no teeth. This does. It runs in ~10ms and fails
 * `npm test` before a single test executes.
 *
 * Exit 1 = a test imports from dist/. Exit 0 = clean.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = new URL("../test/", import.meta.url).pathname;
const FORBIDDEN = /from\s+["']\.\.\/dist\//;
const files = readdirSync(TEST_DIR).filter((f) => f.endsWith(".ts"));
const offenders = [];

for (const name of files) {
  const src = readFileSync(join(TEST_DIR, name), "utf8");
  if (FORBIDDEN.test(src)) offenders.push(name);
}

if (offenders.length) {
  console.error(
    `[scar-lint] FAIL — test file(s) import from ../dist/:\n  ${offenders.join("\n  ")}\n` +
      "Tests must import ../src/*.ts. tsc emits into dist/, so importing dist makes the\n" +
      "emitted declaration an input (TS5055) and resolves wrong at runtime.\n" +
      "Scar: 2026-10-31 A-FORGE repair tree did not compile.",
  );
  process.exit(1);
}

console.log(`[scar-lint] PASS — 0 of ${files.length} test files import from ../dist/`);
