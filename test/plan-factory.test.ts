/**
 * Tests for PlanFactory — W2 Planning Organ.
 *
 * 10 cases covering:
 *  - Linear plans
 *  - Branching plans (DAG with diamond)
 *  - Irreversible flag (F1 surface tools)
 *  - HOLD points (F13 SOVEREIGN)
 *  - Veto insertion rules
 *  - Aggregation (reversibility, risk tier)
 *  - Validation errors (unknown tool, missing dep, self-loop)
 *  - Sensitivity-driven risk adjustment
 *  - arifos_plan_build entry point
 *  - Workflow compatibility (plan shape matches Python engine contract)
 *
 * Run with: npm test
 *   (which compiles to dist/ via tsc, then runs node --test)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PlanFactory,
  passThroughDecomposer,
  F1_SURFACE_TOOLS,
  type TaskTemplate,
} from "../src/domain/governance/planFactory.js";
import type { Mission } from "../src/domain/types/outcome-spec.js";
import type { Plan } from "../src/domain/types/plan.js";
import { arifos_plan_build, PLAN_BUILDER_TOOL_REGISTRY } from "../src/interfaces/mcp/tools/arifos-plan-build.js";
import { aggregateReversibility, aggregateRisk } from "../src/domain/types/plan.js";

// ─── Helpers ────────────────────────────────────────────────────────────

const arifOSPublic13 = [
  "arif_session_init",
  "arif_sense_observe",
  "arif_mind_reason",
  "arif_heart_critique",
  "arif_judge_deliberate",
  "arif_forge_execute",
  "arif_vault_seal",
  "arif_memory_recall",
  "arif_ops_measure",
  "arif_kernel_route",
  "arif_evidence_fetch",
  "arif_gateway_connect",
  "arif_floor_status",
];

function makeMission(tasks: TaskTemplate[], overrides: Partial<Mission> = {}): Mission {
  return {
    outcome: {
      objective: "Test mission objective for W2 planning organ",
      success_criteria: ["plan is well-formed", "veto points are correctly inserted"],
      sensitivity: "MEDIUM",
      inputs: { tasks },
    },
    run: {
      allowed_tools: [],
      allowed_models: "auto",
      budget_limit: {},
      persistence_policy: "SESSION",
      approval_policy: { auto_approve_below: 0.5, hold_above: 0.8 },
      max_wall_clock_seconds: 3600,
    },
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

test("W2.1 — linear plan: 1 reversible task, no veto, plan_state=DRAFT", () => {
  const factory = new PlanFactory();
  const mission = makeMission([
    { task_id: "t1", tool: "arif_sense_observe", args: { mode: "search", query: "x" } },
  ]);
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.tasks.length, 1);
  assert.equal(result.plan.tasks[0].reversibility_class, "reversible");
  assert.equal(result.plan.tasks[0].risk_tier, "LOW");
  assert.equal(result.plan.tasks[0].veto_point, undefined);
  assert.equal(result.plan.reversibility_class, "reversible");
  assert.equal(result.plan.risk_tier, "LOW");
  assert.equal(result.plan.plan_state, "DRAFT");
  assert.equal(result.plan.judge_verdict, "HOLD"); // DRAFT plans start as HOLD
  assert.equal(result.plan.veto_points.length, 0);
});

test("W2.2 — branching plan: 3 tasks, diamond DAG, edges derived", () => {
  const factory = new PlanFactory();
  const mission = makeMission([
    { task_id: "t1", tool: "arif_sense_observe", args: { mode: "search" } },
    { task_id: "t2", tool: "arif_mind_reason", args: { q: "x" }, depends_on: ["t1"] },
    { task_id: "t3", tool: "arif_heart_critique", args: { q: "y" }, depends_on: ["t1"] },
  ]);
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.tasks.length, 3);
  assert.equal(result.plan.edges.length, 2);
  // Edge t1 -> t2 and t1 -> t3 (no t2 -> t3)
  const edgeSet = new Set(result.plan.edges.map((e) => `${e.from_task_id}->${e.to_task_id}`));
  assert.ok(edgeSet.has("t1->t2"));
  assert.ok(edgeSet.has("t1->t3"));
});

test("W2.3 — irreversible flag: arif_vault_seal triggers F1 AMANAH veto", () => {
  const factory = new PlanFactory();
  const mission = makeMission([
    { task_id: "t1", tool: "arif_vault_seal", args: { payload: "x" } },
  ]);
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const task = result.plan.tasks[0];
  assert.equal(task.reversibility_class, "irreversible");
  assert.equal(task.risk_tier, "CRITICAL");
  assert.ok(task.veto_point !== undefined);
  assert.equal(task.veto_point!.floor, "F1");
  assert.ok(task.veto_point!.human_required);
  assert.equal(result.plan.reversibility_class, "irreversible");
  assert.equal(result.plan.risk_tier, "CRITICAL");
  // Veto surfaced at plan level
  assert.equal(result.plan.veto_points.length, 1);
  assert.equal(result.plan.veto_points[0].floor, "F1");
});

test("W2.4 — HOLD point: SOVEREIGN sensitivity adds plan-level F13 veto", () => {
  const factory = new PlanFactory();
  const mission = makeMission(
    [
      { task_id: "t1", tool: "arif_sense_observe", args: {} },
      { task_id: "t2", tool: "arif_mind_reason", args: {}, depends_on: ["t1"] },
    ],
    {
      outcome: {
        objective: "SOVEREIGN mission — requires F13 ratify for everything",
        success_criteria: ["plan executed without F13 override"],
        sensitivity: "SOVEREIGN",
        inputs: { tasks: undefined },
      } as any,
    }
  );
  // Note: the inputs override above won't survive materialize() if the factory
  // pulls tasks from inputs. Build mission with tasks in inputs AND SOVEREIGN sensitivity.
  const realMission: Mission = {
    outcome: {
      objective: "SOVEREIGN mission",
      success_criteria: ["plan executed"],
      sensitivity: "SOVEREIGN",
      inputs: {
        tasks: [
          { task_id: "t1", tool: "arif_sense_observe", args: {} },
          { task_id: "t2", tool: "arif_mind_reason", args: {}, depends_on: ["t1"] },
        ],
      },
    },
    run: {
      allowed_tools: [],
      allowed_models: "auto",
      budget_limit: {},
      persistence_policy: "SESSION",
      approval_policy: { auto_approve_below: 0.5, hold_above: 0.8 },
      max_wall_clock_seconds: 3600,
    },
  };
  const result = factory.build(realMission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Plan-level F13 veto should be inserted at the FIRST task
  const planVeto = result.plan.veto_points.find((v) =>
    v.reason.includes("sensitivity=SOVEREIGN")
  );
  assert.ok(planVeto !== undefined, "plan-level F13 veto should exist");
  assert.equal(planVeto!.floor, "F13");
  assert.equal(planVeto!.human_required, true);
});

test("W2.5 — veto insertion: HIGH risk tool gets F13 veto (without F1 surface)", () => {
  const factory = new PlanFactory();
  // arif_gateway_connect is MEDIUM by default; with HIGH sensitivity, it should become HIGH
  // which triggers F13 veto.
  const mission = makeMission(
    [
      { task_id: "t1", tool: "arif_gateway_connect", args: { target: "external" } },
    ],
    {
      outcome: {
        objective: "External gateway call with HIGH sensitivity",
        success_criteria: ["call made"],
        sensitivity: "HIGH",
        inputs: {
          tasks: [
            { task_id: "t1", tool: "arif_gateway_connect", args: { target: "external" } },
          ],
        },
      } as any,
    }
  );
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const task = result.plan.tasks[0];
  // MEDIUM + HIGH sensitivity → HIGH risk
  assert.equal(task.risk_tier, "HIGH");
  // HIGH risk → F13 veto
  assert.ok(task.veto_point !== undefined);
  assert.equal(task.veto_point!.floor, "F13");
});

test("W2.6 — aggregation: mixed reversibility + max risk tier", () => {
  const revs = [
    { reversibility_class: "reversible" as const },
    { reversibility_class: "irreversible" as const },
  ];
  assert.equal(aggregateReversibility(revs), "mixed");
  const onlyRev = [{ reversibility_class: "reversible" as const }];
  assert.equal(aggregateReversibility(onlyRev), "reversible");
  const onlyIrrev = [{ reversibility_class: "irreversible" as const }];
  assert.equal(aggregateReversibility(onlyIrrev), "irreversible");

  // Max risk
  assert.equal(aggregateRisk([{ risk_tier: "LOW" }, { risk_tier: "HIGH" }]), "HIGH");
  assert.equal(aggregateRisk([{ risk_tier: "MEDIUM" }, { risk_tier: "MEDIUM" }]), "MEDIUM");
  assert.equal(aggregateRisk([{ risk_tier: "LOW" }]), "LOW");
});

test("W2.7 — validation error: unknown tool name", () => {
  const factory = new PlanFactory();
  const mission = makeMission([
    { task_id: "t1", tool: "nonexistent_tool", args: {} },
  ]);
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,  // does NOT include "nonexistent_tool"
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => e.includes("not in registry")));
});

test("W2.8 — validation error: missing dependency in depends_on", () => {
  const factory = new PlanFactory();
  const mission = makeMission([
    { task_id: "t1", tool: "arif_sense_observe", args: {}, depends_on: ["nonexistent_task"] },
  ]);
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => e.includes("not a known task_id")));
});

test("W2.9 — validation error: self-dependency", () => {
  const factory = new PlanFactory();
  const mission = makeMission([
    { task_id: "t1", tool: "arif_sense_observe", args: {}, depends_on: ["t1"] },
  ]);
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => e.includes("self-dependency")));
});

test("W2.10 — arifos_plan_build entry point + workflow compatibility", () => {
  const mission = makeMission([
    { task_id: "t1", tool: "arif_sense_observe", args: { mode: "health" } },
    {
      task_id: "t2",
      tool: "arifos_workflow_execute",
      args: { plan: { steps: [] } },
      depends_on: ["t1"],
    },
  ]);
  const result = arifos_plan_build(mission, "test_agent");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const plan: Plan = result.plan;
  // Plan shape must match what arifOS Python WorkflowEngine expects
  assert.ok(plan.plan_id.startsWith("plan_"));
  assert.ok(plan.mission_id.startsWith("mission_"));
  assert.ok(plan.outcome_spec_id.startsWith("outcomespec_"));
  assert.equal(typeof plan.created_at, "string");
  assert.equal(plan.created_by, "test_agent");
  // Each task has all the fields the Python engine needs
  for (const t of plan.tasks) {
    assert.ok(t.task_id);
    assert.ok(t.tool);
    assert.ok(Array.isArray(t.depends_on));
    assert.ok(t.args !== undefined);
    assert.ok(["reversible", "irreversible"].includes(t.reversibility_class));
    assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(t.risk_tier));
    assert.ok(Array.isArray(t.floor_context));
  }
  // arifos_plan_build knows about both arif_* and arifos_* tools
  assert.ok(PLAN_BUILDER_TOOL_REGISTRY.includes("arif_vault_seal"));
  assert.ok(PLAN_BUILDER_TOOL_REGISTRY.includes("arifos_workflow_execute"));
  // F1 surface tools are correctly identified
  assert.ok(F1_SURFACE_TOOLS.has("arif_vault_seal"));
  assert.ok(F1_SURFACE_TOOLS.has("arif_forge_execute"));
  assert.ok(F1_SURFACE_TOOLS.has("arif_judge_deliberate"));
});

test("W2.11 — mission run.allowed_tools narrows global tool registry", () => {
  const factory = new PlanFactory();
  const mission = makeMission(
    [
      { task_id: "t1", tool: "arif_sense_observe", args: {} },
      { task_id: "t2", tool: "arif_vault_seal", args: { payload: "x" } },
    ],
    {
      run: {
        allowed_tools: ["arif_sense_observe"],
        allowed_models: "auto",
        budget_limit: {},
        persistence_policy: "SESSION",
        approval_policy: { auto_approve_below: 0.5, hold_above: 0.8 },
        max_wall_clock_seconds: 3600,
      },
    }
  );
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => e.includes("outside mission tool allowlist")));
});

test("W2.12 — outcome.constraints.tool_scope narrows allowed tools", () => {
  const factory = new PlanFactory();
  const mission = makeMission(
    [
      { task_id: "t1", tool: "arif_sense_observe", args: {} },
      { task_id: "t2", tool: "arif_mind_reason", args: {} },
    ],
    {
      outcome: {
        objective: "Scoped mission",
        success_criteria: ["only scoped tool runs"],
        sensitivity: "MEDIUM",
        constraints: { tool_scope: ["arif_sense_observe"] },
        inputs: {
          tasks: [
            { task_id: "t1", tool: "arif_sense_observe", args: {} },
            { task_id: "t2", tool: "arif_mind_reason", args: {} },
          ],
        },
      },
    }
  );
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => e.includes("outside mission tool allowlist")));
});

test("W2.13 — validation error: dependency cycle", () => {
  const factory = new PlanFactory();
  const mission = makeMission([
    { task_id: "t1", tool: "arif_sense_observe", args: {}, depends_on: ["t2"] },
    { task_id: "t2", tool: "arif_mind_reason", args: {}, depends_on: ["t1"] },
  ]);
  const result = factory.build(mission, {
    created_by: "test",
    tool_registry: arifOSPublic13,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => e.includes("dependency cycle detected")));
});
