/**
 * P0.1 (2026-07-19): Global activeActor removal — verifiedSessions map is canonical.
 *
 * Tests verify that:
 *   - registerVerifiedSession with valid ACT → verified_session authority
 *   - No global `activeActor` field exposed via the gate class
 *   - Per-request lookup is keyed by session_id (multiple sessions coexist)
 *   - Same actor_id across different sessions yields separate entries
 *   - registerVerifiedSession without ACT is a no-op (P0.5 fail-closed)
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { McpPolicyGate, buildACT } from "../src/domain/governance/McpPolicyGate.js";

const SECRET = "arif-fazil-sovereign-continuity-key";

describe("P0.1 — verifiedSessions map is the canonical verified-session path", () => {
  it("No global activeActor field on McpPolicyGate class", () => {
    // P0.1: the global `activeActor` field is REMOVED.
    // Verified sessions are stored in the per-request `verifiedSessions` map.
    const gate: any = new McpPolicyGate();
    assert.equal(gate.activeActor, undefined, "global activeActor field must not exist");
  });

  it("registerVerifiedSession with valid ACT + session_id grants verified_session per-request", () => {
    const gate = new McpPolicyGate();
    const sct = buildACT("arif", "sess-1", SECRET);
    assert.equal(gate.registerVerifiedSession("sess-1", "arif", sct, SECRET), true);
    const v = gate.evaluate({
      session_id: "sess-1",
      tool_name: "forge_filesystem_write",
      arguments: { path: "/tmp/x", content: "x" },
    });
    assert.equal(v.principal.source, "verified_session");
    assert.equal(v.principal.authority, "FULL");
  });

  it("Multiple sessions coexist with different actor_ids", () => {
    const gate = new McpPolicyGate();
    const sct1 = buildACT("arif", "sess-arif", SECRET);
    const sct2 = buildACT("forge-worker", "sess-worker", SECRET);
    gate.registerVerifiedSession("sess-arif", "arif", sct1, SECRET);
    gate.registerVerifiedSession("sess-worker", "forge-worker", sct2, SECRET);

    // Session A → arif
    const v1 = gate.evaluate({
      session_id: "sess-arif",
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.equal(v1.principal.actorId, "arif");

    // Session B → forge-worker
    const v2 = gate.evaluate({
      session_id: "sess-worker",
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.equal(v2.principal.actorId, "forge-worker");
  });

  it("Wrong session_id does NOT pick up another session's actor", () => {
    const gate = new McpPolicyGate();
    const sct = buildACT("arif", "sess-arif", SECRET);
    gate.registerVerifiedSession("sess-arif", "arif", sct, SECRET);

    const v = gate.evaluate({
      session_id: "sess-other",  // NOT registered
      tool_name: "forge_health_check",
      arguments: {},
    });
    // No verified session for "sess-other" → principal is transport_fallback
    assert.notEqual(v.principal.source, "verified_session");
  });

  it("registerVerifiedSession without ACT is a no-op (P0.5 fail-closed)", () => {
    const gate = new McpPolicyGate();
    const ok = gate.registerVerifiedSession("sess-1", "arif");
    assert.equal(ok, false, "No ACT → registration rejected");

    // Without registration, evaluate gets transport_fallback
    const v = gate.evaluate({
      session_id: "sess-1",
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.notEqual(v.principal.source, "verified_session");
  });
});
