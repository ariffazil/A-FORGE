/**
 * Delegated Truth Tool
 *
 * Optional upstream delegation to external MCP truth lanes (WEALTH, GEOX, etc.).
 * A-FORGE remains the execution shell; when the upstream lane is unavailable or
 * does not expose the requested tool, delegation returns an error and the caller
 * (a subclass) may fall back to a local computation model.
 *
 * @module tools/DelegatedTruthTool
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { BaseTool } from "./base.js";
import type { ToolResult } from "../../domain/types/tool.js";

/** Canonical mapping from A-FORGE names to upstream WEALTH names where they differ. */
const WEALTH_NAME_MAP: Record<string, string> = {
  wealth_compute_EMV: "wealth_compute_emv",
};

function resolveUpstreamName(name: string): string {
  return WEALTH_NAME_MAP[name] ?? name;
}

function extractToolText(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const r = result as { content?: Array<{ type?: string; text?: string; data?: unknown }> };
  const first = r.content?.[0];
  if (!first) return undefined;
  if (typeof first.text === "string") return first.text;
  if (typeof first.data === "string") return first.data;
  return undefined;
}

export abstract class DelegatedTruthTool extends BaseTool {
  /**
   * The base URL of the remote truth lane MCP server (e.g. WEALTH).
   */
  abstract readonly laneBaseUrl: string;

  /**
   * Attempts to delegate the tool execution to the remote truth lane using
   * streamable-http MCP. Returns ok=true only when the upstream tool exists and
   * returns a structured result. Callers must implement a local fallback if they
   * want degraded operation when delegation fails.
   */
  protected async delegate(method: string, params: Record<string, unknown>): Promise<ToolResult> {
    const upstreamName = resolveUpstreamName(method);
    const base = this.laneBaseUrl.replace(/\/$/, "");
    const url = `${base}/mcp`;

    let transport: StreamableHTTPClientTransport | undefined;
    try {
      const client = new Client(
        { name: "A-FORGE-delegated-truth", version: "0.1.0" },
        { capabilities: {} },
      );
      transport = new StreamableHTTPClientTransport(new URL(url));
      await client.connect(transport);

      const result = await client.callTool({ name: upstreamName, arguments: params });
      const text = extractToolText(result);
      if (text === undefined) {
        return {
          ok: false,
          output: `[DELEGATION_ERROR] Upstream tool ${upstreamName} returned no text content`,
        };
      }

      return {
        ok: true,
        output: text,
        metadata: { delegated: true, lane: this.laneBaseUrl, upstreamTool: upstreamName },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        output: `[DELEGATION_FAILED] ${upstreamName} @ ${url}: ${msg}`,
      };
    } finally {
      if (transport) {
        try {
          await transport.close();
        } catch {
          // best-effort cleanup
        }
      }
    }
  }
}
