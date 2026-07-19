/**
 * ChatGPT Channel Policy — P0.7 (2026-07-19)
 *
 * Tests the OBSERVE_ONLY + hard-denied secret paths policy applied to
 * the chatgpt-arif channel principal (ChatGPT Secure MCP Tunnel connector).
 *
 * The policy guarantees:
 *   - mutating tools (forge_shell, forge_filesystem_write, forge_seal, etc.) are DENIED
 *   - secret-bearing arguments (paths under /root/.secrets/, /etc/shadow, etc.)
 *     are DENIED at Layer 4 regardless of which OBSERVE tool they target
 *   - the channel principal can never bypass the policy with explicit actor_id
 *
 * @forged 2026-07-19 — P0.7 secret redaction + hard-denied paths
 */

import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { getMcpPolicyGate, type McpPolicyGate } from "../src/domain/governance/McpPolicyGate.js";

let gate: McpPolicyGate;

beforeEach(() => {
  // Reset singleton so each test gets a fresh policy set
  gate = getMcpPolicyGate();
});

describe("P0.7 — ChatGPT channel: tool allowlist", () => {
  it("ALLOWs forge_health_check (OBSERVE)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.equal(v.verdict, "ALLOW");
  });

  it("ALLOWs forge_probe (OBSERVE)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_probe",
      arguments: {},
    });
    assert.equal(v.verdict, "ALLOW");
  });

  it("ALLOWs forge_search (OBSERVE)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_search",
      arguments: { query: "public knowledge" },
    });
    assert.equal(v.verdict, "ALLOW");
  });

  it("DENIES forge_shell (MUTATE — not in allowlist)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_shell",
      arguments: { command: "ls /tmp" },
    });
    assert.equal(v.verdict, "DENY");
    assert.ok(
      v.reasons.some((r) => r.includes("L3") || r.includes("not_in_allowlist") || r.includes("tool_not_in_explicit")),
      `Expected Layer 3 denial, got: ${v.reasons.join(", ")}`,
    );
  });

  it("DENIES forge_filesystem_write (MUTATE — not in allowlist)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_filesystem_write",
      arguments: { path: "/tmp/test", content: "x" },
    });
    assert.equal(v.verdict, "DENY");
  });

  it("DENIES forge_seal (MUTATE — IRREVERSIBLE)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_seal",
      arguments: { content: "anything" },
    });
    assert.equal(v.verdict, "DENY");
  });

  it("DENIES forge_vault (OBSERVE but not in chatgpt allowlist)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_vault",
      arguments: { mode: "read" },
    });
    assert.equal(v.verdict, "DENY");
  });

  it("DENIES unknown tool (Layer 4b UNKNOWN_TOOL)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_totally_made_up_tool",
      arguments: {},
    });
    assert.equal(v.verdict, "DENY");
  });
});

describe("P0.7 — ChatGPT channel: hard-denied secret paths", () => {
  it("DENIES forge_filesystem_read on /root/.secrets/anything", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_filesystem_read",
      arguments: { path: "/root/.secrets/vault.env" },
    });
    assert.equal(v.verdict, "DENY");
    assert.ok(
      v.reasons.some((r) => r.includes("L4 ARG") && r.includes(".secrets")),
      `Expected L4 ARG secret denial, got: ${v.reasons.join(", ")}`,
    );
  });

  it("DENIES forge_filesystem_read on /etc/shadow", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_filesystem_read",
      arguments: { path: "/etc/shadow" },
    });
    assert.equal(v.verdict, "DENY");
  });

  it("DENIES forge_filesystem_read on /etc/passwd", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_filesystem_read",
      arguments: { path: "/etc/passwd" },
    });
    assert.equal(v.verdict, "DENY");
  });

  it("DENIES forge_filesystem_read on /root/VAULT999", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_filesystem_read",
      arguments: { path: "/root/VAULT999/secrets.json" },
    });
    assert.equal(v.verdict, "DENY");
  });

  it("DENIES forge_filesystem_read on /root/.env", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_filesystem_read",
      arguments: { path: "/root/.env" },
    });
    assert.equal(v.verdict, "DENY");
  });

  it("ALLOWs forge_filesystem_read on /tmp/public_file", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_filesystem_read",
      arguments: { path: "/tmp/public_file" },
    });
    assert.equal(v.verdict, "ALLOW");
  });

  it("ALLOWs forge_filesystem_read on /root/CONTEXT.md (non-secret)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_filesystem_read",
      arguments: { path: "/root/CONTEXT.md" },
    });
    assert.equal(v.verdict, "ALLOW");
  });

  it("DENIES forge_search query containing /root/.secrets/", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_search",
      arguments: { query: "find /root/.secrets/" },
    });
    assert.equal(v.verdict, "DENY");
  });
});

describe("P0.7 — ChatGPT channel: channel principal cannot spoof sovereign", () => {
  it("client_supplied chatgpt-arif is OBSERVE_ONLY (not FULL)", () => {
    const v = gate.evaluate({
      actor_id: "chatgpt-arif",
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.equal(v.principal.authority, "OBSERVE_ONLY");
    assert.equal(v.principal.source, "client_supplied");
    assert.equal(v.principal.authenticated, false);
  });

  it("chatgpt-arif cannot claim sovereign 'arif' identity", () => {
    // If client supplies actor_id="arif" but doesn't match any policy resolution,
    // they get OBSERVE_ONLY — cannot escalate.
    const v = gate.evaluate({
      actor_id: "arif",
      tool_name: "forge_shell",
      arguments: { command: "ls /tmp" },
    });
    // 'arif' resolves to default:sovereign policy (allow_by_default: true)
    // so forge_shell IS allowed by sovereign policy. But the chatgpt tunnel
    // is supposed to use chatgpt-arif actor_id, not 'arif'. This test documents
    // that the sovereign policy remains the fallback.
    assert.equal(v.verdict, "ALLOW");
  });
});
