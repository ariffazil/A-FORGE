import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Request, Response } from "express";
import { createServer } from "node:http";
import { createOperatorAuthMiddleware } from "../src/middleware/operatorAuth.js";

function listenOnce(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

test("operator auth middleware allows request when no token is configured", async () => {
  const app = express();
  app.use("/operator", createOperatorAuthMiddleware(undefined));
  app.get("/operator/test", (_req: Request, res: Response) => res.json({ ok: true }));

  const { url, close } = await listenOnce(app);
  try {
    const response = await fetch(`${url}/operator/test`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    await close();
  }
});

test("operator auth middleware rejects missing token", async () => {
  const app = express();
  app.use("/operator", createOperatorAuthMiddleware("secret123"));
  app.get("/operator/test", (_req: Request, res: Response) => res.json({ ok: true }));

  const { url, close } = await listenOnce(app);
  try {
    const response = await fetch(`${url}/operator/test`);
    assert.equal(response.status, 401);
    const body = (await response.json()) as { ok: boolean; error: { type: string } };
    assert.equal(body.ok, false);
    assert.equal(body.error.type, "unauthorized");
  } finally {
    await close();
  }
});

test("operator auth middleware rejects invalid token", async () => {
  const app = express();
  app.use("/operator", createOperatorAuthMiddleware("secret123"));
  app.get("/operator/test", (_req: Request, res: Response) => res.json({ ok: true }));

  const { url, close } = await listenOnce(app);
  try {
    const response = await fetch(`${url}/operator/test`, {
      headers: { Authorization: "Bearer wrongtoken" },
    });
    assert.equal(response.status, 401);
  } finally {
    await close();
  }
});

test("operator auth middleware accepts valid bearer token", async () => {
  const app = express();
  app.use("/operator", createOperatorAuthMiddleware("secret123"));
  app.get("/operator/test", (_req: Request, res: Response) => res.json({ ok: true }));

  const { url, close } = await listenOnce(app);
  try {
    const response = await fetch(`${url}/operator/test`, {
      headers: { Authorization: "Bearer secret123" },
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    await close();
  }
});
