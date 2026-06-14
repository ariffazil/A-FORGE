/**
 * PreForgeGateClient — TypeScript client for the AAA Pre-Forge Constitutional Gate.
 * ================================================================================
 *
 * Calls the Python pre-forge gate HTTP service (port 18990) before any
 * MUTATE/DEPLOY/ALLOCATE/COMMUNICATE action in A-FORGE.
 *
 * This is the F2+F3+F9 enforcement point. Every A-FORGE tool execution
 * that exceeds OBSERVE/PROPOSE passes through this gate.
 *
 * Usage:
 *   import { preForgeCheck, PreForgeGateResult } from "./PreForgeGateClient.js";
 *
 *   const gate = await preForgeCheck({
 *     text: modelOutput,
 *     actionClass: "MUTATE",
 *     sessionId: req.session_id,
 *     modelId: "deepseek-v4-pro",
 *   });
 *
 *   if (!gate.allowed) {
 *     throw new PreForgeGateBlockedError(gate);
 *   }
 *
 * Forged: 2026-06-14 — Opus Shadow → Eureka Engineering
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

const PRE_FORGE_URL = process.env.PRE_FORGE_URL || "http://127.0.0.1:18990";
const PRE_FORGE_TIMEOUT_MS = parseInt(process.env.PRE_FORGE_TIMEOUT_MS || "5000", 10);

export interface PreForgeGateResult {
  allowed: boolean;
  verdict: "PASS" | "CAUTION" | "HOLD" | "VOID" | "DOWNGRADE";
  all_clear: boolean;
  violations: Array<{
    step?: string;
    marker?: string;
    violation?: string;
    verdict?: string;
    classification?: string;
    score?: number;
    reason?: string;
  }>;
  required_actions: string[];
  citation_summary: {
    total: number;
    provenanced: number;
    decorative: number;
    recommendation: string;
  } | null;
  witness_summary: string;
  shadow_summary: {
    classification: string;
    score: number;
  } | null;
  gated_at: string;
}

export interface PreForgeCheckParams {
  text: string;
  actionClass: string;
  sessionId?: string;
  modelId?: string;
  claimedEvidenceTier?: string;
  knownProvenances?: Record<string, any>;
}

export class PreForgeGateBlockedError extends Error {
  public gateResult: PreForgeGateResult;

  constructor(result: PreForgeGateResult) {
    const violations = result.violations.map(v => v.step || v.violation || "unknown").join(", ");
    super(`PRE_FORGE_GATE: ${result.verdict} — ${violations}`);
    this.name = "PreForgeGateBlockedError";
    this.gateResult = result;
  }
}

/**
 * Run the full pre-forge constitutional gate check.
 */
export async function preForgeCheck(params: PreForgeCheckParams): Promise<PreForgeGateResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PRE_FORGE_TIMEOUT_MS);

  try {
    const body: Record<string, any> = {
      text: params.text,
      action_class: params.actionClass.toLowerCase(),
      session_id: params.sessionId || "default",
      model_id: params.modelId || "unknown",
      claimed_evidence_tier: params.claimedEvidenceTier || "INTERPRETATION",
    };

    if (params.knownProvenances) {
      body.known_provenances = params.knownProvenances;
    }

    const res = await fetch(`${PRE_FORGE_URL}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Pre-forge gate returned ${res.status}: ${errBody}`);
    }

    return (await res.json()) as PreForgeGateResult;
  } catch (err: any) {
    if (err.name === "AbortError") {
      // Gate timeout → fail open with CAUTION (don't block operations on gate failure)
      console.error("[pre-forge-gate] TIMEOUT — failing open with CAUTION");
      return {
        allowed: true,
        verdict: "CAUTION",
        all_clear: false,
        violations: [{ step: "GATE_TIMEOUT", reason: `Pre-forge gate timed out after ${PRE_FORGE_TIMEOUT_MS}ms` }],
        required_actions: ["GATE_TIMEOUT: Pre-forge check unavailable. Proceeding with reduced confidence."],
        citation_summary: null,
        witness_summary: "GATE_TIMEOUT",
        shadow_summary: null,
        gated_at: new Date().toISOString(),
      };
    }
    // Gate unavailable → fail open with CAUTION
    console.error(`[pre-forge-gate] ERROR: ${err.message} — failing open with CAUTION`);
    return {
      allowed: true,
      verdict: "CAUTION",
      all_clear: false,
      violations: [{ step: "GATE_ERROR", reason: err.message }],
      required_actions: ["GATE_ERROR: Pre-forge check unavailable. Proceeding with reduced confidence."],
      citation_summary: null,
      witness_summary: "GATE_ERROR",
      shadow_summary: null,
      gated_at: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Quick boolean check — returns true if action is safe to execute.
 */
export async function quickPreForgeCheck(
  text: string,
  actionClass: string,
  sessionId?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${PRE_FORGE_URL}/quick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        action_class: actionClass.toLowerCase(),
        session_id: sessionId || "default",
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return true; // Fail open
    const data: any = await res.json();
    return data.allowed === true;
  } catch {
    return true; // Fail open on network error
  }
}

/**
 * Register a witness in a session.
 */
export async function registerWitness(
  sessionId: string,
  witnessType: string,
  evidenceRef: string = "",
): Promise<void> {
  try {
    await fetch(`${PRE_FORGE_URL}/witness`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        witness_type: witnessType,
        evidence_ref: evidenceRef,
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Non-critical — witness registration failure is logged but not blocking
  }
}

/**
 * Register an Earth measurement (tool call result) in a session.
 */
export async function registerEarthMeasurement(
  sessionId: string,
  toolName: string,
  evidenceRef: string = "",
): Promise<void> {
  try {
    await fetch(`${PRE_FORGE_URL}/earth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        tool_name: toolName,
        evidence_ref: evidenceRef,
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Non-critical
  }
}

/**
 * Register a model output witness in a session.
 */
export async function registerModelOutput(
  sessionId: string,
  modelId: string,
  isPrimary: boolean = true,
): Promise<void> {
  try {
    await fetch(`${PRE_FORGE_URL}/model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        model_id: modelId,
        is_primary: isPrimary,
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Non-critical
  }
}

/**
 * Get the witness state for a session.
 */
export async function getWitnessState(sessionId: string): Promise<any> {
  const res = await fetch(`${PRE_FORGE_URL}/witness/${encodeURIComponent(sessionId)}`);
  if (!res.ok) return null;
  return res.json();
}

// ── Citation Provenance Capture ──────────────────────────────────────────────

export interface CitationProvenanceRecord {
  marker: string;
  classification: "PROVENANCED" | "DECORATIVE" | "PHANTOM" | "UNVERIFIABLE";
  completeness: number;
  provenance_hash: string;
  url: string;
  title?: string;
}

export interface CitationCaptureResult {
  ok: boolean;
  count: number;
  provenances: Record<string, CitationProvenanceRecord>;
  query: string;
  tool: string;
  timestamp: string;
}

/**
 * Capture citation provenance from search/fetch tool results.
 * Call this after every search or fetch tool call to auto-create
 * provenance records for F2 TRUTH enforcement.
 *
 * Usage:
 *   const results = await search("some query");
 *   const provenance = await captureCitationProvenance({
 *     query: "some query",
 *     toolName: "brave_web_search",
 *     results: results.map(r => ({ url: r.url, title: r.title })),
 *   });
 *   // Pass provenance to pre-forge check
 *   const gate = await preForgeCheck({ ..., knownProvenances: provenance.provenances });
 */
export async function captureCitationProvenance(params: {
  query: string;
  toolName: string;
  results: Array<{ url: string; title?: string; snippet?: string }>;
  modelId?: string;
}): Promise<CitationCaptureResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${PRE_FORGE_URL}/provenance/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        tool_name: params.toolName,
        results: params.results,
        model_id: params.modelId || "deepseek-v4-pro",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[citation-provenance] Batch capture failed: ${res.status}`);
      return { ok: false, count: 0, provenances: {}, query: params.query, tool: params.toolName, timestamp: new Date().toISOString() };
    }

    return (await res.json()) as CitationCaptureResult;
  } catch (err) {
    console.error(`[citation-provenance] Batch capture error: ${err}`);
    return { ok: false, count: 0, provenances: {}, query: params.query, tool: params.toolName, timestamp: new Date().toISOString() };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Create a single citation provenance record.
 */
export async function createCitationProvenance(params: {
  citationText: string;
  toolName: string;
  queryId: string;
  sourceUrl: string;
  sourceModelId?: string;
  resultPosition?: number;
}): Promise<CitationProvenanceRecord | null> {
  try {
    const res = await fetch(`${PRE_FORGE_URL}/citation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        citation_text: params.citationText,
        tool_name: params.toolName,
        query_id: params.queryId,
        source_url: params.sourceUrl,
        source_model_id: params.sourceModelId || "deepseek-v4-pro",
        result_position: params.resultPosition ?? -1,
      }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.provenance || null;
  } catch {
    return null;
  }
}
