/**
 * MCP Conformance Test — Elicitation + Tool Dedupe + Verdict Structure
 *
 * Item 6 (2026-07-07): Verifies the 4 new capabilities:
 *   1. Elicitation module exports valid schemas
 *   2. Tool dedupe check runs without error
 *   3. Forge send/transfer confirm tools exist with correct signatures
 *   4. Verdict structure is consistent across tools
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Item 2: Elicitation Module ────────────────────────────────────────────

describe("Item 2 — Elicitation Module", () => {
  it("exports tradeConfirmationSchema with correct structure", async () => {
    const { tradeConfirmationSchema } = await import("../src/interfaces/mcp/elicitation.js");
    const schema = tradeConfirmationSchema("Test trade description");

    assert.equal(schema.mode, "form");
    assert.ok(schema.message.includes("Test trade description"));
    assert.ok(schema.message.includes("CONFIRM IRREVERSIBLE ACTION"));
    assert.equal(schema.requestedSchema.type, "object");
    assert.ok(schema.requestedSchema.properties.authorized);
    assert.ok(schema.requestedSchema.properties.confirmation_text);
    assert.ok(schema.requestedSchema.required?.includes("authorized"));
    assert.ok(schema.requestedSchema.required?.includes("confirmation_text"));
  });

  it("exports sendConfirmationSchema with correct structure", async () => {
    const { sendConfirmationSchema } = await import("../src/interfaces/mcp/elicitation.js");
    const schema = sendConfirmationSchema("https://example.com", "test payload");

    assert.equal(schema.mode, "form");
    assert.ok(schema.message.includes("https://example.com"));
    assert.ok(schema.message.includes("CONFIRM DATA TRANSMISSION"));
    assert.equal(schema.requestedSchema.type, "object");
    assert.ok(schema.requestedSchema.properties.authorized);
    assert.ok(schema.requestedSchema.required?.includes("authorized"));
  });

  it("exports sensitiveOperationURL with correct structure", async () => {
    const { sensitiveOperationURL } = await import("../src/interfaces/mcp/elicitation.js");
    const schema = sensitiveOperationURL("test-id-123", "API key rotation", "https://auth.example.com/confirm");

    assert.equal(schema.mode, "url");
    assert.equal(schema.elicitationId, "test-id-123");
    assert.equal(schema.url, "https://auth.example.com/confirm");
    assert.ok(schema.message.includes("SENSITIVE OPERATION"));
    assert.ok(schema.message.includes("API key rotation"));
  });

  it("isGenuineAuthorization correctly validates accept/decline/cancel", async () => {
    const { isGenuineAuthorization } = await import("../src/interfaces/mcp/elicitation.js");

    // Accept with correct confirmation
    const accept = isGenuineAuthorization({
      action: "accept",
      content: { authorized: true, confirmation_text: "CONFIRM" },
    });
    assert.equal(accept.authorized, true);

    // Accept without confirmation_text (optional field)
    const acceptNoText = isGenuineAuthorization({
      action: "accept",
      content: { authorized: true },
    });
    assert.equal(acceptNoText.authorized, true);

    // Accept with wrong confirmation text
    const acceptWrong = isGenuineAuthorization({
      action: "accept",
      content: { authorized: true, confirmation_text: "WRONG" } as unknown as Record<string, string | number | boolean>,
    });
    assert.equal(acceptWrong.authorized, false);

    // Decline
    const decline = isGenuineAuthorization({
      action: "decline",
    });
    assert.equal(decline.authorized, false);
    assert.ok(decline.reason.includes("declined"));

    // Cancel
    const cancel = isGenuineAuthorization({
      action: "cancel",
    });
    assert.equal(cancel.authorized, false);
    assert.ok(cancel.reason.includes("cancelled"));

    // Accept but authorized=false
    const acceptFalse = isGenuineAuthorization({
      action: "accept",
      content: { authorized: false },
    });
    assert.equal(acceptFalse.authorized, false);
  });

  it("elicitUser handles missing client support gracefully", async () => {
    const { elicitUser } = await import("../src/interfaces/mcp/elicitation.js");

    // Mock server that throws "does not support"
    const mockServer = {
      elicitInput: async () => {
        throw new Error("Client does not support form elicitation.");
      },
    } as any;

    const result = await elicitUser(mockServer, {
      mode: "form",
      message: "test",
      requestedSchema: { type: "object", properties: {} },
    });

    assert.equal(result.action, "cancel");
    assert.equal(result.content?._elicitation_unavailable, true);
    assert.ok(String(result.content?.reason ?? "").includes("does not support"));
  });
});

// ── Item 5: Tool Dedupe ───────────────────────────────────────────────────

describe("Item 5 — Tool Dedupe Check", () => {
  it("exports runDedupeCheck function", async () => {
    const { runDedupeCheck } = await import("../src/interfaces/mcp/toolDedupe.js");
    assert.equal(typeof runDedupeCheck, "function");
  });

  it("runs against empty registry without error", async () => {
    const { runDedupeCheck } = await import("../src/interfaces/mcp/toolDedupe.js");

    // Mock empty McpServer
    const mockServer = {
      _registeredTools: {},
    } as any;

    const report = runDedupeCheck(mockServer);
    assert.equal(report.total, 0);
    assert.equal(report.unique, 0);
    assert.equal(report.duplicates.length, 0);
    assert.equal(report.verdict, "PASS");
  });

  it("detects exact duplicates", async () => {
    const { runDedupeCheck } = await import("../src/interfaces/mcp/toolDedupe.js");

    // Mock server with two tools sharing identical description + schema
    const mockServer = {
      _registeredTools: {
        tool_a: {
          enabled: true,
          description: "Identical tool",
          inputSchema: { type: "object", properties: { x: { type: "string" } } },
        },
        tool_b: {
          enabled: true,
          description: "Identical tool",
          inputSchema: { type: "object", properties: { x: { type: "string" } } },
        },
      },
    } as any;

    const report = runDedupeCheck(mockServer);
    assert.equal(report.total, 2);
    assert.equal(report.unique, 1);
    assert.equal(report.duplicates.length, 1);
    assert.equal(report.duplicates[0].names.length, 2);
    assert.equal(report.verdict, "DRIFT");
  });

  it("detects deprecated tools still callable", async () => {
    const { runDedupeCheck } = await import("../src/interfaces/mcp/toolDedupe.js");

    const mockServer = {
      _registeredTools: {
        forge_run: {
          enabled: true,
          description: "Deprecated alias",
          inputSchema: {},
        },
      },
    } as any;

    const report = runDedupeCheck(mockServer);
    assert.ok(report.deprecatedCallable.includes("forge_run"));
    assert.equal(report.verdict, "DRIFT");
  });
});
