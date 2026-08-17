/**
 * A-FORGE Cooling Verbs — /cool_drift and /cool_pattern
 *
 * These are the two Hermes cooling slash commands implemented as A-FORGE MCP tools.
 * They craft a COOLING_RECEIPT envelope and route it through seal_chain.js
 * validateCooling() → VAULT999 append.
 *
 * Both tools follow COOLING_RECEIPT_SPEC_v1.md §3 invariants:
 *   INV-C1: action_class=OBSERVE (COOLING-MUST-NOT-SELF-DEPLOY)
 *   INV-C2: caller must NOT contain "forge"
 *   INV-C3: supersedes.type=COLD_LINK (never overwrite original)
 *   INV-C4: governance_path explicit (judge_required true unless AUTO/OBSERVE_ONLY)
 *
 * DITEMPA BUKAN DIBERI — Cooling is forged, not given.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "node:child_process";

const SEAL_CHAIN_JS = "/root/AAA/a2a-server/seal_chain.js";

/**
 * Craft a COOLING_RECEIPT envelope from verb parameters.
 * All fields must pass validateCooling() 4 invariants before seal_chain.js write.
 */
function craftCoolingReceipt(params: {
  verb: "cool_drift" | "cool_pattern";
  session_id: string;
  original_seal_seq: number;
  original_verdict: string;
  judge_hash: string;
  judge_summary: string;
  drift_dimension: string;
  drift_delta: string;
  epistemic_label: string;
  severity: string;
  hypothesis: string;
  evidence: string;
  governance_organ: string;
  governance_floor: string;
  required_authority: string;
  convergence: string;
  recurrence_count?: number;
  first_seen?: string;
  last_seen?: string;
  witness_organ?: string;  // T2.3: domain organ witness for ΔΩΨ routing
  caller?: string;
}): Record<string, unknown> {
  const epoch = new Date().toISOString();

  // INV-C1: action_class MUST be OBSERVE
  const action_class = "OBSERVE";

  // INV-C2: caller must NOT contain "forge"
  const caller = params.caller || "hermes-prime";
  if (caller.toLowerCase().includes("forge")) {
    throw new Error(
      `INV-C2 VIOLATION: caller="${caller}" contains "forge". Cooling routes through governance, never execution.`
    );
  }

  const observations: Array<Record<string, unknown>> = [
    {
      dimension: params.drift_dimension,
      delta: params.drift_delta,
      epistemic_label: params.epistemic_label,
      severity: params.severity,
    },
  ];

  // Add recurrence info for /cool_pattern
  if (params.verb === "cool_pattern" && params.recurrence_count && params.recurrence_count > 1) {
    observations.push({
      dimension: "recurrence",
      delta: `Pattern observed ${params.recurrence_count} times since ${params.first_seen}, last at ${params.last_seen}`,
      epistemic_label: "DER",
      severity: params.recurrence_count >= 3 ? "SIGNIFICANT" : params.severity,
    });
  }

  const envelope: Record<string, unknown> = {
    seal_version: 3,
    event_type: "cooling.receipt",
    epoch,
    action_class,
    caller,
    actor: caller,

    session_id: params.session_id,
    original_seal_seq: params.original_seal_seq,

    original_verdict: {
      verdict: params.original_verdict,
      judge_hash: params.judge_hash,
      judge_summary: params.judge_summary,
    },

    drift_detected: {
      present: true,
      observations,
    },

    proposed_improvement: {
      hypothesis: params.hypothesis,
      evidence: params.evidence,
      epistemic_label: "INT",
      risk_if_applied: params.severity === "CRITICAL" ? "HIGH" : params.severity === "SIGNIFICANT" ? "MEDIUM" : "LOW",
      risk_if_not_applied: "Drift uncorrected may compound in future cycles",
      alternatives: [],
    },

    // INV-C4: governance_path must be explicit
    governance_path: {
      target_organ: params.governance_organ,
      target_floor: params.governance_floor,
      required_authority: params.required_authority,
      judge_required: params.required_authority !== "AUTO" && params.required_authority !== "OBSERVE_ONLY",
      reason: `Cooling from ${params.verb}: ${params.hypothesis}`,
    },

    // INV-C3: supersedes.type MUST be COLD_LINK
    supersedes: {
      seal_seq: params.original_seal_seq,
      type: "COLD_LINK",
      note: "Lineage only. Original SEAL is immutable per F1 AMANAH, F11 AUDIT.",
    },

    witness: {
      human: null,
      ai: caller,
      external: null,
      // T2.3: witness_organ routes cooling through domain organ for physical grounding
      witness_organ: params.witness_organ || params.governance_organ,
    },

    metabolism: {
      cycle_count: 1,
      previous_cooling_seq: null,
      convergence: params.convergence,
    },

    cooling_source: params.verb === "cool_pattern" ? "scheduled_reflection" : "post_verification",
  };

  return envelope;
}

/**
 * Write a COOLING_RECEIPT to VAULT999 via seal_chain.js.
 * The JS writer runs enforceSealInvariants + validateCooling internally.
 */
function writeCoolingReceipt(envelope: Record<string, unknown>): Record<string, unknown> {
  const payloadJson = JSON.stringify(envelope);
  // Use shell-wrapped execSync to call seal_chain.js write
  // Escape shell-safely: single-quote the JSON after escaping any single quotes
  const escaped = payloadJson.replace(/'/g, "'\\''");
  const cmd = `node ${SEAL_CHAIN_JS} write '${escaped}'`;
  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: 15000,
      env: { ...process.env, NODE_PATH: process.env.NODE_PATH || "" },
    });
    const result = JSON.parse(stdout.trim());

    // P1-5h: Forward cooling receipt to arifFLOW — fire-and-forget
    setImmediate(() => {
      _forwardCoolingToArifFlow(envelope).catch(() => {});
    });

    return result;
  } catch (err: any) {
    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    throw new Error(
      `seal_chain.js write failed: ${err.message}\nSTDOUT: ${stdout.slice(0, 500)}\nSTDERR: ${stderr.slice(0, 500)}`
    );
  }
}

export function registerCoolingVerbs(server: McpServer): void {
  // ── /cool_drift — Emit cooling receipt with convergence signal ────────────
  server.tool(
    "forge_cool_drift",
    "Emit a COOLING_RECEIPT with convergence signal (CONVERGING/DIVERGING/STABLE). Routes through seal_chain.js validateCooling() → VAULT999 append. INV-C1: OBSERVE-only. INV-C2: no forge caller. INV-C3: COLD_LINK. INV-C4: explicit governance.",
    {
      session_id: z.string().describe("Session ID of the cooled session"),
      original_seal_seq: z.number().int().describe("Seq of the SEAL being cooled"),
      original_verdict: z.string().describe("Original verdict: SEAL|HOLD|SABAR|VOID"),
      judge_hash: z.string().describe("SHA-256 of the arif_judge verdict envelope"),
      judge_summary: z.string().describe("1-line summary of what 888 decided"),
      drift_dimension: z.enum([
        "runtime_commit", "tool_behavior", "memory_staleness",
        "authority_leak", "unexpected_output", "timing_anomaly",
        "prediction_failure", "human_reaction", "other"
      ]).describe("Dimension where drift was detected"),
      drift_delta: z.string().describe("What Reality saw that the plan didn't predict"),
      epistemic_label: z.enum(["OBS", "DER", "INT"]).describe("Epistemic label for drift claim"),
      severity: z.enum(["INFO", "MINOR", "SIGNIFICANT", "CRITICAL"]).describe("Drift severity"),
      hypothesis: z.string().describe("What the cooling suggests would fix this drift"),
      evidence: z.string().describe("What supports this hypothesis"),
      governance_organ: z.enum(["arifOS", "A-FORGE", "AAA", "GEOX", "WEALTH", "WELL"]).describe("Target organ"),
      governance_floor: z.string().describe("Target floor: F1-F13"),
      required_authority: z.enum(["AUTO", "OBSERVE_ONLY", "888_HOLD", "F13_SOVEREIGN"]).describe("Required authority level"),
      convergence: z.enum(["CONVERGING", "DIVERGING", "STABLE", "first_cooling"]).describe("Convergence state"),
      // T2.3: witness_organ for ΔΩΨ physical grounding routing
      witness_organ: z.enum(["GEOX", "WEALTH", "WELL", "arifOS", "A-FORGE", "AAA"]).optional()
        .describe("Domain organ that witnessed the drift (GEOX/WEALTH/WELL for physical grounding)"),
      caller: z.string().optional().describe("Override caller (default: hermes-prime)"),
    },
    async (params) => {
      try {
        // INV-C2 guard at tool level
        const caller = params.caller || "hermes-prime";
        if (caller.toLowerCase().includes("forge")) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                verdict: "HOLD",
                reason: "INV-C2: COOLING caller must not contain 'forge'. Cooling routes through governance, never execution.",
                invariant: "INV-C2_CALLER_NOT_FORGE",
                status: "rejected",
              }, null, 2),
            }],
            isError: true,
          };
        }

        const envelope = craftCoolingReceipt({
          verb: "cool_drift",
          ...params,
          caller,
        });

        const result = writeCoolingReceipt(envelope);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              verdict: "DRAFT",
              verb: "cool_drift",
              message: "COOLING_RECEIPT emitted (draft, not constitutional SEAL)",
              receipt: envelope,
              seal_chain_result: result,
              invariants_satisfied: [
                "INV-C1: action_class=OBSERVE",
                "INV-C2: caller not forge",
                "INV-C3: supersedes.type=COLD_LINK",
                "INV-C4: governance_path explicit",
              ],
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              verdict: "HOLD",
              verb: "cool_drift",
              error: err.message,
              status: "failed",
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // ── /cool_pattern — Emit cooling receipt from observed failure recurrence ──
  server.tool(
    "forge_cool_pattern",
    "Emit a COOLING_RECEIPT from observed failure recurrence. Same pipeline as cool_drift with additional recurrence_count, first_seen, last_seen fields. Routes through seal_chain.js validateCooling() → VAULT999 append.",
    {
      session_id: z.string().describe("Session ID of the cooled session"),
      original_seal_seq: z.number().int().describe("Seq of the SEAL being cooled"),
      original_verdict: z.string().describe("Original verdict: SEAL|HOLD|SABAR|VOID"),
      judge_hash: z.string().describe("SHA-256 of the arif_judge verdict envelope"),
      judge_summary: z.string().describe("1-line summary of what 888 decided"),
      drift_dimension: z.enum([
        "runtime_commit", "tool_behavior", "memory_staleness",
        "authority_leak", "unexpected_output", "timing_anomaly",
        "prediction_failure", "human_reaction", "other"
      ]).describe("Dimension where drift was detected"),
      drift_delta: z.string().describe("What Reality saw that the plan didn't predict"),
      epistemic_label: z.enum(["OBS", "DER", "INT"]).describe("Epistemic label for drift claim"),
      severity: z.enum(["INFO", "MINOR", "SIGNIFICANT", "CRITICAL"]).describe("Drift severity"),
      hypothesis: z.string().describe("What the cooling suggests would fix this drift"),
      evidence: z.string().describe("What supports this hypothesis"),
      governance_organ: z.enum(["arifOS", "A-FORGE", "AAA", "GEOX", "WEALTH", "WELL"]).describe("Target organ"),
      governance_floor: z.string().describe("Target floor: F1-F13"),
      required_authority: z.enum(["AUTO", "OBSERVE_ONLY", "888_HOLD", "F13_SOVEREIGN"]).describe("Required authority level"),
      convergence: z.enum(["CONVERGING", "DIVERGING", "STABLE", "first_cooling"]).describe("Convergence state"),
      recurrence_count: z.number().int().min(1).describe("How many times this pattern has been observed"),
      first_seen: z.string().describe("ISO-8601 timestamp of first observation"),
      last_seen: z.string().describe("ISO-8601 timestamp of most recent observation"),
      // T2.3: witness_organ for ΔΩΨ physical grounding routing
      witness_organ: z.enum(["GEOX", "WEALTH", "WELL", "arifOS", "A-FORGE", "AAA"]).optional()
        .describe("Domain organ that witnessed the pattern (GEOX/WEALTH/WELL for physical grounding)"),
      caller: z.string().optional().describe("Override caller (default: hermes-prime)"),
    },
    async (params) => {
      try {
        const caller = params.caller || "hermes-prime";
        if (caller.toLowerCase().includes("forge")) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                verdict: "HOLD",
                reason: "INV-C2: COOLING caller must not contain 'forge'.",
                invariant: "INV-C2_CALLER_NOT_FORGE",
                status: "rejected",
              }, null, 2),
            }],
            isError: true,
          };
        }

        const envelope = craftCoolingReceipt({
          verb: "cool_pattern",
          ...params,
          recurrence_count: params.recurrence_count,
          first_seen: params.first_seen,
          last_seen: params.last_seen,
          caller,
        });

        const result = writeCoolingReceipt(envelope);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              verdict: "DRAFT",
              verb: "cool_pattern",
              message: "COOLING_RECEIPT emitted (draft, not constitutional SEAL)",
              receipt: envelope,
              seal_chain_result: result,
              recurrence: {
                count: params.recurrence_count,
                first_seen: params.first_seen,
                last_seen: params.last_seen,
              },
              invariants_satisfied: [
                "INV-C1: action_class=OBSERVE",
                "INV-C2: caller not forge",
                "INV-C3: supersedes.type=COLD_LINK",
                "INV-C4: governance_path explicit",
              ],
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              verdict: "HOLD",
              verb: "cool_pattern",
              error: err.message,
              status: "failed",
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}

/**
 * P1-5h: Forward cooling receipt to arifFLOW :7073/receipt/emit.
 * Fire-and-forget — failure is silent, seal_chain.js write is canonical.
 * DEPRECATED P1-7: will be replaced by arifFLOW client import post-extraction.
 */
async function _forwardCoolingToArifFlow(envelope: Record<string, unknown>): Promise<void> {
  try {
    await fetch("http://127.0.0.1:7073/receipt/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organ: "A-FORGE",
        producer: "coolingVerbs",
        action: `cooling:${envelope.cooling_source || "unknown"}`,
        scope: `drift:${envelope.drift_dimension || "unknown"}`,
        risk: (envelope.severity === "CRITICAL" || envelope.severity === "SIGNIFICANT")
          ? "CONSEQUENTIAL" : "INTERNAL",
        epistemic_label: envelope.epistemic_label || "OBS",
        confidence: 0.85,
        session_id: envelope.session_id as string | undefined,
        verdict: envelope.original_verdict as string || "SABAR",
        metadata: {
          drift_dimension: envelope.drift_dimension,
          convergence: envelope.convergence,
          severity: envelope.severity,
          governance_organ: envelope.governance_organ,
          governance_floor: envelope.governance_floor,
          hypothesis: (envelope.hypothesis as string)?.slice(0, 200),
          cooling_source: envelope.cooling_source,
          required_authority: envelope.required_authority,
          witness_organ: envelope.witness_organ,
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // arifFLOW unreachable — seal_chain.js is canonical
  }
}
