/**
 * F8: Genius / SYSTEMIC HEALTH
 *
 * UPGRADE: Add evidence requirement.
 * If no evidence and action not trivial → HOLD
 *
 * @module governance/f8Genius
 * @constitutional F8 GENIUS — κ_r > 0.9 (systemic health)
 */

export type GeniusVerdict = "PASS" | "HOLD";

export interface GeniusResult {
  verdict: GeniusVerdict;
  evidenceCount: number;
  gStar: number; // grounding score
  reason?: string;
  message?: string;
}

// Trivial operations that don't need evidence
const TRIVIAL_TOOLS = new Set(["list_files", "read_file", "grep_text"]);

/**
 * Check genius before consequential operations.
 * Requires evidence for non-trivial actions.
 *
 * NOTE: First tool call in a session is allowed without prior evidence
 * (bootstrapping problem). Subsequent calls need grounding.
 */
export function checkGenius(
  toolName: string,
  evidenceCount: number,
  memoryHits: number,
  isFirstCall: boolean = false,
): GeniusResult {
  // Trivial operations pass regardless
  if (TRIVIAL_TOOLS.has(toolName)) {
    return {
      verdict: "PASS",
      evidenceCount,
      gStar: 1.0,
    };
  }

  // First call gets a pass (bootstrapping)
  if (isFirstCall) {
    return {
      verdict: "PASS",
      evidenceCount,
      gStar: 0.5, // Moderate confidence for first call
    };
  }

  // Calculate g* (grounding star metric)
  // g* = min(1.0, evidence*0.3 + memory*0.2 + base*0.1)
  const gStar = Math.min(1.0, evidenceCount * 0.3 + memoryHits * 0.2 + 0.1);

  // Threshold: g* >= 0.45 required for non-trivial operations after first call
  if (gStar < 0.45) {
    return {
      verdict: "HOLD",
      evidenceCount,
      gStar,
      reason: "INSUFFICIENT_GROUNDING",
      message: `HOLD: Insufficient grounding (g*=${gStar.toFixed(2)} < 0.45). Need more evidence or memory context.`,
    };
  }

  return {
    verdict: "PASS",
    evidenceCount,
    gStar,
  };
}

/**
 * Count evidence items from tool results.
 */
export function countEvidence(toolResults: Array<{ ok: boolean; output?: string }>): number {
  return toolResults.filter((r) => r.ok && r.output && r.output.length > 10).length;
}
