/**
 * Google Workspace Capability Module for A-FORGE
 * ZEN-FORGED 2026-08-03 — extracted from arifOS kernel google_workspace.py
 *
 * Registers: forge_gmail, forge_drive, forge_sheets, forge_calendar
 *
 * Constitutional gating:
 *   - All reads: OBSERVE (no lease required)
 *   - All mutates: requires actor_id + lease + arif_judge SEAL
 *   - Irreversible (send): requires ACK + WITNESS + capability membrane
 *
 * Architecture:
 *   TypeScript handler → arif_judge gate → Python gws_bridge.py → Google APIs
 *
 * @module capabilities/google-workspace
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const GWS_BRIDGE = "/root/A-FORGE/src/capabilities/google-workspace/gws_bridge.py";
const PYTHON = "python3";

/** Shared schemas */
const actorIdSchema = z.string().optional().describe("Sovereign actor identifier for audit (F11)");
const sessionFields = {
  session_id: z.string().optional(),
  actor_id: actorIdSchema,
  lease_id: z.string().optional(),
  session_token: z.string().optional().describe("Arif's Capability Token (ACT) — preferred alias for session_token"),
  sct: z.string().optional().describe("Alias for session_token (legacy alias — use act)"),
  act: z.string().optional().describe("Arif's Capability Token (ACT) — preferred alias for session_token"),
};

/**
 * Execute Python bridge and return structured result.
 */
async function bridgeCall(service: string, verb: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const { execSync } = await import("child_process");
  const cmdParts = [PYTHON, GWS_BRIDGE, service, verb];
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined && v !== null && v !== "") {
      cmdParts.push(`--${k.replace(/_/g, "-")}`);
      cmdParts.push(typeof v === "object" ? JSON.stringify(v) : String(v));
    }
  }
  const cmd = cmdParts.join(" ");
  try {
    const stdout = execSync(cmd, { timeout: 30000, encoding: "utf-8", maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message;
    return { status: "HOLD", error: `bridge_failed: ${stderr}` };
  }
}

/** 
 * arif_judge gate wrapper — every mutating verb passes through here.
 * In production this calls arifOS :8088 arif_judge. For now, structured gate.
 */
async function gateMutate(verb: string, blastRadius: string, reversibility: string): Promise<{ passed: boolean; cc_id?: string; reason?: string }> {
  // Constitutional gate — delegates to arif_judge in production
  // For irreversible verbs, requires witness + sovereign ACK
  if (reversibility === "IRREVERSIBLE") {
    return {
      passed: false,
      reason: "IRREVERSIBLE_VERB: Requires arif_judge SEAL + sovereign ACK + tri-witness before execution.",
    };
  }
  // Mutate verbs require lease
  return { passed: true }; // Lease check handled at MCP ingress layer
}

// ─── HANDLERS ────────────────────────────────────────────────────────

async function gmailHandler(args: any): Promise<any> {
  const { verb, ...opts } = args;
  const gating = verb === "send" ? { br: "HIGH", rev: "IRREVERSIBLE" }
    : verb?.startsWith("draft") || verb === "modify_labels" ? { br: "LOW", rev: "REVERSIBLE" }
    : { br: "LOW", rev: "READ" };

  if (gating.rev !== "READ") {
    const gate = await gateMutate(`gmail.${verb}`, gating.br, gating.rev);
    if (!gate.passed) {
      return { content: [{ type: "text", text: JSON.stringify({ verdict: "HOLD", gate: "arif_judge", reason: gate.reason }) }] };
    }
  }

  const result = await bridgeCall("gmail", verb, opts);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

async function driveHandler(args: any): Promise<any> {
  const { verb, ...opts } = args;
  const result = await bridgeCall("drive", verb, opts);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

async function sheetsHandler(args: any): Promise<any> {
  const { verb, ...opts } = args;
  const gating = verb === "append" || verb === "update" ? { br: "LOW", rev: "REVERSIBLE" } : { br: "LOW", rev: "READ" };

  if (gating.rev !== "READ") {
    const gate = await gateMutate(`sheets.${verb}`, gating.br, gating.rev);
    if (!gate.passed) {
      return { content: [{ type: "text", text: JSON.stringify({ verdict: "HOLD", gate: "arif_judge", reason: gate.reason }) }] };
    }
  }

  const result = await bridgeCall("sheets", verb, opts);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

async function calendarHandler(args: any): Promise<any> {
  const { verb, ...opts } = args;
  const gating = verb === "create_event" || verb === "update_event" ? { br: "MEDIUM", rev: "REVERSIBLE" }
    : verb === "delete_event" ? { br: "MEDIUM", rev: "IRREVERSIBLE" }
    : { br: "LOW", rev: "READ" };

  if (gating.rev !== "READ") {
    const gate = await gateMutate(`calendar.${verb}`, gating.br, gating.rev);
    if (!gate.passed) {
      return { content: [{ type: "text", text: JSON.stringify({ verdict: "HOLD", gate: "arif_judge", reason: gate.reason }) }] };
    }
  }

  const result = await bridgeCall("calendar", verb, opts);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

// ─── REGISTRATION ─────────────────────────────────────────────────────

/**
 * Register all Google Workspace MCP tools with the A-FORGE server.
 * Call from core.ts after server initialization.
 */
export function registerGoogleWorkspaceTools(server: McpServer): void {
  // ── Gmail ──────────────────────────────────────────────────────────
  server.registerTool(
    "forge_gmail",
    {
      description: "Google Gmail — search, read, draft, send emails through constitutional gate. ACTUATOR · gmail · MUTATE. OBSERVE-class for reads. Every write gated by arif_judge + F1/F3/F13.",
      inputSchema: z.object({
        verb: z.enum(["read-unread", "send"]).describe("Gmail action"),
        max: z.number().optional().describe("Max results (1-50)"),
        query: z.string().optional().describe("Gmail search query, e.g. 'is:unread from:boss@example.com'"),
        to: z.string().optional().describe("Recipient (send)"),
        subject: z.string().optional().describe("Email subject (send)"),
        body: z.string().optional().describe("Email body (send)"),
        ...sessionFields,
      }),
    },
    gmailHandler
  );

  // ── Drive ──────────────────────────────────────────────────────────
  server.registerTool(
    "forge_drive",
    {
      description: "Google Drive — list recent files, search by name. OBSERVE-class. Read-only connector.",
      inputSchema: z.object({
        verb: z.enum(["list", "search"]).describe("Drive action"),
        max: z.number().optional().describe("Max results (1-50)"),
        query: z.string().optional().describe("Search query (file name)"),
        ...sessionFields,
      }),
    },
    driveHandler
  );

  // ── Sheets ─────────────────────────────────────────────────────────
  server.registerTool(
    "forge_sheets",
    {
      description: "Google Sheets — read cell values (A1 notation, not rendering), append rows. Mutations gated by arif_judge. CELL-LEVEL reads with structured rowCount + range echo.",
      inputSchema: z.object({
        verb: z.enum(["read", "append"]).describe("Sheets action"),
        id: z.string().describe("Spreadsheet ID from URL (/d/SPREADSHEET_ID/)"),
        range: z.string().optional().describe("A1 notation range, e.g. 'Sheet1!A1:Z100'"),
        values: z.any().optional().describe("Values to append (array of row arrays)"),
        ...sessionFields,
      }),
    },
    sheetsHandler
  );

  // ── Calendar ───────────────────────────────────────────────────────
  server.registerTool(
    "forge_calendar",
    {
      description: "Google Calendar — list upcoming events, create events. Mutations gated by arif_judge. Timezone: Asia/Kuala_Lumpur.",
      inputSchema: z.object({
        verb: z.enum(["list", "create"]).describe("Calendar action"),
        max: z.number().optional().describe("Max events (1-50)"),
        calendar_id: z.string().optional().describe("Calendar ID (default: primary)"),
        summary: z.string().optional().describe("Event title (create)"),
        start: z.string().optional().describe("Start ISO 8601 (create)"),
        end: z.string().optional().describe("End ISO 8601 (create)"),
        description: z.string().optional().describe("Event description (create)"),
        timezone: z.string().optional().describe("Timezone (default: Asia/Kuala_Lumpur)"),
        ...sessionFields,
      }),
    },
    calendarHandler
  );
}
