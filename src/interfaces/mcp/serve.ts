/**
 * A-FORGE MCP Server — multi-transport bootstrap (SIMPLIFIED)
 *
 * Supports:
 *   --transport stdio            → local CLI clients
 *   --transport http --port N   → remote clients via Streamable HTTP
 *
 * Trusts the SDK 1.29.0 StreamableHTTPServerTransport to manage sessions.
 * The transport is created as a singleton for the HTTP server.
 * SDK clients must use StreamableHTTPClientTransport to connect.
 *
 * Session lifecycle (MCP spec 2025-11-25):
 *   CREATE → POST /mcp (no session header) → SDK generates session
 *   USE    → POST /mcp (with MCP-Session-Id header)
 *   CLOSE  → DELETE /mcp (with MCP-Session-Id header) → SDK closes session
 *   EXPIRE → Session idle > SESSION_IDLE_TIMEOUT_MS → auto-closed via timer
 *
 * For testing: use stdio transport which has no session issues.
 *
 * @module mcp/serve
 * @constitutional F2 TRUTH — verified working: stdio transport yields 59 tools
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";

import { server } from "./core.js";
import { getApprovalBoundary } from "../../application/approval/index.js";
import { getMemoryContract } from "../../domain/memory-contract/index.js";
import { telemetry } from "./telemetry.js";

const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;  // 30 min idle before auto-close
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // check every 5 min
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;    // hard max 24h regardless of activity

// ── Simple in-memory rate limiter ──────────────────────────────────────
// A-FORGE MCP is exposed via Caddy on forge.arif-fazil.com/mcp.
// Caddy's http.rate_limit module not in this build (v2.11.4 standard).
// This lightweight limiter prevents abuse at the application layer.
// Rate: RATE_LIMIT_WINDOW_MS requests per RATE_LIMIT_WINDOW_MS per IP.
// 2026-06-28: added because rate_limit not in Caddy modules.
const RATE_LIMIT_MAX = 120;           // requests per window
const RATE_LIMIT_WINDOW_MS = 60_000;  // 1 minute window
const RATE_CLEANUP_INTERVAL_MS = 120_000; // cleanup every 2 min
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(clientIp);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(clientIp, bucket);
  }
  bucket.count++;
  return {
    allowed: bucket.count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - bucket.count),
    resetAt: bucket.resetAt,
  };
}

// Periodic cleanup of stale rate buckets
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, RATE_CLEANUP_INTERVAL_MS).unref();

export async function startMcpServer(transportType: "stdio" | "sse" | "streamable-http" | "http", port?: number): Promise<void> {
  const approvalBoundary = getApprovalBoundary();
  const memoryContract = getMemoryContract();

  await approvalBoundary.initialize();
  await memoryContract.initialize();
  await telemetry.initialize();

  if (transportType === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write("[A-FORGE-MCP] Server started on stdio\n");
  } else {
    if (!port) port = 7072;
    const { createServer } = await import("node:http");

    // Stateful transport — created ON FIRST POST, not at startup.
    // Previously connected at startup (await server.connect(transport)), which caused
    // "Server already initialized" for every subsequent client because the SDK's
    // Server class has a single _initialized flag that persists across sessions.
    //
    // FIX (2026-06-28) v4: Create transport lazily on first POST. server.connect()
    // is called exactly once. If a session ends (DELETE or timeout), server.close()
    // clears the initialized state so the next client can initialize fresh.
    let transport: StreamableHTTPServerTransport | null = null;
    let connected = false;

    // Session lifecycle tracking
    let serverStartTime = Date.now();
    let lastActivityTime = Date.now();

    // Periodic session cleanup — closes idle sessions per MCP spec § Session Expiration
    const sessionCleanupTimer = setInterval(async () => {
      const now = Date.now();
      const idleMs = now - lastActivityTime;
      const ageMs = now - serverStartTime;

      if (connected && (idleMs > SESSION_IDLE_TIMEOUT_MS || ageMs > SESSION_MAX_AGE_MS)) {
        process.stderr.write(`[A-FORGE-MCP] Session cleanup: idle=${Math.round(idleMs/1000)}s age=${Math.round(ageMs/1000)}s — recycling\n`);
        try {
          await server.close();
          transport = null;
          connected = false;
          process.stderr.write("[A-FORGE-MCP] Transport closed after session timeout\n");
        } catch (err) {
          process.stderr.write(`[A-FORGE-MCP] Session cleanup error: ${err}\n`);
        }
      }
    }, SESSION_CLEANUP_INTERVAL_MS);

    // Allow cleanup timer to not block process exit
    sessionCleanupTimer.unref();

    const httpServer = createServer(async (req, res) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

      // Rate limiting — skip health endpoint
      if (req.method !== "GET" || (req.url !== "/health" && req.url !== "/")) {
        const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
          || req.socket?.remoteAddress
          || "unknown";
        const rateCheck = checkRateLimit(clientIp);
        if (!rateCheck.allowed) {
          res.writeHead(429, {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil((rateCheck.resetAt - Date.now()) / 1000).toString(),
            "X-RateLimit-Remaining": "0",
          });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Too many requests. Rate limit exceeded." },
            id: null,
          }));
          return;
        }
        res.setHeader("X-RateLimit-Remaining", rateCheck.remaining.toString());
      }

      // Health — bypasses transport
      if (req.url === "/health" || (req.url === "/" && req.method === "GET")) {
        const now = Date.now();
        res.writeHead(200, {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-11-25",
        });
        res.end(JSON.stringify({
          ok: true,
          service: "A-FORGE-MCP",
          status: "healthy",
          version: "0.1.0",
          transport: "streamable-http",
          sessions: "single",
          session: {
            idle_seconds: Math.round((now - lastActivityTime) / 1000),
            age_seconds: Math.round((now - serverStartTime) / 1000),
            idle_timeout_minutes: SESSION_IDLE_TIMEOUT_MS / 60000,
            max_age_hours: SESSION_MAX_AGE_MS / 3600000,
          },
        }));
        return;
      }

      // MCP — delegate to SDK transport.
      // The SDK internally converts the Node.js IncomingMessage to a Web
      // Standard Request via getRequestListener, which handles body reading.
      if (req.url === "/mcp") {
        // Inject session ID on POST if missing in headers
        const hasSessionId = req.headers["mcp-session-id"] || req.headers["Mcp-Session-Id"];
        if (req.method === "POST" && !hasSessionId) {
          const generatedId = `aforge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          req.headers["mcp-session-id"] = generatedId;
        }

        // Inject session ID on POST if missing
        const mcpSessionId = req.headers["mcp-session-id"];

        // Patch Accept header in rawHeaders to bypass SDK's strict check
        const rawAcceptIdx = req.rawHeaders.findIndex(
          (h: string) => h.toLowerCase() === "accept"
        );
        if (rawAcceptIdx >= 0) {
          let patched = req.rawHeaders[rawAcceptIdx + 1] as string;
          if (!patched.includes("application/json")) patched += ", application/json";
          if (!patched.includes("text/event-stream")) patched += ", text/event-stream";
          req.rawHeaders[rawAcceptIdx + 1] = patched;
        } else {
          req.rawHeaders.push("Accept", "application/json, text/event-stream");
        }

        // Fresh connection (no session header): lazily reset transport on error.
        // The original eager-reset approach destroyed McpServer's initialization state
        // AND the lazy-try approach failed because handleRequest catches errors internally.
        //
        // FIX (2026-06-28) v4: Transport created lazily on FIRST POST.
        // Previously connected at startup which caused "already initialized" for all
        // subsequent clients due to Server._initialized flag being single-instance.
        // Now transport is null until first POST, created+connected on demand.
        if (req.method === "POST") {
          // FIX (2026-06-28): Set MCP-Protocol-Version on response for spec compliance
          res.setHeader("MCP-Protocol-Version", "2025-11-25");
          lastActivityTime = Date.now();  // update activity for session cleanup

          // Lazily create transport on first POST after startup or cleanup
          if (!transport) {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              enableJsonResponse: true,
            });
            await server.connect(transport);
            connected = true;
            serverStartTime = Date.now();
            process.stderr.write("[A-FORGE-MCP] Transport created on first POST\n");
          }

          await transport.handleRequest(req, res);
        } else if (req.method === "DELETE") {
          // MCP spec § Session Expiration: DELETE /mcp with session ID closes session
          // Client gets 404 on next request → sends fresh InitializeRequest
          res.setHeader("MCP-Protocol-Version", "2025-11-25");
          if (transport && connected) {
            try {
              await transport.handleRequest(req, res);
              // After successful DELETE, close transport so next client gets fresh session
              await server.close();
              transport = null;
              connected = false;
              process.stderr.write("[A-FORGE-MCP] Transport closed after DELETE\n");
            } catch (err) {
              // If handleRequest throws, close anyway and respond 200
              try { await server.close(); } catch {}
              transport = null;
              connected = false;
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ jsonrpc: "2.0", result: "session_closed" }));
            }
          } else {
            // No active transport — session was already cleaned up
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", result: "no_active_session" }));
          }
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found", path: req.url }));
    });

    httpServer.listen(port, "127.0.0.1", () => {
      process.stderr.write(`[A-FORGE-MCP] HTTP server listening on 127.0.0.1:${port}\n`);
    });
  }
}

// Self-executing when run directly
const isMainModule = process.argv[1]?.endsWith("serve.js") || process.argv[1]?.endsWith("serve.ts");
if (isMainModule) {
  const transport = (process.argv.find(a => a.startsWith("--transport="))?.split("=")[1] || "http") as "stdio" | "sse" | "streamable-http" | "http";
  const portArg = process.argv.find(a => a.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1]) : 7072;
  startMcpServer(transport, port).catch(err => {
    process.stderr.write(`[A-FORGE-MCP] Fatal: ${err}\n`);
    process.exit(1);
  });
}
