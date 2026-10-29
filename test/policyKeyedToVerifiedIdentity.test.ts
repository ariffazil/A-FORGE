/**
 * policyKeyedToVerifiedIdentity.test.ts — housekeeping 2026-10-29.
 *
 * The policy was keyed to the actor_id STRING. A caller that merely claimed
 * "arif" resolved to `default:sovereign` — allow_by_default: true, every MCP
 * server in the allowlist (github, postgres, cloudflare, docker, hostinger…).
 *
 * What was already safe (and is pinned here so it stays safe):
 *   mutation was refused by the independent authority layer, which derives
 *   authority from provenance, not from the actor_id string. The existing
 *   comment in McpPolicyGate says exactly that:
 *     "Authority enforcement — derived from provenance, NOT actor_id string."
 *
 * What was NOT safe:
 *   the sovereign policy itself was still handed to an unauthenticated caller,
 *   and the verdict recorded `policy_id: default:sovereign` — which reads in
 *   an audit trail as if sovereign policy had been applied to a stranger.
 *
 * This proposal keys the policy to VERIFIED identity: an unauthenticated
 * caller never receives the sovereign policy, whatever it claims to be.
 *
 * Run: node --test dist/test/policyKeyedToVerifiedIdentity.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { McpPolicyGate, type ToolCallRequest } from "../src/domain/governance/McpPolicyGate.js";

const SECRET = "housekeeping-test-secret-0123456789ab";

function req(overrides: Partial<ToolCallRequest> = {}): ToolCallRequest {
  return {
    tool_name: "forge_filesystem_write",
    actor_id: "arif",
    arguments: { path: "/tmp/x" },
    ...overrides,
  };
}

/** Mint a valid ACT for a verified session, as arifOS would. */
function mintAct(actorId: string, sessionId: string): string {
  const now = Date.now();
  const payload = {
    actor_id: actorId,
    session_id: sessionId,
    issued_at: now,
    expiry: now + 3600_000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
  return `act_v1.${payloadB64}.${sig}`;
}

// ─── §1 — the brief's explicit requirement ───────────────────────────────
// An unverified caller claiming to be Arif must be denied mutation.

test("an unverified caller claiming 'arif' is DENIED mutation", () => {
  const gate = new McpPolicyGate();

  // High-impact and irreversible tools require FULL authority.
  // (authorityPermits: OBSERVE_ONLY permits OBSERVE / SUGGEST / SIMULATE only.)
  for (const tool of [
    "forge_filesystem_write",   // IRREVERSIBLE
    "forge_git_commit",         // EXECUTE_HIGH_IMPACT
    "forge_execute",            // EXECUTE_HIGH_IMPACT
  ]) {
    const v = gate.evaluate(req({ tool_name: tool }));
    assert.equal(v.verdict, "DENY", `${tool} must be denied for an unverified caller`);
    assert.equal(v.principal.source, "client_supplied");
    assert.equal(v.principal.authority, "OBSERVE_ONLY");
  }
});

test("forge_shell stays permitted at OBSERVE_ONLY by the ratified adat-agentic rule", () => {
  // ADAT AGENTIC (F13 directive 2026-08-10): forge_* tools classified
  // EXECUTE_REVERSIBLE are permitted even with OBSERVE_ONLY authority, because
  // the gate shifted from "who can access" to "is this action constitutional".
  // forge_shell then re-gates itself through ArifJudge (DENY / GATE / ALLOW)
  // and the hash-chain audit. Pinned here so the boundary is not mistaken for
  // an oversight — and so it stays deliberate if the ladder ever changes.
  const gate = new McpPolicyGate();
  const v = gate.evaluate(req({ tool_name: "forge_shell" }));
  assert.equal(v.principal.authority, "OBSERVE_ONLY");
  assert.equal(v.verdict, "ALLOW", "adat-agentic rule permits forge_* EXECUTE_REVERSIBLE");
  assert.equal(v.policy_id, "default:unverified", "but never under the sovereign policy");
});

test("the denial reason names the identity layer, not the tool", () => {
  const gate = new McpPolicyGate();
  const v = gate.evaluate(req());
  assert.match(String(v.reasons[0]), /L1_IDENTITY/);
  assert.match(String(v.reasons[0]), /unverified_client_id/);
});

// ─── §2 — the proposal: the policy is keyed to verified identity ───────

test("an unverified caller never resolves to the sovereign policy", () => {
  const gate = new McpPolicyGate();
  for (const claimed of ["arif", "ARIF", "Arif", "arif-fazil", "ARIF_FAZIL", "sovereign"]) {
    const v = gate.evaluate(req({ actor_id: claimed }));
    assert.notEqual(
      v.policy_id,
      "default:sovereign",
      `an unverified caller claiming "${claimed}" received the sovereign policy`,
    );
    assert.equal(v.policy_id, "default:unverified");
  }
});

test("an unauthenticated caller loses the credential-bearing external servers", () => {
  const gate = new McpPolicyGate();
  // OBSERVE-class tool on a federation organ: still reachable.
  const observe = gate.evaluate(
    req({ tool_name: "forge_search", actor_id: "arif", arguments: {} }),
  );
  assert.equal(observe.verdict, "ALLOW", "OBSERVE access to the organs must not regress");
  assert.equal(observe.policy_id, "default:unverified");

  // The external servers are denied at the policy layer for an unverified caller.
  for (const server of ["github", "postgres", "cloudflare", "docker", "hostinger"]) {
    const v = gate.evaluate(
      req({ tool_name: `${server}_read_something`, actor_id: "arif", arguments: {} }),
    );
    assert.notEqual(v.policy_id, "default:sovereign");
  }
});

// ─── §3 — a verified caller is unaffected ───────────────────────────────

test("a verified session still resolves to the sovereign policy", () => {
  const gate = new McpPolicyGate();
  const sessionId = "session-verified-1";
  const act = mintAct("ARIF", sessionId);

  const ok = gate.registerVerifiedSession(sessionId, "ARIF", act, SECRET);
  assert.equal(ok, true, "a valid ACT must register the session");

  const v = gate.evaluate(
    req({ actor_id: "ARIF", session_id: sessionId }),
  );
  assert.equal(v.principal.source, "verified_session");
  assert.equal(v.principal.authority, "FULL");
  assert.equal(v.policy_id, "default:sovereign");
});

// ─── §4 — the pre-existing invariant this proposal must not break ──────

test("OBSERVE-class access for an unverified caller is preserved", () => {
  const gate = new McpPolicyGate();
  for (const tool of ["forge_search", "forge_journalctl", "forge_memory"]) {
    const v = gate.evaluate(req({ tool_name: tool, arguments: {} }));
    assert.equal(v.verdict, "ALLOW", `${tool} must stay reachable at OBSERVE class`);
  }
});
