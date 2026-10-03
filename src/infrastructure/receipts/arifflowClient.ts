/**
 * arifFLOW Client — A-FORGE copy of the SEALED bridge client (P1-3).
 *
 * Source of truth: /root/arifFlow/bridge/ts/arifflow-client.ts
 * Copied verbatim 2026-09-09 (P1-5 wiring, F13 "go") so the A-FORGE
 * service is self-contained. Matches the Rust FlowReceipt struct EXACTLY
 * for POST /ingest compatibility.
 *
 * DITEMPA BUKAN DIBERI — receipts are evidence, not decoration.
 */

import { randomUUID } from "node:crypto";

// ── Enums (match Rust receipt.rs exactly — serde variant names) ───────────

export type StepType =
  | 'Execute' | 'Verify' | 'Cool' | 'Seal' | 'Barrier' | 'Merge' | 'Route';

export type EpistemicLabel = 'OBS' | 'DER' | 'INT' | 'SPEC' | 'SEAL';

export type FloorVerdict = 'PASS' | 'CAUTION' | 'HOLD' | 'VOID';

export type CoolingDecision = 'NONE' | 'HOLD' | 'CLAMP' | 'BYPASS';

export type RustStepType = 'Execute' | 'Verify' | 'Cool' | 'Seal' | 'Barrier' | 'Merge' | 'Route';
export type RustEpistemicLabel = 'Observation' | 'Derivation' | 'Interpretation' | 'Specification' | 'Seal';
export type RustFloorVerdict = 'Pass' | 'Caution' | 'Hold' | 'Void';
export type RustCoolingDecision = 'None' | 'Hold' | 'Clamp' | 'Bypass';

export interface TriWitnessVotes {
  human: number;
  ai: number;
  earth: number;
}

/** EXACT match for Rust FlowReceipt struct fields */
export interface FlowReceiptIngest {
  receipt_id: string;
  previous_receipt_hash: string | null;
  created_at: string;
  actor_id: string;
  session_id: string;
  session_token: string | null;
  step_type: RustStepType;
  topology_id: string | null;
  lane_id: number | null;
  step_number: number;
  cost_ns: number;
  preceding_verify_cost_ns: number | null;
  epistemic_label: RustEpistemicLabel;
  floor_verdict: RustFloorVerdict;
  cooling_decision: RustCoolingDecision;
  tri_witness_votes: TriWitnessVotes | null;
  merkle_root: string | null;
  merkle_inclusion_proof: string | null;
  payload: Record<string, unknown> | null;
}

export interface IngestResponse {
  status: string;
  fq?: {
    quotient: number;
    verdict: string;
    execute_count: number;
    verify_count: number;
  };
  receipts?: number;
  [k: string]: unknown;
}

export interface EmitReceiptParams {
  step_type?: StepType;
  organ?: string;
  actor_id: string;
  session_id: string;
  summary: string;
  epistemic_label?: EpistemicLabel;
  floor_verdict?: FloorVerdict;
  cooling_decision?: CoolingDecision;
  cost_ns?: number;
  preceding_verify_cost_ns?: number;
  parent_receipt_id?: string;
  chain_id?: string;
  lease_id?: string;
  details?: Record<string, unknown>;
  tri_witness_votes?: TriWitnessVotes;
}

export interface HealthResponse {
  status: string;
  fq: {
    quotient: number;
    verdict: string;
    execute_count: number;
    verify_count: number;
  };
  receipts: number;
  uptime_ms: number;
}

// ── Defaults ──────────────────────────────────────────────────────────────
// DEFAULT_TRI_WITNESS = {human:0.42, ai:0.32, earth:0.26} was REMOVED here on
// 2026-10-03 (SCAR-TRI-WITNESS-CONSTANT). It was a fabricated tri-witness
// stamped onto every receipt A-FORGE emitted, because A-FORGE never observes a
// witness. The values are kept in this comment and in the commit message so the
// triple is not silently resurrected by whoever next finds it in old ledger rows
// — 13,863 rows in /var/lib/arifflow/receipts.jsonl still carry it.
// See emitReceipt() for the replacement behaviour.

// ── Client ────────────────────────────────────────────────────────────────

export class ArifFlowClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl = process.env.ARIFLOW_URL || 'http://127.0.0.1:7073', timeout = 5_000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  async health(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`arifFLOW health failed: ${res.status}`);
    return res.json();
  }

  /** POST /ingest — submit a Rust FlowReceipt-compatible JSON */
  async ingest(receipt: FlowReceiptIngest): Promise<IngestResponse> {
    const res = await fetch(`${this.baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receipt),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`arifFLOW ingest failed (${res.status}): ${errBody}`);
    }
    return res.json();
  }

  async fq(): Promise<HealthResponse['fq']> {
    const h = await this.health();
    return h.fq;
  }

  async isAlive(): Promise<boolean> {
    try { await this.health(); return true; } catch { return false; }
  }
}

// Singleton
let _client: ArifFlowClient | null = null;
export function getClient(baseUrl?: string): ArifFlowClient {
  if (!_client) _client = new ArifFlowClient(baseUrl);
  return _client;
}

// ── Enum mapping (TS shorthand → Rust serde variant names) ────────────────

const EPISTEMIC_TO_RUST: Record<string, RustEpistemicLabel> = {
  OBS: 'Observation', DER: 'Derivation', INT: 'Interpretation',
  SPEC: 'Specification', SEAL: 'Seal',
};
const FLOOR_TO_RUST: Record<string, RustFloorVerdict> = {
  PASS: 'Pass', CAUTION: 'Caution', HOLD: 'Hold', VOID: 'Void',
};
const COOLING_TO_RUST: Record<string, RustCoolingDecision> = {
  NONE: 'None', HOLD: 'Hold', CLAMP: 'Clamp', BYPASS: 'Bypass',
};

/**
 * Emit a receipt to arifFLOW. Matches Rust FlowReceipt struct exactly.
 * This is the ONE function every organ calls after P1.
 */
export async function emitReceipt(
  params: EmitReceiptParams,
  client?: ArifFlowClient,
): Promise<IngestResponse> {
  const c = client || getClient();

  const payload: Record<string, unknown> = {
    organ: params.organ || 'A-FORGE', summary: params.summary,
  };
  if (params.details) payload.details = params.details;
  if (params.chain_id) payload.chain_id = params.chain_id;
  if (params.lease_id) payload.lease_id = params.lease_id;

  const ingest: FlowReceiptIngest = {
    receipt_id: randomUUID(),
    previous_receipt_hash: params.parent_receipt_id || null,
    created_at: new Date().toISOString(),
    actor_id: params.actor_id,
    session_id: params.session_id,
    session_token: null,
    step_type: (params.step_type || 'Execute') as RustStepType,
    topology_id: null, lane_id: null, step_number: 0,
    cost_ns: params.cost_ns || 0,
    preceding_verify_cost_ns: params.preceding_verify_cost_ns || null,
    epistemic_label: EPISTEMIC_TO_RUST[params.epistemic_label || 'OBS'] || 'Observation',
    floor_verdict: FLOOR_TO_RUST[params.floor_verdict || 'PASS'] || 'Pass',
    cooling_decision: COOLING_TO_RUST[params.cooling_decision || 'NONE'] || 'None',
    // SCAR-TRI-WITNESS-CONSTANT (2026-10-03, FI-003): was
    //   params.tri_witness_votes || DEFAULT_TRI_WITNESS
    // with DEFAULT_TRI_WITNESS = {human:0.42, ai:0.32, earth:0.26}. A-FORGE never
    // observes a witness, so the fallback fired on essentially every receipt —
    // 13,863 of 13,864 populated tri_witness_votes tuples in
    // /var/lib/arifflow/receipts.jsonl were byte-identical, one real variation.
    // The same triple is what let arifOS F3 TRI-WITNESS publish 0.9299 on the
    // public observatory, since 3*(0.42*0.99*0.99)**(1/3)/2.40 = 0.929858.
    // A self-stamped witness is not a witness. The local type is
    // `TriWitnessVotes | null` and the Rust field is Option<..>, so null is the
    // honest value: "no witness observed". Downstream must render that as
    // unmeasured, never average it into a score. Callers that DO hold a real
    // witness still pass it and are unaffected.
    tri_witness_votes: params.tri_witness_votes ?? null,
    merkle_root: null, merkle_inclusion_proof: null,
    payload,
  };
  return c.ingest(ingest);
}
