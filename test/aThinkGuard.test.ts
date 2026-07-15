/**
 * A-THINK Guard — Integration Tests
 *
 * Proves:
 * 1. FAST mode: 0 tools → STOP on any tool attempt
 * 2. THINK mode: max 2 tools → STOP on third
 * 3. GOVERN + unknown tool → HOLD
 * 4. GOVERN + destructive tool → HOLD (human approval)
 * 5. GOVERN + read-only tool → ALLOW
 * 6. Direct bypass attempt (FAST mode, GOVERN-only tool) → DENY
 * 7. Budget enforcement per mode
 *
 * Run: node --test test/aThinkGuard.test.ts
 * Or:  npm test (after build)
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyMode,
  aThinkCheck,
  AThinkGuard,
} from "../src/domain/governance/aThinkGuard.js";

// ── Mode Classification Tests ────────────────────────────────────────────

test("classifyMode: simple question → FAST", () => {
  assert.equal(classifyMode("Summarize this paragraph"), "FAST");
  assert.equal(classifyMode("What is MCP?"), "FAST");
  assert.equal(classifyMode("Explain what arifOS is"), "FAST");
});

test("classifyMode: analysis request → THINK", () => {
  assert.equal(classifyMode("Compare LangGraph vs AutoGen"), "THINK");
  assert.equal(classifyMode("Critique this architecture"), "THINK");
  assert.equal(classifyMode("What are the risks of this approach"), "THINK");
  assert.equal(classifyMode("Should I use DSPy or manual prompts"), "THINK");
});

test("classifyMode: external side effect → GOVERN", () => {
  assert.equal(classifyMode("Deploy to production"), "GOVERN");
  assert.equal(classifyMode("Send email to client"), "GOVERN");
  assert.equal(classifyMode("Publish this blog post"), "GOVERN");
  assert.equal(classifyMode("git push --force"), "GOVERN");
});

test("classifyMode: irreversible action → GOVERN", () => {
  assert.equal(classifyMode("Delete the old database"), "GOVERN");
  assert.equal(classifyMode("Drop table users"), "GOVERN");
  assert.equal(classifyMode("Truncate logs"), "GOVERN");
});

// ── Budget Enforcement Tests ─────────────────────────────────────────────

test("FAST mode: 0 tools budget → STOP on any tool", () => {
  const result = aThinkCheck("forge_search", "What is MCP?", "test-fast-1");
  assert.equal(result.status, "STOP");
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("BUDGET"));
  assert.ok(result.reason.includes("max_tools=0"));
});

test("THINK mode: respects max 2 tools", () => {
  const guard = new AThinkGuard();

  // First tool → ALLOW
  const r1 = guard.check("forge_search", "Compare LangGraph vs AutoGen", "test-think-budget");
  assert.equal(r1.status, "ALLOW", `First call should be ALLOW, got ${r1.status}`);

  // Second tool → ALLOW
  const r2 = guard.check("forge_search", "Compare LangGraph vs AutoGen", "test-think-budget");
  assert.equal(r2.status, "ALLOW", `Second call should be ALLOW, got ${r2.status}`);

  // Third tool → STOP (budget exceeded)
  const r3 = guard.check("forge_search", "Compare LangGraph vs AutoGen", "test-think-budget");
  assert.equal(r3.status, "STOP", `Third call should be STOP, got ${r3.status}`);
  assert.ok(r3.reason.includes("BUDGET") || r3.reason.includes("max_tools"));
});

test("GOVERN mode: respects max 5 tools", () => {
  const guard = new AThinkGuard();

  // Use 5 tools (read-only tools that are allowed in GOVERN)
  for (let i = 0; i < 5; i++) {
    const r = guard.check("forge_dry_run", "Deploy to production", "test-govern-budget");
    assert.equal(r.status, "ALLOW", `Tool ${i + 1} should be ALLOW, got ${r.status}`);
  }

  // Sixth tool → STOP
  const r6 = guard.check("forge_dry_run", "Deploy to production", "test-govern-budget");
  assert.equal(r6.status, "STOP", `Sixth call should be STOP, got ${r6.status}`);
});

// ── Affordance: UNKNOWN = HOLD ───────────────────────────────────────────

test("GOVERN + unknown tool → HOLD", () => {
  const result = aThinkCheck("some_random_tool", "Deploy to production", "test-unknown-1");
  assert.equal(result.status, "HOLD");
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("UNKNOWN") || result.reason.includes("no affordance card"));
});

test("GOVERN + unregistered tool → HOLD", () => {
  const result = aThinkCheck("forge_nonexistent_tool", "Deploy to production", "test-unknown-2");
  assert.equal(result.status, "HOLD");
  assert.equal(result.allowed, false);
});

// ── Destructive Tool = Human Approval ────────────────────────────────────

test("GOVERN + destructive tool (forge_execute) → HOLD for human approval", () => {
  const result = aThinkCheck("forge_execute", "Deploy to production", "test-destructive-1");
  assert.equal(result.status, "HOLD");
  assert.equal(result.requires_human_approval, true);
  assert.ok(result.reason.includes("human approval"));
});

test("GOVERN + destructive tool (forge_shell) → HOLD for human approval", () => {
  const result = aThinkCheck("forge_shell", "Deploy to production", "test-destructive-2");
  assert.equal(result.status, "HOLD");
  assert.equal(result.requires_human_approval, true);
});

// ── Read-Only in GOVERN = ALLOW ──────────────────────────────────────────

test("GOVERN + read-only tool (forge_dry_run) → ALLOW", () => {
  const result = aThinkCheck("forge_dry_run", "Deploy to production", "test-readonly-1");
  assert.equal(result.status, "ALLOW");
  assert.equal(result.allowed, true);
});

test("GOVERN + read-only tool (forge_search) → ALLOW", () => {
  const result = aThinkCheck("forge_search", "Deploy to production", "test-readonly-2");
  assert.equal(result.status, "ALLOW");
  assert.equal(result.allowed, true);
});

// ── Direct Bypass Denial ─────────────────────────────────────────────────

test("FAST mode + GOVERN-only tool → DENY (mode too low)", () => {
  // forge_shell requires min_mode=GOVERN, FAST is too low
  const result = aThinkCheck("forge_shell", "What is MCP?", "test-bypass-1");
  assert.equal(result.allowed, false);
  // Should be DENY (mode mismatch) or STOP (budget)
  assert.ok(["DENY", "STOP"].includes(result.status));
});

test("THINK mode + GOVERN-only tool → DENY (mode too low)", () => {
  // forge_execute requires min_mode=GOVERN, THINK is too low
  const result = aThinkCheck("forge_execute", "Analyze this", "test-bypass-2");
  assert.equal(result.allowed, false);
  assert.equal(result.status, "DENY");
  assert.ok(result.reason.includes("min_mode=GOVERN"));
});

// ── Session Tracking ─────────────────────────────────────────────────────

test("session tracks tool usage", () => {
  const guard = new AThinkGuard();

  guard.check("forge_search", "Compare tools", "test-tracking-1");
  const session = guard.getSession("test-tracking-1");
  assert.ok(session);
  assert.equal(session.tools_used, 1);
  assert.equal(session.mode, "THINK");

  guard.check("forge_search", "Compare tools", "test-tracking-1");
  const session2 = guard.getSession("test-tracking-1");
  assert.ok(session2);
  assert.equal(session2.tools_used, 2);
});

// ── Full Flow ────────────────────────────────────────────────────────────

test("full flow: FAST → STOP, THINK → ALLOW, GOVERN → HOLD", () => {
  // FAST: simple question, no tools allowed
  const fast = aThinkCheck("forge_search", "What is MCP?", "test-full-fast");
  assert.equal(fast.status, "STOP");
  assert.equal(fast.mode, "FAST");

  // THINK: analysis, tool allowed
  const think = aThinkCheck("forge_search", "Compare LangGraph vs AutoGen", "test-full-think");
  assert.equal(think.status, "ALLOW");
  assert.equal(think.mode, "THINK");

  // GOVERN: deploy, requires approval
  const govern = aThinkCheck("forge_execute", "Deploy to production", "test-full-govern");
  assert.equal(govern.status, "HOLD");
  assert.equal(govern.mode, "GOVERN");
  assert.equal(govern.requires_human_approval, true);
});

// ── Affordance Card Inspection ───────────────────────────────────────────

test("affordance cards are loaded", () => {
  const guard = new AThinkGuard();

  // Known tools should have cards
  assert.ok(guard.getAffordance("forge_search"));
  assert.ok(guard.getAffordance("forge_execute"));
  assert.ok(guard.getAffordance("forge_shell"));
  assert.ok(guard.getAffordance("geox_basin"));

  // Unknown tool should not
  assert.equal(guard.getAffordance("nonexistent_tool"), undefined);
});

test("affordance cards have correct risk labels", () => {
  const guard = new AThinkGuard();

  assert.equal(guard.getAffordance("forge_search")?.risk_label, "R0");
  assert.equal(guard.getAffordance("forge_execute")?.risk_label, "R5");
  assert.equal(guard.getAffordance("forge_shell")?.risk_label, "R5");
  assert.equal(guard.getAffordance("forge_git")?.risk_label, "R3");
});
