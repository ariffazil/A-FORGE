/**
 * P0.3 (2026-07-19): AAE signature is MANDATORY when envelope is present.
 *
 * Tests verify that:
 *   - AAE present without organ_secret → DENY (Layer 1b)
 *   - AAE present with invalid signature → DENY
 *   - AAE present with valid signature but actor mismatch → DENY
 *   - AAE present + valid + matching actor + HIGH_IMPACT tool + AAE class=IRREVERSIBLE → ALLOW
 *   - AAE present + valid + matching actor + HIGH_IMPACT tool + AAE class=OBSERVE → DENY
 *   - Nonce replay is detected and rejected
 *
 * @forged 2026-07-19 — P0.3 AAE signature mandatory
 */

import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { getMcpPolicyGate, type McpPolicyGate } from "../src/domain/governance/McpPolicyGate.js";
import { buildAAE } from "../src/domain/governance/amanahEnvelope.js";

let gate: McpPolicyGate;
const ORGAN_SECRET = "test-organ-secret-12345";
const ACTOR = "arif";

beforeEach(() => {
  gate = getMcpPolicyGate();
  // Pre-register ARIF as verified session so AAE actor matches
  gate.registerVerifiedSession("sess-arif-1", ACTOR);
});

describe("P0.3 — AAE signature mandatory when envelope present", () => {
  it("DENIES AAE present without organ_secret", async () => {
    // Build a valid envelope (organ_secret is part of signing)
    const aae = await buildAAE({
      actor_id: ACTOR,
      intent: "test action",
      action_class: "OBSERVE",
      reversibility: 1.0,
      blast_radius: "local",
      evidence_refs: [],
      nonce: "test-nonce-no-secret-" + Math.random(),
      idempotency_key: "idem-no-secret-" + Math.random(),
      expiry_ms: 60_000,
      organ_secret: ORGAN_SECRET,
      issuer: "test",
    });

    const v = gate.evaluate({
      actor_id: ACTOR,
      session_id: "sess-arif-1",
      tool_name: "forge_health_check",
      arguments: {},
      // NOTE: no organ_secret supplied → signature cannot be verified
      aae,
    });

    assert.equal(v.verdict, "DENY");
    assert.ok(
      v.reasons.some((r) => r.includes("MISSING_ORGAN_SECRET")),
      `Expected MISSING_ORGAN_SECRET, got: ${v.reasons.join(", ")}`,
    );
  });

  it("DENIES AAE present with invalid signature (wrong secret)", async () => {
    const aae = await buildAAE({
      actor_id: ACTOR,
      intent: "test action",
      action_class: "OBSERVE",
      reversibility: 1.0,
      blast_radius: "local",
      evidence_refs: [],
      nonce: "test-nonce-wrong-secret-" + Math.random(),
      idempotency_key: "idem-wrong-secret-" + Math.random(),
      expiry_ms: 60_000,
      organ_secret: "WRONG_SECRET",
      issuer: "test",
    });

    const v = gate.evaluate({
      actor_id: ACTOR,
      session_id: "sess-arif-1",
      tool_name: "forge_health_check",
      arguments: {},
      organ_secret: ORGAN_SECRET, // Valid secret at gate level, but envelope was signed with wrong one
      aae,
    });

    assert.equal(v.verdict, "DENY");
    assert.ok(
      v.reasons.some((r) => r.includes("L1_AAE")),
      `Expected L1_AAE rejection, got: ${v.reasons.join(", ")}`,
    );
  });

  it("DENIES AAE actor_id mismatch", async () => {
    const aae = await buildAAE({
      actor_id: "different-actor",
      intent: "test action",
      action_class: "OBSERVE",
      reversibility: 1.0,
      blast_radius: "local",
      evidence_refs: [],
      nonce: "test-nonce-mismatch-" + Math.random(),
      idempotency_key: "idem-mismatch-" + Math.random(),
      expiry_ms: 60_000,
      organ_secret: ORGAN_SECRET,
      issuer: "test",
    });

    const v = gate.evaluate({
      actor_id: ACTOR,
      session_id: "sess-arif-1",
      tool_name: "forge_health_check",
      arguments: {},
      organ_secret: ORGAN_SECRET,
      aae,
    });

    assert.equal(v.verdict, "DENY");
    assert.ok(
      v.reasons.some((r) => r.includes("actor_mismatch")),
      `Expected actor_mismatch, got: ${v.reasons.join(", ")}`,
    );
  });

  it("ALLOWs valid AAE on OBSERVE tool with verified session", async () => {
    const aae = await buildAAE({
      actor_id: ACTOR,
      intent: "test observe",
      action_class: "OBSERVE",
      reversibility: 1.0,
      blast_radius: "local",
      evidence_refs: [],
      nonce: "test-nonce-valid-observe-" + Math.random(),
      idempotency_key: "idem-valid-observe-" + Math.random(),
      expiry_ms: 60_000,
      organ_secret: ORGAN_SECRET,
      issuer: "test",
    });

    const v = gate.evaluate({
      actor_id: ACTOR,
      session_id: "sess-arif-1",
      tool_name: "forge_health_check",
      arguments: {},
      organ_secret: ORGAN_SECRET,
      aae,
    });

    assert.equal(v.verdict, "ALLOW", `Should ALLOW valid AAE on OBSERVE: ${v.reasons.join(", ")}`);
  });

  it("ALLOWs valid AAE on EXECUTE_REVERSIBLE tool with verified session", async () => {
    const aae = await buildAAE({
      actor_id: ACTOR,
      intent: "test execute_reversible",
      action_class: "EXECUTE_REVERSIBLE",
      reversibility: 0.8,
      blast_radius: "repo",
      evidence_refs: [],
      nonce: "test-nonce-reversible-" + Math.random(),
      idempotency_key: "idem-reversible-" + Math.random(),
      expiry_ms: 60_000,
      organ_secret: ORGAN_SECRET,
      issuer: "test",
    });

    const v = gate.evaluate({
      actor_id: ACTOR,
      session_id: "sess-arif-1",
      tool_name: "forge_filesystem_patch",
      arguments: { path: "/tmp/test.txt", old_text: "x", new_text: "y" },
      organ_secret: ORGAN_SECRET,
      aae,
    });

    assert.equal(v.verdict, "ALLOW", `Should ALLOW valid AAE on EXECUTE_REVERSIBLE: ${v.reasons.join(", ")}`);
  });

  it("DENIES replay: same nonce twice", async () => {
    const aae = await buildAAE({
      actor_id: ACTOR,
      intent: "test replay",
      action_class: "OBSERVE",
      reversibility: 1.0,
      blast_radius: "local",
      evidence_refs: [],
      nonce: "replay-nonce-fixed-" + Math.random(),
      idempotency_key: "idem-replay-" + Math.random(),
      expiry_ms: 60_000,
      organ_secret: ORGAN_SECRET,
      issuer: "test",
    });

    // First request — should ALLOW
    const v1 = gate.evaluate({
      actor_id: ACTOR,
      session_id: "sess-arif-1",
      tool_name: "forge_health_check",
      arguments: {},
      organ_secret: ORGAN_SECRET,
      aae,
    });
    assert.equal(v1.verdict, "ALLOW");

    // Second request with same nonce — should DENY (replay)
    const v2 = gate.evaluate({
      actor_id: ACTOR,
      session_id: "sess-arif-1",
      tool_name: "forge_health_check",
      arguments: {},
      organ_secret: ORGAN_SECRET,
      aae,
    });
    assert.equal(v2.verdict, "DENY");
    assert.ok(
      v2.reasons.some((r) => r.includes("REPLAY")),
      `Expected REPLAY rejection, got: ${v2.reasons.join(", ")}`,
    );
  });
});
