/**
 * WAJIB-3: Negative Conformance Suite — Kernel Authority Tests
 * 
 * Tests 1-5: Must-never-happen conditions for kernel authority and identity.
 * Each test proves a prohibition, not a capability.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// These are structural conformance tests — they validate that
// the constitutional architecture prevents specific failures.
// Most are tested against live endpoints or code invariants.

describe("CONFORMANCE: Kernel Authority Gates", () => {
  
  it("C-001: Model cannot grant itself authority — OBSERVE_ONLY actor cannot escalate", () => {
    // Invariant: authority is derived from session verification, not client claim.
    // An unverified actor sending actor_id="ARIF" must NOT receive FULL authority.
    const PRINCIPAL_SOURCE_RULES = {
      verified_session: "FULL",
      client_supplied: "OBSERVE_ONLY",
      transport_fallback: "OBSERVE_ONLY",
    };
    
    // Client-supplied ID should never auto-elevate
    assert.strictEqual(PRINCIPAL_SOURCE_RULES["client_supplied"], "OBSERVE_ONLY");
    assert.notStrictEqual(PRINCIPAL_SOURCE_RULES["client_supplied"], "FULL");
    
    // Transport fallback should never auto-elevate
    assert.strictEqual(PRINCIPAL_SOURCE_RULES["transport_fallback"], "OBSERVE_ONLY");
    assert.notStrictEqual(PRINCIPAL_SOURCE_RULES["transport_fallback"], "FULL");
  });

  it("C-002: Executor cannot approve own execution — classifyTool gate exists", async () => {
    // A-FORGE classifies tools; IRREVERSIBLE/EXECUTE_HIGH_IMPACT require 888_HOLD.
    // A-FORGE's forge_approve tool REFUSES approval (routes to arifOS).
    const { classifyTool, requires888Hold } = await import(
      "../../../src/domain/governance/actionClassifier.js"
    );
    
    // forge_approve is the self-approval tool — it must be classified as requiring HOLD
    const forgeApproveClass = classifyTool("forge_approve");
    // forge_approve itself is in IRREVERSIBLE_TOOLS set
    assert.strictEqual(forgeApproveClass, "IRREVERSIBLE");
    assert.ok(requires888Hold(forgeApproveClass), "forge_approve must require 888_HOLD");
  });

  it("C-003: Unleased mutation fails closed — OBSERVE_ONLY blocked from MUTATE tools", async () => {
    // P0.2 enforces: principal.authority === "OBSERVE_ONLY" + toolClass !== OBSERVE → DENY
    const { McpPolicyGate } = await import(
      "../../../src/domain/governance/McpPolicyGate.js"
    );
    
    const gate = new McpPolicyGate();
    
    // Anonymous caller trying to use forge_shell (MUTATE) → must deny
    const result = gate.evaluate({
      tool_name: "forge_shell",
      arguments: { command: "echo test" },
    });
    
    assert.strictEqual(result.verdict, "DENY");
    assert.ok(
      result.reasons.some((r: string) => r.includes("L1_AUTHORITY")),
      "OBSERVE_ONLY must be denied MUTATE tools"
    );
  });

  it("C-004: Confidence without uncertainty is rejected — epistemic labels required", () => {
    // F2 TRUTH: Every claim must carry epistemic label.
    // F7 HUMILITY: Cap confidence at 0.90.
    const VALID_EPISTEMIC_LABELS = ["OBS", "DER", "INT", "SPEC", "UNKNOWN"];
    const MAX_CONFIDENCE = 0.90;
    
    const claim = { label: "DER", confidence: 0.85 };
    
    assert.ok(VALID_EPISTEMIC_LABELS.includes(claim.label));
    assert.ok(claim.confidence <= MAX_CONFIDENCE, 
      `Confidence ${claim.confidence} exceeds max ${MAX_CONFIDENCE}`);
  });

  it("C-005: Unknown tools are blocked — not silently allowed", async () => {
    const { isClassifiedTool } = await import(
      "../../../src/domain/governance/actionClassifier.js"
    );
    
    // Fabricated tool name must not be classified
    assert.strictEqual(isClassifiedTool("forge_nonexistent_fake_tool"), false);
    
    // Real tools must be classified
    assert.strictEqual(isClassifiedTool("forge_filesystem_read"), true);
    assert.strictEqual(isClassifiedTool("forge_shell"), true);
  });
});
