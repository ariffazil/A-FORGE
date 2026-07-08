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

import { verdict, sealVerdict, errorVerdict, type VerdictEnvelope } from "./verdict-envelope.js";

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
 */
function determineStatus(raw: any): "SEAL" | "ERROR" {
  if (!raw) return "ERROR";
  if (raw.isError === true) return "ERROR";
  if (raw.error) return "ERROR";
  if (raw.status === "ERROR" || raw.status === "VOID" || raw.status === "HOLD") {
    return "ERROR";
  }
  return "SEAL";
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
  const message = status === "SEAL" ? `${toolName} completed` : `${toolName} failed`;

  if (status === "SEAL") {
    return sealVerdict(data ?? {}, message, { tool: toolName, actor, duration_ms });
  }
  return errorVerdict(message, { tool: toolName, actor, data: data as Record<string, unknown> ?? { raw } });
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
        return {
          content: [{ type: "text" as const, text: JSON.stringify(envelope, null, 2) }],
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
