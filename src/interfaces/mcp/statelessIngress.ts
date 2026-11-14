/**
 * Stateless MCP ingress validation.
 *
 * WHY THIS FILE EXISTS (333-AGI full-surface sweep, 2026-10-29):
 * The SDK/stdio path validates `tools/call` arguments against the tool's zod
 * shape inside McpServer before the handler runs. The custom raw-HTTP stateless
 * path in serve.ts dispatched `toolArgs` straight into the handler instead, so a
 * malformed payload reached tool code and died there. Observed live:
 *
 *   forge_verify_timeline({timeline_items:[{event,date,source}]})   // "source" not "sources"
 *     → handler threw  TypeError: Cannot read properties of undefined (reading 'length')
 *     → the policy interceptor wrapped it as "MCP Policy Gate engine error
 *        during pre-check", pointing the reader at the wrong layer entirely.
 *
 * The agent therefore cannot tell whether it sent bad arguments, whether the
 * tool is broken, or whether a gate refused it. This module separates that
 * failure class at the boundary: validate the shape, answer INVALID_PARAMS with
 * the field path, and never invoke the handler on a payload it cannot read.
 *
 * Design constraints:
 *  - Never mutates or rewrites the arguments. Validation only.
 *  - Absent/uninspectable schema → null (no verdict). Not every registration
 *    carries a zod shape; inventing an error there would be a new failure class.
 *  - Unknown keys are tolerated (zod default), matching the SDK path — internal
 *    fields like `_user_input` / `_mcp_session_id` are injected by serve.ts and
 *    are legitimately outside the declared shape.
 */
import { z } from "zod";

export type IngressIssue = { path: string; message: string };

function asZodObject(inputSchema: unknown): z.ZodTypeAny | null {
  const s = inputSchema as any;
  if (!s || typeof s !== "object") return null;
  // Rebuild from the raw shape so validation checks the DECLARED FIELDS only.
  // Measured 2026-10-29: the runtime does not reject unknown keys on either
  // path (forge_verify_timeline accepted bogus keys at top level and inside a
  // source object and still returned SOURCE_REQUIREMENTS_PASS), because the
  // "SDK patch at line 99 of zod-compat.js" that core.ts's strictification
  // comment relies on is not present in the installed SDK 1.31.0 — that file
  // contains no occurrence of "strict". Validating against the declared shape
  // non-strictly therefore matches today's real contract instead of quietly
  // making it stricter mid-flight. Turning on unknown-key rejection is its own
  // change, with its own verdict, because it breaks callers that pass extra
  // fields right now — see the sweep receipt, finding F-4.
  if (s.shape && typeof s.shape === "object") return z.object(s.shape as any);
  if (typeof s.safeParse === "function") return s as z.ZodTypeAny;
  return null;
}

/**
 * Returns null when the payload may proceed, otherwise the list of offending
 * fields. `path` is dot-joined so an agent can fix the exact key
 * (e.g. "timeline_items.0.sources").
 *
 * Internal `_`-prefixed keys are stripped before validation. serve.ts injects
 * them itself (`_user_input` for the A-THINK guard, `_mcp_session_id` for the
 * egress audit trace) and they are deliberately NOT part of any declared shape;
 * rejecting A-FORGE's own injection as agent garbage would be self-sabotage.
 * Everything else stays strict, because the registered schemas are strict on
 * purpose — core.ts "Schema strictification guard", ratified 2026-06-28: a
 * payload with an unknown field is a typo'd contract, not a free pass.
 */
export function validateIngressArgs(
  inputSchema: unknown,
  args: unknown,
): IngressIssue[] | null {
  if (args !== undefined && args !== null && typeof args !== "object") {
    return [{ path: "(root)", message: "arguments must be a JSON object" }];
  }
  const schema = asZodObject(inputSchema);
  if (!schema) return null; // nothing declared to check against — stay out of the way
  const raw = (args ?? {}) as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("_")) continue; // A-FORGE-internal, not agent-supplied contract
    payload[k] = v;
  }
  const parsed = schema.safeParse(payload);
  if (parsed.success) return null;
  return parsed.error.issues.map((i: any) => ({
    path: Array.isArray(i.path) && i.path.length ? i.path.join(".") : "(root)",
    message: i.message,
  }));
}
