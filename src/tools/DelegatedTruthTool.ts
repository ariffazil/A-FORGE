/**
 * Delegated Truth Tool
 *
 * Implements the 4+1 Architecture by delegating truth logic (math, physical models)
 * to external MCP servers. This ensures A-FORGE remains a "shell only" runtime.
 *
 * @module tools/DelegatedTruthTool
 */

import { BaseTool } from "./base.js";
import type { ToolResult, ToolExecutionContext } from "../types/tool.js";

export abstract class DelegatedTruthTool extends BaseTool {
  /**
   * The base URL of the remote truth lane MCP server (e.g. GEOX or WEALTH).
   */
  abstract readonly laneBaseUrl: string;

  /**
   * Delegates the tool execution to the remote truth lane.
   */
  protected async delegate(method: string, params: Record<string, unknown>): Promise<ToolResult> {
    const url = `${this.laneBaseUrl.replace(/\/$/, "")}/mcp`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: `tools/call`,
          params: {
            name: method,
            arguments: params
          },
          id: Date.now()
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          output: `[DELEGATION_ERROR] Truth Lane ${this.laneBaseUrl} returned ${response.status}`,
        };
      }

      const body = (await response.json()) as any;
      if (body.error) {
         return {
           ok: false,
           output: `[TRUTH_ERROR] ${body.error.message || JSON.stringify(body.error)}`,
         };
      }

      return {
        ok: true,
        output: body.result.content[0].text,
        metadata: { delegated: true, lane: this.laneBaseUrl }
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        output: `[DELEGATION_FAILED] Could not reach Truth Lane: ${msg}`,
      };
    }
  }
}


