/**
 * MCP Bridge Client — Federation Memory Bridge
 *
 * Routes tool calls from A-FORGE TypeScript runtime to arifOS / WEALTH / GEOX
 * Python MCP kernels via HTTP REST surfaces.
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
