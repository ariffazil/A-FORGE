/**
 * A-FORGE MCP Server — STDIO entry point
 *
 * Imports all tools + resources from core.ts and runs stdio transport.
 * This is the canonical entry point for local MCP clients
 * (Claude Desktop, Cursor, OpenCode, Windsurf).
 *
 * @module mcp/stdio
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { server } from "./core.js";
import { getApprovalBoundary } from "../approval/index.js";
import { getMemoryContract } from "../memory-contract/index.js";
import { telemetry } from "./telemetry.js";

async function main(): Promise<void> {
  const approvalBoundary = getApprovalBoundary();
  const memoryContract = getMemoryContract();

  await approvalBoundary.initialize();
  await memoryContract.initialize();
  await telemetry.initialize();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[A-FORGE-mcp] Server started on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[A-FORGE-mcp] Fatal: ${err}\n`);
  process.exit(1);
});


