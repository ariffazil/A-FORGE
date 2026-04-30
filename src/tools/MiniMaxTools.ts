/**
 * MiniMax Tools — Web Search + Image Understanding
 *
 * Stage 111 SENSE tools wired through MiniMax MCP subprocess.
 *
 * @module tools/MiniMaxTools
 */

import { BaseTool } from "./base.js";
import { getMiniMaxClient } from "./MiniMaxMcpClient.js";
import type { ToolResult, ToolExecutionContext } from "../types/tool.js";
import type { ToolRiskLevel } from "../types/tool.js";

export class MiniMaxWebSearchTool extends BaseTool {
  readonly name = "minimax_web_search";
  readonly description = "Search the web using MiniMax AI. Use for grounding queries in current information.";
  readonly parameters = {
    type: "object" as const,
    properties: {
      query: { type: "string" as const, description: "The search query" },
    },
    required: ["query"],
  };
  readonly riskLevel: ToolRiskLevel = "safe";

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const query = args.query as string;
    if (!query) return { ok: false, output: "minimax_web_search: query is required" };

    try {
      const output = await getMiniMaxClient().webSearch(query);
      return { ok: true, output };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, output: `[minimax_web_search ERROR] ${msg}` };
    }
  }
}

export class MiniMaxUnderstandImageTool extends BaseTool {
  readonly name = "minimax_understand_image";
  readonly description = "Analyze an image using MiniMax AI vision. Accepts image URL or path.";
  readonly parameters = {
    type: "object" as const,
    properties: {
      image_source: { type: "string" as const, description: "URL or local path to the image" },
      prompt: { type: "string" as const, description: "Optional question about the image" },
    },
    required: ["image_source"],
  };
  readonly riskLevel: ToolRiskLevel = "safe";

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const imageSource = args.image_source as string;
    const prompt = (args.prompt as string) || "";
    if (!imageSource) return { ok: false, output: "minimax_understand_image: image_source is required" };

    try {
      const output = await getMiniMaxClient().understandImage(imageSource, prompt);
      return { ok: true, output };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, output: `[minimax_understand_image ERROR] ${msg}` };
    }
  }
}
