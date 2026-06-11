import test from "node:test";
import assert from "node:assert/strict";
import { SealService } from "../src/domain/governance/SealService.js";
import { PlanValidator } from "../src/domain/planner/PlanValidator.js";
import type { PlanDAG, PlanNode } from "../src/domain/types/plan.js";

// Mock global fetch for SealService tests
const originalFetch = global.fetch;

test("SealService: validation and authorization flows", async () => {
  const validator = new PlanValidator();
  const service = new SealService(validator, undefined, "http://localhost:8088");

  // Create a minimal DAG and Node
  const node1: PlanNode = {
    id: "node1",
    goal: "test goal",
    status: "pending" as const,
    dependencies: [],
    epistemic: {
      confidence: 0.9,
      assumptions: [],
      unknowns: [],
      riskTier: "safe" as const,
      evidenceCount: 1
    }
  };
  const dag: PlanDAG = {
    id: "test-dag",
    rootId: "node1",
    version: 1,
    createdAt: new Date().toISOString(),
    nodes: new Map([["node1", node1]]),
  };

  // Mock fetch to return PASS
  global.fetch = async () => {
    return {
      ok: true,
      json: async () => ({
        result: { content: [{ type: "text", text: "SEAL" }] }
      })
    } as unknown as Response;
  };

  let verdict = await service.validateDag("goal1", dag, "hash123");
  assert.equal(verdict.status, "PASS");

  // Mock fetch to return HOLD
  global.fetch = async () => {
    return {
      ok: true,
      json: async () => ({
        result: { content: [{ type: "text", text: "HOLD" }] }
      })
    } as unknown as Response;
  };

  verdict = await service.validateDag("goal1", dag, "hash123");
  assert.equal(verdict.status, "HOLD");

  // Mock fetch to fail (network error), should default to HOLD
  global.fetch = async () => {
    throw new Error("Network offline");
  };

  verdict = await service.validateDag("goal1", dag, "hash123");
  assert.equal(verdict.status, "HOLD");
  assert.ok(verdict.message?.includes("Network offline"));

  // Restore fetch
  global.fetch = originalFetch;
});
