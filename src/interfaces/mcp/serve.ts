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

    // Singleton transport — manages sessions internally via SDK
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
    });

    const httpServer = createServer(async (req, res) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

      // Health — bypasses transport
      if (req.url === "/health" || (req.url === "/" && req.method === "GET")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, service: "A-FORGE-MCP", status: "healthy", version: "0.1.0" }));
        return;
      }

      // MCP — delegate to SDK transport (handles GET for SSE, POST for JSON-RPC)
      if (req.url === "/mcp") {
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found", path: req.url }));
    });

    httpServer.listen(port, () => {
      process.stderr.write(`[A-FORGE-MCP] HTTP server listening on port ${port}\n`);
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
