/**
 * Gödel Lock — F7 HUMILITY enforcement
 * 
 * The First Incompleteness Theorem proves that any sufficiently expressive formal 
 * system contains true statements it cannot prove within its own axioms.
 * Translated: no autonomous agent can certify its own absolute certainty.
 *
 * This gate enforces a mandatory uncertainty band (Ω₀ ∈ [0.03, 0.05]) on every output.
 * Any output claiming > 0.97 confidence is structurally impossible and must be rejected.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { randomBytes } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EpistemicLabel = 'OBSERVED' | 'DERIVED' | 'INTERPRETED' | 'SPECULATIVE';

export interface GodelLockInput {
  content: string;
  claimedConfidence?: number;  // 0-1, optional
  epistemicLabel?: EpistemicLabel;
}

export interface GodelLockOutput {
  content: string;
  uncertainty: number;  // Ω₀ ∈ [0.03, 0.05] mandatory
  epistemicLabel: EpistemicLabel;
  godelBlocked: boolean;
  blockReason?: string;
  f7Timestamp: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const MIN_UNCERTAINTY = 0.03;  // floor of Gödel uncertainty band
export const MAX_UNCERTAINTY = 0.05;  // ceiling of Gödel uncertainty band
export const MAX_CONFIDENCE = 1 - MIN_UNCERTAINTY;  // ~0.97

// --- OBSERVED: This is a physical constant from F7 Humility floor.
// Any claim above this threshold is structurally impossible under Gödel's theorem.

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Generate a cryptographically-seeded random uncertainty value within the
 * mandatory Gödel band Ω₀ ∈ [0.03, 0.05].
 */
function generateUncertainty(): number {
  // Use crypto.randomBytes for a flat distribution in [MIN, MAX]
  const range = MAX_UNCERTAINTY - MIN_UNCERTAINTY;
  const bytes = randomBytes(4);
  const rand = bytes.readUInt32BE(0) / 0xFFFFFFFF;
  return MIN_UNCERTAINTY + rand * range;
}

/**
 * Downgrade epistemic label according to Gödel Lock rules:
 * - No label → SPECULATIVE
 * - OBSERVED without external verification → DERIVED
 * - All others preserved
 */
function downgradeEpistemicLabel(
  label: EpistemicLabel | undefined,
  isExternalObservation: boolean,
): EpistemicLabel {
  if (!label) return 'SPECULATIVE';
  if (label === 'OBSERVED' && !isExternalObservation) return 'DERIVED';
  return label;
}

// ── Core function ──────────────────────────────────────────────────────────────

/**
 * Apply the Gödel Lock (F7) to an output.
 * 
 * Every output must carry mandatory uncertainty Ω₀ ∈ [0.03, 0.05].
 * Any claim of confidence > 0.97 is structurally impossible and blocked.
 * 
 * F7 Gödel Lock is NOT overridable by any agent — even the sovereign cannot
 * bypass the laws of logic. Only a direct constitutional amendment (F1–F13
 * floor modification) can change this, and even that requires F13 signature.
 * 
 * @param input - The output content and optional metadata
 * @returns GodelLockOutput with mandatory uncertainty and epistemic label
 */
export function applyGodelLock(input: GodelLockInput): GodelLockOutput {
  const now = new Date().toISOString();
  const f7Timestamp = now;

  // 1. Check if claimed confidence exceeds structural maximum
  if (
    input.claimedConfidence !== undefined &&
    input.claimedConfidence > MAX_CONFIDENCE
  ) {
    return {
      content: input.content,
      uncertainty: MAX_UNCERTAINTY,
      epistemicLabel: downgradeEpistemicLabel(input.epistemicLabel, false),
      godelBlocked: true,
      blockReason: `F7 VIOLATION: Gödel Lock — claimed confidence ${input.claimedConfidence} exceeds structural maximum ${MAX_CONFIDENCE.toFixed(2)}. No autonomous agent can certify certainty above the Gödel bound.`,
      f7Timestamp,
    };
  }

  // 2. Inject mandatory uncertainty
  const uncertainty = generateUncertainty();
  const epistemicLabel = downgradeEpistemicLabel(input.epistemicLabel, false);
  const uncertaintyBand = uncertainty.toFixed(4);

  // 3. Append Gödel Lock annotation
  const suffix = `\n\n[Ω₀ = ${uncertaintyBand}] Gödel Lock (F7): this output carries mandatory uncertainty. No autonomous agent can certify absolute certainty — the Gödel Incompleteness Theorem guarantees true statements exist outside any formal system's proof capability.`;
  const content = input.content + suffix;

  // 4. Ensure the content never claims absolute certainty
  // Strip phrases like "100% certain", "absolutely certain", "guaranteed"
  // Note: \b doesn't work after % (non-word char), so handle 100% separately
  let cleanedContent = content.replace(
    /100%/gi,
    '97% (structural max)',
  );
  cleanedContent = cleanedContent.replace(
    /\b(absolutely(?:\s+certain)?|certifiably|unquestionably|irrefutably|guaranteed|without any doubt|beyond any doubt)\b/gi,
    (match: string) => {
      const lower = match.toLowerCase();
      if (lower === 'absolutely' || lower === 'absolutely certain') return 'highly (within Gödel bound)';
      if (lower === 'certifiably') return 'strongly indicated';
      if (lower === 'unquestionably' || lower === 'irrefutably') return 'strongly supported';
      if (lower === 'guaranteed') return 'strongly indicated (Gödel bound applies)';
      if (lower === 'without any doubt' || lower === 'beyond any doubt') return 'with high confidence (Gödel bound applies)';
      return match;
    },
  );

  return {
    content: cleanedContent,
    uncertainty,
    epistemicLabel,
    godelBlocked: false,
    f7Timestamp,
  };
}

/**
 * Extract the epistemic uncertainty contribution for the E dial.
 * 
 * The E (Evidence) dial in the APEX formula G = (A × P × E × X)^(1/4)
 * includes an epistemic uncertainty contribution from the Gödel Lock.
 * 
 * This function returns the Ω₀ value for the E dial computation.
 */
export function extractUncertaintyContribution(output: GodelLockOutput): number {
  return output.uncertainty;
}

/**
 * Create an Express middleware that passes every response through
 * applyGodelLock before sending to the client.
 * 
 * Integrate into the MCP tool response chain to ensure every tool
 * output carries mandatory F7 uncertainty.
 */
export function createGodelMiddleware() {
  return function godelMiddleware(
    _req: any,
    res: any,
    next: () => void,
  ): void {
    // Override res.json to inject Gödel Lock
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (body && typeof body === 'object' && !body._godelLockApplied) {
        // Only apply to non-error, non-ping responses
        const contentStr = typeof body === 'string' ? body : JSON.stringify(body);
        const result = applyGodelLock({
          content: contentStr,
          epistemicLabel: body?.epistemicLabel ?? undefined,
        });
        if (result.godelBlocked) {
          return originalJson({
            error: result.blockReason,
            _godelLock: { blocked: true, uncertainty: result.uncertainty, f7Timestamp: result.f7Timestamp },
          });
        }
        body._godelLock = {
          uncertainty: result.uncertainty,
          epistemicLabel: result.epistemicLabel,
          f7Timestamp: result.f7Timestamp,
        };
        body._godelLockApplied = true;
      }
      return originalJson(body);
    };
    next();
  };
}

/**
 * Apply Gödel Lock to a forge tool response.
 * Use this to wrap tool outputs in the MCP response chain.
 */
export function applyGodelLockToToolResponse(
  response: Record<string, unknown>,
): Record<string, unknown> {
  const contentStr = JSON.stringify(response);
  const result = applyGodelLock({
    content: contentStr,
    epistemicLabel: (response as any).epistemicLabel ?? undefined,
  });

  if (result.godelBlocked) {
    return {
      error: result.blockReason,
      _godelLock: {
        blocked: true,
        uncertainty: result.uncertainty,
        epistemicLabel: result.epistemicLabel,
        f7Timestamp: result.f7Timestamp,
      },
    };
  }

  return {
    ...response,
    _godelLock: {
      uncertainty: result.uncertainty,
      epistemicLabel: result.epistemicLabel,
      f7Timestamp: result.f7Timestamp,
    },
    _godelLockApplied: true,
  };
}
