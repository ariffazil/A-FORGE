/**
 * L6 / Multi-Organ Federation — Cross-Organ Signal Fusion Tests
 *
 * Closes Trauma Audit Gap #4 (L6: "The body remembers what the mind cannot speak").
 * Tests that no single organ can decide alone, contradictory signals produce
 * UNKNOWN/SABAR, WELL REFLECT_ONLY boundary is preserved, and F13 remains final.
 *
 * NOTE: This tests the architectural contract, not live organ bridges.
 * Live organ integration tests live in the E2E suite. This suite validates
 * that the fusion logic itself respects trauma-derived boundaries.
 *
 * DITEMPA BUKAN DIBERI — Forged 2026-07-29
 */
import test from "node:test";
import assert from "node:assert/strict";

// ─── ARCHITECTURAL CONTRACTS ───────────────────────────

/**
 * Simulated multi-organ signal fusion — mirrors the logic in
 * federation_safety.py without requiring live organs.
 */

interface OrganSignal {
  organ: "WELL" | "WEALTH" | "GEOX" | "arifOS" | "A-FORGE";
  signal_type: "vitality" | "stress" | "behavioral" | "financial" | "stated_intent";
  value: number;        // 0.0 (worst) to 1.0 (best)
  confidence: number;   // 0.0-1.0
  is_reflect_only: boolean;
}

interface FusionResult {
  verdict: "PASS" | "WARN" | "SABAR" | "UNKNOWN" | "HOLD";
  reason: string;
  signals_consulted: number;
  contradictions: string[];
  requires_human: boolean;
}

/**
 * Core fusion rule — mirrors the constitutional architecture:
 * 1. WELL is REFLECT_ONLY — informs but never decides
 * 2. No single organ can produce a final verdict
 * 3. Contradictions escalate to UNKNOWN or SABAR
 * 4. F13 sovereign intent overrides all signals
 */
function fuseOrganSignals(
  signals: OrganSignal[],
  sovereignIntent?: string,
): FusionResult {
  const contradictions: string[] = [];
  const wellSignals = signals.filter(s => s.organ === "WELL");
  const wealthSignals = signals.filter(s => s.organ === "WEALTH");
  const allSignals = signals;

  // Rule 1: WELL REFLECT_ONLY guard
  for (const ws of wellSignals) {
    if (!ws.is_reflect_only) {
      contradictions.push(`WELL signal "${ws.signal_type}" should be REFLECT_ONLY but is not`);
    }
  }

  // Rule 2: No single organ decides
  const uniqueOrgans = new Set(signals.map(s => s.organ));
  if (uniqueOrgans.size < 2) {
    return {
      verdict: "UNKNOWN",
      reason: "Single-organ signal insufficient — multi-organ corroboration required",
      signals_consulted: signals.length,
      contradictions: ["Insufficient organ diversity for fusion"],
      requires_human: true,
    };
  }

  // Rule 3: Contradictions detected
  const statedIntents = signals.filter(s => s.signal_type === "stated_intent");
  const vitalitySignals = signals.filter(s => s.signal_type === "vitality");
  const stressSignals = signals.filter(s => s.signal_type === "stress");

  // If stated intent is HIGH but vitality/stress are LOW, that's a flag
  for (const intent of statedIntents) {
    for (const vit of vitalitySignals) {
      if (intent.value > 0.7 && vit.value < 0.3) {
        contradictions.push(
          `Stated intent (${intent.value}) conflicts with vitality (${vit.value}) — verify`
        );
      }
    }
    for (const stress of stressSignals) {
      if (intent.value > 0.7 && stress.value < 0.3) {
        contradictions.push(
          `Stated intent (${intent.value}) conflicts with stress signal (${stress.value}) — verify`
        );
      }
    }
  }

  // Rule 4: Contradictions → UNKNOWN or SABAR (unless F13 sovereign overrides)
  if (contradictions.length > 0 && !sovereignIntent) {
    return {
      verdict: "SABAR",
      reason: "Cross-organ signal conflict detected — pause for human review",
      signals_consulted: signals.length,
      contradictions,
      requires_human: true,
    };
  }

  // Rule 5: F13 sovereign intent overrides
  if (sovereignIntent) {
    return {
      verdict: "PASS",
      reason: `F13 sovereign intent received: "${sovereignIntent}" — override applied`,
      signals_consulted: signals.length,
      contradictions: [],
      requires_human: false,
    };
  }

  // All signals aligned, multi-organ consensus
  return {
    verdict: "PASS",
    reason: "Multi-organ signals aligned — no conflicts detected",
    signals_consulted: signals.length,
    contradictions: [],
    requires_human: false,
  };
}

// ─── TESTS ─────────────────────────────────────────────

test("multi-organ: single organ signal is insufficient — must have ≥2 organs", () => {
  const signals: OrganSignal[] = [
    { organ: "WELL", signal_type: "vitality", value: 0.8, confidence: 0.7, is_reflect_only: true },
  ];
  const result = fuseOrganSignals(signals);
  assert.strictEqual(result.verdict, "UNKNOWN",
    "Single organ should not be sufficient for a verdict");
  assert.ok(result.requires_human, "Single-organ fusion must require human review");
});

test("multi-organ: aligned signals from multiple organs produce PASS", () => {
  const signals: OrganSignal[] = [
    { organ: "WELL", signal_type: "vitality", value: 0.8, confidence: 0.7, is_reflect_only: true },
    { organ: "WEALTH", signal_type: "financial", value: 0.75, confidence: 0.8, is_reflect_only: false },
    { organ: "arifOS", signal_type: "stated_intent", value: 0.85, confidence: 0.9, is_reflect_only: false },
  ];
  const result = fuseOrganSignals(signals);
  assert.strictEqual(result.verdict, "PASS",
    "Aligned multi-organ signals should pass");
  assert.ok(result.signals_consulted >= 3);
  assert.strictEqual(result.requires_human, false);
});

test("multi-organ: WELL REFLECT_ONLY violation is flagged", () => {
  const signals: OrganSignal[] = [
    { organ: "WELL", signal_type: "vitality", value: 0.3, confidence: 0.5, is_reflect_only: false },
    { organ: "WEALTH", signal_type: "financial", value: 0.8, confidence: 0.8, is_reflect_only: false },
  ];
  const result = fuseOrganSignals(signals);
  assert.ok(result.contradictions.length > 0,
    "WELL signal that is not REFLECT_ONLY should be flagged");
  assert.ok(result.contradictions.some(c => c.includes("REFLECT_ONLY")),
    "Contradiction message must mention REFLECT_ONLY boundary");
});

test("multi-organ: stated intent vs vitality conflict triggers SABAR", () => {
  const signals: OrganSignal[] = [
    { organ: "arifOS", signal_type: "stated_intent", value: 0.9, confidence: 0.85, is_reflect_only: false },
    { organ: "WELL", signal_type: "vitality", value: 0.15, confidence: 0.8, is_reflect_only: true },
    { organ: "WEALTH", signal_type: "financial", value: 0.7, confidence: 0.7, is_reflect_only: false },
  ];
  const result = fuseOrganSignals(signals);
  assert.strictEqual(result.verdict, "SABAR",
    "Stated intent contradicting vitality should trigger SABAR (pause)");
  assert.ok(result.contradictions.length > 0);
  assert.ok(result.requires_human);
});

test("multi-organ: stated intent vs stress conflict triggers SABAR", () => {
  const signals: OrganSignal[] = [
    { organ: "arifOS", signal_type: "stated_intent", value: 0.95, confidence: 0.9, is_reflect_only: false },
    { organ: "WELL", signal_type: "stress", value: 0.1, confidence: 0.75, is_reflect_only: true },
    { organ: "WEALTH", signal_type: "financial", value: 0.6, confidence: 0.6, is_reflect_only: false },
  ];
  const result = fuseOrganSignals(signals);
  assert.strictEqual(result.verdict, "SABAR");
  assert.ok(result.contradictions.some(c => c.includes("stress")),
    "Contradiction should mention stress signal");
});

test("multi-organ: F13 sovereign intent overrides all signal conflicts", () => {
  // Even with contradictions, sovereign intent wins
  const signals: OrganSignal[] = [
    { organ: "arifOS", signal_type: "stated_intent", value: 0.9, confidence: 0.85, is_reflect_only: false },
    { organ: "WELL", signal_type: "vitality", value: 0.1, confidence: 0.7, is_reflect_only: true },
  ];
  const result = fuseOrganSignals(signals, "I AM THE ARCHITECT. PROCEED.");
  assert.strictEqual(result.verdict, "PASS",
    "F13 sovereign intent must override all signal conflicts");
  assert.ok(result.reason.includes("F13"), "Reason must cite F13 override");
});

test("multi-organ: absence of signals produces UNKNOWN, not silence", () => {
  const result = fuseOrganSignals([]);
  assert.strictEqual(result.verdict, "UNKNOWN",
    "Empty signals should produce UNKNOWN, not false confidence");
  assert.ok(result.requires_human);
});

// ─── NEGATIVE TESTS ────────────────────────────────────

test("NEGATIVE: fusion must not produce PASS on contradictory evidence", () => {
  const signals: OrganSignal[] = [
    { organ: "WELL", signal_type: "vitality", value: 0.1, confidence: 0.8, is_reflect_only: true },
    { organ: "arifOS", signal_type: "stated_intent", value: 0.9, confidence: 0.9, is_reflect_only: false },
  ];
  // Without sovereign override, this should NOT pass
  const result = fuseOrganSignals(signals);
  assert.notStrictEqual(result.verdict, "PASS",
    "Contradictory evidence without sovereign override must NOT pass");
});

test("NEGATIVE: fusion must never conclude about the human — only flag", () => {
  // Create an actual contradiction: stated intent is HIGH but vitality is LOW
  const signals: OrganSignal[] = [
    { organ: "arifOS", signal_type: "stated_intent", value: 0.9, confidence: 0.9, is_reflect_only: false },
    { organ: "WELL", signal_type: "vitality", value: 0.15, confidence: 0.7, is_reflect_only: true },
  ];
  const result = fuseOrganSignals(signals);
  // The result should be SABAR or UNKNOWN — requiring human judgment
  assert.ok(["SABAR", "UNKNOWN"].includes(result.verdict),
    `Verdict should be SABAR or UNKNOWN when stated intent contradicts vitality signals, not ${result.verdict}`);
  assert.ok(result.requires_human,
    "When signals suggest human distress contradicting stated intent, human judgment is required");
});
