import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import type express from "express";

import { createApp } from "../src/interfaces/server.js";

function listenOnce(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

const initializeBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "mcp-transport-test", version: "1.0.0" },
  },
});

test("MCP OPTIONS exposes browser transport CORS headers", async () => {
  const { url, close } = await listenOnce(createApp());
  try {
    const response = await fetch(`${url}/mcp`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:6274" },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("access-control-allow-methods") ?? "", /OPTIONS/);
    assert.match(response.headers.get("access-control-allow-headers") ?? "", /MCP-Protocol-Version/);
  } finally {
    await close();
  }
});

test("MCP initialize rejects an untrusted browser origin", async () => {
  const { url, close } = await listenOnce(createApp());
  try {
    const response = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: initializeBody,
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "Invalid Origin");
  } finally {
    await close();
  }
});

test("MCP initialize without Origin reaches the transport gate", async () => {
  const { url, close } = await listenOnce(createApp());
  try {
    const response = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: {
        Host: "forge.arif-fazil.com",
        "Content-Type": "application/json",
      },
      body: initializeBody,
    });
    assert.notEqual(response.status, 403);
  } finally {
    await close();
  }
});
