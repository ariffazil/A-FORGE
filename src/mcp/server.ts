/**
 * A-FORGE MCP Server (stdio wrapper)
 *
 * Legacy entry point that now imports from core.ts.
 * Runs the standard stdio transport.
 *
 * @module mcp/server
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./core.js";
import { getApprovalBoundary } from "../approval/index.js";
import { getMemoryContract } from "../memory-contract/index.js";
import { telemetry } from "./telemetry.js";

async function main() {
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


