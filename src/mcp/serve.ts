/**
 * arifOS MCP Server — multi-transport bootstrap
 *
 * Imports all tools and resources from core.ts and exposes them via
 * stdio or HTTP (Streamable HTTP) transport.
 *
 * Supports:
 *   --transport stdio            → local clients (Claude Desktop, Cursor, Windsurf)
 *   --transport http --port N   → remote clients via Streamable HTTP
 *
 * @module mcp/serve
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";

import { server } from "./core.js";
import { getApprovalBoundary } from "../approval/index.js";
import { getMemoryContract } from "../memory-contract/index.js";
import { telemetry } from "./telemetry.js";

export async function startMcpServer(transport: "stdio" | "sse" | "streamable-http", port?: number): Promise<void> {
  const approvalBoundary = getApprovalBoundary();
  const memoryContract = getMemoryContract();

  await approvalBoundary.initialize();
  await memoryContract.initialize();
  await telemetry.initialize();

  if (transport === "stdio") {
    const t = new StdioServerTransport();
    await server.connect(t);
    process.stderr.write("[arifOS-MCP] Server started on stdio\n");
  } else {
    if (!port) port = 3000;
    const { createServer } = await import("node:http");
    const t = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    const httpServer = createServer(async (req, res) => {
      if (req.url === "/GEOX/mcp" || req.url === "/wealth/mcp" || req.url === "/mcp") {
        await t.handleRequest(req, res, { sessionIdGenerator: () => randomUUID() });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    httpServer.listen(port, () => {
      process.stderr.write(`[arifOS-MCP] HTTP server listening on port ${port}\n`);
    });
  }
}

