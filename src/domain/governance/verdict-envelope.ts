/**
 * verdict-envelope.ts — Single Verdict Location (Item 4)
 *
 * Semua tool response melalui satu envelope yang standardized.
 * Satu format, satu lokasi, satu monotonic chain.
 *
 * Sebelum: 4 vocabularies, 2 field names, fallback chain
 *   → status | verdict | result | output
 *   → isError | error
 *   → fallback: check isError → check error → check status → assume success
 *
 * Selepas: 1 envelope
 *   → VerdictEnvelope { status, data, _meta, _epistemic }
 *
 * outputSchema dari MCP 2025-11-25: setiap tool declare output structure
 * structuredContent: return typed data alongside text
 *
 * Chamber ke-7 — verdict monotonicity.
 * Bila semua response guna envelope yang sama, verdict tak boleh drift.
 *
 * DITEMPA BUKAN DIBERI
 */

import * as crypto from "node:crypto";

// ── Verdict Status — Constitutional 5-state ───────────────────────────────
export type VerdictStatus = "SEAL" | "HOLD" | "SABAR" | "VOID" | "ERROR";

// ── Epistemic Labels ──────────────────────────────────────────────────────
export interface EpistemicLabels {
  output_class: string;
  ai_involvement: string;
  authority_claim: string;
  evidence_source: string;
  tagged_at: string;
}

// ── Metadata ──────────────────────────────────────────────────────────────
export interface VerdictMeta {
  tool: string;
  actor?: string;
  session?: string;
  timestamp: string;
  duration_ms?: number;
  chain_hash?: string;
  elicitation_id?: string;
}

// ── The Envelope — Single response format for all tools ───────────────────
export interface VerdictEnvelope {
  /** Constitutional verdict: SEAL (success) | HOLD | SABAR | VOID | ERROR */
  status: VerdictStatus;

  /** The actual tool output — typed, structured */
  data: Record<string, unknown> | string | null;

  /** Human-readable message — why this verdict */
  message: string;

  /** Epistemic labels — evidence quality */
  _epistemic?: Partial<EpistemicLabels>;

  /** Metadata — provenance chain */
  _meta: VerdictMeta;
}

// ── Helper: Build a VerdictEnvelope ───────────────────────────────────────

let lastChainHash = "";

/**
 * Compute monotonic chain hash — setiap envelope diikat pada envelope sebelumnya.
 * Kalau envelope N-1 tak wujud, N tak boleh verify chain integrity.
 */
function computeChainHash(tool: string, status: string, previousHash: string): string {
  return crypto
    .createHash("sha256")
    .update(`${previousHash}::${tool}::${status}::${Date.now()}`)
    .digest("hex")
    .substring(0, 16);
}

/**
 * Build a standardized VerdictEnvelope for any tool response.
 * Ini adalah SATU-SATUNYA cara untuk return data dari A-FORGE tools.
 */
export function verdict(
  status: VerdictStatus,
  data: Record<string, unknown> | string | null,
  message: string,
  options?: {
    tool?: string;
    actor?: string;
    session?: string;
    duration_ms?: number;
    epistemic?: Partial<EpistemicLabels>;
  },
): VerdictEnvelope {
  const tool = options?.tool ?? "unknown";
  const chainHash = computeChainHash(tool, status, lastChainHash);
  lastChainHash = chainHash;

  return {
    status,
    data,
    message,
    _epistemic: options?.epistemic
      ? {
          ...options.epistemic,
          tagged_at: new Date().toISOString(),
        }
      : undefined,
    _meta: {
      tool,
      actor: options?.actor,
      session: options?.session,
      timestamp: new Date().toISOString(),
      duration_ms: options?.duration_ms,
      chain_hash: chainHash,
    },
  };
}

/**
 * Helper untuk error verdict — standardized error envelope.
 */
export function errorVerdict(
  message: string,
  options?: {
    tool?: string;
    actor?: string;
    session?: string;
    data?: Record<string, unknown>;
  },
): VerdictEnvelope {
  return verdict("ERROR", options?.data ?? null, message, {
    ...options,
    epistemic: {
      output_class: "ERROR",
      ai_involvement: "NONE",
      authority_claim: "EXECUTIVE",
      evidence_source: "COMPUTED",
    },
  });
}

/**
 * Bridge rejection envelope — structured error for ALL blocked bridge calls.
 * Matches the pattern GEOX ingest already uses (MISSING_SOURCE, MISSING_FILENAME).
 *
 * Every blocked call from the bridge boundary MUST use this envelope so the
 * emitting layer, error_code, and trace_id are always present.
 */
export function bridgeError(
  errorCode: string,
  message: string,
  options?: {
    tool?: string;
    actor?: string;
    session?: string;
    sourceLayer?: string;
    downstreamError?: string;
    apx_G?: number;
    apx_C_dark?: number;
    trace_id?: string;
  },
): VerdictEnvelope {
  const data: Record<string, unknown> = {
    status: "ERROR",
    error_code: errorCode,
    source_layer: options?.sourceLayer ?? "A-FORGE::BRIDGE",
    message,
  };
  if (options?.downstreamError) data.downstream_error = options.downstreamError;
  if (options?.trace_id) data.trace_id = options.trace_id;
  if (options?.apx_G !== undefined || options?.apx_C_dark !== undefined) {
    data.apx_block = {
      G: options.apx_G ?? 0.0,
      C_dark: options.apx_C_dark ?? 0.0,
      reason: `Bridge blocked: ${errorCode}`,
    };
  }
  return errorVerdict(message, { ...options, data });
}

/**
 * Helper untuk SEAL verdict — standardized success envelope.
 */
export function sealVerdict(
  data: Record<string, unknown> | string,
  message: string,
  options?: {
    tool?: string;
    actor?: string;
    session?: string;
    duration_ms?: number;
    epistemic?: Partial<EpistemicLabels>;
  },
): VerdictEnvelope {
  return verdict("SEAL", data, message, {
    ...options,
    epistemic: options?.epistemic ?? {
      output_class: "DOMAIN_COMPUTATION",
      ai_involvement: "NONE",
      authority_claim: "ADVISORY",
      evidence_source: "COMPUTED",
    },
  });
}

/**
 * Helper untuk HOLD verdict — pending authorization.
 */
export function holdVerdict(
  message: string,
  elicitationId?: string,
  options?: {
    tool?: string;
    actor?: string;
    data?: Record<string, unknown>;
  },
): VerdictEnvelope {
  return verdict("HOLD", options?.data ?? null, message, {
    ...options,
    epistemic: {
      output_class: "GOVERNANCE_TEMPLATE",
      ai_involvement: "FULL",
      authority_claim: "EXECUTIVE",
      evidence_source: "COMPUTED",
    },
  });
}
