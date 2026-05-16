#!/usr/bin/env node
/**
 * arifOS MCP CLI
 *
 * Entry point for: arifos-mcp serve --organ GEOX --transport stdio
 *
 * @module mcp/cli
 */

import { parseServeArgs } from "../cli/parseArgs.js";
import { startMcpServer } from "./serve.js";

async function main(): Promise<void> {
  const args = parseServeArgs(process.argv.slice(2));

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stderr.write(`[arifOS-MCP] Usage: arifos-mcp serve --organ <GEOX|wealth|forge> --transport <stdio|http> --port <port>\n`);
    process.exit(0);
    return;
  }

  const { transport, port } = args;
  process.stderr.write(`[arifOS-MCP] Starting organ=forge transport=${transport} port=${port ?? 3000}\n`);
  await startMcpServer(transport, port);
}

main().catch((err) => {
  process.stderr.write(`[arifOS-MCP] Fatal: ${err}\n`);
  process.exit(1);
});

