import { BaseTool } from "./base.js";
import type { ToolResult, ToolExecutionContext } from "../types/tool.js";

const AGENT_ZERO_URL = process.env.AGENT_ZERO_URL || "http://agent-zero:80";
const AGENT_ZERO_API_KEY = process.env.AGENT_ZERO_API_KEY || "";

interface AgentZeroApiResponse {
  response?: unknown;
  context_id?: unknown;
  [key: string]: unknown;
}

function toAgentZeroOutput(data: AgentZeroApiResponse): string {
  return typeof data.response === "string" ? data.response : JSON.stringify(data);
}

function toContextId(data: AgentZeroApiResponse): string | undefined {
  return typeof data.context_id === "string" ? data.context_id : undefined;
}

export class AgentZeroDelegateTool extends BaseTool {
  readonly name = "agent_zero_delegate";
  readonly description = "Delegate a task to Agent Zero (browser automation, document creation, web research, multi-agent workflows) and return its response.";
  readonly riskLevel = "guarded" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      task: {
        type: "string" as const,
        description: "The task to delegate to Agent Zero.",
      },
      project: {
        type: "string" as const,
        description: "Optional Agent Zero project name to activate.",
      },
      lifetime_hours: {
        type: "number" as const,
        description: "Chat lifetime in hours (default: 1).",
      },
    },
    required: ["task"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const task = String(args.task ?? "");
    const project = args.project ? String(args.project) : undefined;
    const lifetimeHours = Number(args.lifetime_hours ?? 1);

    try {
      const body: Record<string, unknown> = {
        message: task,
        lifetime_hours: lifetimeHours,
      };
      if (project) body.project_name = project;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (AGENT_ZERO_API_KEY) {
        headers["X-API-KEY"] = AGENT_ZERO_API_KEY;
      }

      const response = await fetch(`${AGENT_ZERO_URL}/api/api_message`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: context.abortSignal,
      });

      if (!response.ok) {
        return {
          ok: false,
          output: `[AGENT_ZERO_ERROR] HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = (await response.json()) as AgentZeroApiResponse;
      return {
        ok: true,
        output: toAgentZeroOutput(data),
        metadata: {
          delegated: true,
          context_id: toContextId(data),
          agent: "agent-zero",
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        output: `[AGENT_ZERO_FAILED] ${msg}`,
      };
    }
  }
}

export class AgentZeroBrowserTool extends BaseTool {
  readonly name = "agent_zero_browser";
  readonly description = "Use Agent Zero's built-in browser to navigate, read, annotate, or interact with web pages. Supports Chrome extensions and visual annotations.";
  readonly riskLevel = "safe" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      url: {
        type: "string" as const,
        description: "The URL to navigate to.",
      },
      instructions: {
        type: "string" as const,
        description: "What to do on the page (click, read, fill form, annotate, etc.).",
      },
    },
    required: ["url", "instructions"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const url = String(args.url ?? "");
    const instructions = String(args.instructions ?? "");
    const task = `Open browser at ${url}. ${instructions}. Report what you see and do.`;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (AGENT_ZERO_API_KEY) {
        headers["X-API-KEY"] = AGENT_ZERO_API_KEY;
      }

      const response = await fetch(`${AGENT_ZERO_URL}/api/api_message`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: task,
          lifetime_hours: 1,
        }),
        signal: context.abortSignal,
      });

      if (!response.ok) {
        return {
          ok: false,
          output: `[AGENT_ZERO_BROWSER_ERROR] HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as AgentZeroApiResponse;
      return {
        ok: true,
        output: toAgentZeroOutput(data),
        metadata: { delegated: true, agent: "agent-zero-browser" },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        output: `[AGENT_ZERO_BROWSER_FAILED] ${msg}`,
      };
    }
  }
}

export class AgentZeroDocumentTool extends BaseTool {
  readonly name = "agent_zero_document";
  readonly description = "Create or edit documents, spreadsheets, or presentations using Agent Zero's LibreOffice integration. Supports ODT, ODS, ODP, Markdown.";
  readonly riskLevel = "guarded" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      format: {
        type: "string" as const,
        description: "Document format: markdown, odt (Writer), ods (Spreadsheet), odp (Presentation).",
        enum: ["markdown", "odt", "ods", "odp"],
      },
      title: {
        type: "string" as const,
        description: "Title or filename for the document.",
      },
      content: {
        type: "string" as const,
        description: "Content or instructions for what the document should contain.",
      },
    },
    required: ["format", "title", "content"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const format = String(args.format ?? "markdown");
    const title = String(args.title ?? "untitled");
    const content = String(args.content ?? "");
    const task = `Create a ${format} document titled "${title}" with the following content/instructions: ${content}. Save it and show me the result.`;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (AGENT_ZERO_API_KEY) {
        headers["X-API-KEY"] = AGENT_ZERO_API_KEY;
      }

      const response = await fetch(`${AGENT_ZERO_URL}/api/api_message`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: task,
          lifetime_hours: 2,
        }),
        signal: context.abortSignal,
      });

      if (!response.ok) {
        return {
          ok: false,
          output: `[AGENT_ZERO_DOC_ERROR] HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as AgentZeroApiResponse;
      return {
        ok: true,
        output: toAgentZeroOutput(data),
        metadata: { delegated: true, format, title, agent: "agent-zero-doc" },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        output: `[AGENT_ZERO_DOC_FAILED] ${msg}`,
      };
    }
  }
}
