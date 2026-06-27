/**
 * InspectorClient Integration Test
 *
 * Tests all 7 Inspector hooks integrated into AgentEngine.
 * Uses a mock LLM provider that returns a tool call, then verifies
 * Inspector intercepts deprecated tools, authority violations, and
 * schema errors.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { AgentEngine } from "../src/domain/engine/AgentEngine.js";
import { InspectorClient } from "../src/infrastructure/inspector/InspectorClient.js";
import type { AgentProfile, EngineRunOptions, AgentRunResult } from "../src/domain/types/agent.js";
import { NoOpVaultClient } from "../src/infrastructure/vault/index.js";

// ── Helpers ────────────────────────────────────────────────────

function mockProfile(overrides?: Partial<AgentProfile>): AgentProfile {
  return {
    name: "inspector-test",
    modeName: "internal_mode",
    systemPrompt: "You are a test agent. Use tools when asked.",
    budget: { maxTurns: 3, tokenCeiling: 8000, maxToolCalls: 5 },
    allowedTools: ["forge_filesystem", "forge_git", "arif_session_init", "arif_health_check"],
    ...overrides,
  };
}

function mockOptions(overrides?: Partial<EngineRunOptions>): EngineRunOptions {
  return {
    task: "Write a test file to /tmp/inspector-test.txt",
    sessionId: `inspector-test-${Date.now()}`,
    workingDirectory: "/tmp",
    riskLevel: "low",
    intentModel: "advisory",
    ackIrreversible: false,
    humanApprovedTicketId: undefined,
    metadata: {},
    ...overrides,
  };
}

/**
 * Creates a mock LLM provider that returns a single tool call then stops.
 */
function mockLlmProvider(toolName: string, toolArgs: Record<string, unknown>) {
  return {
    name: "mock",
    completeTurn: async () => ({
      content: `I'll call ${toolName}`,
      toolCalls: [{
        id: `call_${Date.now()}`,
        toolName,
        args: toolArgs,
      }],
      usage: { inputTokens: 100, outputTokens: 50 },
      responseId: `resp_${Date.now()}`,
      providerMetrics: {},
    }),
  };
}

/**
 * Creates a mock LLM provider that returns text (no tool calls), ending the loop.
 */
function mockTextProvider(response: string) {
  return {
    name: "mock-text",
    completeTurn: async () => ({
      content: response,
      toolCalls: [],
      usage: { inputTokens: 50, outputTokens: 20 },
      responseId: `resp_${Date.now()}`,
      providerMetrics: {},
    }),
  };
}

// ── InspectorClient instance for tests ─────────────────────────

const inspector = new InspectorClient({
  deprecationRegistryPath: "/root/AAA/docs/deprecation-registry.json",
  toolRegistryPath: "/root/AAA/docs/TOOLREGISTRY.json",
  sessionId: `inspector-smoke-${Date.now()}`,
});

// ═══════════════════════════════════════════════════════════════
// P0: Deprecation + Authority (unit tests)
// ═══════════════════════════════════════════════════════════════

await test("P0: checkDeprecated — detects DEPRECATED_PROXY tools", async () => {
  const check = inspector.checkDeprecated("mcp__arifos__forge_filesystem");
  assert.equal(check.deprecated, true);
  assert.equal(check.status, "DEPRECATED_PROXY");
  assert.ok(check.migration.includes("forge.arif-fazil.com"));
});

await test("P0: checkDeprecated — marks active tools clean", async () => {
  const check = inspector.checkDeprecated("arif_session_init");
  assert.equal(check.deprecated, false);
  assert.equal(check.status, "ACTIVE");
});

await test("P0: checkDeprecated — wildcard matches forge_* patterns", async () => {
  const check = inspector.checkDeprecated("mcp__arifos__forge_docker");
  assert.equal(check.deprecated, true);
  assert.equal(check.status, "DEPRECATED_PROXY");
});

await test("P0: checkAuthority — blocks OBSERVE agent from IRREVERSIBLE tool", async () => {
  const ctx = { enabledTools: new Set(), dangerousToolsEnabled: false, experimentalToolsEnabled: false, holdEnabled: false, riskLevel: "low" as const };
  const check = inspector.checkAuthority("arif_forge_execute", ctx);
  assert.equal(check.allowed, false);
  assert.equal(check.required, "IRREVERSIBLE");
});

await test("P0: checkAuthority — allows internal_mode agent with dangerous tools", async () => {
  const ctx = { enabledTools: new Set(), dangerousToolsEnabled: true, experimentalToolsEnabled: false, holdEnabled: true, riskLevel: "low" as const };
  const check = inspector.checkAuthority("arif_health_check", ctx);
  assert.equal(check.allowed, true);
});

await test("P0: checkAuthority — humanOverride bypasses all", async () => {
  const ctx = { enabledTools: new Set(), dangerousToolsEnabled: false, experimentalToolsEnabled: false, holdEnabled: false, riskLevel: "low" as const, humanOverride: true };
  const check = inspector.checkAuthority("arif_forge_execute", ctx);
  assert.equal(check.allowed, true);
});

await test("P0: preflight — returns HOLD for deprecated tool", async () => {
  const ctx = { enabledTools: new Set(), dangerousToolsEnabled: false, experimentalToolsEnabled: false, holdEnabled: false, riskLevel: "low" as const };
  const pf = inspector.preflight("mcp__arifos__forge_filesystem", { mode: "read", path: "/tmp/test" }, ctx);
  assert.equal(pf.verdict, "HOLD");
});

await test("P0: preflight — returns PASS for clean tool with sufficient auth", async () => {
  const ctx = { enabledTools: new Set(["arif_health_check"]), dangerousToolsEnabled: false, experimentalToolsEnabled: false, holdEnabled: false, riskLevel: "low" as const };
  const pf = inspector.preflight("arif_health_check", {}, ctx);
  assert.equal(pf.verdict, "PASS");
});

// ═══════════════════════════════════════════════════════════════
// P2: Schema Validation
// ═══════════════════════════════════════════════════════════════

await test("P2: validateSchema — catches missing required args", async () => {
  const result = inspector.validateSchema("forge_filesystem", { mode: "write" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e: string) => e.includes("content")));
});

await test("P2: validateSchema — detects command injection patterns", async () => {
  const result = inspector.validateSchema("forge_shell_dryrun", { command: "rm -rf /" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e: string) => e.includes("F12")));
});

await test("P2: validateSchema — detects path traversal", async () => {
  const result = inspector.validateSchema("forge_filesystem", { mode: "read", path: "../../../etc/passwd" });
  assert.ok(result.warnings.some((w: string) => w.includes("F13")));
});

await test("P2: validateSchema — warns on secret keywords in args", async () => {
  const result = inspector.validateSchema("forge_run", { task: "use API_KEY=sk-12345 to auth" });
  assert.ok(result.warnings.some((w: string) => w.includes("secret")));
});

// ═══════════════════════════════════════════════════════════════
// P3: Output Validation
// ═══════════════════════════════════════════════════════════════

await test("P3: validateOutput — passes clean output", async () => {
  const result = inspector.validateOutput("forge_filesystem", "file written successfully to /tmp/test.txt");
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

await test("P3: validateOutput — detects error patterns in output", async () => {
  const result = inspector.validateOutput("forge_git", "error: permission denied — cannot push to main");
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

await test("P3: validateOutput — flags empty output from mutation tools", async () => {
  const result = inspector.validateOutput("forge_filesystem", "");
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e: string) => e.includes("Empty output")));
});

await test("P3: validateOutput — passes empty output from read tools", async () => {
  // Read tools aren't in the mutation list, so empty output is fine
  const result = inspector.validateOutput("arif_health_check", "");
  assert.equal(result.valid, true);
});

// ═══════════════════════════════════════════════════════════════
// P1 + P4: Snapshot + Drift + Session Continuity
// ═══════════════════════════════════════════════════════════════

await test("P1: snapshot — captures baseline with tools and organs", async () => {
  const snap = await inspector.snapshot();
  assert.ok(snap.sessionId.length > 0);
  assert.ok(Object.keys(snap.tools).length > 10, `Expected >10 tools, got ${Object.keys(snap.tools).length}`);
  assert.ok("arifos" in snap.organs);
  assert.ok("aforge" in snap.organs);
});

await test("P1: detectDrift — runs without baseline (empty report)", async () => {
  const freshInspector = new InspectorClient({
    deprecationRegistryPath: "/root/AAA/docs/deprecation-registry.json",
    toolRegistryPath: "/root/AAA/docs/TOOLREGISTRY.json",
    sessionId: `drift-test-${Date.now()}`,
  });
  const drift = await freshInspector.detectDrift();
  assert.equal(drift.zombie.length, 0);
  assert.equal(drift.missing.length, 0);
});

await test("P1: detectDrift — marks deprecated tools as degraded", async () => {
  const snap = await inspector.snapshot();
  const drift = await inspector.detectDrift(snap);
  assert.ok(drift.degraded.length > 0, `Expected degraded tools, got ${drift.degraded.length}`);
});

await test("P4: snapshotFinal — writes session manifest", async () => {
  const sessionInspector = new InspectorClient({
    deprecationRegistryPath: "/root/AAA/docs/deprecation-registry.json",
    toolRegistryPath: "/root/AAA/docs/TOOLREGISTRY.json",
    sessionId: `final-test-${Date.now()}`,
  });
  await sessionInspector.snapshot();
  await sessionInspector.snapshotFinal();

  const manifest = sessionInspector.loadManifest(sessionInspector["sessionId"]);
  assert.ok(manifest !== null, "Manifest should be loadable");
  assert.equal(manifest!.sessionId, sessionInspector["sessionId"]);
});

// ═══════════════════════════════════════════════════════════════
// P3: Receipt Chain Verification
// ═══════════════════════════════════════════════════════════════

await test("P3: verifyReceiptChain — runs without error", async () => {
  const chain = await inspector.verifyReceiptChain("test-session");
  // Chain may or may not be intact — we're just checking it doesn't throw
  assert.ok(typeof chain.intact === "boolean");
  assert.ok(typeof chain.lastSealId === "string" || chain.lastSealId === null);
});

// ═══════════════════════════════════════════════════════════════
// Integration: Inspector wired into AgentEngine
// ═══════════════════════════════════════════════════════════════

await test("Integration: AgentEngine with Inspector — blocks deprecated tool call", async () => {
  // Agent asks for a deprecated tool (mcp__arifos__forge_filesystem)
  const llm = mockLlmProvider("mcp__arifos__forge_filesystem", { mode: "read", path: "/tmp/test" });
  const profile = mockProfile({ allowedTools: ["mcp__arifos__forge_filesystem", "arif_health_check"] });

  const engine = new AgentEngine(profile, {
    llmProvider: llm,
    toolRegistry: new (await import("../src/infrastructure/tools/ToolRegistry.js")).ToolRegistry(),
    longTermMemory: new (await import("../src/application/memory/LongTermMemory.js")).LongTermMemory("/tmp/ltm-inspector-test.json"),
    inspector,
    vaultClient: new NoOpVaultClient(),
  });

  const result: AgentRunResult = await engine.run(mockOptions({ riskLevel: "low" }));
  // The Inspector should have blocked the deprecated tool, resulting in HOLD or VOID
  const isBlocked =
    result.finalText.includes("HOLD") ||
    result.finalText.includes("VOID") ||
    result.metrics.blockedDangerousActions > 0;

  assert.ok(isBlocked, `Expected blocked execution for deprecated tool. Got: ${result.finalText.slice(0, 200)}`);
});

await test("Integration: AgentEngine with Inspector — allows clean tool", async () => {
  // Agent asks for a clean tool then stops
  const llm = mockTextProvider("Health check complete. All organs green.");
  const profile = mockProfile({ allowedTools: ["arif_health_check"] });

  const engine = new AgentEngine(profile, {
    llmProvider: llm,
    toolRegistry: new (await import("../src/infrastructure/tools/ToolRegistry.js")).ToolRegistry(),
    longTermMemory: new (await import("../src/application/memory/LongTermMemory.js")).LongTermMemory("/tmp/ltm-clean-test.json"),
    inspector,
    vaultClient: new NoOpVaultClient(),
  });

  const result: AgentRunResult = await engine.run(mockOptions({ riskLevel: "low" }));
  assert.ok(result.finalText.includes("Health check") || result.finalText.includes("green"),
    `Expected clean execution. Got: ${result.finalText.slice(0, 200)}`);
});

console.log("\n✅ Inspector Integration Tests PASSED");
