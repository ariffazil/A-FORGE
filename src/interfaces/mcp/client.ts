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
 * Canonical constitution_hash computation.
 * MUST match sovereign_signer.py:get_constitution_hash() exactly.
 * This is the SHA-256 hash of the floor spec, used as the payload anchor
 * for Ed25519 sovereign signatures. The verifier (arifOS) computes the same
 * value and compares.
 */
const FLOOR_SPEC =
  "F1: Amanah, F2: Truth, F3: Tri-Witness, F4: Clarity, " +
  "F5: Peace, F6: Maruah, F7: Humility, F8: Genius, " +
  "F9: Anti-Hantu, F10: Ontology, F11: Auditability, F12: Resilience, F13: Sovereign";

/**
 * Try to compute constitution_hash from KERNEL_CANON file, falling back
 * to FLOOR_SPEC hash. Matches sovereign_signer.py behavior exactly.
 */
function computeConstitutionHash(): string {
  const candidates = [
    "/root/arifOS/GENESIS/000_KERNEL_CANON.md",
    "/opt/arifos/app/GENESIS/000_KERNEL_CANON.md",
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p);
        const hash = crypto.createHash("sha256").update(content).digest("hex");
        return `sha256:${hash}`;
      }
    } catch {
      // fall through
    }
  }
  // Fallback: hash the floor spec (same as sovereign_signer.py)
  const hash = crypto.createHash("sha256").update(FLOOR_SPEC).digest("hex").substring(0, 16);
  return `sha256:${hash}`;
}

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
  // P0-FIX: Prefer ARIFOS_KERNEL_URL for arifos namespace (VPS local execution).
  // This prevents stale/incorrect public URLs from breaking local proxy calls.
  if (namespace === "arifos") {
    const kernelUrl = process.env["ARIFOS_KERNEL_URL"];
    if (kernelUrl) return kernelUrl;
  }
  const fromEnv = process.env[cfg.env];
  if (fromEnv) return fromEnv;
  return cfg.default;
}

/**
 * Inject Ed25519 sovereign signature into tool call arguments.
 *
 * F13 SOVEREIGN: Signs `actor_id:constitution_hash:nonce` payload using the
 * sovereign private key. The verifier (arifOS `verify_sovereign_signature`)
 * checks this signature against the sovereign public key.
 *
 * FAIL-CLOSED (2026-07-07 FIX):
 * - If key is missing → throws. Execution halts. No silent pass.
 * - If signature fails → throws. Execution halts. No silent pass.
 * - If payload is malformed → throws. Execution halts.
 *
 * Payload format (MUST match sovereign_verify.py):
 *   "{actor_id}:{constitution_hash}:{nonce}"
 *
 * Signature format: base64-encoded Ed25519 raw bytes (no prefix)
 */
function injectSovereignSignature(canonicalTool: string, argsRecord: Record<string, unknown>): void {
  // Only sign tools that reach arifOS verification paths:
  // arif_forge_execute  → verified in tools.py line 6948 (session init chain)
  // arif_vault_seal     → verified in tools.py line 15528 (seal chain)
  if (canonicalTool !== "arif_forge_execute" && canonicalTool !== "arif_vault_seal") {
    return;
  }

  const keyPath = "/root/compose/sekrits/arifos_sovereign.key";
  let keyExists: boolean;
  try {
    keyExists = fs.existsSync(keyPath);
  } catch {
    keyExists = false;
  }
  if (!keyExists) {
    throw new Error(
      `SOVEREIGN KEY MISSING: Cannot sign ${canonicalTool}. ` +
      `Key not found at ${keyPath}. ` +
      `888_HOLD: Sovereign identity binding requires the Ed25519 private key.`
    );
  }

  const privateKeyPem = fs.readFileSync(keyPath, "utf-8");
  const actorId = (argsRecord.actor_id as string) || "ariffazil::auto";
  argsRecord.actor_id = actorId;

  // constitution_hash MUST match what sovereign_signer.py and
  // sovereign_verify.py compute. This anchors the signature to the
  // specific constitution version, preventing replay across forks.
  const constitutionHash = computeConstitutionHash();

  // Nonce: timestamp-based with random suffix. Unique per invocation.
  const nonce = `${Date.now()}:${crypto.randomBytes(4).toString("hex")}`;

  // Payload format: {actor_id}:{constitution_hash}:{nonce}
  // This MUST match sovereign_verify.py:verify_sovereign_signature()
  const payload = Buffer.from(`${actorId}:${constitutionHash}:${nonce}`, "utf-8");

  // Sign with Ed25519. crypto.sign(null, data, key) uses RSA-SSA-PSS default
  // when key is PEM. For Ed25519, we need to load the key explicitly.
  let signatureBytes: Buffer;
  try {
    const keyObject = crypto.createPrivateKey(privateKeyPem);
    signatureBytes = crypto.sign(null, payload, keyObject);
  } catch (signErr) {
    throw new Error(
      `SOVEREIGN SIGN FAILED: Cannot sign ${canonicalTool}. ` +
      `Error: ${signErr instanceof Error ? signErr.message : String(signErr)}. ` +
      `888_HOLD: Sovereign identity signature generation failed.`
    );
  }

  // Signature format: raw base64 (no prefix, no hex)
  // This MUST match sovereign_verify.py which does base64.b64decode(actor_signature)
  argsRecord.actor_signature = signatureBytes.toString("base64");
  argsRecord.nonce = nonce;
  argsRecord.constitution_hash = constitutionHash;
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
      const err = new Error(
        `MCP Bridge: ${actionClass} tool "${canonicalTool}" requires a governed session. ` +
        `888_HOLD: No session_id provided. Call arif_session_init first.`
      ) as Error & { error_code: string; source_layer: string };
      err.error_code = "SESSION_REQUIRED";
      err.source_layer = "A-FORGE::BRIDGE";
      throw err;
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
        const err = new Error(
          `MCP Bridge: Verdict precondition failed for "${canonicalTool}". ` +
          `${precondition.reason} ` +
          `AC_Risk: ${acRisk.toFixed(2)} | Breakers: [${circuitBreakers.join(', ')}]`
        ) as Error & { error_code: string; source_layer: string; precondition_reason: string };
        err.error_code = "VERDICT_PRECONDITION_FAILED";
        err.source_layer = "A-FORGE::BRIDGE";
        err.precondition_reason = precondition.reason;
        throw err;
      }
    } catch (err) {
      // If we can't reach arifOS for verdict check, block conservatively
      if (err instanceof Error && (err as any).error_code === 'VERDICT_PRECONDITION_FAILED') {
        throw err; // Re-throw precondition failures with structured data
      }
      if (err instanceof Error && err.message.includes('Verdict precondition failed')) {
        throw err; // Re-throw precondition failures (backward compat)
      }
      // Network errors = cautious block
      const netErr = new Error(
        `MCP Bridge: Cannot verify verdict precondition for "${canonicalTool}". ` +
        `888_HOLD: Kernel unreachable for verdict query. Action requires SEAL.`
      ) as Error & { error_code: string; source_layer: string };
      netErr.error_code = "KERNEL_UNREACHABLE";
      netErr.source_layer = "A-FORGE::BRIDGE";
      throw netErr;
    }
  }
  
  const body = transformArgs(toolName, argsRecord);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Federation-Schema-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    const netErr = new Error(
      `MCP Bridge: Network error calling ${namespace} kernel at ${url}. ` +
        `888_HOLD: Kernel unreachable. Detail: ${msg}`,
    ) as Error & { error_code: string; source_layer: string; downstream_error: string };
    netErr.error_code = "NETWORK_ERROR";
    netErr.source_layer = `A-FORGE::BRIDGE::${namespace.toUpperCase()}`;
    netErr.downstream_error = msg;
    throw netErr;
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

  // Kernel error handling — structured rejection envelope
  if (!response.ok || payload.status === "error" || payload.verdict === "HOLD") {
    const errorMsg =
      (payload.error as string) ??
      (payload.reason as string) ??
      `Kernel returned HTTP ${response.status}`;
    const floor = (payload.failed_floor as string) ?? (payload.floor as string) ?? "F13";
    const verdict = (payload.verdict as string) ?? "HOLD";
    const err = new Error(
      `MCP Bridge: Kernel error for ${canonicalTool}. ` +
        `${floor} | ${verdict} | ${errorMsg}`,
    ) as Error & { error_code: string; source_layer: string; downstream_error: string; payload: Record<string, unknown> };
    err.error_code = (payload.error_code as string) ?? "KERNEL_HOLD";
    err.source_layer = `A-FORGE::BRIDGE::${namespace.toUpperCase()}`;
    err.downstream_error = errorMsg;
    err.payload = payload;
    throw err;
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
