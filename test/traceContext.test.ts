/**
 * Causal trace context — P5 adversarial tests.
 * Tests: root creation, child span continuity, parallel siblings,
 * missing parent rejection, W3C traceparent compatibility.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createRootTrace,
  createChildSpan,
  parseTraceparent,
  formatTraceparent,
  validateTraceForCall,
  resolveTraceContext,
  injectTraceIntoMeta,
} from "../src/infrastructure/causality/traceContext.js";

describe("TraceContext — root creation", () => {
  it("creates root with unique trace_id and span_id", () => {
    const root = createRootTrace();
    assert.ok(root.trace_id.length >= 32);
    assert.ok(root.span_id.length === 16);
    assert.equal(root.parent_span_id, null);
    assert.equal(root.baggage.caller, undefined);
  });

  it("creates root with caller baggage", () => {
    const root = createRootTrace("hermes");
    assert.equal(root.baggage.caller, "hermes");
  });

  it("each root has unique trace_id", () => {
    const a = createRootTrace();
    const b = createRootTrace();
    assert.notEqual(a.trace_id, b.trace_id);
    assert.notEqual(a.span_id, b.span_id);
  });
});

describe("TraceContext — child span continuity", () => {
  it("child inherits parent trace_id", () => {
    const parent = createRootTrace();
    const child = createChildSpan(parent);
    assert.ok("trace_id" in child);
    if ("trace_id" in child) {
      assert.equal(child.trace_id, parent.trace_id);
      assert.notEqual(child.span_id, parent.span_id);
      assert.equal(child.parent_span_id, parent.span_id);
    }
  });

  it("child gets new span_id", () => {
    const parent = createRootTrace();
    const child = createChildSpan(parent);
    if ("trace_id" in child) {
      assert.notEqual(child.span_id, parent.span_id);
    }
  });

  it("child records parent_span_id correctly", () => {
    const parent = createRootTrace();
    const child = createChildSpan(parent);
    if ("trace_id" in child) {
      assert.equal(child.parent_span_id, parent.span_id);
    }
  });

  it("nested grandchild continuity", () => {
    const root = createRootTrace();
    const child = createChildSpan(root);
    if ("error" in child) throw new Error(child.error);
    const grandchild = createChildSpan(child);
    if ("error" in grandchild) throw new Error(grandchild.error);
    assert.equal(grandchild.trace_id, root.trace_id);
    assert.equal(grandchild.parent_span_id, child.span_id);
    assert.notEqual(grandchild.span_id, root.span_id);
    assert.notEqual(grandchild.span_id, child.span_id);
  });

  it("parallel siblings share trace_id but not span_id", () => {
    const root = createRootTrace();
    const sib1 = createChildSpan(root, "sibling-1");
    const sib2 = createChildSpan(root, "sibling-2");
    if ("error" in sib1) throw new Error(sib1.error);
    if ("error" in sib2) throw new Error(sib2.error);
    assert.equal(sib1.trace_id, sib2.trace_id);
    assert.notEqual(sib1.span_id, sib2.span_id);
    assert.equal(sib1.parent_span_id, root.span_id);
    assert.equal(sib2.parent_span_id, root.span_id);
  });
});

describe("TraceContext — error handling", () => {
  it("rejects child without parent span_id", () => {
    const badParent = { trace_id: "abc", span_id: "", parent_span_id: null, baggage: {}, created_at: "" };
    const child = createChildSpan(badParent);
    if ("error" in child) {
      assert.ok(child.error.includes("PARENT_SPAN_MISSING"));
    } else {
      assert.fail("Should have returned error");
    }
  });

  it("rejects child without parent trace_id", () => {
    const badParent = { trace_id: "", span_id: "abcd1234abcd1234", parent_span_id: null, baggage: {}, created_at: "" };
    const child = createChildSpan(badParent);
    if ("error" in child) {
      assert.ok(child.error.includes("PARENT_TRACE_MISSING"));
    } else {
      assert.fail("Should have returned error");
    }
  });
});

describe("TraceContext — validation", () => {
  it("validates complete trace context", () => {
    const ctx = createRootTrace();
    const r = validateTraceForCall(ctx, true);
    assert.equal(r.ok, true);
  });

  it("rejects missing trace context when required", () => {
    const r = validateTraceForCall(null, true);
    assert.equal(r.ok, false);
    assert.ok(r.error?.includes("TRACE_MISSING"));
  });

  it("allows missing trace context when not required", () => {
    const r = validateTraceForCall(null, false);
    assert.equal(r.ok, true);
  });

  it("rejects short trace_id", () => {
    const bad = { trace_id: "short", span_id: "abcd1234abcd1234", parent_span_id: null, baggage: {}, created_at: "" };
    const r = validateTraceForCall(bad, true);
    assert.equal(r.ok, false);
    assert.ok(r.error?.includes("INVALID_TRACE_ID"));
  });

  it("rejects short span_id", () => {
    const bad = { trace_id: "abcdef1234567890abcdef1234567890", span_id: "short", parent_span_id: null, baggage: {}, created_at: "" };
    const r = validateTraceForCall(bad, true);
    assert.equal(r.ok, false);
    assert.ok(r.error?.includes("INVALID_SPAN_ID"));
  });
});

describe("TraceContext — W3C traceparent", () => {
  it("parses valid traceparent header", () => {
    const tp = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
    const ctx = parseTraceparent(tp);
    assert.ok(ctx);
    if (ctx) {
      assert.equal(ctx.trace_id, "0af7651916cd43dd8448eb211c80319c");
      assert.equal(ctx.span_id, "b7ad6b7169203331");
    }
  });

  it("rejects malformed traceparent", () => {
    assert.equal(parseTraceparent("bad-header"), null);
    assert.equal(parseTraceparent(""), null);
  });

  it("formats valid traceparent", () => {
    const ctx = createRootTrace();
    const tp = formatTraceparent(ctx);
    assert.ok(tp.startsWith("00-"));
    assert.equal(tp.length, 55);
  });

  it("resolveTraceContext prefers traceparent header", () => {
    const ctx = resolveTraceContext({}, { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" });
    assert.equal(ctx.trace_id, "0af7651916cd43dd8448eb211c80319c");
    assert.equal(ctx.span_id, "b7ad6b7169203331");
  });
});

describe("TraceContext — injection", () => {
  it("injects trace into meta object", () => {
    const ctx = createRootTrace();
    const target: Record<string, unknown> = {};
    injectTraceIntoMeta(ctx, target);
    const trace = (target as any)._trace;
    assert.ok(trace);
    assert.equal(trace.trace_id, ctx.trace_id);
    assert.equal(trace.span_id, ctx.span_id);
    assert.equal(trace.parent_span_id, ctx.parent_span_id);
  });
});

describe("TraceContext — full federation chain", () => {
  it("trace survives AAA → arifOS → A-FORGE → VAULT999 chain", () => {
    // AAA creates root
    const aaaRoot = createRootTrace("AAA-gateway");
    // arifOS receives and creates child
    const arifosSpan = createChildSpan(aaaRoot, "arifOS-judge");
    if ("error" in arifosSpan) throw new Error(arifosSpan.error);
    // A-FORGE receives and creates child
    const aforgeSpan = createChildSpan(arifosSpan, "A-FORGE-execute");
    if ("error" in aforgeSpan) throw new Error(aforgeSpan.error);
    // VAULT999 receives and creates child (the seal)
    const vaultSpan = createChildSpan(aforgeSpan, "VAULT999-seal");
    if ("error" in vaultSpan) throw new Error(vaultSpan.error);

    // All share the same trace_id
    assert.equal(arifosSpan.trace_id, aaaRoot.trace_id);
    assert.equal(aforgeSpan.trace_id, aaaRoot.trace_id);
    assert.equal(vaultSpan.trace_id, aaaRoot.trace_id);

    // Chain verification: each parent_span_id points to the previous span
    assert.equal(arifosSpan.parent_span_id, aaaRoot.span_id);
    assert.equal(aforgeSpan.parent_span_id, arifosSpan.span_id);
    assert.equal(vaultSpan.parent_span_id, aforgeSpan.span_id);

    // All spans are unique
    const spans = new Set([aaaRoot.span_id, arifosSpan.span_id, aforgeSpan.span_id, vaultSpan.span_id]);
    assert.equal(spans.size, 4);
  });
});
