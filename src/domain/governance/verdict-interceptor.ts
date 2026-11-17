/**
 * verdict-interceptor.ts — Verdict Envelope Interceptor
 *
 * Wraps every tool handler response through VerdictEnvelope.
 * Satu lokasi untuk semua verdict — chamber ke-7.
 *
 * Before: each tool returns raw { content: [...] }
 * After:  each tool returns VerdictEnvelope { status, data, message, _meta, _epistemic }
 *
 * DITEMPA BUKAN DIBERI
 */

import {
  verdict,
  sealVerdict,
  errorVerdict,
  type VerdictEnvelope,
  type VerdictStatus,
} from "./verdict-envelope.js";
import { resolveCanonicalVerdict, type CanonicalVerdict } from "./canonical-verdict.js";

const WRAPPED = Symbol.for("aforge.verdict.intercepted");

/**
 * Detect if a response is already a VerdictEnvelope.
 */
function isVerdictEnvelope(obj: any): obj is VerdictEnvelope {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.status === "string" &&
    typeof obj._meta === "object" &&
    typeof obj._meta.tool !== "undefined"
  );
}

/**
 * Extract meaningful data from raw MCP content response.
 */
function extractData(raw: any): Record<string, unknown> | string | null {
  if (!raw) return null;
  if (Array.isArray(raw.content) && raw.content.length > 0) {
    const textContent = raw.content.find((c: any) => c.type === "text");
    if (textContent?.text) {
      // Try JSON parse for structured data
      try {
        return JSON.parse(textContent.text);
      } catch {
        return textContent.text.slice(0, 1000);
      }
    }
  }
  if (typeof raw === "string") return raw;
  return raw;
}

/**
 * Determine verdict status from raw response.
 *
 * G-15 FIX (2026-09-20, FI-008). Previously this returned only
 * "SEAL" | "ERROR", collapsing HOLD, VOID and SABAR into ERROR — so a
 * constitutional refusal was indistinguishable from a crash, and the
 * Judgment -> Receipt edge lost the verdict. A refusal is not a fault;
 * downstream consumers must be able to tell them apart.
 */
function determineStatus(raw: any): VerdictStatus {
  if (!raw) return "ERROR";

  // R5 (2026-10-22): delegate to THE canonical verdict computer. This function
  // used to be a second verdict computer: it read `status` first, so a response
  // carrying both a success receipt and a top-level refusal (CON-14) resolved
  // to the success side, and it ignored the kernel reconciliation block
  // (CON-15) entirely. There is now exactly one place that decides a verdict.
  //
  // The canonical computer applies strictest-wins (VOID > HOLD > SABAR > SEAL,
  // fault dominates), preserves SABAR≠HOLD, and folds every foreign token into
  // one vocabulary. Divergence is reported, not averaged.
  const resolved = resolveCanonicalVerdict(raw);

  // GHOST-HEARTBEAT GUARD: a divergent source is a finding, not noise. Emit it
  // so downstream witnesses can audit the disagreement (F11). Never silent.
  if (resolved.divergent) {
    process.stderr.write(
      `[VerdictInterceptor] VERDICT_FIELD_DIVERGENCE — ${resolved.reason}\n`,
    );
  }

  return resolved.verdict as VerdictStatus;
}

/**
 * Wrap a raw MCP tool response in VerdictEnvelope.
 */
export function wrapVerdict(
  raw: any,
  toolName: string,
  actor?: string,
  duration_ms?: number,
): VerdictEnvelope {
  // Already wrapped — pass through
  if (isVerdictEnvelope(raw)) return raw;

  const status = determineStatus(raw);
  const data = extractData(raw);
  // R5: SABAR is "proceed with caution" — not a failure. The old binary
  // message ("completed" vs "failed") mislabeled every constitutional refusal
  // as a crash. Message must match the verdict class.
  const message =
    status === "SEAL" ? `${toolName} completed`
    : status === "SABAR" ? `${toolName} completed with caution (SABAR)`
    : `${toolName} ${status === "ERROR" ? "failed" : `blocked (${status})`}`;

  if (status === "SEAL") {
    return sealVerdict(data ?? {}, message, { tool: toolName, actor, duration_ms });
  }
  // R5: HOLD/SABAR/VOID are constitutional outcomes, not transport faults.
  // Preserve the verdict class in the envelope instead of collapsing every
  // non-SEAL into ERROR (the CON-14/15 collapse that made a refusal
  // indistinguishable from a crash).
  return verdict(status as CanonicalVerdict, data as Record<string, unknown> ?? { raw }, message, {
    tool: toolName,
    actor,
    epistemic: {
      output_class: status === "SABAR" ? "DOMAIN_COMPUTATION" : "GOVERNANCE_DECISION",
      ai_involvement: "NONE",
      authority_claim: status === "SABAR" ? "ADVISORY" : "EXECUTIVE",
      evidence_source: "COMPUTED",
    },
  });
}

/**
 * Install verdict envelope interceptor on all registered tools.
 * Wraps every handler's return value through VerdictEnvelope.
 *
 * Called AFTER all tool registrations.
 */
export function installVerdictInterceptor(srv: any): void {
  if (!srv) {
    process.stderr.write("[VerdictInterceptor] server not provided\n");
    return;
  }

  const registry = (srv as any)._registeredTools as Record<string, any> | undefined;
  if (!registry) {
    process.stderr.write("[VerdictInterceptor] _registeredTools unavailable\n");
    return;
  }

  let wrapped = 0;
  for (const [toolName, tool] of Object.entries(registry)) {
    if (!tool || typeof tool.handler !== "function") continue;
    if ((tool.handler as any)[WRAPPED]) continue;

    const original = tool.handler.bind(tool);
    const wrappedHandler = async (args: any, extra?: any): Promise<any> => {
      const startTime = Date.now();
      const actorId = args?.actor_id ?? args?.actorId ?? args?.actor;
      try {
        const result = await original(args, extra);
        const envelope = wrapVerdict(result, toolName, actorId, Date.now() - startTime);
        // KX-006 (2026-10-19): "SEAL" is kernel vocabulary. An envelope without a
        // call_hash is not a constitutional seal, so the word must not reach the
        // wire on any read. Outward copy only — internal verdict semantics and the
        // forwarded legacy receipt are untouched.
        const outward = JSON.parse(JSON.stringify(envelope));
        if (!outward.call_hash) {
          if (outward.status === "SEAL") outward.status = "OK";
          if (outward.verdict === "SEAL") outward.verdict = "OK";
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(outward, null, 2) }],
        };
      } catch (err: any) {
        const envelope = errorVerdict(err.message ?? "Unknown error", {
          tool: toolName,
          actor: actorId,
          data: { code: err.code, name: err.name },
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(envelope, null, 2) }],
          isError: true,
        };
      }
    };

    Object.defineProperty(wrappedHandler, WRAPPED, { value: true });
    tool.handler = wrappedHandler;
    wrapped++;
  }

  process.stderr.write(
    `[VerdictInterceptor] installed — ${wrapped} tools wrapped with VerdictEnvelope\n`,
  );
}
