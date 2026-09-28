/**
 * forge_parallel → AAA A2A gateway version-header contract.
 *
 * SCAR 2026-09-28: the gateway on :3001 answers every POST /a2a without an
 * A2A-Version header as -32600 Invalid Request ("A2A-Version header is
 * required. Set A2A-Version: 1.0"). parallelTools.ts sent only Content-Type and
 * Accept, so every forge_parallel call was rejected at the first hop. It went
 * unnoticed because the tool has zero recorded uses — an absent header is not
 * observable in a lane with no traffic.
 *
 * The stub below enforces the same rule the live gateway enforces, so this test
 * fails if the header is dropped again, and the negative control proves the stub
 * gates rather than vacuously passing.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { a2aCall } from "../src/interfaces/mcp/parallelTools.js";

type Captured = {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
};

/** Mirrors the live gateway's transitional rule: absent A2A-Version → -32600. */
function startA2aStub(): Promise<{
  url: string;
  seen: Captured[];
  close: () => Promise<void>;
}> {
  const seen: Captured[] = [];
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const captured: Captured = {
        headers: { ...req.headers },
        body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
      };
      seen.push(captured);

      const version = req.headers["a2a-version"];
      res.setHeader("Content-Type", "application/json");
      if (typeof version !== "string" || version === "") {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: captured.body.id ?? null,
            error: {
              code: -32600,
              message: "Invalid Request",
              data: {
                details: "A2A-Version header is required. Set A2A-Version: 1.0",
                supportedVersions: ["1.0"],
              },
            },
          }),
        );
        return;
      }
      res.writeHead(200);
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: captured.body.id ?? null,
          result: { accepted: true, method: captured.body.method },
        }),
      );
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        seen,
        close: () =>
          new Promise<void>((done) => {
            if (typeof server.closeAllConnections === "function") server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

test("a2aCall declares A2A-Version 1.0 and survives the gateway version gate", async () => {
  const stub = await startA2aStub();
  try {
    const out = await a2aCall("message/send", { message: { parts: [] } }, 5000, stub.url);

    assert.equal(out.ok, true, `gateway refused the call: ${out.error}`);
    assert.equal(stub.seen.length, 1);
    assert.equal(stub.seen[0].headers["a2a-version"], "1.0");
    assert.equal(stub.seen[0].body.jsonrpc, "2.0");
    assert.equal(stub.seen[0].body.method, "message/send");
    assert.ok(
      typeof stub.seen[0].body.id === "string" && (stub.seen[0].body.id as string).length > 0,
      "request id must be set",
    );
  } finally {
    await stub.close();
  }
});

test("negative control: the stub refuses an undeclared version, so the test above is not vacuous", async () => {
  const stub = await startA2aStub();
  try {
    const res = await fetch(`${stub.url}/a2a`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "no-header", method: "message/send", params: {} }),
    });
    const json = (await res.json()) as { error?: { code?: number } };
    assert.equal(res.status, 400);
    assert.equal(json.error?.code, -32600);
  } finally {
    await stub.close();
  }
});
