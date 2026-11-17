/**
 * A-THINK dispatch mode floor — regression test for the 2026-10-29 surface sweep.
 *
 * FAILURE CLASS (measured, not theorised): forge_git({mode:"status"}) was refused
 * by BOTH instruments — the MCP SDK client and raw curl — with
 *   STOP "BUDGET: max_tools=0 reached (used=0)"
 * because the ingress paths (serve.ts stateless, core.ts stdio x2) feed a tool
 * PARAMETER into classifyMode(), which classifies human SENTENCES. "status" reads
 * as neither ambiguous nor analysable → FAST → and the FAST lane carries
 * max_tools: 0 by design, so the call was refused for spending a budget it was
 * never permitted to touch. Every non-OBSERVE tool whose args look "simple"
 * inherits this dead lane.
 *
 * These tests pin the four things that must stay true:
 *   1. a tool call arriving at the guard is never judged in the 0-tool lane;
 *   2. the FAST lane itself is NOT loosened — budgets.yaml still says 0;
 *   3. classifyMode() still answers FAST for plain questions (the lane that
 *      refuses tool use for a turn is a real control and stays);
 *   4. the floor does not weaken the affordance gate (THINK(1) < GOVERN(2)).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyMode, AThinkGuard } from "../src/domain/governance/aThinkGuard.js";

// Hermetic budgets (D-1 rule: runtime budgets.yaml is mutable operational state).
// Identical shape to the production file so the floor is tested against real
// numbers, including FAST.max_tools = 0.
const TEST_BUDGETS: Record<string, any> = {
  FAST:   { max_steps: 1,  max_tools: 0, max_agents: 1, max_time_seconds: 10,   memory: false, receipt: false, human_gate: false },
  THINK:  { max_steps: 12, max_tools: 10, max_agents: 2, max_time_seconds: 120, memory: true,  receipt: true,  human_gate: false },
  GOVERN: { max_steps: 20, max_tools: 40, max_agents: 3, max_time_seconds: 300, memory: true,  receipt: true,  human_gate: true  },
};

test("floor: a tool call classified from a bare mode string is not STOPped for max_tools=0", () => {
  const guard = new AThinkGuard(TEST_BUDGETS as any);
  // Exactly what serve.ts:1204 passes for a non-shell tool: String(args.mode).
  const r = guard.check("forge_git", "status", "floor-git-status");
  assert.equal(r.mode, "THINK", `expected THINK, got ${r.mode}`);
  assert.ok(!r.reason.includes("max_tools=0"), `self-contradictory STOP survived: ${r.reason}`);
  assert.equal(r.allowed, true, `read-only git mode must reach the tool: ${r.status} ${r.reason}`);
  // F11: the verdict must name the branch that let it through, not bare "ALLOWED".
  assert.match(r.reason, /read-only/i, `exemption not traceable in verdict: ${r.reason}`);
});

test("floor: plain-question input at dispatch also leaves the 0-tool lane", () => {
  const guard = new AThinkGuard(TEST_BUDGETS as any);
  const r = guard.check("forge_chart", "What is MCP?", "floor-chart-question");
  assert.equal(r.mode, "THINK");
  assert.equal(r.status, "ALLOW");
});

test("FAST lane is NOT loosened: production budgets.yaml still declares max_tools: 0", () => {
  // Anchored on cwd, not __dirname: the canonical runner is `node --test
  // dist/test/*.js` executed from the repo root (see package.json scripts.test).
  const p = resolve(process.cwd(), "a_think/budgets.yaml");
  const raw = readFileSync(p, "utf-8");
  const fastBlock = raw.split(/\n\s+THINK:/)[0];
  assert.match(fastBlock, /max_tools:\s*0/, "the fix must floor the LANE, not raise the FAST budget");
});

test("classifyMode still answers FAST for ordinary questions (control preserved)", () => {
  assert.equal(classifyMode("Summarize this paragraph"), "FAST");
  assert.equal(classifyMode("What is MCP?"), "FAST");
});

test("exemption is mode-scoped: a mutating git mode does NOT get the read-only pass", () => {
  const guard = new AThinkGuard(TEST_BUDGETS as any);
  // "commit" is absent from READONLY_GIT_MODES — the card's GOVERN requirement
  // must still bite. This is the falsifier for the floor + exemption pair.
  const r = guard.check("forge_git", "commit", "floor-git-commit");
  assert.equal(r.allowed, false, `mutating mode slipped through: ${r.status} ${r.reason}`);
  assert.ok(!/read-only/i.test(r.reason), `exemption applied to a mutate mode: ${r.reason}`);
});

test("floor does not weaken affordance gating: side-effect input still classifies GOVERN", () => {
  // MODE_ORDER THINK(1) < GOVERN(2); inputs naming an external side effect must
  // still land in GOVERN so the human-approval branch can act on them.
  const guard = new AThinkGuard(TEST_BUDGETS as any);
  const r = guard.check("forge_git", "commit the patched kernel and push", "floor-govern-check");
  assert.equal(r.mode, "GOVERN", `side-effect input must still classify GOVERN, got ${r.mode}`);
});
