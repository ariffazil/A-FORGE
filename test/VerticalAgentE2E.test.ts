/**
 * VerticalAgentE2E.test.ts — D8 minimum-viable e2e
 *
 * Proves: VerticalAgentEngine runs 000→999 lifecycle on a real task,
 * produces a typed AgenticEventEnvelope with work_contract_id, and
 * passes BW14 (every run has a governed work ledger).
 *
 * Zen discipline: smallest test that exercises the spine end-to-end.
 * No mocks of the state machine, no overengineering of stages.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createVerticalAgent } from "../src/domain/agents/vertical-agent/index.js";
import { validateBendaWajib } from "../src/domain/governance/benda-wajib.js";
import type { WorkContract } from "../src/domain/types/memory-lifecycle.js";

const WORK_CONTRACT: WorkContract = {
  task_id: "task-20260712-003",
  objective: "Prove VerticalAgentEngine runs end-to-end and produces BW14-valid envelope",
  success_criteria: [
    "agent reaches stage 999_SEAL",
    "envelope carries work_contract_id",
    "validateBendaWajib verdict == PASS",
    "task_outcome.budgets populated",
  ],
  budget: {
    reasoning: { max_cycles: 8, max_input_tokens: 80000, max_output_tokens: 16000 },
    tools: { max_calls_total: 20 },
    coordination: { max_delegations: 3 },
    cost: { max_usd: 0.50 },
    termination: { confidence_target: 0.50 },
  },
};

test("D8 — VerticalAgentEngine runs 000→999 and produces BW14-valid envelope", () => {
  // 000 INIT
  const agent = createVerticalAgent({
    agent_id: "forge-e2e-test",
    domain: "engineering" as never,
    session_id: "sct-e2e-001",
    actor_id: "forge-000Ω",
    work_contract: WORK_CONTRACT,
  });

  // 111 OBSERVE — one observation
  agent.addObservation({
    id: "obs-1",
    content: { key: "D7 patch landed", files: 2, tests_passing: 19 },
    source: "filesystem",
    source_type: "direct_observation",
    truth_class: "FACT",
    confidence: 0.95,
    observed_at: "2026-07-12T10:30:00Z",
    source_reliability: 0.95,
    domain: "engineering" as never,
  });

  // 333 THINK — one proposal
  agent.addProposal({
    id: "prop-1",
    description: "Run D8 e2e test on VerticalAgentEngine",
    classification: "EXECUTE_REVERSIBLE",
    reversible: true,
    expected_outcome: "Test passes with 4/4 assertions",
    success_evidence: "All test assertions green",
    failure_evidence: "Any assertion red",
    risk: 0.10,
    cost: 0.05,
    source_observation_ids: ["obs-1"],
    tool_name: "node:test",
    confidence: 0.90,
    proposed_at: "2026-07-12T10:30:00Z",
  });

  // 888 VERIFY — one verification that passed
  agent.addVerification({
    id: "ver-1",
    proposal_id: "prop-1",
    passed: true,
    observed_outcome: "All assertions green",
    expected_outcome: "Test passes with 4/4 assertions",
    match_quality: 1.0,
    success_evidence_matched: ["All test assertions green"],
    failure_evidence_matched: [],
    contradictions: [],
    confidence: 0.95,
    verified_at: "2026-07-12T10:30:00Z",
  });

  // Advance: 000 → 111 → 333 → 888 → 999 (one advance per stage transition)
  const advances: Array<{ ok: boolean; to: string }> = [];
  for (let i = 0; i < 12; i++) {
    const r = agent.advance();
    advances.push({ ok: r.success, to: r.transition?.to ?? "?" });
    if (r.success && r.transition?.to === "999_SEAL") break;
    if (!r.success && r.blockedBy) break;
  }

  // Get the built envelope (typed, after D7)
  const envelope = agent.buildEnvelope();

  // ── Assertions (the 4 success criteria, in order) ───────────────────────

  // 1. Agent reached 999_SEAL
  assert.equal(agent.getStage(), "999_SEAL", `Final stage: ${agent.getStage()}`);

  // 2. Envelope carries work_contract_id (BW14 typed field, post-D7)
  assert.equal(envelope.work_contract_id, "task-20260712-003", "BW14 typed field missing");

  // 3. Full BendaWajib passes (all 14 invariants including BW14 work ledger)
  const bwResult = validateBendaWajib(envelope);
  assert.equal(bwResult.verdict, "PASS", `BW verdict: ${bwResult.verdict}, violated: ${bwResult.violated.join(",")}`);
  assert.equal(bwResult.checks.length, 14);

  // 4. Envelope carries populated budget tuples (the GIE spine — populated
  // by buildEnvelope's D7 patch using produceTaskOutcome internally)
  assert.ok(envelope.budget_consumed, "budget_consumed missing from envelope");
  assert.ok(envelope.task_outcome, "task_outcome missing from envelope");
  assert.equal(
    (envelope.budget_consumed as { cost_usd?: [number, number] }).cost_usd?.[1],
    0.50,
    "budget_consumed.cost_usd allocated should match work_contract.max_usd",
  );
});
