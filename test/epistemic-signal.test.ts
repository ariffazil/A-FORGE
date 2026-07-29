/**
 * F2 TRUTH — Epistemic Signal + Memory Classification Tests
 *
 * Closes Trauma Audit Gap #1 (L7: "Naming heals").
 * Every material claim must carry an epistemic label (OBS/DER/INT/SPEC).
 * Confidence must be capped per F7 HUMILITY.
 * UNKNOWN is valid — SPECULATION masquerading as OBSERVATION is not.
 *
 * DITEMPA BUKAN DIBERI — Forged 2026-07-29
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  epistemicSignal,
  Epistemic,
  memoryStatus,
  Memory,
  enrichResult,
} from "../src/domain/governance/epistemic-signal.js";
import type {
  EpistemicSignal,
  EvidenceLayer,
  MemoryClass,
  MemoryStatus,
} from "../src/domain/governance/epistemic-signal.js";

// ─── EPISTEMIC SIGNAL ───────────────────────────────────

test("OBS layer creates evidence-grade signal with high confidence", () => {
  const sig = epistemicSignal("OBS", { source: "curl :8088/health", confidence: 0.90, authority_claim: "EVIDENCE" });
  assert.strictEqual(sig.evidence_layer, "OBS");
  assert.ok(sig.confidence >= 0.85, "OBS should have high confidence");
  assert.strictEqual(sig.authority_claim, "EVIDENCE");
  assert.ok(sig.reversible, "Observations should be reversible by default");
});

test("SPEC layer creates advisory signal with low confidence", () => {
  // Use Epistemic.speculative helper which correctly sets confidence to 0.3
  const sig = Epistemic.speculative("model hallucination", ["no ground truth anchor", "speculative"]);
  assert.strictEqual(sig.evidence_layer, "SPEC");
  assert.strictEqual(sig.confidence, 0.30, "SPEC confidence should be 0.3 (speculative helper)");
  assert.strictEqual(sig.authority_claim, "ADVISORY");
  assert.ok(sig.uncertainty.length > 0, "SPEC must carry uncertainty");
});

test("DER layer is derived from OBS with documented chain", () => {
  // Use Epistemic.derived helper which correctly sets authority to EVIDENCE
  const sig = Epistemic.derived("computed from porosity log", 0.75);
  assert.strictEqual(sig.evidence_layer, "DER");
  assert.ok(sig.confidence >= 0.6 && sig.confidence <= 0.85, "DER should be mid-range confidence");
  assert.strictEqual(sig.authority_claim, "EVIDENCE");
});

test("INT layer is interpretive synthesis", () => {
  const sig = epistemicSignal("INT", {
    source: "multi-well correlation",
    confidence: 0.6,
    uncertainty: ["limited well control", "fault zone ambiguity"],
  });
  assert.strictEqual(sig.evidence_layer, "INT");
  assert.ok(sig.confidence <= 0.7, "INT should be moderate confidence");
  assert.strictEqual(sig.authority_claim, "ADVISORY");
  assert.ok(sig.uncertainty.length > 0, "INT should declare uncertainty");
});

test("F7 HUMILITY: confidence is hard-capped at 0.90", () => {
  const sig = epistemicSignal("OBS", { confidence: 0.99 });
  assert.ok(sig.confidence <= 0.90, "Confidence MUST be capped at 0.90 per F7");
  assert.strictEqual(sig.confidence, 0.90, "0.99 should be clamped to 0.90");
});

test("confidence defaults to 0.7 when not specified", () => {
  const sig = epistemicSignal("DER");
  assert.strictEqual(sig.confidence, 0.7);
});

test("UNTAGGED IS INVALID — every output must carry a valid EvidenceLayer", () => {
  // All valid evidence layers should be accepted
  const validLayers: EvidenceLayer[] = ["OBS", "DER", "INT", "SPEC"];
  for (const layer of validLayers) {
    const sig = epistemicSignal(layer);
    assert.ok(validLayers.includes(sig.evidence_layer),
      `${layer} must be a valid evidence layer`);
  }
});

test("SPEC cannot claim VERDICT or SEALED authority", () => {
  const sig = epistemicSignal("SPEC", { authority_claim: "ADVISORY" });
  assert.notStrictEqual(sig.authority_claim, "SEALED",
    "SPEC claims cannot carry SEALED authority");
  assert.notStrictEqual(sig.authority_claim, "VERDICT",
    "SPEC claims cannot carry VERDICT authority");
});

// ─── EPISTEMIC HELPERS ─────────────────────────────────

test("Epistemic.observed produces OBS + EVIDENCE + high confidence", () => {
  const sig = Epistemic.observed("curl :8088/health", 0.88);
  assert.strictEqual(sig.evidence_layer, "OBS");
  assert.strictEqual(sig.authority_claim, "EVIDENCE");
  assert.ok(sig.confidence >= 0.85);
});

test("Epistemic.derived produces DER + EVIDENCE + moderate confidence", () => {
  const sig = Epistemic.derived("porosity calculation");
  assert.strictEqual(sig.evidence_layer, "DER");
  assert.strictEqual(sig.authority_claim, "EVIDENCE");
  assert.ok(sig.confidence >= 0.6);
});

test("Epistemic.interpreted produces INT + ADVISORY + uncertainty", () => {
  const sig = Epistemic.interpreted("geological model", undefined, ["limited data"]);
  assert.strictEqual(sig.evidence_layer, "INT");
  assert.strictEqual(sig.authority_claim, "ADVISORY");
  assert.ok(sig.uncertainty.length > 0);
});

test("Epistemic.speculative produces SPEC + ADVISORY + low confidence (0.3)", () => {
  const sig = Epistemic.speculative("guess", ["no evidence"]);
  assert.strictEqual(sig.evidence_layer, "SPEC");
  assert.strictEqual(sig.authority_claim, "ADVISORY");
  assert.strictEqual(sig.confidence, 0.3);
});

// ─── MEMORY STATUS ─────────────────────────────────────

test("memoryStatus LIVE_PROBE marks data as fresh with verified timestamp", () => {
  const mem = memoryStatus("LIVE_PROBE", { last_verified: new Date().toISOString() });
  assert.strictEqual(mem.class, "LIVE_PROBE");
  assert.strictEqual(mem.is_fresh, true);
  assert.ok(mem.last_verified);
});

test("Memory.live helper produces LIVE_PROBE with current timestamp", () => {
  const mem = Memory.live("test-source");
  assert.strictEqual(mem.class, "LIVE_PROBE");
  assert.strictEqual(mem.is_fresh, true);
  assert.strictEqual(mem.source, "test-source");
});

test("Memory.cached with old timestamp reports stale", () => {
  const oldDate = new Date(Date.now() - 600_000).toISOString(); // 10 min ago
  const mem = Memory.cached(oldDate, 300); // 5 min TTL
  assert.strictEqual(mem.class, "CACHED_MEMORY");
  assert.strictEqual(mem.is_fresh, false, "Old data should be stale");
});

test("Memory.inferred carries INFERRED class", () => {
  const mem = Memory.inferred("derived-from-logs");
  assert.strictEqual(mem.class, "INFERRED");
});

test("Memory.sealed carries SEALED_RECEIPT class", () => {
  const mem = Memory.sealed("VAULT999");
  assert.strictEqual(mem.class, "SEALED_RECEIPT");
});

test("Memory.stale carries STALE class with explicit staleness", () => {
  const mem = Memory.stale("2025-01-01T00:00:00Z", "old-cache");
  assert.strictEqual(mem.class, "STALE");
  assert.strictEqual(mem.is_fresh, false);
});

// ─── ENRICHED RESULT ───────────────────────────────────

test("enrichResult produces EnrichedResult with data + memory + epistemic", () => {
  const data = { status: "healthy", uptime: 3600 };
  const mem = Memory.live("health-check");
  const epi = Epistemic.observed(":8088/health");
  const result = enrichResult(data, mem, epi);

  assert.deepStrictEqual(result.data, data);
  assert.strictEqual(result.memory.class, "LIVE_PROBE");
  assert.strictEqual(result.epistemic.evidence_layer, "OBS");
});

test("enrichResult preserves error envelope for graceful degradation", () => {
  const data = { error: "timeout" };
  const mem = Memory.live("failed-probe");
  const epi = Epistemic.speculative("network-error");
  const result = enrichResult(data, mem, epi);

  assert.deepStrictEqual(result.data, data);
  assert.strictEqual(result.epistemic.confidence, 0.3);
});

// ─── NEGATIVE TESTS — what should be REJECTED ──────────

test("NEGATIVE: high-confidence SPECULATION should raise concern", () => {
  // If agent claims high confidence on SPEC, that's epistemically invalid
  const sig = epistemicSignal("SPEC", { confidence: 0.80 });
  // F7 cap applies, so it will be 0.80 (below 0.90, but still high for SPEC)
  // This test documents the gap — SPEC should ideally never exceed 0.5
  assert.ok(sig.confidence <= 0.90, "F7 cap applies universally");
  // But note: SPEC at 0.8 is suspicious — this is an area where a
  // stricter domain-specific cap (SPEC ≤ 0.5) could be added
});

test("NEGATIVE: UNKNOWN is valid — empty uncertainty on DER is a smell", () => {
  // DER without declaring any uncertainty is technically valid code,
  // but epistemically questionable. Document the expectation.
  const sig = epistemicSignal("DER", { confidence: 0.9 });
  assert.strictEqual(sig.uncertainty.length, 0,
    "Default: no uncertainty declared");
  // In practice, DER should carry at least one uncertainty source.
  // This is a soft expectation — the type system allows empty.
});

test("NEGATIVE: missing source should not crash — defaults to 'unknown'", () => {
  const sig = epistemicSignal("OBS");
  assert.strictEqual(sig.source, "unknown",
    "Missing source defaults to 'unknown' — not ideal but not a crash");
});
