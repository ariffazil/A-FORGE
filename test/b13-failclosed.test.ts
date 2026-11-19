/**
 * B1.3 PROVENANCE NON-ESCALATION falsifiers (F13 bounded lane 2026-10-27).
 * AAA/instructions/apex-boundary-first-b1.md — missing metadata MUST NOT
 * default true; PASS/SEAL strings MUST NOT upgrade validity classes.
 *
 * Expected state BEFORE this lane's code fix:
 *   B13-1 RED  — origin/main mcp-bridge.ts still has `meta.scope_valid ?? true`
 *   B13-2 RED  — origin/main forgeShell.ts still has `?? true` + PASS/SEAL inference
 * A RED here is the falsifier firing. Do not weaken the test; fix the code.
 *
 * NOTE: these test the WORKTREE (current checkout), while HEAD/origin/main
 * still carry the default-true pattern — capture the before-state via
 *   git show origin/main:<file> | grep -n '?? true'
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const read = (p: string): string => readFileSync(join(SRC, p), "utf8");

describe("B13 — missing verification metadata never resolves true", () => {
  const adapters = [
    "domain/types/mcp-bridge.ts",
    "interfaces/mcp/shell/forgeShell.ts",
  ];

  for (const file of adapters) {
    it(`${file}: no '?? true' default on scope_valid/replay_safe/token_valid`, () => {
      const src = read(file);
      assert.doesNotMatch(
        src,
        /(?:scope_valid|replay_safe|token_valid):\s*meta\.\w+\s*\?\?\s*true/,
        `${file} still defaults a validity class to true when meta is absent`
      );
    });

    it(`${file}: PASS/SEAL status text never establishes token_valid`, () => {
      const src = read(file);
      assert.doesNotMatch(
        src,
        /token_valid:\s*meta\.token_valid\s*\?\?\s*\([^)]*(?:status === "PASS"|verdict === "SEAL")/,
        `${file} still infers token_valid from status/verdict strings`
      );
    });

    it(`${file}: explicit fail-closed comparison (=== true) is the normalization`, () => {
      const src = read(file);
      assert.match(
        src,
        /(?:scope_valid|replay_safe|token_valid):\s*meta\.\w+\s*===\s*true/,
        `${file} must normalize validity via '=== true' (absent => false)`
      );
    });
  }
});
