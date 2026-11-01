/**
 * APA connectors that complete the custody surface without touching the
 * Gödel-locked Google Workspace capability directory:
 *   - forge_telegram     : send / get_me through APA telegram bridge :18096
 *   - forge_drive_create : create a Drive file via the gws CLI, then read back
 *
 * Both register through server.registerTool(), so core.ts wraps them with the
 * same FQ/ACT/claim/lease/APA gates as every other tool.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkEgressGrant } from "../../domain/governance/egressGrant.js";

const TELEGRAM_BRIDGE = process.env.APA_TELEGRAM_BRIDGE_URL ?? "http://127.0.0.1:18096";
const GWS_BIN = process.env.GWS_BIN ?? "/usr/local/bin/gws";
const APA_TMP_DIR = process.env.APA_TMP_DIR ?? "/tmp/opencode";

const sessionFields = {
  session_id: z.string().optional(),
  actor_id: z.string().optional(),
  lease_id: z.string().optional(),
  session_token: z.string().optional(),
  sct: z.string().optional(),
  act: z.string().optional(),
};

async function telegramBridge(mode: string, params: Record<string, unknown> = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(TELEGRAM_BRIDGE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, ...params }),
      signal: controller.signal,
    });
    return await resp.json();
  } catch (err: any) {
    return { ok: false, error: err?.name === "AbortError" ? "TELEGRAM_BRIDGE_TIMEOUT" : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function telegramHandler(
  args: any,
  _ctx?: any,
  deps?: { bridge?: (mode: string, params?: Record<string, unknown>) => Promise<any> },
): Promise<any> {
  const verb = String(args.verb ?? "");
  if (verb === "get_me") {
    const r = await (deps?.bridge ?? telegramBridge)("get_me");
    const payload = r?.ok
      ? { status: "SEAL", verb, result: r.result }
      : { status: "HOLD", verb, error: r?.error ?? "telegram_get_me_failed" };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }

  if (verb !== "send") {
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "HOLD", error: `unknown telegram verb: ${verb}` }, null, 2) }],
    };
  }

  if (!args.chat_id || !args.text) {
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "HOLD", error: "chat_id and text are required for send" }, null, 2) }],
    };
  }

  // HUMAN_RASA G1 — per-message egress grant (AFORGE_EGRESS_PER_MESSAGE_GRANT,
  // default "0"). Telegram has no subject → subject "" so the grant binds
  // sha256("" + text). Fail-closed: any HOLD below fires BEFORE the bridge call.
  const grant = checkEgressGrant({
    grantId: args.grant_id,
    grantRecord: args.grant_record,
    grantPath: args.grant_path,
    recipient: String(args.chat_id),
    subject: "",
    body: String(args.text),
  });
  if (grant.hold) {
    const payload = { status: "HOLD", verb, gate: "EGRESS_PER_MESSAGE_GRANT", error: grant.code, reason: grant.reason };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }

  const r = await (deps?.bridge ?? telegramBridge)("send_message", {
    chat_id: args.chat_id,
    text: args.text,
    parse_mode: args.parse_mode ?? "HTML",
  });

  const sent = r?.ok === true && r?.result?.sent === true;
  const payload = sent
    ? {
        status: "SEAL",
        verb,
        result: {
          message_id: r.result.message_id,
          chat: r.result.chat ?? null,
          sent: true,
        },
      }
    : {
        status: "HOLD",
        verb,
        error: r?.error ?? "telegram_send_failed",
        result: r?.result ?? null,
      };

  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function runGws(args: string[]): any {
  const out = execFileSync(GWS_BIN, args, {
    encoding: "utf-8",
    timeout: 45000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const trimmed = out.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

async function driveCreateHandler(args: any): Promise<any> {
  const name = String(args.name ?? "").trim();
  const content = typeof args.content === "string" ? args.content : "";
  if (!name) {
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "HOLD", error: "name is required" }, null, 2) }],
    };
  }

  mkdirSync(APA_TMP_DIR, { recursive: true });
  const dir = mkdtempSync(join(APA_TMP_DIR, "apa-drive-"));
  const filePath = join(dir, name.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.txt");
  writeFileSync(filePath, content, "utf8");

  try {
    const metadata: Record<string, unknown> = {
      name,
      mimeType: args.mime_type ?? "text/plain",
    };
    if (args.parent_id) metadata.parents = [String(args.parent_id)];

    const created = runGws([
      "drive", "files", "create",
      "--json", JSON.stringify(metadata),
      "--upload", filePath,
      "--upload-content-type", String(args.mime_type ?? "text/plain"),
      "--format", "json",
    ]);

    const fileId = created?.id ?? created?.fileId ?? null;
    if (!fileId) {
      return {
        content: [{ type: "text", text: JSON.stringify({ status: "HOLD", error: "drive_create_no_file_id", result: created }, null, 2) }],
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "SEAL",
          verb: "create",
          result: {
            file_id: fileId,
            name: created?.name ?? name,
            mime_type: created?.mimeType ?? metadata.mimeType,
            web_view_link: created?.webViewLink ?? null,
          },
        }, null, 2),
      }],
    };
  } catch (err: any) {
    const stderr = err?.stderr?.toString?.() ?? "";
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "HOLD",
          error: `drive_create_failed: ${err?.message ?? String(err)}`,
          stderr: stderr.slice(0, 1200),
        }, null, 2),
      }],
    };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch { /* best-effort */ }
  }
}

export function registerApaConnectors(server: McpServer): void {
  server.registerTool(
    "forge_telegram",
    {
      description: "APA Telegram send-only connector. Verbs: send, get_me. Sends through the local APA bridge (:18096) using @arifOS_bot. send is IRREVERSIBLE (a sent message cannot be recalled) and carries transport read-back. When AFORGE_EGRESS_PER_MESSAGE_GRANT=1, send additionally requires grant_id + a readable grant record binding {recipient, sha256(subject+body), expires_at, issued_by} — fail-closed HOLD otherwise.",
      inputSchema: z.object({
        verb: z.enum(["send", "get_me"]).describe("Telegram action"),
        chat_id: z.string().optional().describe("Target chat id (send)"),
        text: z.string().optional().describe("Message text (send)"),
        parse_mode: z.enum(["HTML", "Markdown", "MarkdownV2"]).optional().describe("Parse mode (default HTML)"),
        grant_id: z.string().optional().describe("Per-message egress grant id (required when AFORGE_EGRESS_PER_MESSAGE_GRANT=1)"),
        grant_record: z.record(z.string(), z.unknown()).optional().describe("Stored grant record binding {grant_id, recipient, payload_sha256, expires_at, issued_by}"),
        grant_path: z.string().optional().describe("Path to a JSON grant record (alternative to grant_record)"),
        ...sessionFields,
      }),
    },
    telegramHandler,
  );

  server.registerTool(
    "forge_drive_create",
    {
      description: "Create a Google Drive file (text content, any MIME type) via the gws CLI. Returns file_id; APA custody reads metadata back after creation. For native Google Docs use the gws docs lane.",
      inputSchema: z.object({
        name: z.string().describe("File name"),
        content: z.string().default("").describe("UTF-8 file content"),
        mime_type: z.string().optional().describe("MIME type (default text/plain)"),
        parent_id: z.string().optional().describe("Parent folder id"),
        ...sessionFields,
      }),
    },
    driveCreateHandler,
  );
}
