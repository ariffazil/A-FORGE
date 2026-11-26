/**
 * R-01 Negative & Positive Tests: agent:forge-worker deny-by-default hardening.
 * Uses ACT-verified session so McpPolicyGate resolves policy_id = "agent:forge-worker"
 * (not "default:unverified").
 * Run: node --test dist/test/r01ForgeWorkerDenyByDefault.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { McpPolicyGate, EXAMPLE_POLICIES } from "../src/domain/governance/McpPolicyGate.js";

const SECRET = "r01-test-secret-0123456789abcdef";

function makeVerifiedForgeWorkerGate(): { gate: McpPolicyGate; sessionId: string } {
  const gate = new McpPolicyGate();
  for (const p of EXAMPLE_POLICIES) gate.addPolicy(p);
  const actorId = "forge-worker";
  const sessionId = "r01-forge-worker-session";
  const now = Date.now();
  const payload = { actor_id: actorId, session_id: sessionId, issued_at: now, expiry: now + 3600_000 };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
  const act = `act_v1.${payloadB64}.${sig}`;
  assert.equal(gate.registerVerifiedSession(sessionId, actorId, act, SECRET), true);
  return { gate, sessionId };
}

test("R-01 NEGATIVE: verified forge-worker resolves agent:forge-worker and is DENIED unlisted forge tool", () => {
  const { gate, sessionId } = makeVerifiedForgeWorkerGate();
  const res = gate.evaluate({
    actor_id: "forge-worker",
    session_id: sessionId,
    tool_name: "forge_unlisted_dangerous_tool",
    arguments: {},
  });
  assert.equal(res.policy_id, "agent:forge-worker");
  assert.equal(res.verdict, "DENY", `unlisted tool must be denied; got: ${JSON.stringify(res)}`);
});

test("R-01 NEGATIVE: verified forge-worker is DENIED unlisted external MCP tool", () => {
  const { gate, sessionId } = makeVerifiedForgeWorkerGate();
  const res = gate.evaluate({
    actor_id: "forge-worker",
    session_id: sessionId,
    tool_name: "unknown_external_tool",
    arguments: {},
  });
  assert.equal(res.policy_id, "agent:forge-worker");
  assert.equal(res.verdict, "DENY", `unlisted external tool must be denied; got: ${JSON.stringify(res)}`);
});

test("R-01 NEGATIVE: verified forge-worker is DENIED forge_shell reading /etc/shadow", () => {
  const { gate, sessionId } = makeVerifiedForgeWorkerGate();
  const res = gate.evaluate({
    actor_id: "forge-worker",
    session_id: sessionId,
    tool_name: "forge_shell",
    arguments: { command: "cat /etc/shadow" },
  });
  assert.equal(res.policy_id, "agent:forge-worker");
  assert.equal(res.verdict, "DENY", `credential read must be blocked; got: ${JSON.stringify(res)}`);
});

test("R-01 POSITIVE: verified forge-worker is ALLOWED explicit allowlisted forge_filesystem under /tmp/", () => {
  const { gate, sessionId } = makeVerifiedForgeWorkerGate();
  const res = gate.evaluate({
    actor_id: "forge-worker",
    session_id: sessionId,
    tool_name: "forge_filesystem",
    arguments: { path: "/tmp/safe-test.txt" },
  });
  assert.equal(res.policy_id, "agent:forge-worker");
  assert.equal(res.verdict, "ALLOW", `allowlisted path should pass; got: ${JSON.stringify(res)}`);
});
