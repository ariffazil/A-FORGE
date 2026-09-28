/**
 * A2A non-ownership guard.
 *
 * History: this file used to assert the opposite — that A-FORGE served an A2A
 * agent card, handled SendMessage and ran a task lifecycle. Those three tests
 * went red in the June hexagonal reorg (f24b81cc) when the A2A surface moved to
 * AAA as the sole gateway, and nobody noticed because the file is not in the
 * `npm test` list. The tests were not the bug. The bug was that /contract and the
 * startup banner kept advertising GET /.well-known/agent-card.json while the
 * router had already removed it — a machine-readable bridge contract pointing at
 * an endpoint that cannot answer.
 *
 * So these tests pin the boundary instead of the old behaviour: A-FORGE must not
 * serve A2A, and must not claim to.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type express from "express";
import { createApp } from "../src/interfaces/server.js";
import { shutdownPersonalOS } from "../src/application/personal-v2/index.js";

function listenOnce(
  app: express.Express,
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((res) => {
            if (typeof server.closeAllConnections === "function") {
              server.closeAllConnections();
            }
            server.close(() => res());
          }),
      });
    });
  });
}

test("A-FORGE does not serve an A2A surface", async () => {
  const { url, close } = await listenOnce(createApp());
  try {
    const card = await fetch(`${url}/.well-known/agent-card.json`);
    assert.equal(card.status, 404, "card route must not exist — AAA :3001 is the sole gateway");

    const a2a = await fetch(`${url}/a2a`, {
      method: "POST",
      headers: { "content-type": "application/json", "A2A-Version": "1.0" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "x", method: "SendMessage", params: {} }),
    });
    assert.equal(a2a.status, 404, "no A2A RPC host here");
  } finally {
    await close();
    await shutdownPersonalOS();
  }
});

test("the published bridge contract does not advertise an A2A card route", async () => {
  const { url, close } = await listenOnce(createApp());
  try {
    const res = await fetch(`${url}/contract`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { endpoints?: Record<string, string> };
    assert.ok(body.endpoints, "/contract must still publish its endpoint map");

    // A listing that 404s is worse than no listing: a bridge reading this would
    // negotiate an A2A handshake with us and time out.
    const advertised = JSON.stringify(body.endpoints).toLowerCase();
    assert.ok(
      !advertised.includes("agent-card"),
      `/contract still advertises an agent-card route: ${JSON.stringify(body.endpoints)}`,
    );
    assert.ok(
      !/"[^"]*\/a2a/.test(advertised),
      `/contract still advertises an /a2a path: ${JSON.stringify(body.endpoints)}`,
    );
  } finally {
    await close();
    await shutdownPersonalOS();
  }
});
