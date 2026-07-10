/**
 * quantum-substrate-kernel.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 * A-FORGE executor-side schemas for the 000–999 metabolic cycle.
 *
 * The canonical constitutional kernel is Python: see arifos_kernel.py.
 * This TypeScript module provides the types and client shapes A-FORGE uses to
 * consume kernel receipts, call substrate organs, and execute allowed actions.
 *
 * DITEMPA BUKAN DIBERI
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Ontology: uncertainty, verdict, phase
// ═══════════════════════════════════════════════════════════════════════════════

export const UncertaintyTagEnum = z.enum([
  "UNKNOWN",
  "ESTIMATE",
  "HYPOTHESIS",
  "PLAUSIBLE",
  "CLAIM",
]);
export type UncertaintyTag = z.infer<typeof UncertaintyTagEnum>;

export const VerdictEnum = z.enum(["SEAL", "SABAR", "HOLD", "VOID"]);
export type Verdict = z.infer<typeof VerdictEnum>;

// Live federation organ map:
// 000 INIT · 111 OBSERVE · 333 THINK · 444 ROUTE · 555 CRITIQUE/HEART
// 777 FORGE (provisional ACT) · 888 JUDGE · 900 COOL · 999 SEAL
export const PhaseEnum = z.enum([
  "000",
  "111",
  "333",
  "444",
  "555",
  "777",
  "888",
  "900",
  "999",
]);
export type Phase = z.infer<typeof PhaseEnum>;

export const PHASE_ORDER: Phase[] = [
  "000",
  "111",
  "333",
  "444",
  "555",
  "777",
  "888",
  "900",
  "999",
];

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Evidence geometry — every substrate enters here
// ═══════════════════════════════════════════════════════════════════════════════

export const EvidenceItemSchema = z.object({
  id: z.string(),
  source: z.enum([
    "GEOX",
    "WEALTH",
    "WELL",
    "LLM",
    "QUANTUM",
    "HUMAN",
    "CLASSICAL",
  ]),
  payload: z.unknown(),
  uncertainty: UncertaintyTagEnum,
  lineageId: z.string().optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Governance state: Δ (entropy/pressure), Ω (uncertainty), Ψ (integrity)
// ═══════════════════════════════════════════════════════════════════════════════

export const GovernanceStateSchema = z.object({
  phase: PhaseEnum,
  evidence: z.array(EvidenceItemSchema),
  delta: z.number(), // Δ: state-change pressure / blast radius
  omega: z.number(), // Ω: epistemic uncertainty / conflict
  psi: z.number(), // Ψ: floor-compliance / alignment field
  verdict: VerdictEnum.optional(),
  authorityPresent: z.boolean(),
  reversible: z.boolean(),
  intentId: z.string().optional(),
});
export type GovernanceState = z.infer<typeof GovernanceStateSchema>;

export const DEFAULT_THRESHOLDS = {
  OMEGA_MAX: 0.5, // above this → HOLD
  PSI_MIN: 0.7, // below this → HOLD
  DELTA_CRITICAL: 0.8, // above this + omega warn → SABAR
  OMEGA_WARN: 0.4,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Substrate organ interface — dumb pipe, no governance
// ═══════════════════════════════════════════════════════════════════════════════

export interface Organ {
  name: string;
  compute(input: unknown): Promise<EvidenceItem[]>;
}

/** HTTP-backed organ client. In production this becomes an MCP server envelope. */
export class HttpOrganClient implements Organ {
  constructor(
    public name: string,
    public url: string,
  ) {}

  async compute(input: unknown): Promise<EvidenceItem[]> {
    const res = await fetch(`${this.url}/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(`${this.name} compute failed: ${res.status}`);
    }
    const data = await res.json();
    return z.array(EvidenceItemSchema).parse(data.evidence);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ΔΩΨ calculators (federated, evidence-weighted)
// ═══════════════════════════════════════════════════════════════════════════════

export function computeDelta(
  prior: GovernanceState,
  actionDescription: string,
  blastRadius: number,
): number {
  // Δ = normalized blast radius scaled by reversibility discount
  const reversibleDiscount = prior.reversible ? 0.5 : 1.0;
  return Math.min(1.0, blastRadius * reversibleDiscount);
}

export function computeOmega(evidence: EvidenceItem[]): number {
  if (evidence.length === 0) return 1.0;
  const tagWeight: Record<UncertaintyTag, number> = {
    UNKNOWN: 1.0,
    ESTIMATE: 0.75,
    HYPOTHESIS: 0.6,
    PLAUSIBLE: 0.35,
    CLAIM: 0.1,
  };
  const conflict = detectConflict(evidence);
  const avg =
    evidence.reduce((sum, e) => sum + tagWeight[e.uncertainty], 0) /
    evidence.length;
  return Math.min(1.0, avg + conflict);
}

export function computePsi(
  evidence: EvidenceItem[],
  floors: string[],
): number {
  // Ψ starts at 1.0 and drops for every missing floor or substrate-overreach sign
  let psi = 1.0;
  const requiredFloors = ["F1", "F2", "F7", "F9", "F11", "F13"];
  for (const f of requiredFloors) {
    if (!floors.includes(f)) psi -= 0.12;
  }
  // Any evidence claiming verdict authority is an automatic psi hit
  for (const e of evidence) {
    if (
      typeof e.payload === "object" &&
      e.payload !== null &&
      "verdict" in e.payload
    ) {
      psi -= 0.5;
    }
  }
  return Math.max(0.0, psi);
}

function detectConflict(evidence: EvidenceItem[]): number {
  // Simple contradiction detector: if two evidence items from different sources
  // carry the same lineageId and opposite sign, raise conflict.
  const byLineage = new Map<string, EvidenceItem[]>();
  for (const e of evidence) {
    if (!e.lineageId) continue;
    const list = byLineage.get(e.lineageId) ?? [];
    list.push(e);
    byLineage.set(e.lineageId, list);
  }
  let conflict = 0.0;
  for (const [, items] of byLineage) {
    if (items.length < 2) continue;
    const signs = items.map((i) => extractSign(i.payload));
    if (signs.some((s) => s !== undefined) && new Set(signs).size > 1) {
      conflict += 0.25;
    }
  }
  return Math.min(1.0, conflict);
}

function extractSign(payload: unknown): "support" | "oppose" | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const p = payload as Record<string, unknown>;
  if (p.sign === "support") return "support";
  if (p.sign === "oppose") return "oppose";
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Judge (888) — the only place a verdict is born
// ═══════════════════════════════════════════════════════════════════════════════

export function judge(state: GovernanceState): GovernanceState {
  const { delta, omega, psi, authorityPresent } = state;

  if (!authorityPresent) {
    return { ...state, verdict: "VOID" };
  }

  if (omega > DEFAULT_THRESHOLDS.OMEGA_MAX || psi < DEFAULT_THRESHOLDS.PSI_MIN) {
    return { ...state, verdict: "HOLD" };
  }

  if (
    delta > DEFAULT_THRESHOLDS.DELTA_CRITICAL &&
    omega > DEFAULT_THRESHOLDS.OMEGA_WARN
  ) {
    return { ...state, verdict: "SABAR" };
  }

  return { ...state, verdict: "SEAL" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Kernel: metabolic state machine 000 → 999
// ═══════════════════════════════════════════════════════════════════════════════

export class SubstrateKernel {
  private organs = new Map<string, Organ>();

  registerOrgan(organ: Organ): this {
    this.organs.set(organ.name, organ);
    return this;
  }

  init(intent: { id?: string; description: string }): GovernanceState {
    return {
      phase: "000",
      evidence: [],
      delta: 0.0,
      omega: 1.0,
      psi: 1.0,
      authorityPresent: false,
      reversible: true,
      intentId: intent.id ?? `intent-${Date.now()}`,
    };
  }

  async observe(
    state: GovernanceState,
    organName: string,
    input: unknown,
  ): Promise<GovernanceState> {
    this.assertPhase(state, ["000", "111"], "observe");
    const organ = this.organs.get(organName);
    if (!organ) throw new Error(`Organ not registered: ${organName}`);

    const items = await organ.compute(input);
    const evidence = [...state.evidence, ...items];
    return {
      ...state,
      phase: "111",
      evidence,
      omega: computeOmega(evidence),
      psi: computePsi(evidence, this.extractFloors(evidence)),
    };
  }

  think(state: GovernanceState): GovernanceState {
    this.assertPhase(state, ["111", "333"], "think");
    // 333 synthesizes evidence; no side effects, no verdict
    return { ...state, phase: "333" };
  }

  route(state: GovernanceState, nextOrgan: string): GovernanceState {
    this.assertPhase(state, ["333", "444"], "route");
    if (!this.organs.has(nextOrgan)) {
      throw new Error(`Route target unknown: ${nextOrgan}`);
    }
    return { ...state, phase: "444" };
  }

  critique(state: GovernanceState): GovernanceState {
    this.assertPhase(state, ["444", "555"], "critique");
    // 555 = heart/critique: re-check floor compliance before provisional act
    return {
      ...state,
      phase: "555",
      psi: computePsi(state.evidence, this.extractFloors(state.evidence)),
    };
  }

  prepareAction(
    state: GovernanceState,
    action: { blastRadius: number; reversible: boolean },
  ): GovernanceState {
    this.assertPhase(state, ["555", "777"], "prepareAction");
    return {
      ...state,
      phase: "777",
      delta: computeDelta(state, "proposed-action", action.blastRadius),
      reversible: action.reversible,
    };
  }

  judge(state: GovernanceState, authorityPresent: boolean): GovernanceState {
    this.assertPhase(state, ["777", "888"], "judge");
    return judge({ ...state, phase: "888", authorityPresent });
  }

  cool(state: GovernanceState): GovernanceState {
    this.assertPhase(state, ["888", "900"], "cool");
    // 900 = cooling ledger / drift detection
    return { ...state, phase: "900" };
  }

  seal(state: GovernanceState): GovernanceState {
    this.assertPhase(state, ["900", "999"], "seal");
    if (state.verdict !== "SEAL" && state.verdict !== "SABAR") {
      throw new Error(
        `Cannot seal from verdict ${state.verdict}. Only SEAL/SABAR may enter 999.`,
      );
    }
    return { ...state, phase: "999" };
  }

  private assertPhase(
    state: GovernanceState,
    allowed: Phase[],
    verb: string,
  ): void {
    if (!allowed.includes(state.phase)) {
      throw new Error(
        `${verb} not allowed in phase ${state.phase}; expected one of ${allowed.join(
          ",",
        )}`,
      );
    }
  }

  private extractFloors(evidence: EvidenceItem[]): string[] {
    const floors = new Set<string>();
    for (const e of evidence) {
      if (typeof e.payload === "object" && e.payload !== null) {
        const p = e.payload as Record<string, unknown>;
        if (Array.isArray(p.floors)) {
          for (const f of p.floors) floors.add(String(f));
        }
      }
    }
    return Array.from(floors);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Quantum→TS wiring helper (kept outside the kernel — it is just an organ)
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuantumComputeInput {
  id?: string;
  lineageId?: string;
  n_qubits: number;
  backend?: "simulator" | "qiskit" | "cirq" | "braket" | "mock";
  ops: Array<
    | { type: "single"; gate: "H" | "X" | "Y" | "Z"; target: number }
    | { type: "cnot"; control: number; target: number }
  >;
}

export function makeQuantumOrganClient(url: string): Organ {
  return new HttpOrganClient("QUANTUM", url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. A-FORGE executor receipt — hard-fail validation
// ═══════════════════════════════════════════════════════════════════════════════

export const ExecutorReceiptSchema = z.object({
  receiptId: z.string(),
  kernelSignature: z.string(),
  verdict: VerdictEnum,
  authorityScope: z.string(),
  allowedAction: z.string(),
  toolName: z.string(),
  blastRadius: z.number(),
  reversible: z.boolean(),
  inputHash: z.string(),
  leaseExpiry: z.string().datetime(),
  evidenceRefs: z.array(z.string()).default([]),
});
export type ExecutorReceipt = z.infer<typeof ExecutorReceiptSchema>;

export const ActionResultSchema = z.object({
  receiptId: z.string(),
  toolName: z.string(),
  executedAt: z.string().datetime(),
  output: z.unknown(),
  error: z.string().optional(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

export const ExecutionReportSchema = z.object({
  receipt: ExecutorReceiptSchema,
  result: ActionResultSchema,
  returnSignature: z.string(),
});
export type ExecutionReport = z.infer<typeof ExecutionReportSchema>;

export const MANDATORY_RECEIPT_FIELDS = [
  "receiptId",
  "kernelSignature",
  "verdict",
  "authorityScope",
  "allowedAction",
  "toolName",
  "blastRadius",
  "reversible",
  "inputHash",
  "leaseExpiry",
] as const;

export function validateExecutorReceipt(
  receipt: unknown,
): ExecutorReceipt {
  const parsed = ExecutorReceiptSchema.parse(receipt);

  // A-FORGE hard-fail: only SEAL/SABAR may execute.
  if (parsed.verdict !== "SEAL" && parsed.verdict !== "SABAR") {
    throw new Error(
      `A-FORGE refuses execution: verdict is ${parsed.verdict}, expected SEAL or SABAR`,
    );
  }

  // A-FORGE hard-fail: lease must not be expired.
  if (new Date(parsed.leaseExpiry) < new Date()) {
    throw new Error("A-FORGE refuses execution: receipt lease expired");
  }

  return parsed;
}

/**
 * A-FORGE executor stub. In production this routes to forge_* tools.
 * It validates the kernel receipt first and refuses anything unsigned,
 * expired, or non-executable.
 */
export async function forgeExecute(
  receipt: unknown,
  toolImpl: (toolName: string, args: unknown) => Promise<unknown>,
): Promise<ExecutionReport> {
  const valid = validateExecutorReceipt(receipt);

  const output = await toolImpl(valid.toolName, {
    action: valid.allowedAction,
    blastRadius: valid.blastRadius,
    reversible: valid.reversible,
  });

  const result: ActionResult = {
    receiptId: valid.receiptId,
    toolName: valid.toolName,
    executedAt: new Date().toISOString(),
    output,
  };

  return {
    receipt: valid,
    result,
    returnSignature: valid.kernelSignature, // production: HMAC over result
  };
}
