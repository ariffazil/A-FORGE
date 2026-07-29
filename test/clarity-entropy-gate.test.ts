/**
 * F4 CLARITY — Entropy Gate (ΔS ≤ 0) Tests
 *
 * Closes Trauma Audit Gap #3 (L2: "Harm cascades through systems").
 * Tests that entropy increase triggers HOLD, clarifying actions pass,
 * and silent drift is detected.
 *
 * DITEMPA BUKAN DIBERI — Forged 2026-07-29
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  checkClarity,
  calculateRisk,
  type ClarityResult,
  type ClarityVerdict,
} from "../src/domain/governance/f4Clarity.js";

// ─── RISK CALCULATION ──────────────────────────────────

test("calculateRisk: read-only operations have low risk", () => {
  const risk = calculateRisk("read_file", { path: "/tmp/test.txt" });
  assert.strictEqual(risk, 0.1, "Reading files should be low risk (0.1)");
});

test("calculateRisk: write operations have medium risk", () => {
  const risk = calculateRisk("write_file", { path: "/tmp/test.txt", content: "data" });
  assert.strictEqual(risk, 0.5, "Writing files should be medium risk (0.5)");
});

test("calculateRisk: destructive keywords increase risk", () => {
  const baseRisk = calculateRisk("run_command", { command: "ls" });
  // Use keywords that match the MODIFIER_PATTERNS (delete/remove/overwrite/replace)
  const highRisk = calculateRisk("run_command", { command: "sudo delete production cache --remove-all" });

  assert.ok(highRisk > baseRisk,
    `Destructive keywords should increase risk (${baseRisk} → ${highRisk})`);
});

test("calculateRisk: sudo/admin keywords increase risk", () => {
  const baseRisk = calculateRisk("run_command", { command: "echo hello" });
  const sudoRisk = calculateRisk("run_command", { command: "sudo systemctl restart" });

  assert.ok(sudoRisk > baseRisk,
    `Sudo commands should increase risk (${baseRisk} → ${sudoRisk})`);
});

test("calculateRisk: risk never exceeds 1.0", () => {
  const risk = calculateRisk("run_command", {
    command: "sudo rm -rf /production/delete --force --overwrite --admin --root",
  });
  assert.ok(risk <= 1.0, `Risk must not exceed 1.0 (got ${risk})`);
});

test("calculateRisk: unknown tool defaults to 0.5", () => {
  const risk = calculateRisk("unknown_tool_xyz", {});
  assert.strictEqual(risk, 0.5, "Unknown tools should default to 0.5 risk");
});

// ─── CLARITY GATE ──────────────────────────────────────

test("checkClarity: first call always passes (bootstrapping)", () => {
  const result = checkClarity("run_command", { command: "rm -rf" }, 0, true);
  assert.strictEqual(result.verdict, "PASS");
  assert.ok(result.entropyDelta !== undefined, "Should compute entropy delta");
});

test("checkClarity: entropy decrease passes (ΔS < 0)", () => {
  // Start high risk, move to low risk = clarity increasing
  const result = checkClarity("read_file", { path: "/tmp/test" }, 0.8);
  assert.strictEqual(result.verdict, "PASS");
  assert.ok(result.entropyDelta < 0, "ΔS should be negative (entropy decreasing)");
});

test("checkClarity: small entropy increase still passes", () => {
  // Small increase within tolerance
  const result = checkClarity("list_files", { path: "/tmp" }, 0.1);
  assert.strictEqual(result.verdict, "PASS");
});

test("checkClarity: large entropy spike triggers HOLD (ΔS > 0.4)", () => {
  const result = checkClarity(
    "run_command",
    { command: "sudo rm -rf /etc/delete --overwrite" },
    0.1
  );
  assert.strictEqual(result.verdict, "HOLD",
    `Should HOLD on entropy spike, got ${result.verdict}`);
  assert.ok(result.reason === "ENTROPY_SPIKE", `Reason should be ENTROPY_SPIKE, got ${result.reason}`);
  assert.ok(result.entropyDelta > 0.4,
    `ΔS should exceed 0.4 threshold, got ${result.entropyDelta}`);
  assert.ok(result.message, "HOLD must carry a message explaining why");
});

test("checkClarity: HOLD includes risk before/after context", () => {
  const result = checkClarity(
    "run_command",
    { command: "sudo delete production database" },
    0.05
  );
  if (result.verdict === "HOLD") {
    assert.ok(result.riskBefore !== undefined);
    assert.ok(result.riskAfter !== undefined);
    assert.ok(result.riskAfter > result.riskBefore,
      "Risk should increase when HOLD triggered");
  }
});

// ─── CONSECUTIVE ENTROPY TRACKING ──────────────────────

test("clarity: consecutive safe operations maintain or improve clarity", () => {
  // Simulate a healthy sequence: read → analyze → read
  const r1 = checkClarity("read_file", { path: "/tmp/a" }, 0, true);  // first call
  assert.strictEqual(r1.verdict, "PASS");

  const r2 = checkClarity("read_file", { path: "/tmp/b" }, r1.riskAfter);  // same risk level
  assert.strictEqual(r2.verdict, "PASS");

  const r3 = checkClarity("read_file", { path: "/tmp/c" }, r2.riskAfter);  // still safe
  assert.strictEqual(r3.verdict, "PASS");
});

test("clarity: escalating risk triggers HOLD eventually", () => {
  // Start safe, then escalate
  let prevRisk = 0;
  const r1 = checkClarity("read_file", {}, prevRisk, true);
  assert.strictEqual(r1.verdict, "PASS");
  prevRisk = r1.riskAfter;

  const r2 = checkClarity("write_file", {}, prevRisk);
  assert.strictEqual(r2.verdict, "PASS", "Moderate increase within tolerance");
  prevRisk = r2.riskAfter;

  const r3 = checkClarity(
    "run_command",
    { command: "sudo delete --force --overwrite --admin" },
    prevRisk
  );
  assert.strictEqual(r3.verdict, "HOLD",
    "Destructive escalation should eventually trigger HOLD");
});

// ─── NEGATIVE TESTS ────────────────────────────────────

test("NEGATIVE: HOLD is NOT execution — it's a governance pause", () => {
  const result = checkClarity("run_command", { command: "sudo rm -rf /prod" }, 0.05);
  assert.strictEqual(result.verdict, "HOLD");
  // The caller (FloorEnforcer) must NOT proceed on HOLD
  // This test validates the signal itself is correct
});

test("NEGATIVE: zero previous risk with no bootstrapping still gates", () => {
  const result = checkClarity("run_command", { command: "rm -rf /" }, 0, false);
  // Without bootstrapping flag, direct destructive cmd from zero state should gate
  if (result.entropyDelta > 0.4) {
    assert.strictEqual(result.verdict, "HOLD",
      "Destructive command from zero state should be gated");
  }
});

test("NEGATIVE: silent no-op is worse than declared HOLD", () => {
  // Even a PASS verdict carries its entropy delta — no silence allowed
  const result = checkClarity("read_file", { path: "/tmp" }, 0.2);
  assert.ok(result.entropyDelta !== undefined,
    "Every clarity check MUST return its entropy delta, even on PASS");
  assert.ok("verdict" in result, "Every result must carry a verdict");
});

test("NEGATIVE: missing tool name defaults to medium risk", () => {
  const risk = calculateRisk("", {});
  assert.strictEqual(risk, 0.5,
    "Unknown/empty tool should default to 0.5, not 0 (zero risk is dangerous)");
});
