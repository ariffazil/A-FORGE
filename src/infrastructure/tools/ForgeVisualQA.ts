/**
 * @file forge_visual_qa.ts — Constitutional Visual QA Tool
 * @description Governed visual QA with scar consultation, tri-witness W³,
 *              and PASS_CANDIDATE → SEALED_DEPLOY state machine.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 *
 * CONSTITUTIONAL BASIS:
 *   F1  AMANAH  — Cannot self-grant PASS. Only SEALED_DEPLOY after 888.
 *   F2  TRUTH   — Epistemic labels on all evidence (OBS/DER/INT/SPEC).
 *   F3  WITNESS — W³ = ∛(W₁ × W₂ × W₃). Zero collapses consensus.
 *   F7  HUMILITY — Confidence cap 0.90. Declare unknowns.
 *   F9  ANTI-HANTU — No consciousness claims. C_dark < 0.30.
 *   F11 AUDIT   — Every decision logged, inspectable, attributable.
 *
 * OBS/INT EVIDENCE GAP:
 *   Multimodal = eyes. Agency = nervous system + constitution + scars + sovereignty.
 *   This tool forces vision through governance before any human-facing verdict.
 *
 * @author arifOS Federation
 * @version 1.0.0
 * @constitutional true
 */

import { z } from "zod";

// ============================================================================
// VERDICT STATE MACHINE
// ============================================================================

/**
 * Terminal PASS is HARAM. The AI cannot grant itself a success state.
 * PASS_CANDIDATE → 888_HOLD → human ack → SEALED_DEPLOY
 */
export const VerdictState = z.enum([
  "INIT",              // Cycle started
  "VALIDATING",        // W1/W2 running
  "ITERATING",         // Scar-informed fix in progress
  "PASS_CANDIDATE",    // Deviations within threshold, awaiting W3 sovereign
  "SEALED_DEPLOY",     // Post-888 cryptographic human approval (ONLY terminal success)
  "HOLD",              // Human requested pause
  "HARD_FAULT",        // ΔS violation or max iterations
  "VOID",              // Constitutional rejection
]);
export type VerdictState = z.infer<typeof VerdictState>;

/**
 * Valid state transitions. Any other transition = constitutional violation.
 */
const VALID_TRANSITIONS: Record<VerdictState, VerdictState[]> = {
  INIT:             ["VALIDATING"],
  VALIDATING:       ["PASS_CANDIDATE", "ITERATING", "HARD_FAULT"],
  ITERATING:        ["VALIDATING", "HARD_FAULT"],
  PASS_CANDIDATE:   ["SEALED_DEPLOY", "HOLD", "VOID"],  // ONLY 888 can transition out
  SEALED_DEPLOY:    [],  // Terminal — no transitions out
  HOLD:             ["VALIDATING", "VOID"],  // Human can restart or void
  HARD_FAULT:       ["VALIDATING", "VOID"],  // Retry or void
  VOID:             [],  // Terminal — no transitions out
};

export function isValidTransition(from: VerdictState, to: VerdictState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================================
// SCAR CONSULTATION LAYER
// ============================================================================

export interface Scar {
  scar_id: string;
  deviation_type: string;
  context: string;
  historical_fix: string;
  outcome: "SUCCESS" | "FAILURE" | "PARTIAL";
  session_id: string;
  timestamp: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface ScarConsultationResult {
  deviation_type: string;
  scar_found: boolean;
  scar?: Scar;
  action: "APPLY_HISTORICAL" | "GENERATE_NEW" | "SCAR_CONFLICT";
  reason: string;
}

/**
 * Query the VAULT999 scar database for matching deviation types.
 *
 * F1 AMANAH: Scars are append-only. They cannot be deleted or modified.
 * The agent must metabolize past pain before generating new fixes.
 */
export async function consultScars(
  deviations: Deviation[],
  scarQueryFn: (type: string) => Promise<Scar | null>,
): Promise<ScarConsultationResult[]> {
  const results: ScarConsultationResult[] = [];

  for (const deviation of deviations) {
    const scar = await scarQueryFn(deviation.type);

    if (!scar) {
      results.push({
        deviation_type: deviation.type,
        scar_found: false,
        action: "GENERATE_NEW",
        reason: "No historical scar found for this deviation type",
      });
      continue;
    }

    if (scar.outcome === "SUCCESS") {
      results.push({
        deviation_type: deviation.type,
        scar_found: true,
        scar,
        action: "APPLY_HISTORICAL",
        reason: `Scar ${scar.scar_id} shows successful fix. Reusing.`,
      });
    } else if (scar.outcome === "FAILURE") {
      results.push({
        deviation_type: deviation.type,
        scar_found: true,
        scar,
        action: "SCAR_CONFLICT",
        reason: `Scar ${scar.scar_id} shows previous fix FAILED. Must generate new fix with explicit deviation.`,
      });
    } else {
      // PARTIAL — apply with caution flag
      results.push({
        deviation_type: deviation.type,
        scar_found: true,
        scar,
        action: "APPLY_HISTORICAL",
        reason: `Scar ${scar.scar_id} shows partial success. Applying with caution.`,
      });
    }
  }

  return results;
}

// ============================================================================
// TRI-WITNESS W³ VALIDATOR
// ============================================================================

export interface Deviation {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  element?: string;
  expected?: string;
  actual?: string;
  epistemic_label: "OBS" | "DER" | "INT" | "SPEC";
}

export interface WitnessResult<ID extends string = "W1" | "W2" | "W3"> {
  witness_id: ID;
  status: "CONFIRMED" | "REJECTED" | "PENDING" | "TIMEOUT";
  confidence: number;  // Capped at 0.90 per F7
  deviations: Deviation[];
  notes?: string;
}

export interface TriWitnessLedger {
  w1_vision: WitnessResult<"W1">;
  w2_linter: WitnessResult<"W2">;
  w3_sovereign: WitnessResult<"W3">;
  consensus: boolean;
  consensus_confidence: number;
  failure_reason?: string;
}

/**
 * W³ = ∛(W₁ × W₂ × W₃)
 *
 * Zero in ANY channel collapses consensus → 888_HOLD.
 * W₁ and W₂ must agree before result can reach W₃.
 *
 * F3 WITNESS: Tri-witness floor for any verdict.
 * F7 HUMILITY: Confidence capped at 0.90.
 */
export function evaluateTriWitness(
  w1: WitnessResult<"W1">,
  w2: WitnessResult<"W2">,
  w3: WitnessResult<"W3">,
): TriWitnessLedger {
  // F7 HUMILITY: Cap all confidences at 0.90
  const capConf = (c: number) => Math.min(c, 0.90);

  const w1c = capConf(w1.confidence);
  const w2c = capConf(w2.confidence);
  const w3c = capConf(w3.confidence);

  // W³ = geometric mean (cube root of product)
  const w3Score = Math.cbrt(w1c * w2c * w3c);

  // Zero in any channel collapses consensus
  const anyZero = w1c === 0 || w2c === 0 || w3c === 0;
  const anyRejected =
    w1.status === "REJECTED" ||
    w2.status === "REJECTED" ||
    w3.status === "REJECTED";

  // W₁ and W₂ must agree before W₃ is consulted
  const w1w2Agreement =
    w1.status === "CONFIRMED" && w2.status === "CONFIRMED";

  let failureReason: string | undefined;

  if (anyZero) {
    failureReason = "W³ collapsed: zero confidence in one or more channels";
  } else if (anyRejected) {
    failureReason = "W³ collapsed: one or more witnesses rejected";
  } else if (!w1w2Agreement && w3.status !== "PENDING") {
    failureReason = "W₁/W₂ disagreement before sovereign consultation";
  }

  const consensus = !anyZero && !anyRejected && w1w2Agreement;

  // Return capped witnesses (F7 HUMILITY: never expose raw confidence > 0.90)
  return {
    w1_vision: { ...w1, confidence: w1c },
    w2_linter: { ...w2, confidence: w2c },
    w3_sovereign: { ...w3, confidence: w3c },
    consensus,
    consensus_confidence: w3Score,
    failure_reason: failureReason,
  };
}

// ============================================================================
// ENTROPY METABOLISM
// ============================================================================

export interface EntropyState {
  iteration: number;
  deviation_count: number;
  delta_s: number;  // positive = improvement, negative = degradation
  cumulative_delta: number;
}

/**
 * ΔS ≤ 0 is the constitutional requirement (F4 CLARITY).
 * If entropy is non-decreasing after the first iteration → HARD_FAULT.
 *
 * This is Popperian falsification: the system must prove it's getting better.
 */
export function computeEntropyDelta(
  prev: EntropyState,
  currentDeviationCount: number,
): EntropyState {
  const deltaS = prev.deviation_count - currentDeviationCount;
  return {
    iteration: prev.iteration + 1,
    deviation_count: currentDeviationCount,
    delta_s: deltaS,
    cumulative_delta: prev.cumulative_delta + deltaS,
  };
}

/**
 * Check if entropy is monotonically non-increasing (required).
 * Returns HARD_FAULT if ΔS < 0 (entropy increased) after first iteration.
 */
export function checkEntropyGate(entropy: EntropyState): {
  pass: boolean;
  reason?: string;
} {
  // First iteration is exempt (baseline)
  if (entropy.iteration <= 1) {
    return { pass: true };
  }

  // ΔS must be > 0 (deviations must strictly decrease after first iteration)
  // ΔS = 0 means no improvement → HARD_FAULT (thermodynamic proof required)
  if (entropy.delta_s <= 0) {
    return {
      pass: false,
      reason: `ENTROPY_NON_DECREASING: ΔS=${entropy.delta_s} at iteration ${entropy.iteration}. No improvement — system must reduce deviations.`,
    };
  }

  return { pass: true };
}

// ============================================================================
// FORGE_VISUAL_QA — The Governed MCP Tool
// ============================================================================

export const ForgeVisualQAInput = z.object({
  /** Mode of operation */
  mode: z.enum(["validate_only", "iterate_and_fix", "full_loop"]),

  /** Screenshot path for W₁ vision analysis */
  screenshot_path: z.string(),

  /** DOM payload for W₂ structural linter */
  dom_payload: z.string(),

  /** Constraints to validate against */
  constraints: z.object({
    max_nav_links: z.number().optional(),
    min_contrast_ratio: z.number().optional(),
    required_elements: z.array(z.string()).optional(),
    max_deviation_score: z.number().default(0.1),
    custom_rules: z.record(z.unknown()).optional(),
  }),

  /** Maximum iterations before HARD_FAULT */
  max_iterations: z.number().default(5),

  /** Previous deviation count for entropy calculation */
  prev_deviation_count: z.number().default(0),

  /** Scar database query function (injected) */
  scar_query_fn: z.function()
    .args(z.string())
    .returns(z.promise(z.unknown().nullable()))
    .optional(),
});
export type ForgeVisualQAInput = z.infer<typeof ForgeVisualQAInput>;

export const ForgeVisualQAScarConsultation = z.object({
  deviation_type: z.string(),
  scar_found: z.boolean(),
  scar_id: z.string().optional(),
  action: z.enum(["APPLY_HISTORICAL", "GENERATE_NEW", "SCAR_CONFLICT"]),
  reason: z.string(),
});

export const ForgeVisualQATriWitnessLedger = z.object({
  w1_vision: z.object({
    witness_id: z.literal("W1"),
    status: z.enum(["CONFIRMED", "REJECTED", "PENDING", "TIMEOUT"]),
    confidence: z.number(),
    deviations: z.array(z.unknown()),
  }),
  w2_linter: z.object({
    witness_id: z.literal("W2"),
    status: z.enum(["CONFIRMED", "REJECTED", "PENDING", "TIMEOUT"]),
    confidence: z.number(),
    deviations: z.array(z.unknown()),
  }),
  w3_sovereign: z.object({
    witness_id: z.literal("W3"),
    status: z.enum(["CONFIRMED", "REJECTED", "PENDING", "TIMEOUT"]),
    confidence: z.number(),
    deviations: z.array(z.unknown()),
  }),
  consensus: z.boolean(),
  consensus_confidence: z.number(),
  failure_reason: z.string().optional(),
});

export const ForgeVisualQAOutput = z.object({
  verdict: VerdictState,
  iterations: z.number(),
  entropy_delta: z.number(),
  tri_witness_ledger: ForgeVisualQATriWitnessLedger,
  scar_consultations: z.array(ForgeVisualQAScarConsultation),
  deviations_remaining: z.array(z.unknown()),
  requires888hold: z.boolean(),
  integration_receipts: z.object({
    arif_judge: z.object({
      status: z.enum(["PENDING", "EMITTED", "ACKNOWLEDGED"]),
      receipt_id: z.string().optional(),
    }),
    vault999: z.object({
      status: z.enum(["PENDING", "EMITTED", "SEALED"]),
      receipt_id: z.string().optional(),
    }),
    well: z.object({
      status: z.enum(["PENDING", "EMITTED", "ACKNOWLEDGED"]),
      receipt_id: z.string().optional(),
    }),
  }),
  code_diff: z.string().optional(),
  screenshot_hash: z.string().optional(),
  epistemic_state: z.enum(["UNKNOWN", "ESTIMATE", "HYPOTHESIS", "PLAUSIBLE", "CLAIM"]),
});

/**
 * Main execution loop for forge_visual_qa.
 *
 * Constitutional flow:
 *   INIT → VALIDATE (W1+W2) → SCAR_CONSULT → ENTROPY_CHECK →
 *   [if clean] → PASS_CANDIDATE → 888_HOLD → SEALED_DEPLOY
 *   [if dirty] → ITERATE (scar-informed) → loop
 *   [if ΔS violation] → HARD_FAULT
 */
export async function forgeVisualQA(
  input: ForgeVisualQAInput,
  deps: {
    visionAnalyze: (path: string, constraints: unknown) => Promise<{ deviations: Deviation[]; confidence: number }>;
    domLinter: (payload: string, required: string[]) => Promise<{ deviations: Deviation[]; confidence: number }>;
    scarQuery: (type: string) => Promise<Scar | null>;
    generateFix: (payload: string, deviations: Deviation[], scars: ScarConsultationResult[]) => Promise<string>;
    request888Hold: (context: unknown) => Promise<{ approved: boolean; receipt_id: string }>;
    sealToVault: (data: unknown) => Promise<{ receipt_id: string }>;
    notifyWell: (signal: unknown) => Promise<{ receipt_id: string }>;
  },
): Promise<z.infer<typeof ForgeVisualQAOutput>> {
  let currentVerdict: VerdictState = "INIT";
  let iterations = 0;
  let domPayload = input.dom_payload;
  let entropy: EntropyState = {
    iteration: 0,
    deviation_count: input.prev_deviation_count,
    delta_s: 0,
    cumulative_delta: 0,
  };

  const scarConsultations: z.infer<typeof ForgeVisualQAScarConsultation>[] = [];

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: VALIDATE (W1 + W2)
  // ─────────────────────────────────────────────────────────────
  currentVerdict = "VALIDATING";

  const w1Result = await deps.visionAnalyze(input.screenshot_path, input.constraints);
  const w2Result = await deps.domLinter(
    domPayload,
    input.constraints.required_elements ?? [],
  );

  const allDeviations = [...w1Result.deviations, ...w2Result.deviations];

  // W₁ and W₂ must agree: if either has deviations, we don't have consensus
  const w1: WitnessResult<"W1"> = {
    witness_id: "W1",
    status: w1Result.deviations.length === 0 ? "CONFIRMED" : "REJECTED",
    confidence: w1Result.confidence,
    deviations: w1Result.deviations,
  };

  const w2: WitnessResult<"W2"> = {
    witness_id: "W2",
    status: w2Result.deviations.length === 0 ? "CONFIRMED" : "REJECTED",
    confidence: w2Result.confidence,
    deviations: w2Result.deviations,
  };

  // W₃ is always PENDING until 888 gate
  const w3: WitnessResult<"W3"> = {
    witness_id: "W3",
    status: "PENDING",
    confidence: 0,
    deviations: [],
  };

  const triWitness = evaluateTriWitness(w1, w2, w3);

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: ITERATE (with scar consultation)
  // ─────────────────────────────────────────────────────────────
  while (allDeviations.length > 0 && iterations < input.max_iterations) {
    currentVerdict = "ITERATING";
    iterations++;

    // ENTROPY CHECK
    entropy = computeEntropyDelta(entropy, allDeviations.length);
    const entropyGate = checkEntropyGate(entropy);

    if (!entropyGate.pass) {
      currentVerdict = "HARD_FAULT";
      break;
    }

    // SCAR CONSULTATION (before generating fixes)
    const scars = await consultScars(allDeviations, deps.scarQuery);
    scarConsultations.push(...scars.map(s => ({
      deviation_type: s.deviation_type,
      scar_found: s.scar_found,
      scar_id: s.scar?.scar_id,
      action: s.action,
      reason: s.reason,
    })));

    // GENERATE FIX (informed by scars)
    domPayload = await deps.generateFix(domPayload, allDeviations, scars);

    // RE-VALIDATE
    const w1Next = await deps.visionAnalyze(input.screenshot_path, input.constraints);
    const w2Next = await deps.domLinter(domPayload, input.constraints.required_elements ?? []);

    allDeviations.length = 0;
    allDeviations.push(...w1Next.deviations, ...w2Next.deviations);

    // Update witness results
    w1.status = w1Next.deviations.length === 0 ? "CONFIRMED" : "REJECTED";
    w1.confidence = w1Next.confidence;
    w1.deviations = w1Next.deviations;

    w2.status = w2Next.deviations.length === 0 ? "CONFIRMED" : "REJECTED";
    w2.confidence = w2Next.confidence;
    w2.deviations = w2Next.deviations;

    Object.assign(triWitness, evaluateTriWitness(w1, w2, w3));
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 3: VERDICT ASSIGNMENT
  // ─────────────────────────────────────────────────────────────
  const normalizedScore = allDeviations.length === 0
    ? 0
    : allDeviations.reduce((sum, d) => {
        const sev = { LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, CRITICAL: 1.0 }[d.severity];
        return sum + sev;
      }, 0) / allDeviations.length;

  if (currentVerdict !== "HARD_FAULT") {
    if (
      allDeviations.length === 0 ||
      normalizedScore <= (input.constraints.max_deviation_score ?? 0.1)
    ) {
      // ── PASS_CANDIDATE (NOT "PASS") ──
      // F1 AMANAH: AI cannot grant itself terminal success state
      currentVerdict = "PASS_CANDIDATE";
    } else if (iterations >= input.max_iterations) {
      currentVerdict = "HARD_FAULT";
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 4: 888_GATE (for PASS_CANDIDATE)
  // ─────────────────────────────────────────────────────────────
  let requires888 = currentVerdict === "PASS_CANDIDATE";
  let judgeReceiptId: string | undefined;

  if (requires888) {
    const holdResult = await deps.request888Hold({
      verdict: currentVerdict,
      tri_witness: triWitness,
      iterations,
      entropy_delta: entropy.delta_s,
      deviations: allDeviations,
    });

    judgeReceiptId = holdResult.receipt_id;

    if (holdResult.approved) {
      // Only 888 approval + human ack can grant SEALED_DEPLOY
      w3.status = "CONFIRMED";
      w3.confidence = 0.90;  // Sovereign approval = high confidence
      Object.assign(triWitness, evaluateTriWitness(w1, w2, w3));
      currentVerdict = "SEALED_DEPLOY";
      requires888 = false;
    }
    // If not approved, stay at PASS_CANDIDATE — human hasn't responded yet.
    // The orchestrator handles the HOLD/REJECT flow externally.
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 5: INTEGRATION RECEIPTS
  // ─────────────────────────────────────────────────────────────
  const vaultReceipt = await deps.sealToVault({
    verdict: currentVerdict,
    iterations,
    entropy_delta: entropy.delta_s,
    screenshot_hash: input.screenshot_path,  // TODO: actual hash
    code_diff_hash: domPayload,              // TODO: actual hash
  });

  // WELL notification if iterations > 3 (operator fatigue signal)
  if (iterations > 3) {
    await deps.notifyWell({
      signal: "VISUAL_QA_FATIGUE",
      iterations,
      verdict: currentVerdict,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // OUTPUT
  // ─────────────────────────────────────────────────────────────
  return {
    verdict: currentVerdict,
    iterations,
    entropy_delta: entropy.delta_s,
    tri_witness_ledger: triWitness,
    scar_consultations: scarConsultations,
    deviations_remaining: allDeviations,
    requires888hold: currentVerdict === "PASS_CANDIDATE",
    integration_receipts: {
      arif_judge: {
        status: judgeReceiptId ? "EMITTED" : "PENDING",
        receipt_id: judgeReceiptId,
      },
      vault999: {
        status: "EMITTED",
        receipt_id: vaultReceipt.receipt_id,
      },
      well: {
        status: iterations > 3 ? "EMITTED" : "PENDING",
        receipt_id: undefined,
      },
    },
    code_diff: iterations > 0 ? domPayload : undefined,
    screenshot_hash: undefined,  // TODO: compute sha256
    epistemic_state: currentVerdict === "SEALED_DEPLOY" ? "CLAIM" : "HYPOTHESIS",
  };
}
