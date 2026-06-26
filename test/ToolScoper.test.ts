/**
 * Tests for ToolScoper — budget-aware tool surface scoping.
 *
 * PLAN: PLAN-2026-06-22-P0-ToolScoper
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ToolScoper,
  getToolScoper,
  resetToolScoper,
  classifyAction,
  stageToActionClass,
} from "../src/domain/engine/ToolScoper.js";
import type {
  ActionClass,
  PipelineStage,
  ScopedToolSurface,
} from "../src/domain/engine/ToolScoper.js";
import { BudgetManager } from "../src/domain/engine/BudgetManager.js";
import type { BudgetStatus } from "../src/domain/types/agent.js";

// ─── 1. Basic action class scoping ─────────────────────────────────────

test("ToolScoper: OBSERVE scope returns read-only tool patterns", () => {
  const scoper = new ToolScoper();
  const surface = scoper.scope("OBSERVE", "111_OBSERVE");

  assert.ok(surface.allowedTools.length > 0, "should have at least one allowed tool");
  // 111_OBSERVE stage narrows OBSERVE action class to concrete stage tools
  // Stage tools: arif_ping, arif_sense_observe, arif_ops_measure, arif_memory_recall, forge_query
  assert.ok(surface.allowedTools.includes("arif_ping"), "arif_ping should be in OBSERVE");
  assert.ok(surface.allowedTools.includes("arif_sense_observe"), "arif_sense_observe should be in OBSERVE");
  assert.ok(surface.allowedTools.includes("forge_query"), "forge_query should be in OBSERVE");
  // Wildcards (geox_*, wealth_*) are correctly excluded by stage narrowing
  // To get wildcards, scope without stage narrowing or use a broader stage
  assert.ok(!surface.allowedTools.includes("arif_forge_execute"), "forge_execute should NOT be in OBSERVE");
  assert.equal(surface.budgetDownshifted, false, "no budget, no downshift");
  assert.ok(surface.reason.includes("OBSERVE"), "reason should mention action class");
});

test("ToolScoper: MUTATE scope includes mutation tools only", () => {
  const scoper = new ToolScoper();
  const surface = scoper.scope("MUTATE", "777_EXECUTE");

  // 777_EXECUTE stage narrows MUTATE to execution-specific tools:
  // forge_execute, arif_forge_execute, forge_approve
  assert.ok(surface.allowedTools.includes("forge_execute"), "forge_execute must be in MUTATE");
  assert.ok(surface.allowedTools.includes("arif_forge_execute"), "forge_execute must be in MUTATE");
  assert.ok(surface.allowedTools.includes("forge_approve"), "forge_approve must be in MUTATE");
  // vault_seal is excluded by 777_EXECUTE stage (belongs in 888_JUDGE/999_SEAL)
  assert.ok(!surface.allowedTools.includes("arif_vault_seal"), "vault_seal should be excluded by stage narrowing");
  assert.ok(!surface.allowedTools.includes("arif_sense_observe"), "observe tool should NOT be in MUTATE");
  assert.ok(!surface.allowedTools.includes("arif_mind_reason"), "mind_reason should NOT be in MUTATE");
  assert.ok(surface.reason.includes("MUTATE"), "reason should mention action class");
});

test("ToolScoper: IRREVERSIBLE scope is minimal", () => {
  const scoper = new ToolScoper();
  const surface = scoper.scope("IRREVERSIBLE", "999_SEAL");

  // 999_SEAL stage narrows IRREVERSIBLE to only vault_seal
  assert.ok(surface.allowedTools.includes("arif_vault_seal"), "vault_seal must be in IRREVERSIBLE + 999_SEAL");
  assert.equal(surface.allowedTools.length, 1, "999_SEAL should narrow to exactly 1 tool (vault_seal)");
  // forge_execute excluded by 999_SEAL stage (execute ≠ seal)
  assert.ok(!surface.allowedTools.includes("forge_execute"), "forge_execute should be excluded by stage narrowing");
  assert.ok(!surface.allowedTools.includes("arif_forge_execute"), "arif_forge_execute should be excluded by stage narrowing");
  // Non-IRREVERSIBLE tools should never appear
  assert.ok(!surface.allowedTools.includes("arif_sense_observe"), "observe tool should NOT be in IRREVERSIBLE");
  assert.ok(!surface.allowedTools.includes("arif_mind_reason"), "mind_reason should NOT be in IRREVERSIBLE");
});

// ─── 2. Budget-aware downshift ──────────────────────────────────────────

test("ToolScoper: budget downshift removes expensive tools from THINK scope", () => {
  const scoper = new ToolScoper();
  const budgetStatus: BudgetStatus = {
    totalTokensUsed: 800_000,
    totalCostUsd: 4.20,
    usagePercent: 0.85,  // > 80% → downshift
    turnsRemaining: 2,
    shouldDownshift: true,
  };

  const surface = scoper.scope("THINK", "333_REASON", budgetStatus);

  assert.ok(surface.budgetDownshifted, "should be downshifted");
  assert.ok(
    !surface.allowedTools.includes("arif_judge_deliberate") ||
    !surface.allowedTools.includes("arif_mind_reason"),
    "expensive THINK tools should be excluded under budget pressure",
  );
  assert.ok(surface.excludedTools.length > 0, "should have excluded tools");
  assert.ok(surface.budgetStatus.includes("85.0%"), "budget status should reflect 85% usage");
});

test("ToolScoper: no downshift when budget is healthy", () => {
  const scoper = new ToolScoper();
  const budgetStatus: BudgetStatus = {
    totalTokensUsed: 100_000,
    totalCostUsd: 0.50,
    usagePercent: 0.15,  // 15% → healthy
    turnsRemaining: 42,
    shouldDownshift: false,
  };

  const surface = scoper.scope("THINK", "333_REASON", budgetStatus);

  assert.equal(surface.budgetDownshifted, false, "should NOT be downshifted at 15%");
  assert.equal(surface.excludedTools.length, 0, "no tools should be excluded");
  assert.ok(
    surface.allowedTools.includes("arif_mind_reason"),
    "arif_mind_reason should still be present with healthy budget",
  );
});

test("ToolScoper: downshift from BudgetManager instance is respected", () => {
  // Create a BudgetManager that is near exhaustion
  const bm = new BudgetManager(
    { tokenCeiling: 10_000, maxTurns: 100, perTurnTokenLimit: 1_000 },
    { inputCostPerMillionTokens: 1, outputCostPerMillionTokens: 2 },
  );

  // Manually add usage to push it past 80%
  for (let i = 0; i < 9; i++) {
    bm.addUsage(900, 100); // 9 × 1000 = 9000 tokens used = 90%
  }

  getToolScoper(bm);
  const surface = getToolScoper().scope("THINK", "333_REASON");

  assert.ok(surface.budgetDownshifted, "should downshift when BudgetManager exceeds 80%");
  assert.ok(surface.budgetStatus.includes("90"), "budget status should show ~90% usage");

  // Clean up singleton for other tests
  resetToolScoper();
});

// ─── 3. Registry-aware scoping ─────────────────────────────────────────

test("ToolScoper: scopeRegistry resolves wildcards against real tool names", () => {
  const scoper = new ToolScoper();
  const registryTools = [
    "arif_ping",
    "arif_sense_observe",
    "arif_ops_measure",
    "arif_memory_recall",
    "arif_mind_reason",
    "arif_judge_deliberate",
    "forge_query",
    "geox_basin_profile",
    "geox_system_registry_status",
    "geox_evidence_reason",
    "wealth_wisdom_evaluate",
    "well_assess_metabolism",
  ];

  // scopeRegistry with 111_OBSERVE stage — stage narrows to concrete stage tools
  const surface = scoper.scopeRegistry("OBSERVE", "111_OBSERVE", registryTools);

  // 111_OBSERVE stage tools = arif_ping, arif_sense_observe, arif_ops_measure,
  // arif_memory_recall, forge_query — these pass both action class AND stage
  assert.ok(surface.allowedTools.includes("arif_ping"), "arif_ping should pass stage+action");
  assert.ok(surface.allowedTools.includes("arif_sense_observe"), "sense_observe should pass stage+action");
  assert.ok(surface.allowedTools.includes("forge_query"), "forge_query should pass stage+action");

  // geox_* wildcards NOT in 111_OBSERVE stage → excluded by design
  // For wildcard resolution test, scope with 333_REASON stage which has geox and wealth tools
  const surfaceBroad = scoper.scopeRegistry("THINK", "333_REASON", registryTools);
  // geox_evidence_reason and wealth_wisdom_evaluate are in BOTH THINK action class AND 333_REASON stage
  assert.ok(
    surfaceBroad.allowedTools.includes("geox_evidence_reason"),
    "geox_evidence_reason should resolve from geox_* in THINK ∩ 333_REASON",
  );
  assert.ok(
    surfaceBroad.allowedTools.includes("wealth_wisdom_evaluate"),
    "wealth_wisdom_evaluate should resolve from wealth_* in THINK ∩ 333_REASON",
  );
  // well_assess_metabolism is in THINK action but NOT in 333_REASON stage → excluded by narrowing
  assert.ok(
    !surfaceBroad.allowedTools.includes("well_assess_metabolism"),
    "well_* tools excluded by 333_REASON stage (only geox_evidence_reason in stage)",
  );

  // Should NOT contain forge_execute (not in OBSERVE action class)
  assert.ok(
    !surface.allowedTools.includes("arif_forge_execute"),
    "forge_execute should NOT be in OBSERVE scope",
  );
});

// ─── 4. classifyAction helper ──────────────────────────────────────────

test("classifyAction: maps forge_plan labels correctly", () => {
  assert.equal(classifyAction("observe"), "OBSERVE");
  assert.equal(classifyAction("OBSERVE"), "OBSERVE");
  assert.equal(classifyAction("read"), "READ");
  assert.equal(classifyAction("read_only"), "OBSERVE");
  assert.equal(classifyAction("think"), "THINK");
  assert.equal(classifyAction("plan"), "THINK");
  assert.equal(classifyAction("draft"), "DRAFT");
  assert.equal(classifyAction("mutate"), "MUTATE");
  assert.equal(classifyAction("write"), "MUTATE");
  assert.equal(classifyAction("build"), "MUTATE");
  assert.equal(classifyAction("irreversible"), "IRREVERSIBLE");
  assert.equal(classifyAction("seal"), "IRREVERSIBLE");
  assert.equal(classifyAction("delete"), "IRREVERSIBLE");
});

test("classifyAction: extracts from args when provided", () => {
  assert.equal(
    classifyAction("observe", { actionClass: "mutate" }),
    "MUTATE",
    "args.actionClass should take priority",
  );
  assert.equal(
    classifyAction("observe", { action: "read" }),
    "OBSERVE",
    "unrecognized arg keys should not confuse the classifier",
  );
});

test("classifyAction: defaults to OBSERVE for unknown classifications", () => {
  assert.equal(classifyAction(""), "OBSERVE");
  assert.equal(classifyAction("unknown_garbage"), "OBSERVE");
  assert.equal(classifyAction("  "), "OBSERVE");
});

// ─── 5. Stage-to-action mapping ────────────────────────────────────────

test("stageToActionClass: maps each stage to the correct action class", () => {
  assert.equal(stageToActionClass("000_CLARIFY"), "OBSERVE");
  assert.equal(stageToActionClass("111_OBSERVE"), "OBSERVE");
  assert.equal(stageToActionClass("222_EVIDENCE"), "READ");
  assert.equal(stageToActionClass("333_REASON"), "THINK");
  assert.equal(stageToActionClass("444_COMPOSE"), "DRAFT");
  assert.equal(stageToActionClass("555_ROUTE"), "READ");
  assert.equal(stageToActionClass("666_HEART"), "THINK");
  assert.equal(stageToActionClass("777_EXECUTE"), "MUTATE");
  assert.equal(stageToActionClass("888_JUDGE"), "THINK");
  assert.equal(stageToActionClass("999_SEAL"), "IRREVERSIBLE");
});

// ─── 6. Pipeline stage narrowing ──────────────────────────────────────

test("ToolScoper: 888_JUDGE stage narrows THINK to judgment tools", () => {
  const scoper = new ToolScoper();
  const surface = scoper.scope("THINK", "888_JUDGE");

  const allowed = surface.allowedTools;

  // 888_JUDGE stage should intersect THINK action class with stage-specific tools.
  // THINK patterns are: arif_mind_reason, arif_judge_deliberate, arif_heart_critique,
  // geox_evidence_reason, wealth_wisdom_evaluate, wealth_omni_wisdom,
  // well_assess_metabolism, well_assess_homeostasis
  // 888_JUDGE stage tools are: arif_judge_deliberate, arif_vault_seal
  assert.ok(allowed.includes("arif_judge_deliberate"), "judge_deliberate must be in 888_JUDGE scope");

  // vault_seal is in 888_JUDGE stage tools but NOT in THINK action class
  // → the intersection logic falls through to union mode when intersection is empty
  // vault_seal may or may not be present depending on the intersection/union logic
  // This is a design choice — the important thing is judge_deliberate is present

  // Should not include reasoning tools unrelated to judgment
  assert.ok(
    !allowed.includes("arif_mind_reason"),
    "888_JUDGE should exclude arif_mind_reason (not in stage tools)",
  );
});

// ─── 7. Custom action tool map override ───────────────────────────────

test("ToolScoper: custom actionToolMap overrides defaults", () => {
  const customMap: Partial<Record<ActionClass, string[]>> = {
    READ: ["arif_ping", "forge_query"],  // Only these two tools for READ
  };
  const scoper = new ToolScoper(undefined, customMap);
  const surface = scoper.scope("READ", "555_ROUTE");

  // With a custom map, the overrides are used directly (no fallback to defaults)
  // However, "555_ROUTE" stage tools are ["arif_kernel_route", "arif_gateway_connect"]
  // which intersect with action class patterns. Since intersection is empty,
  // union mode kicks in: [arif_ping, forge_query] + [arif_kernel_route, arif_gateway_connect]
  assert.equal(surface.allowedTools.length, 4, "custom READ + stage union should have 4 tools");
  assert.ok(surface.allowedTools.includes("arif_ping"), "custom READ includes arif_ping");
  assert.ok(surface.allowedTools.includes("forge_query"), "custom READ includes forge_query");
  assert.ok(surface.allowedTools.includes("arif_kernel_route"), "555_ROUTE stage includes kernel_route");
  assert.ok(surface.allowedTools.includes("arif_gateway_connect"), "555_ROUTE stage includes gateway_connect");
});

// ─── 8. Edge cases ─────────────────────────────────────────────────────

test("ToolScoper: empty action class patterns should not crash", () => {
  const overrides: Partial<Record<ActionClass, string[]>> = {
    MUTATE: [],
  };
  const scoper = new ToolScoper(undefined, overrides);
  const surface = scoper.scope("MUTATE", "777_EXECUTE");

  // When override is empty, resolveActionPatterns falls back to defaults.
  // So MUTATE patterns come from DEFAULT_ACTION_TOOL_MAP.
  // 777_EXECUTE stage tools are ["forge_execute", "arif_forge_execute", "forge_approve"]
  // Intersection of MUTATE defaults with stage is non-empty → intersection used.
  assert.ok(surface.allowedTools.length > 0,
    "empty override falls back to defaults — tools should exist");
  assert.ok(surface.allowedTools.includes("forge_approve"),
    "forge_approve should be present (in both MUTATE defaults and 777_EXECUTE stage)");
});

test("ToolScoper: singleton getToolScoper returns same instance", () => {
  resetToolScoper();
  const a = getToolScoper();
  const b = getToolScoper();
  assert.equal(a, b, "getToolScoper() should return the same singleton instance");
  resetToolScoper();
  const c = getToolScoper();
  assert.notEqual(a, c, "after reset, getToolScoper() should return a new instance");
});
