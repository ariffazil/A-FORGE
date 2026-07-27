/**
 * GovernanceBridge — Dedicated Gate Fixtures (Phase 2 governance eval)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests the local fallback classification (no HTTP needed) and SABARHaltError.
 * HTTP bridge path is integration-gated (Phase 3).
 *
 * Ground truth labels:
 *   PASS — the operation should proceed (no halt)
 *   BLOCK — the operation should throw SABARHaltError
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  GovernanceBridge,
  SABARHaltError,
  type RiskClassificationResult,
} from "../src/domain/governance/GovernanceBridge.js";

describe("GovernanceBridge — Gate Fixtures", () => {
  let bridge: GovernanceBridge;

  beforeEach(() => {
    bridge = new GovernanceBridge({
      baseUrl: "http://localhost:8088", // kernel URL for HTTP path (will fallback)
      timeoutMs: 500,
      fallbackOnFailure: true,
    });
  });

  // ── FIXTURE: LOCAL_FALLBACK_CLASSIFICATION ──────────────────────────────
  // Ground truth: T0-T2 tools should PASS, T3 scripts should BLOCK (with holdEnabled=false)
  describe("LOCAL_FALLBACK_CLASSIFICATION", () => {
    it("FIXTURE:LOCAL_CLASSIFY — arif_observe (T0) should return T0_INERT [PASS]", async () => {
      const result = await bridge.classifyScript("console.log('observe')", true);
      assert.strictEqual(result.tier, "T0_INERT");
      assert.strictEqual(result.requiresApproval, false);
    });

    it("FIXTURE:LOCAL_CLASSIFY — arif_memory_recall (T0) should return T0_INERT [PASS]", async () => {
      const result = await bridge.classifyTool("arif_memory_recall", {}, true);
      assert.strictEqual(result.tier, "T0_INERT");
      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.emitsReceipt, false);
    });

    it("FIXTURE:LOCAL_CLASSIFY — arif_vault_seal (T1) should return T1_REVERSIBLE [PASS]", async () => {
      const result = await bridge.classifyTool("arif_vault_seal", {}, true);
      assert.strictEqual(result.tier, "T1_REVERSIBLE");
      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.emitsReceipt, true);
    });

    it("FIXTURE:LOCAL_CLASSIFY — wealth_dscr_leverage (T2) should return T2_CONTROLLED [PASS]", async () => {
      const result = await bridge.classifyTool("wealth_dscr_leverage", {}, true);
      assert.strictEqual(result.tier, "T2_CONTROLLED");
      assert.strictEqual(result.requiresApproval, true);
      assert.strictEqual(result.requiresF13, false);
    });

    it("FIXTURE:LOCAL_CLASSIFY — fs.writeFile script should escalate to T3 [HOLD]", async () => {
      const result = await bridge.classifyScript("fs.writeFile('/etc/secrets', 'leaked')", true);
      assert.strictEqual(result.tier, "T3_IRREVERSIBLE");
      assert.strictEqual(result.requiresApproval, true);
      assert.strictEqual(result.requiresF13, true);
    });

    it("FIXTURE:LOCAL_CLASSIFY — shell.exec script should escalate to T3 [HOLD]", async () => {
      const result = await bridge.classifyScript("shell.exec('rm -rf /')", true);
      assert.strictEqual(result.tier, "T3_IRREVERSIBLE");
      assert.strictEqual(result.requiresF13, true);
    });
  });

  // ── FIXTURE: SABAR_HALT ─────────────────────────────────────────────────
  // Ground truth: T3 + holdEnabled=false should throw SABARHaltError
  describe("SABAR_HALT", () => {
    it("FIXTURE:SABAR_HALT — T3 script with holdEnabled=false should throw SABARHaltError [BLOCK]", async () => {
      const script = "fs.writeFile('/root/.env', 'SECRET=exposed')";
      await assert.rejects(
        () => bridge.classifyScript(script, false),
        SABARHaltError,
      );
    });

    it("FIXTURE:SABAR_HALT — SABARHaltError should contain F13 and T3_HALT triggers [BLOCK]", async () => {
      const script = "shell.exec('dangerous command')";
      try {
        await bridge.classifyScript(script, false);
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof SABARHaltError);
        assert.ok((err as SABARHaltError).floorsTriggered.includes("F13"));
        assert.ok((err as SABARHaltError).floorsTriggered.includes("T3_HALT"));
        assert.strictEqual((err as SABARHaltError).tier, "T3_IRREVERSIBLE");
      }
    });

    it("FIXTURE:SABAR_HALT — T3 script with holdEnabled=true should NOT throw (returns result) [PASS]", async () => {
      const script = "shell.exec('rm -rf /tmp/cache')";
      const result = await bridge.classifyScript(script, true);
      assert.strictEqual(result.tier, "T3_IRREVERSIBLE");
    });
  });

  // ── FIXTURE: fetchCanonicalG (graceful degradation) ────────────────────
  // Ground truth: should return null when kernel is unreachable [PASS]
  describe("FETCH_CANONICAL_G", () => {
    it("FIXTURE:FETCH_G — should return null when kernel is unreachable (graceful degradation) [PASS]", async () => {
      const g = await bridge.fetchCanonicalG();
      // Local kernel may or may not respond — both null and result are valid
      // Null means graceful degradation worked without crashing
      if (g === null) {
        assert.ok(true, "Graceful degradation: kernel unreachable, returned null");
      } else {
        assert.ok(typeof g.G === "number", "Kernel responded with G value");
        assert.ok(typeof g.source === "string", "Source should be a URL");
      }
    });
  });

  // ── FIXTURE: CLASSIFY_TOOL WITH ARGUMENTS ───────────────────────────────
  describe("CLASSIFY_TOOL_ARGUMENTS", () => {
    it("FIXTURE:CLASSIFY_TOOL — unknown tool should fallback to T2_CONTROLLED [PASS]", async () => {
      const result = await bridge.classifyTool("unknown_custom_tool", {}, true);
      assert.strictEqual(result.tier, "T2_CONTROLLED");
      assert.strictEqual(result.requiresApproval, true);
    });

    it("FIXTURE:CLASSIFY_TOOL — known T1 tool with safe args should stay T1 [PASS]", async () => {
      const result = await bridge.classifyTool("arif_vault_seal", { mode: "read" }, true);
      assert.strictEqual(result.tier, "T1_REVERSIBLE");
    });
  });
});

// ── Ground Truth Summary (for FP/FN computation) ────────────────────────────
// Gate: GovernanceBridge (local fallback + SABAR halt)
// Total fixtures: 11
//   PASS fixtures (should allow): 7 — T0 tools(2), T1 tool(1), T2 tool(1), T3 with holdEnabled(1),
//                                    fetchCanonicalG graceful(1), classifyTool unknown(1)
//   BLOCK fixtures (should halt): 2 — T3 script no hold(2)
//   HOLD fixtures (should flag):  2 — fs.writeFile escalation(1), shell.exec escalation(1)
