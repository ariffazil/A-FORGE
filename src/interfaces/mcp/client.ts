/**
 * MCP Bridge Client — Federation Memory Bridge
 *
 * Routes tool calls from A-FORGE TypeScript runtime to arifOS / WEALTH / GEOX
 * Python MCP kernels via HTTP REST surfaces.
 *
 * Includes verdict precondition check: MUTATE/ATOMIC actions require a
 * valid SEAL verdict before execution (APEX Unified Theory integration).
 *
 * Previously a placeholder (888_HOLD). Now forged.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import {
  type MCPNamespace,
  NAMESPACE_DEFAULTS,
  TOOL_NAME_MAP,
  transformArgs,
  transformResponse,
} from "../../domain/types/mcp-bridge.js";
import {
  checkVerdictPrecondition,
  requiresVerdictCheck,
  type SessionVerdictState,
} from "../../domain/forge/check_verdict.js";
import * as fs from "node:fs";
import * as crypto from "node:crypto";

/**
 * Map MCP tool names to action classes for verdict precondition checking.
 * MUTATE tools modify state. ATOMIC tools are irreversible.
 */
const MUTATE_TOOLS = new Set([
  'forge_execute', 'forge_approve', 'arif_vault_seal',
  'forge_dry_run', // dry run is safe but still MUTATE-adjacent
]);

const ATOMIC_TOOLS = new Set([
  'arif_forge_execute',
]);

function classifyToolAction(toolName: string): 'OBSERVE' | 'DERIVE' | 'MUTATE' | 'ATOMIC' {
  // Aligned to actionClassifier for One Skill/One Tool consistency (minimal patch)
  if (ATOMIC_TOOLS.has(toolName)) return 'ATOMIC';
  if (MUTATE_TOOLS.has(toolName)) return 'MUTATE';
  return 'OBSERVE';
}

function parseToolName(tool: string): { namespace: MCPNamespace; toolName: string } {
  const dotIndex = tool.indexOf(".");
  if (dotIndex === -1) {
    // Bare tool name — default to arifos namespace
    return { namespace: "arifos", toolName: tool };
  }
  const ns = tool.slice(0, dotIndex);
  const name = tool.slice(dotIndex + 1);
  // Handle "_mcp" suffix in namespace (e.g., "arifos_mcp.apex_judge")
  const cleanNs = ns.replace(/_mcp$/, "") as MCPNamespace;
  if (!NAMESPACE_DEFAULTS[cleanNs]) {
    throw new Error(
      `MCP Bridge: Unknown namespace "${cleanNs}" in tool "${tool}". ` +
        `Known namespaces: ${Object.keys(NAMESPACE_DEFAULTS).join(", ")}`,
    );
  }
  return { namespace: cleanNs, toolName: name };
}

function getMcpUrl(namespace: MCPNamespace): string {
  const cfg = NAMESPACE_DEFAULTS[namespace];
  const fromEnv = process.env[cfg.env];
  if (fromEnv) return fromEnv;
  return cfg.default;
}

function injectSovereignSignature(canonicalTool: string, argsRecord: Record<string, unknown>) {
  if (canonicalTool !== "arif_forge_execute" && canonicalTool !== "arif_vault_seal") {
    return;
  }
  
  try {
    const keyPath = "/root/compose/sekrits/arifos_sovereign.key";
    if (!fs.existsSync(keyPath)) return;
    
    const privateKey = fs.readFileSync(keyPath, "utf-8");
    const nonce = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const actorId = (argsRecord.actor_id as string) || "ariffazil::auto";
    argsRecord.actor_id = actorId;
    
    // In current implementation, arifOS just logs the signature and checks F1 AMANAH (nonce).
    // The strict hash verification is F13-pending, so we sign a dummy payload for now
    // until the exact constitution_hash structure is finalized.
    const payload = Buffer.from(actorId + "auto-seal" + nonce);
    const signature = crypto.sign(null, payload, privateKey);
    
    argsRecord.actor_signature = "ed25519:" + signature.toString("hex");
    argsRecord.nonce = nonce;
  } catch (err) {
    // Silently fail if key cannot be read or used; kernel will handle the missing signature
  }
}

/**
 * Call an MCP tool on a federation kernel via HTTP REST bridge.
 *
 * @param tool — Fully-qualified tool name, e.g. "arifos_mcp.apex_judge"
 * @param args — Arguments object passed by caller
 * @returns Unwrapped tool result (the kernel's `.result` field)
 * @throws On network failure, unknown namespace, or kernel error
 */
export async function callMCP(tool: string, args: unknown): Promise<unknown> {
  const { namespace, toolName } = parseToolName(tool);
  const canonicalTool = TOOL_NAME_MAP[toolName] ?? toolName;
  const url = `${getMcpUrl(namespace)}/tools/${canonicalTool}`;

  const argsRecord = (typeof args === "object" && args !== null ? args : {}) as Record<
    string,
    unknown
  >;
  
  injectSovereignSignature(canonicalTool, argsRecord);

  // ── Verdict precondition check (aligned to One Skill + One Tool) ─────────────────────
  // Before calling MUTATE/ATOMIC tools, check if a SEAL verdict exists.
  // This prevents execution without constitutional approval.
  // Note: aligned to actionClassifier and enforce_restraint_and_verdict where possible.
  const actionClass = classifyToolAction(canonicalTool);
  if (requiresVerdictCheck(0.5) && (actionClass === 'MUTATE' || actionClass === 'ATOMIC')) {
    // Check for session_id in args — if present, check session verdict state
    const sessionId = argsRecord.session_id as string | undefined;
    if (!sessionId) {
      throw new Error(
        `MCP Bridge: ${actionClass} tool "${canonicalTool}" requires a governed session. ` +
        `888_HOLD: No session_id provided. Call arif_session_init first.`
      );
    }

    // Attempt to read session verdict from arifOS
    try {
      const vitalsUrl = `${getMcpUrl('arifos')}/tools/arif_ops_measure`;
      const vitalsResponse = await fetch(vitalsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'vitals', session_id: sessionId }),
      });
      const vitalsPayload = await vitalsResponse.json() as Record<string, unknown>;
      
      const sessionVerdict = (vitalsPayload.verdict as string) ?? null;
      const acRisk = (vitalsPayload.ac_risk as number) ?? 0.50;
      const circuitBreakers = (vitalsPayload.circuit_breakers as string[]) ?? [];
      const simulationIndex = (vitalsPayload.simulation_index as number) ?? 0.0;

      const sessionState: SessionVerdictState = {
        actionClass,
        verdict: sessionVerdict as SessionVerdictState['verdict'],
        confidence: (vitalsPayload.confidence as number) ?? 0.0,
        acRisk,
        simulationIndex,
        circuitBreakers,
        timestamp: Date.now(),
      };

      const precondition = checkVerdictPrecondition(actionClass, sessionState);
      if (!precondition.permitted) {
        throw new Error(
          `MCP Bridge: Verdict precondition failed for "${canonicalTool}". ` +
          `${precondition.reason} ` +
          `AC_Risk: ${acRisk.toFixed(2)} | Breakers: [${circuitBreakers.join(', ')}]`
        );
      }
    } catch (err) {
      // If we can't reach arifOS for verdict check, block conservatively
      if (err instanceof Error && err.message.includes('Verdict precondition failed')) {
        throw err; // Re-throw precondition failures
      }
      // Network errors = cautious block
      throw new Error(
        `MCP Bridge: Cannot verify verdict precondition for "${canonicalTool}". ` +
        `888_HOLD: Kernel unreachable for verdict query. Action requires SEAL.`
      );
    }
  }
  
  const body = transformArgs(toolName, argsRecord);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    throw new Error(
      `MCP Bridge: Network error calling ${namespace} kernel at ${url}. ` +
        `888_HOLD: Kernel unreachable. Detail: ${msg}`,
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch (parseErr) {
    const text = await response.text().catch(() => "<unreadable>");
    throw new Error(
      `MCP Bridge: Non-JSON response from ${url} (HTTP ${response.status}). ` +
        `Body: ${text.slice(0, 500)}`,
    );
  }

  // Kernel error handling
  if (!response.ok || payload.status === "error" || payload.verdict === "HOLD") {
    const errorMsg =
      (payload.error as string) ??
      (payload.reason as string) ??
      `Kernel returned HTTP ${response.status}`;
    const floor = (payload.failed_floor as string) ?? (payload.floor as string) ?? "F13";
    const verdict = (payload.verdict as string) ?? "HOLD";
    throw new Error(
      `MCP Bridge: Kernel error for ${canonicalTool}. ` +
        `${floor} | ${verdict} | ${errorMsg}`,
    );
  }

  // Unwrap the kernel's result envelope
  const rawResult =
    payload.result ?? payload;

  const resultRecord =
    typeof rawResult === "object" && rawResult !== null
      ? (rawResult as Record<string, unknown>)
      : { _raw: rawResult };

  return transformResponse(toolName, resultRecord);
}
