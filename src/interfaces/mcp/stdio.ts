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
import { getConstitutionGate } from "../../application/approval/index.js";
import { getMemoryContract } from "../../domain/memory-contract/index.js";
import { telemetry } from "./telemetry.js";
import { assertActMutationGateOrExit } from "../../infrastructure/governance/actIngress.js";

async function main(): Promise<void> {
  // Production lockout: FORGE_ACT_REQUIRE_MUTATE=0 is FATAL in production.
  assertActMutationGateOrExit(process.env);

  const memoryContract = getMemoryContract();

  process.stderr.write(`[A-FORGE-mcp] Constitution gate: ${getConstitutionGate()}\n`);
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


