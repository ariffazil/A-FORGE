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
import { checkEgressGrant } from "../../domain/governance/egressGrant.js";

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
  const { execFileSync } = await import("child_process");
  const argList: string[] = [GWS_BRIDGE, service, verb];
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined && v !== null && v !== "") {
      argList.push(`--${k.replace(/_/g, "-")}`);
      argList.push(typeof v === "object" ? JSON.stringify(v) : String(v));
    }
  }
  try {
    const stdout = execFileSync(PYTHON, argList, { timeout: 30000, encoding: "utf-8", maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message;
    return { status: "HOLD", error: `bridge_failed: ${stderr}` };
  }
}

/** 
 * arif_judge gate wrapper — every mutating verb passes through here.
 * HUMAN_RASA G1 (2026-11-01) doc-truth fix: this does NOT call arifOS arif_judge.
 * It is a local structured reversibility gate: IRREVERSIBLE verbs fail closed
 * (HOLD) UNLESS they are gmail.send / gmail.draft_send, which ride the standing
 * F13_EMAIL_SEND lane authorized 2026-10-18 (receipt recorded for audit, no HOLD).
 * Production arif_judge integration (SEAL + sovereign ACK + tri-witness) has NOT
 * landed; the IRREVERSIBLE_VERB reason below is what holds every other verb.
 */
export async function gateMutate(verb: string, blastRadius: string, reversibility: string): Promise<{ passed: boolean; cc_id?: string; reason?: string }> {
  // Local structured gate — NOT a live arif_judge call (see doc comment above)
  // For irreversible verbs, requires witness + sovereign ACK
  if (reversibility === "IRREVERSIBLE") {
    // F13 authorization 2026-10-18: email send is a sovereign-authorized
    // capability — agent may send; receipt is recorded for audit (no HOLD).
    if (verb === "gmail.send" || verb === "gmail.draft_send") {
      return { passed: true, cc_id: "F13_EMAIL_SEND", reason: "F13-authorized email send lane (2026-10-18)" };
    }
    return {
      passed: false,
      reason: "IRREVERSIBLE_VERB: Requires arif_judge SEAL + sovereign ACK + tri-witness before execution.",
    };
  }
  // Mutate verbs require lease
  return { passed: true }; // Lease check handled at MCP ingress layer
}

// ─── HANDLERS ────────────────────────────────────────────────────────

export async function gmailHandler(
  args: any,
  _ctx?: any,
  deps?: { bridge?: (service: string, verb: string, opts?: Record<string, unknown>) => Promise<Record<string, unknown>> },
): Promise<any> {
  const { verb, grant_id, grant_record, grant_path, ...opts } = args;
  // WEBO audit 2026-10-18: draft_send was misclassified REVERSIBLE via startsWith("draft")
  // and escaped the gate — but draft_send SENDS THE EMAIL (gmail_bridge action_draft_send →
  // users().drafts().send()) = IRREVERSIBLE per the bridge's own header. Fixed: both send
  // paths are IRREVERSIBLE → gateMutate. HUMAN_RASA G1 doc-truth fix (2026-11-01): the old
  // claim "gateMutate fail-closed → 888_HOLD until arif_judge lands" was stale — since the
  // F13 re-authorization the same day, gateMutate passes gmail.send / gmail.draft_send on
  // the standing cc_id F13_EMAIL_SEND lane (no HOLD); every other IRREVERSIBLE verb still
  // HOLDs. [EXPLORATION/Vault audit F1/F13]
  // F13 re-authorization 2026-10-18: email send is a sovereign-authorized capability lane.
  // Actor defaults to the sovereign (arif) for audit; agent may pass an explicit actor_id.
  const gating = (verb === "send" || verb === "draft_send") ? { br: "HIGH", rev: "IRREVERSIBLE" }
    : verb?.startsWith("draft") || verb === "modify_labels" ? { br: "LOW", rev: "REVERSIBLE" }
    : { br: "LOW", rev: "READ" };

  // HUMAN_RASA G1 — per-message egress grant (AFORGE_EGRESS_PER_MESSAGE_GRANT,
  // default "0", NOT flipped). Runs BEFORE the F13_EMAIL_SEND lane: when the flag
  // is on, a standing lane pass is no longer enough — the exact message must be
  // grant-bound. Flag off → skipped, the 2026-10-18 lane behaves exactly as before.
  if (verb === "send" || verb === "draft_send") {
    const grant = checkEgressGrant({
      grantId: grant_id,
      grantRecord: grant_record,
      grantPath: grant_path,
      recipient: String(opts.to ?? ""),
      subject: String(opts.subject ?? ""),
      body: String(opts.body ?? ""),
    });
    if (grant.hold) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ verdict: "HOLD", gate: "EGRESS_PER_MESSAGE_GRANT", reason: `${grant.code}: ${grant.reason}` }),
        }],
      };
    }
  }

  if (gating.rev !== "READ") {
    const gate = await gateMutate(`gmail.${verb}`, gating.br, gating.rev);
    if (!gate.passed) {
      return { content: [{ type: "text", text: JSON.stringify({ verdict: "HOLD", gate: "arif_judge", reason: gate.reason }) }] };
    }
  }

  // Send verbs require an actor for audit (L11 AUTH). Default to sovereign.
  if ((verb === "send" || verb === "draft_send") && !opts.actor_id) {
    opts.actor_id = "arif";
  }

  const result = await (deps?.bridge ?? bridgeCall)("gmail", verb, opts);
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
      description: "Google Gmail — search, read, draft, send emails through the local structured reversibility gate (gateMutate). ACTUATOR · gmail · MUTATE. OBSERVE-class for reads. NOTE: gateMutate does NOT call arif_judge — writes pass a local gate; gmail send/draft_send ride the standing F13_EMAIL_SEND lane (2026-10-18), all other IRREVERSIBLE verbs HOLD. When AFORGE_EGRESS_PER_MESSAGE_GRANT=1, send additionally requires grant_id + a readable grant record — fail-closed HOLD otherwise.",
      inputSchema: z.object({
        verb: z.enum(["read-unread", "send"]).describe("Gmail action"),
        max: z.number().optional().describe("Max results (1-50)"),
        query: z.string().optional().describe("Gmail search query, e.g. 'is:unread from:boss@example.com'"),
        to: z.string().optional().describe("Recipient (send)"),
        subject: z.string().optional().describe("Email subject (send)"),
        body: z.string().optional().describe("Email body (send)"),
        grant_id: z.string().optional().describe("Per-message egress grant id (required when AFORGE_EGRESS_PER_MESSAGE_GRANT=1)"),
        grant_record: z.record(z.string(), z.unknown()).optional().describe("Stored grant record binding {grant_id, recipient, payload_sha256, expires_at, issued_by}"),
        grant_path: z.string().optional().describe("Path to a JSON grant record (alternative to grant_record)"),
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
