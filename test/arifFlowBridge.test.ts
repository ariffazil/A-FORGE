/**
 * arifFlowBridge.test.ts — P1-5 canary tests.
 *
 * Verifies: canonical receipt shape posted to /ingest, fail-open behavior
 * when the daemon is unreachable, and ARIFFLOW_URL=off kill-switch.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  emitFlowReceipt,
  arifFlowEnabled,
} from "../src/infrastructure/bridges/arifFlowBridge.js";

interface Sink {
  server: http.Server;
  url: string;
  bodies: { url: string | undefined; body: Record<string, unknown> }[];
}

function startSink(): Promise<Sink> {
  return new Promise((resolve) => {
    const bodies: Sink["bodies"] = [];
    const server = http.createServer((req, res) => {
      let buf = "";
      req.on("data", (c: Buffer) => (buf += c.toString()));
      req.on("end", () => {
        bodies.push({
          url: req.url,
          body: JSON.parse(buf || "{}") as Record<string, unknown>,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", actor: "test" }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${addr.port}`, bodies });
    });
  });
}

test("emitFlowReceipt posts canonical receipt shape to /ingest", async () => {
  const prev = process.env.ARIFFLOW_URL;
  const sink = await startSink();
  process.env.ARIFFLOW_URL = sink.url;
  try {
    const r = await emitFlowReceipt({
      step_type: "Execute",
      actor_id: "aforge",
      session_id: "SEAL-test00000000ff",
      cost_ns: 1234,
      floor_verdict: "Pass",
      payload: { tool: "forge_shell", exit_code: 0 },
    });
    assert.equal(r.ok, true);
    assert.equal(sink.bodies.length, 1);
    const { url, body } = sink.bodies[0];
    assert.equal(url, "/ingest");
    assert.equal(body.actor_id, "aforge");
    assert.equal(body.session_id, "SEAL-test00000000ff");
    assert.equal(body.step_type, "Execute");
    assert.equal(body.epistemic_label, "Observation");
    assert.equal(body.floor_verdict, "Pass");
    assert.equal(body.cooling_decision, "None");
    assert.equal(body.cost_ns, 1234);
    assert.equal(body.step_number, 1);
    assert.ok(typeof body.receipt_id === "string" && body.receipt_id.length > 0);
    assert.ok(!Number.isNaN(Date.parse(body.created_at as string)));
    assert.deepEqual(body.payload, { tool: "forge_shell", exit_code: 0 });
  } finally {
    process.env.ARIFFLOW_URL = prev;
    sink.server.close();
  }
});

test("emitFlowReceipt fails open when arifFlow is unreachable", async () => {
  const prev = process.env.ARIFFLOW_URL;
  process.env.ARIFFLOW_URL = "http://127.0.0.1:1"; // nothing listens here
  try {
    const r = await emitFlowReceipt({
      step_type: "Execute",
      actor_id: "aforge",
      session_id: "s",
      cost_ns: 1,
    });
    // Must RESOLVE (never reject) and report failure honestly.
    assert.equal(r.ok, false);
    assert.notEqual(r.status, "ingested");
  } finally {
    process.env.ARIFFLOW_URL = prev;
  }
});

test("ARIFFLOW_URL=off disables emission", async () => {
  const prev = process.env.ARIFFLOW_URL;
  process.env.ARIFFLOW_URL = "off";
  try {
    assert.equal(arifFlowEnabled(), false);
    const r = await emitFlowReceipt({
      step_type: "Execute",
      actor_id: "aforge",
      session_id: "s",
      cost_ns: 1,
    });
    assert.equal(r.status, "disabled");
  } finally {
    process.env.ARIFFLOW_URL = prev;
  }
});
