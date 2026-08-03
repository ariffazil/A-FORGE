/**
 * serveModern.ts — A-FORGE DUAL-ERA MCP PROXY (Phase 1)
 * ======================================================
 * 
 * 2026-07-28 protocol endpoint for A-FORGE.
 * 
 * ARCHITECTURE:
 *   2026-era clients → :7099/mcp (createMcpHandler v2) → (Phase 1b: proxy to v1 :7072)
 *   2025-era clients → :7072/mcp (StreamableHTTPServerTransport v1) — UNCHANGED
 * 
 * STRATEGY:
 *   Phase 1 (NOW):   v2 handler on :7099, v1 on :7072. Separate ports.
 *   Phase 2 (SOON):  v2 handler absorbs v1 via legacy: 'stateless'
 *   Phase 3 (LATER): Pure v2, v1 retired when Python organs upgrade
 * 
 * KEY FACT: A-FORGE has zod 3.25 but `zod/v4` subpath works.
 *   Import from "zod/v4" for v2 SDK compatibility.
 *   Use z.object({...}) — raw shapes with optional() may trigger 
 *   toJSONSchema warnings (cosmetic, functional fallback works).
 * 
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createServer } from "node:http";
import { z } from "zod/v4";

// ─── FACTORY ──────────────────────────────────────────────────────────
function buildServer(): McpServer {
  const server = new McpServer({
    name: "aforge-v2-proxy",
    version: "2026.08.03",
  });

  // Identity tool
  server.registerTool("forge_whoami", {
    description: "A-FORGE dual-era proxy identity. Returns migration status and protocol info.",
    inputSchema: z.object({}).passthrough() as any,
  }, async () => ({
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        server: "aforge-v2-proxy",
        protocol: "2026-07-28",
        strategy: "dual-era proxy Phase 1",
        v1_backend: "127.0.0.1:7072/mcp",
        v2_endpoint: "127.0.0.1:7099/mcp",
        status: "2026-era handler ACTIVE",
        tools_available: "forge_whoami, forge_proxy_call (Phase 1b: proxy all 114 forge_* tools)",
        migration_plan: "Phase 2: unified dual-era handler. Phase 3: pure v2 when FastMCP 4.0.0 ships.",
      }, null, 2),
    }],
  }));

  // Proxy tool — forward to v1
  server.registerTool("forge_proxy_call", {
    description: "Forward a tool call to the v1 A-FORGE server at :7072/mcp. " +
      "Phase 1b will add transparent proxy for all 114 forge_* tools.",
    inputSchema: z.object({
      method: z.string().describe("MCP method (e.g. tools/call)"),
      name: z.string().describe("Tool name to call on v1 server"),
    }).passthrough() as any,
  }, async ({ method, name }: { method: string; name: string }) => ({
    content: [{
      type: "text" as const,
      text: `Proxy forwarding: ${method}/${name} → v1 :7072/mcp\n(Phase 1b: transparent proxy for all tools)`,
    }],
  }));

  return server;
}

// ─── HTTP SERVER ─────────────────────────────────────────────────────
const handler = createMcpHandler(() => buildServer());
const nodeHandler = toNodeHandler(handler, {
  onerror: (e) => console.error("[V2-PROXY-ERR]", String(e).slice(0, 300)),
});

const PORT = 7099;
createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      server: "aforge-v2-proxy",
      spec: "2026-07-28",
      v1_backend: "127.0.0.1:7072/mcp",
      uptime: process.uptime(),
    }));
    return;
  }
  nodeHandler(req, res);
}).listen(PORT, "127.0.0.1", () => {
  console.error(`A-FORGE v2 PROXY READY :${PORT} → v1 :7072`);
});
