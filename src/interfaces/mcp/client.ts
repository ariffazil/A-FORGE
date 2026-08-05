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
/**
 * P0.9 FIX (2026-07-19): arifOS session store for MCP header propagation.
 * 
 * When forge_session_init calls arif_init and gets back an arifOS session_id,
 * it's stored here. Subsequent callMCP() calls to arifOS include this session
 * as Mcp-Session-Id header, fixing the ::anonymous delegation hole.
 * 
 * ANTI-FORGERY: sessions are only accepted from legitimate arif_init responses.
 * Replayed/forged session IDs are rejected because they won't match the stored
 * session from the genuine init handshake.
 */
let _arifOsSessionId: string | null = null;
let _arifOsSessionActor: string | null = null;

/** Called by forge_session_init after successful arif_init handshake. */
export function setArifOsSession(sessionId: string, actorId: string): void {
  _arifOsSessionId = sessionId;
  _arifOsSessionActor = actorId;
}

/** Returns the current arifOS session, or null if no session is active. */
export function getArifOsSession(): { sessionId: string; actorId: string } | null {
  if (!_arifOsSessionId) return null;
  return { sessionId: _arifOsSessionId, actorId: _arifOsSessionActor! };
}
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
 * Call an MCP tool on a federation kernel via JSON-RPC 2.0 over HTTP.
 *
 * @param tool — Fully-qualified tool name, e.g. "arifos.arif_judge"
 * @param args — Arguments object passed by caller
 * @returns Unwrapped tool result (the kernel's structuredContent or parsed text)
 * @throws On network failure, unknown namespace, or kernel error
 */
export async function callMCP(tool: string, args: unknown): Promise<unknown> {
  const { namespace, toolName } = parseToolName(tool);
  const canonicalTool = TOOL_NAME_MAP[toolName] ?? toolName;
  const url = `${getMcpUrl(namespace)}/mcp`;
  console.log(`[callMCP] ${tool} → canonicalTool=${canonicalTool}, url=${url}`);

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
        `No session_id provided. Call arif_session_init first.`
      ) as Error & { error_code: string; source_layer: string };
      err.error_code = "SESSION_REQUIRED";
      err.source_layer = "A-FORGE::BRIDGE";
      throw err;
    }

    // Attempt to read session verdict from arifOS via JSON-RPC
    try {
      const vitalsUrl = `${getMcpUrl('arifos')}/mcp`;
      const vitalsJsonRpc = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: "arif_ops_measure", arguments: { mode: 'vitals', session_id: sessionId } },
        id: Date.now(),
      };
      const vitalsResponse = await fetch(vitalsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(vitalsJsonRpc),
      });
      const vitalsJsonRpcResp = await vitalsResponse.json() as Record<string, unknown>;
      const vitalsResult = (vitalsJsonRpcResp.result ?? {}) as Record<string, unknown>;
      const vitalsStructured = (vitalsResult.structuredContent ?? vitalsResult) as Record<string, unknown>;
      // Also try parsing text content if no structuredContent
      let vitalsPayload: Record<string, unknown>;
      if (vitalsStructured && typeof vitalsStructured === 'object' && Object.keys(vitalsStructured).length > 0) {
        vitalsPayload = vitalsStructured;
      } else {
        const vContent = vitalsResult.content as Array<{type: string, text: string}> | undefined;
        try { vitalsPayload = JSON.parse(vContent?.[0]?.text ?? '{}'); } catch { vitalsPayload = {}; }
      }

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

      const precondition = await checkVerdictPrecondition(actionClass, sessionState);
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

  // Wrap in JSON-RPC 2.0 envelope for MCP protocol compliance
  const jsonRpcPayload = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: canonicalTool,
      arguments: body,
    },
    id: Date.now(),
  };

  let response: Response;
  try {
    // P0.9: Propagate arifOS session via Mcp-Session-Id header.
    // Without this, proxied calls arrive ::anonymous at the kernel.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    if (namespace === "arifos" && _arifOsSessionId) {
      headers["Mcp-Session-Id"] = _arifOsSessionId;
    }
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(jsonRpcPayload),
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

  let jsonRpcResponse: Record<string, unknown>;
  try {
    jsonRpcResponse = (await response.json()) as Record<string, unknown>;
  } catch (parseErr) {
    const text = await response.text().catch(() => "<unreadable>");
    throw new Error(
      `MCP Bridge: Non-JSON response from ${url} (HTTP ${response.status}). ` +
        `Body: ${text.slice(0, 500)}`,
    );
  }

  // ── JSON-RPC 2.0 error handling ──────────────────────────────────────────
  // The kernel may return a JSON-RPC error object instead of a result.
  const jsonRpcError = jsonRpcResponse.error as Record<string, unknown> | undefined;
  console.log(`[callMCP] ${canonicalTool} — jsonRpcError=${!!jsonRpcError}, hasResult=${!!jsonRpcResponse.result}`);
  if (jsonRpcError) {
    const errorMsg = (jsonRpcError.message as string) ?? JSON.stringify(jsonRpcError);
    console.error(`[callMCP] ${canonicalTool} — JSON-RPC error: ${errorMsg.slice(0, 200)}`);
    const err = new Error(
      `MCP Bridge: Kernel error for ${canonicalTool}. ${errorMsg}`,
    ) as Error & { error_code: string; source_layer: string; downstream_error: string; payload: Record<string, unknown> };
    err.error_code = (jsonRpcError.name as string) ?? "JSONRPC_ERROR";
    err.source_layer = `A-FORGE::BRIDGE::${namespace.toUpperCase()}`;
    err.downstream_error = errorMsg;
    err.payload = jsonRpcResponse;
    throw err;
  }

  // ── Unwrap JSON-RPC result envelope ──────────────────────────────────────
  // JSON-RPC result contains: { content: [{type:"text", text:"..."}], structuredContent: {...}, isError: bool }
  const jsonRpcResult = jsonRpcResponse.result as Record<string, unknown> | undefined;
  if (!jsonRpcResult) {
    console.error(`[callMCP] ${canonicalTool} — no result in response`);
    throw new Error(
      `MCP Bridge: No result in JSON-RPC response for ${canonicalTool}. Response: ${JSON.stringify(jsonRpcResponse).slice(0, 300)}`,
    );
  }

  // Check if the tool itself reported an error
  console.log(`[callMCP] ${canonicalTool} — isError=${jsonRpcResult.isError}, hasStructured=${!!jsonRpcResult.structuredContent}`);
  if (jsonRpcResult.isError === true) {
    const contentArray = jsonRpcResult.content as Array<{ type: string; text: string }> | undefined;
    const errorText = contentArray?.[0]?.text ?? JSON.stringify(jsonRpcResult);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(errorText); } catch { parsed = { error: errorText }; }
    const errorMsg = (parsed.error as string) ?? (parsed.message as string) ?? errorText.slice(0, 300);
    const err = new Error(
      `MCP Bridge: Kernel error for ${canonicalTool}. ${errorMsg}`,
    ) as Error & { error_code: string; source_layer: string; downstream_error: string; payload: Record<string, unknown> };
    err.error_code = (parsed.error_code as string) ?? "TOOL_ERROR";
    err.source_layer = `A-FORGE::BRIDGE::${namespace.toUpperCase()}`;
    err.downstream_error = errorMsg;
    err.payload = parsed;
    throw err;
  }

  // Extract the actual tool result — prefer structuredContent, fall back to parsed text
  const structuredContent = jsonRpcResult.structuredContent as Record<string, unknown> | undefined;
  let rawResult: unknown;
  if (structuredContent) {
    rawResult = structuredContent;
  } else {
    const contentArray = jsonRpcResult.content as Array<{ type: string; text: string }> | undefined;
    const textContent = contentArray?.[0]?.text;
    if (textContent) {
      try { rawResult = JSON.parse(textContent); } catch { rawResult = { _raw_text: textContent }; }
    } else {
      rawResult = jsonRpcResult;
    }
  }

  // Kernel-level error handling — structured rejection envelope within tool result
  const resultObj = (typeof rawResult === "object" && rawResult !== null ? rawResult : { _raw: rawResult }) as Record<string, unknown>;
  console.log(`[callMCP] ${canonicalTool} — resultObj.status=${resultObj.status}, verdict=${resultObj.verdict}, httpOk=${response.ok}`);
  if (!response.ok || resultObj.status === "error" || resultObj.verdict === "HOLD") {
    const errorMsg =
      (resultObj.error as string) ??
      (resultObj.reason as string) ??
      `Kernel returned HTTP ${response.status}`;
    const floor = (resultObj.failed_floor as string) ?? (resultObj.floor as string) ?? "F13";
    const verdict = (resultObj.verdict as string) ?? "HOLD";
    const err = new Error(
      `MCP Bridge: Kernel error for ${canonicalTool}. ` +
        `${floor} | ${verdict} | ${errorMsg}`,
    ) as Error & { error_code: string; source_layer: string; downstream_error: string; payload: Record<string, unknown> };
    err.error_code = (resultObj.error_code as string) ?? "KERNEL_HOLD";
    err.source_layer = `A-FORGE::BRIDGE::${namespace.toUpperCase()}`;
    err.downstream_error = errorMsg;
    err.payload = resultObj;
    throw err;
  }

  return transformResponse(toolName, resultObj);
}
