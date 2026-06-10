/**
 * Tests for OutcomeSpec + RunConfig + Validator
 * Plan: PLAN-2026-06-06-P5-GoalPlane
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  materialize,
  triggersHold,
  sensitivityRequiresHuman,
  parseMission,
  type Mission,
  type SensitivityLevel,
  type OutcomeSpec,
  type RunConfig,
} from "../src/domain/types/outcome-spec.js";

import {
  validateMission,
  quickVerdict,
  specHash,
  missionActionRequiresHold,
} from "../src/domain/governance/outcomeSpecValidator.js";

// ─── Helper builders ─────────────────────────────────────────────────

function makeMission(overrides: Partial<{
  objective: string;
  success_criteria: string[];
  sensitivity: SensitivityLevel;
  reversibility_required: boolean;
  cost_budget_usd: number;
  time_budget_seconds: number;
  max_wall_clock_seconds: number;
  tool_scope: string[];
  allowed_tools: string[];
  evidence_required: any;
  notifier_channel: string;
  auto_approve_below: number;
  hold_above: number;
}> = {}): Mission {
  const outcome: any = {
    objective: overrides.objective ?? "Analyze the Malay Basin prospect and recommend drilling decision",
    success_criteria: overrides.success_criteria ?? [
      "POS > 0.3 calculated from seismic + well data",
      "EMV at P50 > $50M USD",
      "Drilling cost estimate within ±20% confidence",
    ],
  };
  if (overrides.sensitivity !== undefined) outcome.sensitivity = overrides.sensitivity;
  if (overrides.reversibility_required !== undefined) outcome.reversibility_required = overrides.reversibility_required;
  if (overrides.tool_scope !== undefined) {
    outcome.constraints = { ...(outcome.constraints ?? {}), tool_scope: overrides.tool_scope };
  }
  if (overrides.cost_budget_usd !== undefined) {
    outcome.constraints = { ...(outcome.constraints ?? {}), cost_budget_usd: overrides.cost_budget_usd };
  }
  if (overrides.time_budget_seconds !== undefined) {
    outcome.constraints = { ...(outcome.constraints ?? {}), time_budget_seconds: overrides.time_budget_seconds };
  }
  if (overrides.notifier_channel !== undefined) outcome.notifier_channel = overrides.notifier_channel;
  if (overrides.evidence_required !== undefined) outcome.evidence_required = overrides.evidence_required;

  const run: any = {
    allowed_models: "auto",
    persistence_policy: "EPOCH",
  };
  if (overrides.allowed_tools !== undefined) run.allowed_tools = overrides.allowed_tools;
  if (overrides.max_wall_clock_seconds !== undefined) run.max_wall_clock_seconds = overrides.max_wall_clock_seconds;
  if (overrides.auto_approve_below !== undefined || overrides.hold_above !== undefined) {
    run.approval_policy = {
      auto_approve_below: overrides.auto_approve_below ?? 0.5,
      hold_above: overrides.hold_above ?? 0.8,
    };
  }

  return { outcome: outcome as OutcomeSpec, run: run as RunConfig } as Mission;
}

// ─── 1. parseMission (no Zod) ────────────────────────────────────────

test("parseMission: valid raw object → ok", () => {
  const m = makeMission();
  const raw: unknown = JSON.parse(JSON.stringify(m));
  const result = parseMission(raw);
  assert.equal(result.ok, true);
});

test("parseMission: missing objective → error", () => {
  const raw: unknown = {
    outcome: { success_criteria: ["x"] },
    run: {},
  };
  const result = parseMission(raw);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => e.includes("OBJECTIVE")));
  }
});

test("parseMission: short objective → error", () => {
  const raw: unknown = {
    outcome: { objective: "short", success_criteria: ["x"] },
    run: {},
  };
  const result = parseMission(raw);
  assert.equal(result.ok, false);
});

test("parseMission: empty success_criteria → error", () => {
  const raw: unknown = {
    outcome: { objective: "valid objective here", success_criteria: [] },
    run: {},
  };
  const result = parseMission(raw);
  assert.equal(result.ok, false);
});

test("parseMission: invalid sensitivity → error", () => {
  const raw: unknown = {
    outcome: {
      objective: "valid objective here",
      success_criteria: ["x"],
      sensitivity: "EXTREME",
    },
    run: {},
  };
  const result = parseMission(raw);
  assert.equal(result.ok, false);
});

// ─── 2. Verdict logic ────────────────────────────────────────────────

test("validateMission: simple valid mission → SEAL", () => {
  const m = makeMission();
  const receipt = validateMission(m);
  assert.equal(receipt.verdict, "SEAL");
  assert.equal(receipt.reasons.length, 0);
});

test("validateMission: SOVEREIGN tier → HOLD", () => {
  const m = makeMission({ sensitivity: "SOVEREIGN" });
  const receipt = validateMission(m);
  assert.equal(receipt.verdict, "HOLD");
  assert.ok(receipt.warnings.some((w) => w.startsWith("SOVEREIGN_TIER")));
});

test("validateMission: budget override → VOID", () => {
  const m = makeMission({ cost_budget_usd: 10 });
  m.run.budget_limit = { cost_usd: 100 };
  const receipt = validateMission(m);
  assert.equal(receipt.verdict, "VOID");
  assert.ok(receipt.reasons.some((r) => r.startsWith("BUDGET_OVERRIDE")));
});

test("validateMission: wall_clock over budget → warning (still SEAL)", () => {
  const m = makeMission({
    time_budget_seconds: 60,
    max_wall_clock_seconds: 7200,
  });
  const receipt = validateMission(m);
  assert.equal(receipt.verdict, "SEAL");
  assert.ok(receipt.warnings.some((w) => w.startsWith("WALL_CLOCK_OVER_BUDGET")));
});

test("validateMission: duplicate success_criteria → warning", () => {
  const m = makeMission();
  m.outcome.success_criteria = ["Criterion A", "criterion a", "Criterion B"];
  const receipt = validateMission(m);
  assert.ok(receipt.warnings.some((w) => w.startsWith("DUPLICATE_SUCCESS_CRITERIA")));
});

test("validateMission: inverted approval policy → VOID", () => {
  const m = makeMission({ auto_approve_below: 0.9, hold_above: 0.3 });
  const receipt = validateMission(m);
  assert.equal(receipt.verdict, "VOID");
  assert.ok(receipt.reasons.some((r) => r.startsWith("APPROVAL_POLICY_INVERTED")));
});

// ─── 3. specHash determinism ─────────────────────────────────────────

test("specHash: deterministic for same input", () => {
  const m = makeMission();
  const h1 = specHash(m);
  const h2 = specHash(m);
  assert.equal(h1, h2);
  assert.match(h1, /^[a-f0-9]{64}$/); // SHA-256 hex
});

test("specHash: different sensitivity → different hash", () => {
  const m1 = makeMission();
  const m2 = makeMission({ sensitivity: "HIGH" });
  assert.notEqual(specHash(m1), specHash(m2));
});

// ─── 4. HOLD trigger map ─────────────────────────────────────────────

test("triggersHold: SOVEREIGN tier holds all listed actions", () => {
  assert.equal(triggersHold("PRODUCTION_DEPLOY", "SOVEREIGN"), true);
  assert.equal(triggersHold("VAULT_SEAL", "SOVEREIGN"), true);
  assert.equal(triggersHold("FINANCIAL_TRANSACTION", "SOVEREIGN"), true);
});

test("triggersHold: LOW tier holds nothing", () => {
  assert.equal(triggersHold("PRODUCTION_DEPLOY", "LOW"), false);
  assert.equal(triggersHold("FORM_SUBMIT", "LOW"), false);
});

test("triggersHold: HIGH tier holds forms and emails", () => {
  assert.equal(triggersHold("FORM_SUBMIT", "HIGH"), true);
  assert.equal(triggersHold("EMAIL_SEND", "HIGH"), true);
  assert.equal(triggersHold("EXTERNAL_API_CALL", "HIGH"), true);
});

test("triggersHold: ALWAYS_HOLD actions hold at any tier", () => {
  assert.equal(triggersHold("DROP DATABASE", "LOW"), true);
  assert.equal(triggersHold("rm -rf /", "LOW"), true);
  assert.equal(triggersHold("git push --force", "MEDIUM"), true);
});

test("sensitivityRequiresHuman: only SOVEREIGN requires human", () => {
  assert.equal(sensitivityRequiresHuman("SOVEREIGN"), true);
  assert.equal(sensitivityRequiresHuman("HIGH"), false);
  assert.equal(sensitivityRequiresHuman("MEDIUM"), false);
  assert.equal(sensitivityRequiresHuman("LOW"), false);
});

// ─── 5. Mission action integration ────────────────────────────────────

test("missionActionRequiresHold: SOVEREIGN + production deploy → HOLD", () => {
  const m = makeMission({ sensitivity: "SOVEREIGN" });
  assert.equal(missionActionRequiresHold(m, "PRODUCTION_DEPLOY"), true);
});

test("missionActionRequiresHold: LOW + read operation → no HOLD", () => {
  const m = makeMission({ sensitivity: "LOW" });
  assert.equal(missionActionRequiresHold(m, "READ_FILE"), false);
  assert.equal(missionActionRequiresHold(m, "SEARCH_INDEX"), false);
});

// ─── 6. quickVerdict helper ──────────────────────────────────────────

test("quickVerdict: returns verdict directly", () => {
  assert.equal(quickVerdict(makeMission()), "SEAL");
  assert.equal(quickVerdict(makeMission({ sensitivity: "SOVEREIGN" })), "HOLD");
});

// ─── 7. Receipt structure ────────────────────────────────────────────

test("validateMission: receipt has all required fields", () => {
  const m = makeMission();
  const r = validateMission(m);
  assert.ok(r.epoch_id);
  assert.match(r.epoch_id, /^[0-9a-f-]{36}$/);
  assert.ok(r.spec_hash);
  assert.match(r.spec_hash, /^[a-f0-9]{64}$/);
  assert.ok(r.validated_at);
  assert.ok(r.spec_summary);
  assert.equal(r.spec_summary.sensitivity, "MEDIUM");
  assert.equal(r.spec_summary.success_criteria_count, 3);
});

test("validateMission: spec_summary objective_first_line truncated at newline", () => {
  const m = makeMission({
    objective: "Line 1 of the objective.\nLine 2 should be truncated.\nLine 3.",
  });
  const r = validateMission(m);
  assert.equal(r.spec_summary.objective_first_line, "Line 1 of the objective.");
});

// ─── 8. materialize() applies defaults ───────────────────────────────

test("materialize: applies OutcomeSpec defaults", () => {
  const m = makeMission();
  const mat = materialize(m);
  assert.equal(mat.outcome.sensitivity, "MEDIUM");
  assert.equal(mat.outcome.reversibility_required, true);
  assert.deepEqual(mat.outcome.inputs, {});
  assert.deepEqual(mat.outcome.evidence_required, []);
});

test("materialize: applies RunConfig defaults", () => {
  const m = makeMission();
  const mat = materialize(m);
  assert.equal(mat.run.allowed_models, "auto");
  assert.equal(mat.run.persistence_policy, "SESSION");
  assert.equal(mat.run.max_wall_clock_seconds, 3600);
  assert.equal(mat.run.approval_policy.auto_approve_below, 0.5);
  assert.equal(mat.run.approval_policy.hold_above, 0.8);
});
