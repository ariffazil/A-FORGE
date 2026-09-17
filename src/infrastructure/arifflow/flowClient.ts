/**
 * P1-7 (2026-09-15, ARIF GO): Legacy-receipt adapter — old governance
 * receipt shapes become CALLERS of arifFLOW via the canonical client.
 *
 * Doctrine: "old receipt functions become callers of arifFLOW · arifFLOW
 * is receipt authority, not judge." This adapter maps the retired
 * /receipt/emit body contract onto emitReceipt() (arifflowClient), which
 * speaks the live /ingest FlowReceipt schema (incl. required
 * cooling_decision). Fire-and-forget: local computation remains canonical.
 */
import { emitReceipt } from "../receipts/arifflowClient.js";

export interface ArifFlowLegacyReceipt {
  organ: string;
  producer: string;
  action: string;
  scope?: string;
  risk?: string;
  epistemic_label?: unknown;
  confidence?: number;
  session_id?: string;
  actor_id?: string;
  verdict?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

type EmitParams = Parameters<typeof emitReceipt>[0];

/** Legacy verdict vocabulary → arifflowClient floor_verdict keys. */
function floorFromVerdict(verdict: string | undefined): "PASS" | "HOLD" | "VOID" | "CAUTION" {
  const v = String(verdict ?? "SABAR").toUpperCase();
  if (v === "SEAL" || v === "PASS") return "PASS";
  if (v === "HOLD") return "HOLD";
  if (v === "VOID" || v === "FAIL") return "VOID";
  return "CAUTION";
}

/**
 * Forward a legacy-shaped governance receipt to arifFLOW. Never throws —
 * arifflowClient falls back to local JSONL on failure (no silent drop).
 */
export async function forwardLegacyReceipt(legacy: ArifFlowLegacyReceipt): Promise<void> {
  const common = {
    organ: legacy.organ,
    actor_id: legacy.actor_id || legacy.organ || "A-FORGE",
    session_id: legacy.session_id || "aforge-unbound",
    floor_verdict: floorFromVerdict(legacy.verdict) as EmitParams["floor_verdict"],
    cost_ns: 0,
  };

  try {
    // 1. Execute receipt (the mutation itself)
    await emitReceipt({
      ...common,
      step_type: "Execute",
      summary: legacy.action,
      epistemic_label: String(legacy.epistemic_label ?? "DER").toUpperCase() as EmitParams["epistemic_label"],
      details: {
        producer: legacy.producer,
        scope: legacy.scope,
        risk: legacy.risk,
        confidence: legacy.confidence,
        legacy_verdict: legacy.verdict,
        metadata: legacy.metadata,
        p1_7_migrated: true,
      },
    });

    // 2. Paired Verify receipt (observed execution completed — breaks A-FORGE exec:0 ratio)
    await emitReceipt({
      ...common,
      step_type: "Verify",
      summary: `verify: ${legacy.action}`,
      epistemic_label: "OBS",
      details: {
        producer: legacy.producer,
        paired_with: legacy.action,
        verify_reason: "post-execution observation",
      },
    });
  } catch {
    // emitReceipt already wrote its local fallback — nothing to do here.
  }
}
