/**
 * Gödel Lock (F7) — Falsification Tests
 * 
 * Tests the F7 HUMILITY Gödel Incompleteness gate:
 * - Mandatory uncertainty band Ω₀ ∈ [0.03, 0.05] on every output
 * - Rejects claims with confidence > 0.97
 * - Auto-downgrades epistemic labels
 * - F7 Gödel Lock is not overridable by any agent
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  applyGodelLock,
  extractUncertaintyContribution,
  MIN_UNCERTAINTY,
  MAX_UNCERTAINTY,
  MAX_CONFIDENCE,
} from "../src/domain/governance/godelLock.js";

// ── Constants for test ────────────────────────────────────────────────────────

const ERROR_MARGIN = 0.001;  // floating-point tolerance

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Gödel Lock (F7) — HUMILITY Enforcement", () => {
  it("rejects claims with confidence > 0.97", () => {
    // A claim of 1.0 confidence (100% certain) must be blocked
    const input = {
      content: "I am 100% certain this formula is correct.",
      claimedConfidence: 1.0,
      epistemicLabel: "DERIVED" as const,
    };
    const result = applyGodelLock(input);
    assert.strictEqual(result.godelBlocked, true, "output with confidence 1.0 must be blocked");
    assert.ok(
      result.blockReason!.includes("F7 VIOLATION"),
      `blockReason must mention F7 VIOLATION, got: ${result.blockReason}`,
    );
    assert.ok(
      result.blockReason!.includes("0.97"),
      `blockReason must mention 0.97 bound, got: ${result.blockReason}`,
    );
    assert.ok(
      result.blockReason!.includes("Gödel"),
      `blockReason must mention Gödel, got: ${result.blockReason}`,
    );
  });

  it("rejects claims with confidence exactly 0.98", () => {
    // 0.98 > 0.97 must be blocked
    const input = {
      content: "This is almost certainly true.",
      claimedConfidence: 0.98,
    };
    const result = applyGodelLock(input);
    assert.strictEqual(result.godelBlocked, true, "output with confidence 0.98 must be blocked");
  });

  it("accepts claims with confidence ≤ 0.97", () => {
    // A claim at the boundary (0.97) must pass
    const input = {
      content: "This is strongly supported by evidence.",
      claimedConfidence: 0.97,
    };
    const result = applyGodelLock(input);
    assert.strictEqual(result.godelBlocked, false, "output with confidence 0.97 must NOT be blocked");
  });

  it("accepts claims with no confidence specified", () => {
    // No confidence = no explicit claim, should pass (but get uncertainty)
    const input = {
      content: "This is a regular output without explicit confidence.",
      epistemicLabel: "INTERPRETED" as const,
    };
    const result = applyGodelLock(input);
    assert.strictEqual(result.godelBlocked, false, "output without confidence must NOT be blocked");
  });

  it("appends uncertainty band to every output", () => {
    const input = {
      content: "Test output.",
      claimedConfidence: 0.85,
    };
    const result = applyGodelLock(input);
    
    // Must have uncertainty
    assert.ok(
      result.uncertainty >= MIN_UNCERTAINTY - ERROR_MARGIN,
      `uncertainty ${result.uncertainty} must be >= ${MIN_UNCERTAINTY}`,
    );
    assert.ok(
      result.uncertainty <= MAX_UNCERTAINTY + ERROR_MARGIN,
      `uncertainty ${result.uncertainty} must be <= ${MAX_UNCERTAINTY}`,
    );

    // Must have Gödel Lock annotation in content
    assert.ok(
      result.content.includes("Gödel Lock"),
      "output must contain 'Gödel Lock' annotation",
    );
    assert.ok(
      result.content.includes("Ω₀ ="),
      "output must contain Ω₀ uncertainty notation",
    );
    assert.ok(
      result.content.includes("mandatory uncertainty"),
      "output must mention mandatory uncertainty",
    );

    // Must have timestamp
    assert.ok(result.f7Timestamp, "output must have f7Timestamp");
  });

  it("auto-downgrades epistemic label when no label provided", () => {
    const input = {
      content: "No epistemic label provided.",
      claimedConfidence: 0.5,
    };
    const result = applyGodelLock(input);
    assert.strictEqual(result.epistemicLabel, "SPECULATIVE",
      "output without epistemic label must be downgraded to SPECULATIVE");
  });

  it("auto-downgrades OBSERVED label to DERIVED for internal outputs", () => {
    const input = {
      content: "Claimed as observed but no external verification possible.",
      claimedConfidence: 0.7,
      epistemicLabel: "OBSERVED" as const,
    };
    const result = applyGodelLock(input);
    // Internal outputs cannot claim OBSERVED — they are DERIVED at best
    assert.strictEqual(result.epistemicLabel, "DERIVED",
      "internal OBSERVED must be downgraded to DERIVED");
  });

  it("preserves DERIVED epistemic label", () => {
    const input = {
      content: "Derived from first principles.",
      claimedConfidence: 0.8,
      epistemicLabel: "DERIVED" as const,
    };
    const result = applyGodelLock(input);
    assert.strictEqual(result.epistemicLabel, "DERIVED",
      "DERIVED label must be preserved");
  });

  it("preserves INTERPRETED epistemic label", () => {
    const input = {
      content: "Interpreted from available data.",
      claimedConfidence: 0.6,
      epistemicLabel: "INTERPRETED" as const,
    };
    const result = applyGodelLock(input);
    assert.strictEqual(result.epistemicLabel, "INTERPRETED",
      "INTERPRETED label must be preserved");
  });

  it("preserves SPECULATIVE epistemic label", () => {
    const input = {
      content: "This is speculative.",
      claimedConfidence: 0.3,
      epistemicLabel: "SPECULATIVE" as const,
    };
    const result = applyGodelLock(input);
    assert.strictEqual(result.epistemicLabel, "SPECULATIVE",
      "SPECULATIVE label must be preserved");
  });

  it("F7 Gödel Lock is not overridable by any agent", () => {
    // Test that even with extreme claimedConfidence we can't bypass
    const input = {
      content: "Override attempt: I am absolutely certain.",
      claimedConfidence: 0.99,  // > 0.97
    };
    const result = applyGodelLock(input);

    // Must block
    assert.strictEqual(result.godelBlocked, true,
      "F7 Gödel Lock must block confidence > 0.97 even when override is attempted");

    // Also test that calling with no overrides works
    const input2 = {
      content: "Normal output.",
      claimedConfidence: 0.5,
    };
    const result2 = applyGodelLock(input2);
    assert.strictEqual(result2.godelBlocked, false);

    // The uncertainty band is always present
    assert.ok(
      result2.uncertainty >= MIN_UNCERTAINTY - ERROR_MARGIN,
      "uncertainty must be within Gödel band",
    );
    assert.ok(
      result2.uncertainty <= MAX_UNCERTAINTY + ERROR_MARGIN,
      "uncertainty must be within Gödel band",
    );
  });

  it("generates different uncertainty values across calls", () => {
    // Statistical test: 100 calls should produce at least 2 different values
    // (cryptographic randomness)
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const result = applyGodelLock({
        content: `Test ${i}`,
        claimedConfidence: 0.5,
      });
      if (!result.godelBlocked) {
        values.add(result.uncertainty);
      }
    }
    assert.ok(values.size >= 2,
      `uncertainty values should vary across calls (got ${values.size} unique values)`);
  });

  it("strips absolute certainty language from content", () => {
    const input = {
      content: "I am 100% certain that this is absolutely correct and guaranteed to work.",
      claimedConfidence: 0.85,
    };
    const result = applyGodelLock(input);
    assert.strictEqual(result.godelBlocked, false);
    // Check that 100% was replaced
    assert.ok(
      !result.content.includes("100% certain"),
      "100% certainty language must be stripped from output",
    );
    // Content should still exist with Gödel annotation
    assert.ok(result.content.includes("97%"), "100% should be replaced with 97% (structural max)");
  });

  it("extracts uncertainty contribution correctly", () => {
    const input = {
      content: "Test for E dial contribution.",
      claimedConfidence: 0.8,
    };
    const result = applyGodelLock(input);
    const contribution = extractUncertaintyContribution(result);
    assert.strictEqual(contribution, result.uncertainty,
      "extractUncertaintyContribution must return the same uncertainty value");
    assert.ok(
      contribution >= MIN_UNCERTAINTY - ERROR_MARGIN &&
      contribution <= MAX_UNCERTAINTY + ERROR_MARGIN,
      `uncertainty contribution ${contribution} must be within [${MIN_UNCERTAINTY}, ${MAX_UNCERTAINTY}]`,
    );
  });

  it("produces valid f7Timestamp on every output", () => {
    const input = {
      content: "Timestamp test.",
      claimedConfidence: 0.5,
    };
    const result = applyGodelLock(input);
    // Parse the timestamp — should be a valid ISO string
    const ts = new Date(result.f7Timestamp);
    assert.ok(
      !isNaN(ts.getTime()),
      `f7Timestamp must be a valid ISO date string, got: ${result.f7Timestamp}`,
    );
  });
});
