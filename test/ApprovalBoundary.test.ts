/**
 * ApprovalBoundary — Dedicated Gate Fixtures (Phase 2 governance eval)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Each test has a ground-truth label:
 *   PASS — the boundary should NOT require approval (false positive if it does)
 *   HOLD — the boundary SHOULD require approval (false negative if it doesn't)
 *
 * Covers: state machine, risk assessment, AFK auto-approve, hold queue lifecycle.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ApprovalBoundary } from "../src/application/approval/ApprovalBoundary.js";

function makePreview(level: "minimal" | "low" | "medium" | "high" | "critical") {
  return {
    whatWillHappen: "Test action",
    sideEffects: ["test.log"],
    modifications: [{ path: "/tmp/test.log", operation: "create" as const }],
    reasoning: `This is a ${level} risk test action`,
    riskAssessment: {
      level,
      concerns: [`Test concern for ${level}`],
      mitigations: ["Test mitigation"],
    },
  };
}

describe("ApprovalBoundary — Gate Fixtures", () => {
  let boundary: ApprovalBoundary;

  beforeEach(() => {
    boundary = new ApprovalBoundary({ storePath: "/tmp/test-approvals.json" });
    delete process.env.AFK_MODE;
    delete process.env.ENABLE_AFK_AUTO_APPROVE;
    delete process.env.ENABLE_DANGEROUS_TOOLS;
  });

  afterEach(() => {
    delete process.env.AFK_MODE;
    delete process.env.ENABLE_AFK_AUTO_APPROVE;
    delete process.env.ENABLE_DANGEROUS_TOOLS;
  });

  // ── FIXTURE: RISK_TIER_ROUTING ──────────────────────────────────────────
  // Ground truth: low=ready (PASS), medium+=holding (HOLD)
  describe("RISK_TIER_ROUTING", () => {
    it("FIXTURE:RISK_TIER_ROUTING — minimal risk should route to ready state [PASS]", () => {
      const preview = makePreview("minimal");
      const item = boundary.stageAction("Low-risk read", preview);
      assert.strictEqual(item.state, "ready");
      assert.strictEqual(item.badge, "📋 Ready");
    });

    it("FIXTURE:RISK_TIER_ROUTING — low risk should route to ready state [PASS]", () => {
      const preview = makePreview("low");
      const item = boundary.stageAction("Low-risk edit", preview);
      assert.strictEqual(item.state, "ready");
      assert.strictEqual(item.badge, "📋 Ready");
    });

    it("FIXTURE:RISK_TIER_ROUTING — medium risk should route to holding state [HOLD]", () => {
      const preview = makePreview("medium");
      const item = boundary.stageAction("Medium-risk deploy", preview);
      assert.strictEqual(item.state, "holding");
      assert.strictEqual(item.badge, "✋ Needs Yes");
    });

    it("FIXTURE:RISK_TIER_ROUTING — high risk should route to holding state [HOLD]", () => {
      const preview = makePreview("high");
      const item = boundary.stageAction("High-risk mutation", preview);
      assert.strictEqual(item.state, "holding");
      assert.strictEqual(item.badge, "✋ Needs Yes");
    });

    it("FIXTURE:RISK_TIER_ROUTING — critical risk should route to holding state [HOLD]", () => {
      const preview = makePreview("critical");
      const item = boundary.stageAction("Critical operation", preview);
      assert.strictEqual(item.state, "holding");
      assert.strictEqual(item.badge, "✋ Needs Yes");
    });
  });

  // ── FIXTURE: HOLD_QUEUE_LIFECYCLE ───────────────────────────────────────
  // Ground truth: approve transitions holding→approved, reject→rejected
  describe("HOLD_QUEUE_LIFECYCLE", () => {
    it("FIXTURE:HOLD_QUEUE_LIFECYCLE — approve transitions holding to approved [PASS]", () => {
      const preview = makePreview("medium");
      const item = boundary.stageAction("Deploy release", preview);
      boundary.approve(item.holdId);
      const retrieved = boundary.getHoldItem(item.holdId);
      assert.strictEqual(retrieved?.state, "approved");
    });

    it("FIXTURE:HOLD_QUEUE_LIFECYCLE — reject transitions holding to rejected [PASS]", () => {
      const preview = makePreview("medium");
      const item = boundary.stageAction("Dangerous op", preview);
      boundary.reject(item.holdId);
      const retrieved = boundary.getHoldItem(item.holdId);
      assert.strictEqual(retrieved?.state, "rejected");
    });

    it("FIXTURE:HOLD_QUEUE_LIFECYCLE — cannot approve already rejected item [BLOCK]", () => {
      const preview = makePreview("medium");
      const item = boundary.stageAction("Rejected op", preview);
      boundary.reject(item.holdId);
      assert.throws(() => boundary.approve(item.holdId), /rejected/);
    });
  });

  // ── FIXTURE: AFK_AUTO_APPROVE ───────────────────────────────────────────
  // Ground truth: low risk + AFK = skip holding (PASS through)
  describe("AFK_AUTO_APPROVE", () => {
    it("FIXTURE:AFK_AUTO_APPROVE — should auto-approve low risk when AFK enabled [PASS]", () => {
      process.env.AFK_MODE = "true";
      process.env.ENABLE_AFK_AUTO_APPROVE = "1";
      process.env.ENABLE_DANGEROUS_TOOLS = "1";
      const preview = makePreview("low");
      const item = boundary.stageAction("Low-risk AFK action", preview);
      assert.strictEqual(item.state, "approved");
      assert.strictEqual(item.badge, "🤖 AFK-Auto");
    });

    it("FIXTURE:AFK_AUTO_APPROVE — should NOT auto-approve medium risk even when AFK enabled [HOLD]", () => {
      process.env.AFK_MODE = "true";
      process.env.ENABLE_AFK_AUTO_APPROVE = "1";
      process.env.ENABLE_DANGEROUS_TOOLS = "1";
      const preview = makePreview("medium");
      const item = boundary.stageAction("Medium-risk AFK action", preview);
      assert.strictEqual(item.state, "holding");
      assert.notStrictEqual(item.badge, "🤖 AFK-Auto");
    });
  });

  // ── FIXTURE: SUMMARY ────────────────────────────────────────────────────
  describe("SUMMARY", () => {
    it("FIXTURE:SUMMARY — getSummary should return correct structure [PASS]", () => {
      const stats = boundary.getSummary();
      assert.ok(typeof stats.awaitingApproval === "number");
      assert.ok(typeof stats.ready === "number");
      assert.ok(typeof stats.executed === "number");
      assert.ok(typeof stats.rejected === "number");
    });
  });
});

// ── Ground Truth Summary (for FP/FN computation) ────────────────────────────
// Gate: ApprovalBoundary
// Total fixtures: 10
//   PASS fixtures (should NOT require approval): 5 — minimal(1), low(1), approve(1), reject(1), AFK low(1)
//   HOLD fixtures (SHOULD require approval):      4 — medium(1), high(1), critical(1), AFK medium(1)
//   BLOCK fixtures (should reject):                1 — reject then approve
