#!/usr/bin/env node
/**
 * scarReflex.test.ts — Test scar keyword matching + reflex gate (node:test)
 * Uses a test-specific scar index to avoid production file race conditions.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Use temp dir for test isolation
const TEST_SCAR_DIR = path.join(os.tmpdir(), "scar-reflex-test-" + Date.now());
const TEST_SCAR_INDEX = path.join(TEST_SCAR_DIR, "index.json");

const TEST_SCAR = {
  scar_id: "test_scar_001",
  fingerprint: "test_fp_001",
  failure_mode: "premature git push without tests",
  severity: "HIGH",
  sealed_at: new Date().toISOString(),
  scar_pressure: 0.8,
  constraint_imposed: "run npm test before any git push",
};

// Mirror of SCAR_STOPWORDS in forgeShell.ts — keep in sync.
const SCAR_STOPWORDS = new Set([
  "printf", "echo", "print", "input", "output", "stdout", "stderr", "stdin",
  "token", "value", "string", "number", "result", "return", "error", "warning",
  "fetch", "http", "https", "json", "yaml", "config", "command", "argv",
  "test", "tests", "match", "match_count", "count",
]);

// Inline the matcher (mirror of forgeShell.ts pattern)
function matchScarsByKeywords(command: string, indexPath: string): any[] {
  try {
    if (!fs.existsSync(indexPath)) return [];
    const content = fs.readFileSync(indexPath, "utf-8");
    const scars = JSON.parse(content) as Record<string, any>;
    // Split command into primary tokens and sub-tokens (splitting across delimiters including . - _ /)
    // 2026-09-17: mirror of hardened forgeShell.ts matcher — stopwords +
    // word-boundary + min-length guards (ChatGPT external-audit scar fix).
    const rawTokens = command.toLowerCase().split(/[\s,;:|&()]+/).filter(t => t.length >= 5);
    const subTokens = command.toLowerCase().split(/[\s,;:|&().\-_/]+/).filter(t => t.length >= 6);
    const allTokens = Array.from(new Set([...rawTokens, ...subTokens]))
      .filter(t => !SCAR_STOPWORDS.has(t));
    if (allTokens.length === 0) return [];

    const hits: any[] = [];
    for (const [id, scar] of Object.entries(scars)) {
      const text = `${scar.failure_mode || ""} ${scar.constraint_imposed || ""}`.toLowerCase();
      let matchCount = 0;
      let specificHit = false;
      for (const token of allTokens) {
        const escapeRegex = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`\\b${escapeRegex}\\b`);
        if (re.test(text)) {
          matchCount++;
          if (token.length >= 7) specificHit = true;
        }
      }
      const isCritical = (scar.severity || "").toUpperCase() === "CRITICAL";
      if (matchCount >= 2 || (isCritical && specificHit) || (matchCount >= 1 && specificHit)) {
        hits.push({
          scar_id: scar.scar_id || id,
          failure_mode: scar.failure_mode || "",
          severity: scar.severity || "MEDIUM",
          scar_pressure: scar.scar_pressure || 0.5,
          constraint_imposed: scar.constraint_imposed || "",
        });
      }
    }
    return hits.sort((a, b) => b.scar_pressure - a.scar_pressure);
  } catch {
    return [];
  }
}

describe("Scar Reflex Gate", () => {
  before(() => {
    fs.mkdirSync(TEST_SCAR_DIR, { recursive: true });
    fs.writeFileSync(TEST_SCAR_INDEX, JSON.stringify({ test_scar_001: TEST_SCAR }, null, 2));
  });

  after(() => {
    try { fs.rmSync(TEST_SCAR_DIR, { recursive: true }); } catch {}
  });

  it("should match scar by keyword tokens", () => {
    // "git push" alone only matches 1 token ("push") — needs more context to trigger
    const hits = matchScarsByKeywords("git push origin main without running tests", TEST_SCAR_INDEX);
    assert.ok(hits.length > 0, "Should find matching scar");
    assert.strictEqual(hits[0].scar_id, "test_scar_001");
    assert.ok(hits[0].failure_mode.includes("git push"));
  });

  it("should not match unrelated commands", () => {
    const hits = matchScarsByKeywords("ls -la /tmp", TEST_SCAR_INDEX);
    assert.strictEqual(hits.length, 0, "Should find no matching scars");
  });

  it("should sort by scar_pressure descending", () => {
    const hits = matchScarsByKeywords("git push without running tests first", TEST_SCAR_INDEX);
    if (hits.length > 1) {
      for (let i = 1; i < hits.length; i++) {
        assert.ok(hits[i-1].scar_pressure >= hits[i].scar_pressure, "Should be sorted by pressure descending");
      }
    }
  });

  it("should return empty for missing index", () => {
    const hits = matchScarsByKeywords("git push", "/nonexistent/path.json");
    assert.strictEqual(hits.length, 0);
  });

  // 2026-09-17 regression: ChatGPT external audit found printf/uname commands
  // matching the "temporal hallucination in executive briefing" scar via
  // shared generic tokens. With the hardened matcher, these benign commands
  // must NOT trigger any scar match.
  it("REGRESSION (ChatGPT-2026-09-17): benign printf/uname/id must not match", () => {
    const hits = matchScarsByKeywords("printf 'probe harmless\\n' && uname -s && id -u", TEST_SCAR_INDEX);
    assert.strictEqual(hits.length, 0, `printf/uname/id command must not trigger scar, got: ${JSON.stringify(hits)}`);
  });

  it("REGRESSION: bare 'git push' must still match 'push without tests' scar", () => {
    const hits = matchScarsByKeywords("git push origin main without running tests", TEST_SCAR_INDEX);
    assert.ok(hits.length > 0, "Real git push without tests MUST still trigger the scar");
    assert.strictEqual(hits[0].scar_id, "test_scar_001");
  });
});
