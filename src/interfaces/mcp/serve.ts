/**
 * A-FORGE MCP Server — multi-transport bootstrap (SIMPLIFIED)
 *
 * Supports:
 *   --transport stdio            → local CLI clients
 *   --transport http --port N   → remote clients via Streamable HTTP
 *
 * Multi-client (2026-06-28): HTTP transport allows stateless read-only
 * access for secondary clients via a STATELESS_TOOLS whitelist.
 * First client gets a full session via the SDK transport.
 * Subsequent clients get stateless access to whitelisted tools.
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
import { getMcpPolicyGate, EXAMPLE_POLICIES } from "../../domain/governance/McpPolicyGate.js";
import type { VerdictResult } from "../../domain/governance/McpPolicyGate.js";
import { aThinkCheck, aThinkErrorResponse } from "../../domain/governance/aThinkGuard.js";

const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;  // 30 min idle before auto-close
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // check every 5 min
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;    // hard max 24h regardless of activity

// ── Stateless tool whitelist (2026-06-28) ─────────────────────────────
// External HTTP clients can call these tools without a session.
// All other tools require session ownership (first client via SDK transport).
// MUTATE tools (forge_execute, forge_filesystem write, forge_git commit, etc.)
// are NEVER in this list and always require session ownership.
const STATELESS_TOOLS = new Set([
  "forge_session_init",
  "forge_health_check",
  "forge_probe",
  "forge_search",
  "forge_research",
  "forge_minimax_search",
  "forge_docs_lookup",
  "forge_memory",
  // forge_systemctl — DEPRECATED, use forge_shell('systemctl ...') instead
  "forge_journalctl",
  "forge_registry_status",
  "forge_status",
  "forge_scan",
  "forge_shell_dryrun",
  "forge_shell",
  "forge_shell_status",
  "forge_shell_ledger",
  "forge_shell_alert_history",
  "forge_registry",
  "forge_document_ingest",                                   // Phase 1 — read-only, no side effects

  // ── Phase 5: MCP Policy Gate (2026-06-30) ──────────────────────────
  // Observation/check/list capability in the merged engine is stateless.
  "forge_policy",

  // ── Phase 6: MCP Surface Guard (2026-07-03) ───────────────────────
  // Drift detection is read-only observation. Pin mutates in-memory state only.
  "forge_surface_guard",

  // ── Phase 7: MCP Surface Audit (2026-07-03) ──────────────────────
  // Phantom drift detection — compares registry vs affordances.
  // All modes are read-only (audit, scan). fix mode produces DRAFT only.
  "forge_surface_audit",

  // ── Phase 8: P0 Machine Constitution Layer (2026-07-04) ─────────
  // VPS state-anchor tools. All modes are read-only observation.
  // They make the machine's boundary state (ports/services/cron) visible
  // and assertable against a saved Machine Constitution registry.
  // F1 AMANAH: never mutate, only sense. F2 TRUTH: labeled outputs.
  "forge_vps_ports",
  "forge_vps_services",
  "forge_vps_cron",
  "forge_boundaries_assert",
]);

// ── MCP Policy Gate initialization ──────────────────────────────────
// 5-layer enforcement: identity → server → tool → args → verdict.
// Blocks prompt injection / hallucinated plans / unauthorized mutations BEFORE
// any tool handler runs. Architectural, not behavioral.
const mcpPolicyGate = getMcpPolicyGate();

// ── Simple in-memory rate limiter ──────────────────────────────────────
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_CLEANUP_INTERVAL_MS = 120_000;
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

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, RATE_CLEANUP_INTERVAL_MS).unref();

// ── MCP Policy Gate: evaluate a tool call BEFORE dispatch ────────────
// Returns verdict + reason chain. Called at every tools/call path.
// Non-blocking on engine failure (fail-open → DENY with reason).
function evaluatePolicyGate(
  toolName: string,
  toolArgs: Record<string, any>,
  actorId?: string,
  clientIp?: string,
  transport?: "stdio" | "http",
): VerdictResult {
  try {
    return mcpPolicyGate.evaluate({
      actor_id: actorId,
      tool_name: toolName,
      arguments: toolArgs,
      transport,
      client_ip: clientIp,
    });
  } catch (err: any) {
    return {
      verdict: "DENY",
      actor_id: actorId ?? "anonymous",
      policy_id: "engine_error",
      mcp_server: toolName.split("_")[0] ?? "unknown",
      tool_name: toolName,
      layers: { identity: false, server: false, tool: false, argument: false },
      reasons: [`ENGINE_ERROR:${err.message}`],
      timestamp: new Date().toISOString(),
    };
  }
}

// ── Tool registry helpers (access SDK internals) ───────────────────────
function getServerTools(): any[] {
  const registry = (server as any)._registeredTools as Record<string, any>;
  if (!registry) return [];
  return Object.entries(registry)
    .filter(([_, t]: [string, any]) => t.enabled !== false)
    .map(([name, t]: [string, any]) => ({
      name,
      description: t.description ?? "",
      inputSchema: t.inputSchema ?? {},
    }));
}

function getToolHandler(name: string): ((args: any) => Promise<any>) | null {
  const registry = (server as any)._registeredTools as Record<string, any>;
  if (!registry || !registry[name]) return null;
  // The handler might be stored as `handler` property
  // or in the McpServer's internal handler map
  const tool = registry[name];
  if (typeof tool.handler === "function") return tool.handler;
  return null;
}

function jsonRpcError(id: any, code: number, message: string, data?: any): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data ? { data } : {}) },
  });
}

function jsonRpcResult(id: any, result: any): string {
  return JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result });
}

// ── Session ID generation ──────────────────────────────────────────────
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
    let transport: StreamableHTTPServerTransport | null = null;
    let connected = false;
    let serverStartTime = Date.now();
    let lastActivityTime = Date.now();

    // Periodic session cleanup
    const sessionCleanupTimer = setInterval(async () => {
      const now = Date.now();
      const idleMs = now - lastActivityTime;
      const ageMs = now - serverStartTime;
      if (connected && (idleMs > SESSION_IDLE_TIMEOUT_MS || ageMs > SESSION_MAX_AGE_MS)) {
        process.stderr.write(`[A-FORGE-MCP] Session cleanup: idle=${Math.round(idleMs/1000)}s age=${Math.round(ageMs/1000)}s\n`);
        try {
          await server.close();
          transport = null;
          connected = false;
        } catch (err) {
          process.stderr.write(`[A-FORGE-MCP] Session cleanup error: ${err}\n`);
        }
      }
    }, SESSION_CLEANUP_INTERVAL_MS);
    sessionCleanupTimer.unref();

    const httpServer = createServer(async (req, res) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

      // Rate limiting
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
          res.end(jsonRpcError(null, -32000, "Too many requests. Rate limit exceeded."));
          return;
        }
        res.setHeader("X-RateLimit-Remaining", rateCheck.remaining.toString());
      }

      // Health endpoint
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
          sessions: connected ? "active" : "pending",
          stateless_tools: STATELESS_TOOLS.size,
          session: connected ? {
            idle_seconds: Math.round((now - lastActivityTime) / 1000),
            age_seconds: Math.round((now - serverStartTime) / 1000),
          } : null,
        }));
        return;
      }

      // MCP handler
      if (req.url === "/mcp") {
        // GET /mcp — discovery for external clients
        if (req.method === "GET") {
          res.writeHead(200, {
            "Content-Type": "application/json",
            "MCP-Protocol-Version": "2025-11-25",
          });
          res.end(JSON.stringify({
            name: "A-FORGE-MCP",
            version: "0.1.0",
            protocolVersion: "2025-11-25",
            transport: "streamable-http",
            authentication: "none",
            note: "No API key, no OAuth, no token. Open MCP endpoint.",
            endpoints: {
              initialize: "POST /mcp",
              tools_list: "POST /mcp → tools/list",
              tools_call: "POST /mcp → tools/call"
            },
            docs: "https://forge.arif-fazil.com",
            stateless_tools: STATELESS_TOOLS.size,
          }));
          return;
        }
        if (req.method === "POST") {
          const hasSessionId = !!(req.headers["mcp-session-id"] || req.headers["Mcp-Session-Id"]);
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

          // ── Client with existing session → forward to SDK transport ─────
          if (hasSessionId) {
            lastActivityTime = Date.now();

            if (!transport) {
              process.stderr.write(`[A-FORGE-MCP] Stale session — no active transport\n`);
              res.writeHead(409, { "Content-Type": "application/json" });
              res.end(jsonRpcError(null, -32001, "Session expired. Re-initialize without Mcp-Session-Id."));
              return;
            }

            if (transport && connected) {
              try {
                await transport.handleRequest(req, res);
              } catch (err) {
                process.stderr.write(`[A-FORGE-MCP] handleRequest error: ${err}\n`);
                if (!res.headersSent) {
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(jsonRpcError(null, -32603, "Internal error"));
                }
              }
            } else {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(jsonRpcError(null, -32000, "Server not initialized"));
            }
            return;
          }

          // First no-session client gets a real SDK-managed MCP session.
          res.setHeader("MCP-Protocol-Version", "2025-11-25");
          if (!transport) {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              enableJsonResponse: true,
            });
            await server.connect(transport);
            connected = true;
            serverStartTime = Date.now();
            lastActivityTime = Date.now();
            process.stderr.write("[A-FORGE-MCP] Transport created on first session request\n");
            await transport.handleRequest(req, res);
            return;
          }

          // ── New client (no session ID) → stateless path ─────────────────
          const bodyStr = await new Promise<string>((resolve) => {
            const chunks: Buffer[] = [];
            req.on("data", (chunk: Buffer) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
          });

          let parsed: any;
          try {
            parsed = JSON.parse(bodyStr);
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(jsonRpcError(null, -32700, "Parse error"));
            return;
          }

          const method = parsed.method;
          const msgId = parsed.id ?? null;

          if (method === "initialize") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(jsonRpcResult(msgId, {
              protocolVersion: "2025-11-25",
              capabilities: { tools: {}, resources: {}, logging: {}, registration: { mode: "explicit", tool: "forge_agent" } },
              serverInfo: { name: "A-FORGE-MCP", version: "0.1.0" },
            }));
            return;
          }

          // Case 2: tools/list
          if (method === "tools/list") {
            const tools = getServerTools().map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: {
                type: "object",
                properties: t.inputSchema?.shape
                  ? Object.entries(t.inputSchema.shape).reduce((acc: any, [k, v]: [string, any]) => {
                      acc[k] = { type: v._def?.typeName?.includes("optional") ? "string" : "string", description: v.description };
                      return acc;
                    }, {})
                  : {},
              },
            }));
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(jsonRpcResult(msgId, { tools }));
            return;
          }

          // Case 3: tools/call
          if (method === "tools/call") {
            const toolName = parsed.params?.name;
            const toolArgs = parsed.params?.arguments ?? {};

            if (!toolName) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32602, "Missing tool name"));
              return;
            }

            // Check whitelist
            if (!STATELESS_TOOLS.has(toolName)) {
              const msg = `Tool "${toolName}" requires session ownership. Use session-based connection or connect via stdio.`;
              process.stderr.write(`[A-FORGE-MCP] Rejected stateless call: ${toolName}\n`);
              res.writeHead(403, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32000, msg));
              return;
            }

            // ── A-THINK Guard (stateless path) ────────────────────────
            // Constitutional front-door. UNKNOWN = HOLD. Budget enforced.
            const aThinkVerdict = aThinkCheck(toolName);
            if (!aThinkVerdict.allowed) {
              const errResp = aThinkErrorResponse(aThinkVerdict);
              process.stderr.write(
                `[A-FORGE-MCP] A-THINK ${aThinkVerdict.status} (stateless): ${toolName} — ${aThinkVerdict.reason}\n`,
              );
              res.writeHead(403, {
                "Content-Type": "application/json",
                "X-AThink-Gate": aThinkVerdict.status,
                "X-AThink-Mode": aThinkVerdict.mode,
              });
              res.end(jsonRpcError(msgId, -32011, `A-THINK guard: ${aThinkVerdict.status}`, {
                status: aThinkVerdict.status,
                gate: "A_THINK_GUARD",
                mode: aThinkVerdict.mode,
                reason: aThinkVerdict.reason,
                tool: toolName,
              }));
              return;
            }

            // ── Policy Gate (stateless path) ───────────────────────────
            // The 5-layer boundary (identity/server/tool/args) evaluated before dispatch.
            const actorHint =
              (toolArgs?.actor_id as string) || (toolArgs?.actorId as string) || "stateless-client";
            const clientIp = (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
              || req.socket?.remoteAddress || "unknown");
            const policyVerdict = evaluatePolicyGate(toolName, toolArgs, actorHint, clientIp, "http");
            if (policyVerdict.verdict === "DENY") {
              process.stderr.write(
                `[A-FORGE-MCP] Policy DENY (stateless) actor=${actorHint} tool=${toolName} reasons=${policyVerdict.reasons.join(",")}\n`,
              );
              res.writeHead(403, {
                "Content-Type": "application/json",
                "X-Policy-Gate": "DENY",
                "X-Policy-Id": policyVerdict.policy_id,
              });
              res.end(jsonRpcError(msgId, -32010, "MCP Policy Gate denied the request", {
                verdict: policyVerdict.verdict,
                policy_id: policyVerdict.policy_id,
                reasons: policyVerdict.reasons,
                layers: policyVerdict.layers,
                violated_regex: policyVerdict.violated_regex,
              }));
              return;
            }

            // Dispatch whitelisted tool
            process.stderr.write(`[A-FORGE-MCP] Stateless call: ${toolName}\n`);
            try {
              const handler = getToolHandler(toolName);
              if (!handler) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(jsonRpcError(msgId, -32602, `Tool "${toolName}" not found`));
                return;
              }

              const result = await handler(toolArgs);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(jsonRpcResult(msgId, result));
            } catch (err: any) {
              process.stderr.write(`[A-FORGE-MCP] Stateless call error: ${toolName}: ${err}\n`);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32603, err.message ?? "Tool execution failed"));
            }
            return;
          }

          // Case 6: prompts/list — list registered MCP prompts
          if (method === "prompts/list") {
            const registry = (server as any)._registeredPrompts as Record<string, any>;
            const promptsList = registry ? Object.entries(registry)
              .filter(([_, p]: [string, any]) => p.enabled !== false)
              .map(([name, p]: [string, any]) => ({
                name,
                description: p.description ?? "",
                arguments: p.argsSchema ? Object.entries(p.argsSchema.shape).map(([k, v]: [string, any]) => ({
                  name: k,
                  description: v.description,
                  required: !v._def?.typeName?.includes("optional"),
                })) : [],
              })) : [];
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(jsonRpcResult(msgId, { prompts: promptsList }));
            return;
          }

          // Case 7: prompts/get — get a specific prompt
          if (method === "prompts/get") {
            const promptName = parsed.params?.name;
            const promptArgs = parsed.params?.arguments ?? {};
            if (!promptName) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32602, "Missing prompt name"));
              return;
            }
            const registry = (server as any)._registeredPrompts as Record<string, any>;
            const prompt = registry?.[promptName];
            if (!prompt) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32602, `Prompt "${promptName}" not found`));
              return;
            }
            if (typeof prompt.callback === "function") {
              try {
                const result = await prompt.callback(promptArgs);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(jsonRpcResult(msgId, result));
              } catch (err: any) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(jsonRpcError(msgId, -32603, err.message ?? "Prompt execution failed"));
              }
            } else {
              // Fallback: return the prompt metadata
              const argDefs = prompt.argsSchema ? Object.entries(prompt.argsSchema.shape).map(([k, v]: [string, any]) => ({
                name: k,
                description: v.description,
                required: !v._def?.typeName?.includes("optional"),
              })) : [];
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(jsonRpcResult(msgId, {
                description: prompt.description,
                arguments: argDefs,
                messages: [{ role: "user", content: { type: "text", text: `Prompt "${promptName}" requires workflow-specific arguments. Use tools/list to discover capabilities.` } }],
              }));
            }
            return;
          }

          // MCP notifications (no id) — acknowledge silently, no response body
          if (method.startsWith("notifications/")) {
            res.writeHead(202, { "Content-Type": "application/json" });
            res.end();
            return;
          }

          // Unknown method — reject
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(jsonRpcError(msgId, -32601, `Method not found: ${method}`));
          return;
        }

        // DELETE — session cleanup
        if (req.method === "DELETE") {
          res.setHeader("MCP-Protocol-Version", "2025-11-25");
          if (transport && connected) {
            try {
              await transport.handleRequest(req, res);
              await server.close();
              transport = null;
              connected = false;
            } catch {
              try { await server.close(); } catch {}
              transport = null;
              connected = false;
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ jsonrpc: "2.0", result: "session_closed" }));
            }
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", result: "no_active_session" }));
          }
          return;
        }

        // GET without session — not supported
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed", path: req.url }));
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
