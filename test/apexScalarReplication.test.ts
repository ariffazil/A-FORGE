/**
 * Apex Scalar Replication — fetchApexScalars() tests
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests GovernanceBridge.fetchApexScalars() against a mock HTTP server
 * that simulates arifOS /health responses.
 *
 * Cases:
 *   1. Full response — all 5 scalars replicated with status "REPLICATED"
 *   2. arifOS unreachable — graceful null fallback
 *   3. Partial response — only some scalars present, rest null
 *   4. Status field is "REPLICATED" not "MEASURED" (F2 + F7 provenance)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { GovernanceBridge, type ScalarReplica } from "../src/domain/governance/GovernanceBridge.js";

/** Spin up a mock arifOS /health endpoint on an ephemeral port. */
function startMockArifOS(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ server: http.Server; port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        server,
        port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

describe("Apex Scalar Replication — fetchApexScalars()", () => {
  let mockServer: { server: http.Server; port: number; close: () => Promise<void> } | null = null;

  afterEach(async () => {
    if (mockServer) {
      await mockServer.close();
      mockServer = null;
    }
  });

  // ── CASE 1: Full response ──────────────────────────────────────────
  it("full response — all 5 scalars replicated with correct values", async () => {
    mockServer = await startMockArifOS((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        apex_scalars: {
          G:      { value: 0.4714, status: "MEASURED" },
          C_dark: { value: 0.1225, status: "MEASURED" },
          W3:     { value: 0.7439, status: "MEASURED" },
          h:      { value: 0.7669, status: "MEASURED" },
          QDF:    { value: 0.4137, status: "MEASURED" },
        },
      }));
    });

    const bridge = new GovernanceBridge({
      baseUrl: `http://127.0.0.1:${mockServer.port}`,
      timeoutMs: 3000,
    });

    const result = await bridge.fetchApexScalars();
    assert.ok(result, "fetchApexScalars should return non-null");

    assert.ok(result.G, "G should be non-null");
    assert.strictEqual(result.G!.value, 0.4714);
    assert.strictEqual(result.G!.status, "REPLICATED");
    assert.strictEqual(result.G!.source, "arifos.health");

    assert.ok(result.C_dark, "C_dark should be non-null");
    assert.strictEqual(result.C_dark!.value, 0.1225);

    assert.ok(result.W3, "W3 should be non-null");
    assert.strictEqual(result.W3!.value, 0.7439);

    assert.ok(result.h, "h should be non-null");
    assert.strictEqual(result.h!.value, 0.7669);

    assert.ok(result.QDF, "QDF should be non-null");
    assert.strictEqual(result.QDF!.value, 0.4137);

    assert.strictEqual(result.source, "arifos.health");
    assert.ok(typeof result.fetched_at === "string");
  });

  // ── CASE 2: arifOS unreachable ─────────────────────────────────────
  it("arifOS unreachable — returns null (graceful degradation)", async () => {
    // Use a port that's definitely not listening
    const bridge = new GovernanceBridge({
      baseUrl: "http://127.0.0.1:1", // port 1 — nothing there
      timeoutMs: 500,
    });

    const result = await bridge.fetchApexScalars();
    assert.strictEqual(result, null, "Should return null when arifOS is unreachable");
  });

  // ── CASE 3: Partial response ───────────────────────────────────────
  it("partial response — only available scalars are non-null", async () => {
    mockServer = await startMockArifOS((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        apex_scalars: {
          G:   { value: 0.5, status: "MEASURED" },
          W3:  { value: 0.8, status: "MEASURED" },
          // C_dark, h, QDF are missing
        },
      }));
    });

    const bridge = new GovernanceBridge({
      baseUrl: `http://127.0.0.1:${mockServer.port}`,
      timeoutMs: 3000,
    });

    const result = await bridge.fetchApexScalars();
    assert.ok(result, "fetchApexScalars should return non-null (server responded)");

    assert.ok(result.G, "G should be non-null");
    assert.strictEqual(result.G!.value, 0.5);

    assert.strictEqual(result.C_dark, null, "C_dark should be null (not in response)");
    assert.strictEqual(result.h, null, "h should be null (not in response)");
    assert.strictEqual(result.QDF, null, "QDF should be null (not in response)");

    assert.ok(result.W3, "W3 should be non-null");
    assert.strictEqual(result.W3!.value, 0.8);
  });

  // ── CASE 4: Status is "REPLICATED" not "MEASURED" ──────────────────
  it("status field is REPLICATED, never MEASURED (F2 + F7 provenance)", async () => {
    mockServer = await startMockArifOS((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        apex_scalars: {
          G:      { value: 0.4714, status: "MEASURED" },
          C_dark: { value: 0.1225, status: "MEASURED" },
          W3:     { value: 0.7439, status: "MEASURED" },
          h:      { value: 0.7669, status: "MEASURED" },
          QDF:    { value: 0.4137, status: "MEASURED" },
        },
      }));
    });

    const bridge = new GovernanceBridge({
      baseUrl: `http://127.0.0.1:${mockServer.port}`,
      timeoutMs: 3000,
    });

    const result = await bridge.fetchApexScalars();
    assert.ok(result);

    // Even though arifOS reports status: "MEASURED", A-FORGE must report "REPLICATED"
    const keys = ["G", "C_dark", "W3", "h", "QDF"] as const;
    for (const key of keys) {
      const scalar: ScalarReplica | null = result[key];
      assert.ok(scalar, `${key} should be non-null`);
      assert.strictEqual(
        scalar!.status,
        "REPLICATED",
        `${key} status must be "REPLICATED", not "MEASURED"`,
      );
      assert.notStrictEqual(scalar!.status, "MEASURED");
      assert.strictEqual(scalar!.source, "arifos.health");
    }
  });

  // ── CASE 5: Non-200 response — returns null ────────────────────────
  it("non-200 HTTP response — returns null (graceful degradation)", async () => {
    mockServer = await startMockArifOS((_req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal server error" }));
    });

    const bridge = new GovernanceBridge({
      baseUrl: `http://127.0.0.1:${mockServer.port}`,
      timeoutMs: 3000,
    });

    const result = await bridge.fetchApexScalars();
    assert.strictEqual(result, null, "Should return null on HTTP 500");
  });

  // ── CASE 6: Missing apex_scalars key entirely ──────────────────────
  it("missing apex_scalars key — returns null", async () => {
    mockServer = await startMockArifOS((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    });

    const bridge = new GovernanceBridge({
      baseUrl: `http://127.0.0.1:${mockServer.port}`,
      timeoutMs: 3000,
    });

    const result = await bridge.fetchApexScalars();
    assert.strictEqual(result, null, "Should return null when apex_scalars key is absent");
  });

  // ── CASE 7: Non-numeric value is treated as null ───────────────────
  it("non-numeric value (null) in scalar — that scalar returns null", async () => {
    mockServer = await startMockArifOS((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        apex_scalars: {
          G:      { value: 0.4714, status: "MEASURED" },
          C_dark: { value: null, status: "UNMEASURED" },
          W3:     { value: 0.7439, status: "MEASURED" },
          h:      { value: null, status: "UNMEASURED" },
          QDF:    { value: 0.4137, status: "MEASURED" },
        },
      }));
    });

    const bridge = new GovernanceBridge({
      baseUrl: `http://127.0.0.1:${mockServer.port}`,
      timeoutMs: 3000,
    });

    const result = await bridge.fetchApexScalars();
    assert.ok(result);
    assert.ok(result.G, "G should be replicated");
    assert.strictEqual(result.C_dark, null, "C_dark value is null → scalar should be null");
    assert.strictEqual(result.h, null, "h value is null → scalar should be null");
    assert.ok(result.QDF, "QDF should be replicated");
  });
});
