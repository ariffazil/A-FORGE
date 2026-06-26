#!/usr/bin/env node
/**
 * MCP Stdio→HTTP Bridge — AAA Distillation Pattern
 *
 * Converts any stdio-only MCP server into a persistent HTTP citizen.
 * One bridge instance per tool = no more per-session npx spawn leaks.
 *
 * Usage:
 *   node stdio-http-bridge.js --port 18085 --name github -- npx @modelcontextprotocol/server-github
 *
 * Architecture:
 *   HTTP clients → StreamableHTTPServerTransport → MCP Server (proxy)
 *       → StdioClientTransport → spawned child process (stdio MCP server)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// ── Config ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

// Parse --port, --name, --health-port
let port = 18085;
let healthPort = null;
let name = "bridge";
const childCmd = [];

let i = 0;
while (i < args.length) {
  if (args[i] === "--port" && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
    i += 2;
  } else if (args[i] === "--health-port" && args[i + 1]) {
    healthPort = parseInt(args[i + 1], 10);
    i += 2;
  } else if (args[i] === "--name" && args[i + 1]) {
    name = args[i + 1];
    i += 2;
  } else if (args[i] === "--") {
    childCmd.push(...args.slice(i + 1));
    break;
  } else {
    i++;
  }
}

if (childCmd.length === 0) {
  console.error("Usage: node stdio-http-bridge.js --port N --name X -- <command> [args...]");
  process.exit(1);
}

const COMMAND = childCmd[0];
const CMD_ARGS = childCmd.slice(1);

// ── State ───────────────────────────────────────────────────────────────────
let childProcess = null;
let mcpClient = null;
let proxyTools = [];
let proxyPrompts = [];
let proxyResources = [];
let ready = false;
let bootTime = null;

// ── Child Process Management ────────────────────────────────────────────────
function spawnChild() {
  const env = { ...process.env };
  const child = spawn(COMMAND, CMD_ARGS, {
    stdio: ["pipe", "pipe", "pipe"],
    env,
  });

  child.on("exit", (code, signal) => {
    console.error(`[${name}] child exited code=${code} signal=${signal} — will restart`);
    ready = false;
    proxyTools = [];
    mcpClient = null;
    childProcess = null;
    setTimeout(spawnChild, 2000);
  });

  child.on("error", (err) => {
    console.error(`[${name}] child error: ${err.message} — will restart`);
    ready = false;
    childProcess = null;
    setTimeout(spawnChild, 2000);
  });

  child.stderr.on("data", (d) => {
    process.stderr.write(`[${name}:stderr] ${d}`);
  });

  childProcess = child;
  return child;
}

// ── MCP Client Connection ───────────────────────────────────────────────────
async function connectClient() {
  const child = spawnChild();

  const transport = new StdioClientTransport({
    command: COMMAND,
    args: CMD_ARGS,
    env: process.env,
  });

  // We already spawned the child, so use the existing pipes
  // StdioClientTransport spawns its own — let it manage the child
  // Kill our pre-spawned one
  child.kill();
  childProcess = null;

  const client = new Client(
    { name: `bridge-${name}`, version: "1.0.0" },
    { capabilities: { tools: {}, prompts: {}, resources: {} } }
  );

  try {
    await client.connect(transport);
    console.error(`[${name}] MCP client connected to child`);

    // Discover capabilities
    try {
      const toolsResult = await client.listTools();
      proxyTools = toolsResult.tools || [];
      console.error(`[${name}] discovered ${proxyTools.length} tools`);
    } catch (e) {
      console.error(`[${name}] tool discovery failed: ${e.message}`);
    }

    try {
      const promptsResult = await client.listPrompts();
      proxyPrompts = promptsResult.prompts || [];
    } catch (_) { /* prompts optional */ }

    try {
      const resourcesResult = await client.listResources();
      proxyResources = resourcesResult.resources || [];
    } catch (_) { /* resources optional */ }

    mcpClient = client;
    ready = true;
    bootTime = new Date().toISOString();
  } catch (err) {
    console.error(`[${name}] client connect failed: ${err.message}`);
    client.close().catch(() => {});
    setTimeout(connectClient, 2000);
  }
}

// ── HTTP MCP Server (stateless — fresh transport per request) ────────────────
const httpServer = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health
  if (req.url === "/health" || (req.url === "/" && req.method === "GET")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: ready,
      service: `mcp-bridge-${name}`,
      status: ready ? "healthy" : "starting",
      tool_count: proxyTools.length,
      uptime: bootTime,
    }));
    return;
  }

  // MCP endpoint — stateless: fresh transport per request
  if (req.url === "/mcp") {
    if (!ready) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bridge not ready — child still starting" }));
      return;
    }

    // Create a fresh transport per request (stateless mode)
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      // No sessionIdGenerator = stateless mode — each request gets fresh init
    });

    // Create a fresh proxy server per transport
    const proxyServer = new Server(
      { name: `bridge-${name}`, version: "1.0.0" },
      { capabilities: { tools: { listChanged: true } } }
    );

    // Register proxy tool handlers
    if (proxyTools.length > 0) {
      proxyServer.setRequestHandler("tools/list", async () => ({
        tools: proxyTools,
      }));

      proxyServer.setRequestHandler("tools/call", async (request) => {
        if (!mcpClient) {
          throw new Error("Backend client not connected");
        }
        return mcpClient.callTool(request.params.name, request.params.arguments || {});
      });
    }

    await proxyServer.connect(transport);
    await transport.handleRequest(req, res);

    // Clean up after response
    res.on("finish", () => {
      transport.close().catch(() => {});
      proxyServer.close().catch(() => {});
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found", path: req.url }));
});

// ── Boot ─────────────────────────────────────────────────────────────────────
console.error(`[${name}] Starting MCP stdio→HTTP bridge on port ${port}`);
console.error(`[${name}] Command: ${COMMAND} ${CMD_ARGS.join(" ")}`);

// Start HTTP listener first (health endpoint responds immediately)
httpServer.listen(port, "127.0.0.1", () => {
  console.error(`[${name}] HTTP server listening on http://127.0.0.1:${port}`);
});

// Then connect to child
connectClient();

// Graceful shutdown
process.on("SIGTERM", () => {
  console.error(`[${name}] Shutting down...`);
  if (mcpClient) mcpClient.close().catch(() => {});
  httpServer.close();
  process.exit(0);
});
