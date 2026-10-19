/**
 * FEDERATION_REALITY_DISTILLATION — Falsification Suite (Phase 1)
 * REFERENCE: ARIFOS::FEDERATION_REALITY_DISTILLATION::2026-10-19
 * Forged: 2026-10-19 · Authority: ARIF (Human Sovereign) · Mode: evidence-bound
 *
 * Encodes EUREKA-4 (verdict != identity evidence) and EUREKA-6 (receipts must
 * carry governance semantics, not only transport success).
 *
 * Expected state BEFORE the Phase-2 patch:
 *   FS-3  RED   — identity inferred from status/verdict in 4 sites
 *   FS-4  GREEN — regression lock: HOLD must never be stored as ok:true
 *   FS-5  RED   — refusal_cause is not preserved in the receipt
 *
 * A RED here is the falsifier firing. Do not weaken the test to make it green;
 * fix the code (P1/P3 in the distillation patch plan).
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildInvocationRecord } from "../src/infrastructure/metrics/invocationLog.js";

const SRC = join(process.cwd(), "src");
const read = (p: string): string => readFileSync(join(SRC, p), "utf8");

describe("FS-3 — verdict is not identity evidence", () => {
  const sites: Array<{ file: string; re: RegExp; why: string }> = [
    {
      file: "domain/types/mcp-bridge.ts",
      re: /token_valid:\s*meta\.token_valid \?\? \([^)]*(?:status === "PASS"|verdict === "SEAL")/,
      why: "token_valid inferred from status/verdict",
    },
    {
      file: "domain/types/mcp-bridge.ts",
      re: /const valid = [^;]*(?:verdict === "SEAL"|status === "PASS")/,
      why: "lease validity inferred from verdict string",
    },
    {
      file: "interfaces/mcp/core.ts",
      re: /actor_verified \|\| [^)]*(?:status === "resumed"|verdict === "SEAL")/,
      why: "identity verified from status/verdict",
    },
    {
      file: "interfaces/mcp/shell/forgeShell.ts",
      re: /(?:scope_valid|replay_safe|token_valid):\s*Boolean\(meta\.\w+ \?\? \([^)]*(?:status === "PASS"|verdict === "SEAL")/,
      why: "scope/replay validity defaulted from status/verdict",
    },
  ];

  for (const s of sites) {
    it(`no verdict-string identity inference — ${s.file} (${s.why})`, () => {
      const src = read(s.file);
      assert.doesNotMatch(src, s.re, `${s.why} still present in ${s.file}`);
    });
  }
});

describe("FS-4 — HOLD is never persisted as ok:true", () => {
  it("verdict HOLD forces ok=false and can_claim_success=false", () => {
    const rec = buildInvocationRecord("fs4_probe", { verdict: "HOLD" });
    assert.equal(rec.ok, false);
    assert.equal(rec.can_claim_success, false);
  });

  it("verdict VOID forces ok=false", () => {
    const rec = buildInvocationRecord("fs4_probe", { verdict: "VOID" });
    assert.equal(rec.ok, false);
  });

  it("governance verdict is preserved on the receipt", () => {
    const rec = buildInvocationRecord("fs4_probe", { verdict: "HOLD" });
    assert.equal(rec.verdict, "HOLD");
  });
});

describe("FS-5 — a refused invocation preserves its refusal cause", () => {
  it("receipt carries refusal_cause when the invocation was refused", () => {
    const rec = buildInvocationRecord("fs5_probe", {
      verdict: "HOLD",
      error: "FLOOR_BLOCK:F13",
    });
    assert.ok(
      "refusal_cause" in rec,
      "refusal_cause missing: a HOLD receipt without its cause is a fidelity failure",
    );
    assert.ok(
      "governance_verdict" in rec,
      "governance_verdict missing: transport success cannot stand in for governance outcome",
    );
  });
});
