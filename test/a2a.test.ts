import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type express from "express";
import { createApp } from "../src/server.js";

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

test("A2A agent card exposes official 1.0 JSON-RPC interface", async () => {
  const { url, close } = await listenOnce(createApp());
  try {
    const response = await fetch(`${url}/.well-known/agent-card.json`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      name: string;
      supportedInterfaces: Array<{ url: string; protocolBinding: string; protocolVersion: string }>;
      capabilities: { streaming?: boolean; pushNotifications?: boolean };
    };

    assert.equal(body.name, "arifOS Personal");
    assert.equal(body.supportedInterfaces[0]?.protocolBinding, "JSONRPC");
    assert.equal(body.supportedInterfaces[0]?.protocolVersion, "1.0");
    assert.equal(body.supportedInterfaces[0]?.url, `${url}/a2a`);
    assert.equal(body.capabilities.streaming, false);
    assert.equal(body.capabilities.pushNotifications, false);
  } finally {
    await close();
  }
});

test("A2A SendMessage returns a completed task and GetTask can retrieve it", async () => {
  const { url, close } = await listenOnce(createApp());
  try {
    const sendResponse = await fetch(`${url}/a2a`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "A2A-Version": "1.0",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "send-1",
        method: "SendMessage",
        params: {
          message: {
            messageId: "msg-1",
            role: "ROLE_USER",
            parts: [
              {
                data: {
                  command: "remember",
                  what: "I prefer dark mode in all apps",
                },
                mediaType: "application/json",
              },
            ],
          },
          configuration: {
            historyLength: 2,
          },
        },
      }),
    });

    assert.equal(sendResponse.status, 200);
    const sendBody = await sendResponse.json() as {
      jsonrpc: string;
      id: string;
      result: {
        id: string;
        status: { state: string };
        history?: Array<{ role: string }>;
        artifacts?: Array<{ parts: Array<{ text?: string; data?: unknown }> }>;
      };
    };

    assert.equal(sendBody.jsonrpc, "2.0");
    assert.equal(sendBody.id, "send-1");
    assert.equal(sendBody.result.status.state, "TASK_STATE_COMPLETED");
    assert.equal(sendBody.result.history?.length, 2);
    assert.ok(sendBody.result.artifacts?.[0]?.parts.some((part) => typeof part.text === "string"));

    const getResponse = await fetch(`${url}/a2a`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "A2A-Version": "1.0",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-1",
        method: "GetTask",
        params: {
          id: sendBody.result.id,
          historyLength: 1,
        },
      }),
    });

    assert.equal(getResponse.status, 200);
    const getBody = await getResponse.json() as {
      result: {
        id: string;
        history?: Array<{ role: string }>;
      };
    };
    assert.equal(getBody.result.id, sendBody.result.id);
    assert.equal(getBody.result.history?.length, 1);
    assert.equal(getBody.result.history?.[0]?.role, "ROLE_AGENT");
  } finally {
    await close();
  }
});

test("A2A text requests default to think and completed tasks are not cancelable", async () => {
  const { url, close } = await listenOnce(createApp());
  try {
    const sendResponse = await fetch(`${url}/a2a`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "A2A-Version": "1.0",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "send-2",
        method: "SendMessage",
        params: {
          message: {
            messageId: "msg-2",
            role: "ROLE_USER",
            parts: [
              {
                text: "Compare React vs Vue for this project",
                mediaType: "text/plain",
              },
            ],
          },
        },
      }),
    });

    const sendBody = await sendResponse.json() as {
      result: { id: string; metadata?: { arifos?: { command?: string } } };
    };

    assert.equal(sendBody.result.metadata?.arifos?.command, "think");

    const cancelResponse = await fetch(`${url}/a2a`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "A2A-Version": "1.0",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "cancel-1",
        method: "CancelTask",
        params: {
          id: sendBody.result.id,
        },
      }),
    });

    assert.equal(cancelResponse.status, 400);
    const cancelBody = await cancelResponse.json() as {
      error: { data?: { code?: string } };
    };
    assert.equal(cancelBody.error.data?.code, "TaskNotCancelableError");
  } finally {
    await close();
  }
});
