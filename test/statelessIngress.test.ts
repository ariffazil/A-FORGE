/**
 * Stateless MCP ingress validation — unit tests.
 *
 * FAILURE CLASS: the raw-HTTP tools/call path in serve.ts dispatched arguments
 * straight into the tool handler with no schema check (the stdio/SDK path does
 * check). Measured 2026-10-29:
 *   forge_verify_timeline({timeline_items:[{event:"sweep",date:"2026-10-29",source:"session"}]})
 *     → handler TypeError: Cannot read properties of undefined (reading 'length')
 *     → reported to the caller as "MCP Policy Gate engine error during pre-check"
 * The agent could not tell a typo from a broken tool from a governance refusal.
 * These tests pin the boundary answer: INVALID_PARAMS with the field path.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validateIngressArgs } from "../src/interfaces/mcp/statelessIngress.js";

const SourceSchema = z.object({
  source_id: z.string(),
  source_type: z.enum(["publication", "report", "dataset", "interview", "archive", "correspondence", "other"]),
  reliability: z.number().min(0).max(1),
  organization: z.string().optional(),
});
const TimelineItemSchema = z.object({
  event: z.string(),
  date: z.string(),
  sources: z.array(SourceSchema).min(1),
});
const shape = {
  timeline_items: z.array(TimelineItemSchema).min(1),
  min_sources: z.number().int().min(1).max(10).default(2),
  require_independent: z.boolean().default(true),
};
// serve.ts hands the validator the registry's inputSchema; registry entries carry
// a ZodObject built from the raw shape, so both forms are exercised here.
const schemaObj = z.object(shape);

test("valid payload proceeds (null = no verdict)", () => {
  const args = { timeline_items: [{ event: "x", date: "2026-10-29", sources: [{ source_id: "s1", source_type: "report", reliability: 0.9 }] }] };
  assert.equal(validateIngressArgs(schemaObj, args), null);
  assert.equal(validateIngressArgs({ shape }, args), null, "raw-shape form must behave identically");
});

test("the measured failure now names the field path instead of crashing downstream", () => {
  const issues = validateIngressArgs(schemaObj, { timeline_items: [{ event: "sweep", date: "2026-10-29", source: "session" }] });
  assert.ok(issues, "expected a verdict");
  assert.equal(issues!.length, 1);
  assert.equal(issues![0].path, "timeline_items.0.sources");
});

test("empty required array is caught at the array, not inside the handler loop", () => {
  const issues = validateIngressArgs(schemaObj, { timeline_items: [] });
  assert.ok(issues);
  assert.equal(issues![0].path, "timeline_items");
});

test("unknown extra keys are NOT rejected — matches runtime behaviour today", () => {
  // Measured 2026-10-29: extra keys passed both transports and were silently
  // ignored, so this validator must not become a secret strictness upgrade.
  const args = {
    timeline_items: [{ event: "x", date: "d", sources: [{ source_id: "s", source_type: "report", reliability: 0.5, zzz: 1 }], bogus: true }],
    zzz_top_level: true,
  };
  assert.equal(validateIngressArgs(schemaObj, args), null);
});

test("A-FORGE-internal underscore keys are ignored, not treated as agent garbage", () => {
  // serve.ts injects _user_input and _mcp_session_id after the agent's payload.
  const args = { timeline_items: [{ event: "x", date: "d", sources: [{ source_id: "s", source_type: "report", reliability: 0.5 }] }], _user_input: "status", _mcp_session_id: "abc" };
  assert.equal(validateIngressArgs(schemaObj, args), null);
});

test("non-object arguments are refused at the root", () => {
  const issues = validateIngressArgs(schemaObj, "forge_verify_timeline" as any);
  assert.ok(issues);
  assert.equal(issues![0].path, "(root)");
});

test("nothing declared → no verdict (never invent an error)", () => {
  assert.equal(validateIngressArgs(undefined, { anything: true }), null);
  assert.equal(validateIngressArgs({}, { anything: true }), null);
});

test("deprecated stub schema (z.object({})) accepts any payload unchanged", () => {
  assert.equal(validateIngressArgs(z.object({}), { url: "https://x", mode: "read" }), null);
});

test("type errors are reported per field", () => {
  const issues = validateIngressArgs(schemaObj, { timeline_items: [{ event: 42, date: "d", sources: [{ source_id: "s", source_type: "not-a-type", reliability: 5 }] }] });
  assert.ok(issues);
  const paths = issues!.map(i => i.path).sort();
  assert.deepEqual(paths, ["timeline_items.0.event", "timeline_items.0.sources.0.reliability", "timeline_items.0.sources.0.source_type"]);
});
