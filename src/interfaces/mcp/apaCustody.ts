/**
 * APA Custody Gate — kill switch, denial ledger, idempotency, read-back.
 *
 * SINGLE ENFORCEMENT POINT: src/interfaces/mcp/core.ts (MCP ingress).
 * Per-app authority manifests stay in /root/A-FORGE/apa/manifests; the lease
 * validator stays in forgeTools.ts and is called from core.ts (MCP) and
 * server.ts (HTTP) — one implementation, two transports.
 *
 * Duties:
 *   1. Kill switch   — apa/state/revocations.json
 *   2. Denial ledger — apa/state/denials.jsonl
 *   3. Idempotency   — apa/state/idempotency/<key>.json
 *   4. Read-back     — independent read after send/append/create
 *
 * DITEMPA BUKAN DIBERI — custody is enforced, not documented.
 */

import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type ApaApp =
  | "gmail"
  | "telegram"
  | "drive"
  | "sheets"
  | "calendar"
  | "github"
  | "email"
  | "gws"
  | "gemini";

const STATE_DIR = process.env.APA_STATE_DIR ?? "/var/lib/a-forge/apa";
const REVOCATIONS_PATH = join(STATE_DIR, "revocations.json");
const DENIALS_PATH = join(STATE_DIR, "denials.jsonl");
const IDEMPOTENCY_DIR = join(STATE_DIR, "idempotency");
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IN_FLIGHT_TTL_MS = 5 * 60 * 1000;

const GMAIL_BRIDGE = process.env.APA_GMAIL_BRIDGE_URL ?? "http://127.0.0.1:18097";
const DRIVE_BRIDGE = process.env.APA_DRIVE_BRIDGE_URL ?? "http://127.0.0.1:18099";
const SHEETS_BRIDGE = process.env.APA_SHEETS_BRIDGE_URL ?? "http://127.0.0.1:18075";
const TELEGRAM_BRIDGE = process.env.APA_TELEGRAM_BRIDGE_URL ?? "http://127.0.0.1:18096";

const GOVERNANCE_KEYS = new Set([
  "session_id",
  "session_token",
  "sct",
  "act",
  "lease_id",
  "actor_id",
  "justification",
  "claim_class",
  "idempotency_key",
]);

// ── App resolution ───────────────────────────────────────────────────────────

export function resolveApaApp(toolName: string): ApaApp | null {
  if (toolName === "forge_gmail") return "gmail";
  if (toolName === "forge_telegram") return "telegram";
  if (toolName === "forge_drive") return "drive";
  if (toolName === "forge_drive_create") return "drive";
  if (toolName === "forge_sheets") return "sheets";
  if (toolName === "forge_calendar") return "calendar";
  if (toolName.startsWith("forge_github")) return "github";
  if (toolName === "forge_email") return "email";
  if (toolName === "forge_gws") return "gws";
  if (toolName === "forge_gemini") return "gemini";
  return null;
}

/** Verbs that change external state -> idempotency + read-back required. */
export function isMutatingApaVerb(app: ApaApp, verb: string, tool = ""): boolean {
  switch (app) {
    case "gmail":
      return verb === "send" || verb === "draft_send";
    case "telegram":
      return verb === "send" || verb === "send_message" || verb === "send_file";
    case "drive":
      return verb === "create";
    case "sheets":
      return verb === "append" || verb === "update";
    case "calendar":
      return verb === "create" || verb === "create_event" || verb === "delete" || verb === "delete_event";
    case "github":
      return (
        tool.includes("create") ||
        tool.includes("update") ||
        ["pr", "merge", "push", "comment", "close"].includes(verb)
      );
    default:
      return false;
  }
}

// ── Revocation kill switch ───────────────────────────────────────────────────

export interface RevocationEntry {
  reason?: string;
  at?: string;
  by?: string;
}

export interface RevocationState {
  revoked?: Record<string, RevocationEntry>;
  updated_at?: string;
}

let revocationCache: { mtimeMs: number; state: RevocationState } | null = null;

export function readRevocations(): RevocationState {
  try {
    const st = statSync(REVOCATIONS_PATH);
    if (revocationCache && revocationCache.mtimeMs === st.mtimeMs) {
      return revocationCache.state;
    }
    const parsed = JSON.parse(readFileSync(REVOCATIONS_PATH, "utf8")) as RevocationState;
    const state = parsed && typeof parsed === "object" ? parsed : { revoked: {} };
    revocationCache = { mtimeMs: st.mtimeMs, state };
    return state;
  } catch (err: any) {
    if (err?.code === "ENOENT") return { revoked: {} };
    // The kill switch cannot read its own state -> fail closed.
    return {
      revoked: {
        "*": {
          reason: `REVOCATION_STATE_UNREADABLE: ${err?.message ?? String(err)}`,
          at: new Date().toISOString(),
          by: "apa-custody-fail-closed",
        },
      },
    };
  }
}

export interface RevocationDecision {
  revoked: boolean;
  key?: string;
  reason?: string;
  at?: string;
  by?: string;
}

export function checkApaRevocation(app: ApaApp): RevocationDecision {
  const revoked = readRevocations().revoked ?? {};
  const appEntry = revoked[app];
  const wildcard = revoked["*"];
  const key = appEntry ? app : wildcard ? "*" : null;
  if (!key) return { revoked: false };
  const entry = key === app ? appEntry : wildcard!;
  return {
    revoked: true,
    key,
    reason: entry?.reason ?? "APA_KILL_SWITCH",
    at: entry?.at,
    by: entry?.by,
  };
}

// ── Denial ledger ────────────────────────────────────────────────────────────

export interface ApaDenialInput {
  tool: string;
  app: ApaApp | null;
  gate: string;
  reason: string;
  actor_id?: string;
  lease_id?: string;
  verb?: string;
  args?: Record<string, unknown>;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export async function recordApaDenial(input: ApaDenialInput): Promise<void> {
  const entry = {
    ts: new Date().toISOString(),
    tool: input.tool,
    app: input.app,
    gate: input.gate,
    reason: input.reason,
    actor_id: input.actor_id ?? null,
    lease_id: input.lease_id ?? null,
    verb: input.verb ?? null,
    args_hash: input.args ? sha256(stableStringify(input.args)) : null,
  };
  try {
    await mkdir(STATE_DIR, { recursive: true });
    await appendFile(DENIALS_PATH, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    // A blocked action stays blocked even if the ledger cannot be written.
    process.stderr.write(`[apa-custody] DENIAL_LEDGER_WRITE_FAILED: ${String(err)}\n`);
  }
}

// ── Idempotency ──────────────────────────────────────────────────────────────

export interface IdempotencyRecord {
  key: string;
  app: ApaApp;
  verb: string;
  status: "in_flight" | "success" | "failed" | "unverified";
  ts: string;
  result?: unknown;
  error?: string;
}

export function computeIdempotencyKey(
  app: ApaApp,
  verb: string,
  args: Record<string, unknown>,
): string {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args ?? {})) {
    if (key.startsWith("_") || GOVERNANCE_KEYS.has(key)) continue;
    filtered[key] = value;
  }
  return sha256(`${app}|${verb}|${stableStringify(filtered)}`);
}

function idempotencyPath(key: string): string {
  return join(IDEMPOTENCY_DIR, `${key}.json`);
}

async function readIdempotencyRecord(path: string): Promise<IdempotencyRecord | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as IdempotencyRecord;
    if (!parsed || typeof parsed !== "object" || !parsed.key) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type IdempotencyBegin =
  | { mode: "execute"; key: string }
  | { mode: "replay"; key: string; result: unknown }
  | { mode: "in_flight"; key: string; record?: IdempotencyRecord };

export async function beginIdempotent(
  app: ApaApp,
  verb: string,
  args: Record<string, unknown>,
): Promise<IdempotencyBegin> {
  const key = computeIdempotencyKey(app, verb, args);
  const path = idempotencyPath(key);
  await mkdir(IDEMPOTENCY_DIR, { recursive: true });

  const existing = await readIdempotencyRecord(path);
  if (existing) {
    const age = Date.now() - Date.parse(existing.ts);
    if (existing.status === "success" && age < IDEMPOTENCY_TTL_MS) {
      return { mode: "replay", key, result: existing.result };
    }
    if (existing.status === "in_flight" && age < IN_FLIGHT_TTL_MS) {
      return { mode: "in_flight", key, record: existing };
    }
    if (existing.status === "unverified" && age < IDEMPOTENCY_TTL_MS) {
      // Side effect may exist but was not verified. Never auto-retry.
      return { mode: "in_flight", key, record: existing };
    }
    // failed / expired -> allow a new attempt below.
  }

  const record: IdempotencyRecord = {
    key,
    app,
    verb,
    status: "in_flight",
    ts: new Date().toISOString(),
  };

  try {
    await writeFile(path, JSON.stringify(record), { encoding: "utf8", flag: "wx" });
    return { mode: "execute", key };
  } catch (err: any) {
    if (err?.code === "EEXIST") {
      const again = await readIdempotencyRecord(path);
      if (again?.status === "success") return { mode: "replay", key, result: again.result };
      return { mode: "in_flight", key, record: again ?? undefined };
    }
    throw err;
  }
}

export async function completeIdempotent(key: string, result: unknown): Promise<void> {
  const prior = await readIdempotencyRecord(idempotencyPath(key));
  const record: IdempotencyRecord = {
    key,
    app: prior?.app ?? "gmail",
    verb: prior?.verb ?? "unknown",
    status: "success",
    ts: new Date().toISOString(),
    result,
  };
  await writeFile(idempotencyPath(key), JSON.stringify(record), "utf8");
}

export async function failIdempotent(key: string, error: string): Promise<void> {
  const prior = await readIdempotencyRecord(idempotencyPath(key));
  const record: IdempotencyRecord = {
    key,
    app: prior?.app ?? "gmail",
    verb: prior?.verb ?? "unknown",
    status: "failed",
    ts: new Date().toISOString(),
    error,
  };
  await writeFile(idempotencyPath(key), JSON.stringify(record), "utf8");
}

export async function unverifyIdempotent(key: string, reason: string): Promise<void> {
  const prior = await readIdempotencyRecord(idempotencyPath(key));
  const record: IdempotencyRecord = {
    key,
    app: prior?.app ?? "gmail",
    verb: prior?.verb ?? "unknown",
    status: "unverified",
    ts: new Date().toISOString(),
    error: reason,
    result: prior?.result,
  };
  await writeFile(idempotencyPath(key), JSON.stringify(record), "utf8");
}

// ── Read-back ────────────────────────────────────────────────────────────────

export interface ReadBackResult {
  ok: boolean;
  level: string;
  reason?: string;
  observed?: Record<string, unknown>;
}

async function bridgePost(url: string, body: unknown, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await resp.json() as any;
    if (!resp.ok) return { ok: false, error: `HTTP_${resp.status}`, raw: json };
    return json;
  } catch (err: any) {
    return { ok: false, error: err?.name === "AbortError" ? "READ_BACK_TIMEOUT" : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function verifyGmail(messageId: string): Promise<ReadBackResult> {
  const resp = await bridgePost(GMAIL_BRIDGE, { verb: "read", params: { message_id: messageId } });
  const observedId = resp?.result?.id ?? null;
  const ok = resp?.ok === true && observedId === messageId;
  return {
    ok,
    level: "content_metadata",
    reason: ok ? undefined : (resp?.error ?? "MESSAGE_NOT_FOUND_ON_READBACK"),
    observed: {
      message_id: observedId,
      subject: resp?.result?.headers?.Subject ?? null,
      to: resp?.result?.headers?.To ?? null,
    },
  };
}

async function verifySheets(spreadsheetId: string, updatedRange: string, expectedRows: number): Promise<ReadBackResult> {
  const resp = await bridgePost(SHEETS_BRIDGE, {
    verb: "read",
    params: { spreadsheet_id: spreadsheetId, range: updatedRange },
  });
  const rowCount = Number(resp?.result?.row_count ?? -1);
  const ok = resp?.ok === true && rowCount >= expectedRows;
  return {
    ok,
    level: "content_rows",
    reason: ok ? undefined : (resp?.error ?? `ROWS_NOT_FOUND expected=${expectedRows} observed=${rowCount}`),
    observed: { spreadsheet_id: spreadsheetId, range: updatedRange, row_count: rowCount, expected_rows: expectedRows },
  };
}

async function verifyDrive(fileId: string): Promise<ReadBackResult> {
  const resp = await bridgePost(DRIVE_BRIDGE, { verb: "get_metadata", params: { file_id: fileId } });
  const observedId = resp?.result?.id ?? null;
  const ok = resp?.ok === true && observedId === fileId;
  return {
    ok,
    level: "metadata",
    reason: ok ? undefined : (resp?.error ?? "FILE_NOT_FOUND_ON_READBACK"),
    observed: { file_id: observedId, name: resp?.result?.name ?? null, web_view_link: resp?.result?.webViewLink ?? null },
  };
}

async function verifyTelegram(messageId: number | string): Promise<ReadBackResult> {
  // Bot API is send-only for this bridge (getUpdates is intentionally removed).
  // Read-back verifies transport ack + bot identity, not message content.
  const resp = await bridgePost(TELEGRAM_BRIDGE, { mode: "get_me" });
  const bot = resp?.result ?? {};
  const ok = resp?.ok === true && Boolean(bot.username || bot.id) && Boolean(messageId);
  return {
    ok,
    level: "transport_ack+bot_identity",
    reason: ok ? undefined : (resp?.error ?? "TELEGRAM_ACK_UNVERIFIED"),
    observed: { message_id: messageId, bot_username: bot.username ?? null, bot_id: bot.id ?? null },
  };
}

export async function runApaReadBack(
  app: ApaApp | null,
  verb: string,
  args: Record<string, unknown>,
  payload: any,
): Promise<ReadBackResult | null> {
  const result = payload?.result ?? {};
  if (app === "gmail" && verb === "send" && result?.message_id) {
    return verifyGmail(String(result.message_id));
  }
  if (app === "sheets" && verb === "append" && result?.updated_range) {
    const expected = Array.isArray(args.values) ? args.values.length : 1;
    return verifySheets(String(args.id ?? ""), String(result.updated_range), expected);
  }
  if (app === "drive" && verb === "create" && result?.file_id) {
    return verifyDrive(String(result.file_id));
  }
  if (app === "telegram" && verb === "send" && result?.message_id) {
    return verifyTelegram(result.message_id);
  }
  return null;
}

// ── MCP envelope helpers ─────────────────────────────────────────────────────

export interface ApaPreflightOk {
  ok: true;
  app: ApaApp | null;
  tool: string;
  verb: string;
  idemKey?: string;
}

export interface ApaPreflightBlocked {
  ok: false;
  response: any;
}

export type ApaPreflightResult = ApaPreflightOk | ApaPreflightBlocked;

export function extractMcpJson(result: any): any | null {
  const text = result?.content?.[0]?.text;
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function mcpJson(payload: unknown, isError = true): any {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}

/**
 * Pre-handler gate. Runs BEFORE FQ/ACT/claim/lease. Revocation is absolute:
 * even a valid lease cannot execute a revoked app.
 */
export async function apaPreflight(
  tool: string,
  args: Record<string, unknown>,
): Promise<ApaPreflightResult> {
  const app = resolveApaApp(tool);
  if (!app) return { ok: true, app: null, tool, verb: "" };

  const verb = typeof args.verb === "string" ? args.verb
    : typeof args.mode === "string" ? args.mode
    : "";
  const actor_id = typeof args.actor_id === "string" ? args.actor_id : undefined;
  const lease_id = typeof args.lease_id === "string" ? args.lease_id : undefined;

  const rev = checkApaRevocation(app);
  if (rev.revoked) {
    await recordApaDenial({
      tool,
      app,
      gate: "APA_KILL_SWITCH",
      reason: rev.reason ?? "revoked",
      actor_id,
      lease_id,
      verb,
      args,
    });
    return {
      ok: false,
      response: mcpJson({
        error: "APA_REVOKED",
        verdict: "HOLD",
        gate: "APA_KILL_SWITCH",
        app,
        revoked_by: rev.by ?? null,
        revoked_at: rev.at ?? null,
        reason: rev.reason ?? "revoked",
        next_action: `apa-revoke clear ${app}`,
      }),
    };
  }

  if (!isMutatingApaVerb(app, verb, tool)) {
    return { ok: true, app, tool, verb };
  }

  const idem = await beginIdempotent(app, verb, args);
  if (idem.mode === "replay") {
    const payload = extractMcpJson(idem.result);
    if (payload) {
      return {
        ok: false,
        response: mcpJson(
          { ...payload, _apa: { idempotent_replay: true, key: idem.key } },
          false,
        ),
      };
    }
    return { ok: false, response: idem.result ?? mcpJson({ error: "APA_IDEMPOTENT_REPLAY_EMPTY", key: idem.key }) };
  }
  if (idem.mode === "in_flight") {
    await recordApaDenial({
      tool,
      app,
      gate: "APA_IDEMPOTENCY",
      reason: idem.record?.status === "unverified"
        ? "UNVERIFIED_PRIOR_ATTEMPT — reconcile before retry"
        : "IN_FLIGHT — duplicate suppressed",
      actor_id,
      lease_id,
      verb,
      args,
    });
    return {
      ok: false,
      response: mcpJson({
        error: "APA_IDEMPOTENT_IN_FLIGHT",
        verdict: "HOLD",
        gate: "APA_IDEMPOTENCY",
        app,
        key: idem.key,
        prior_status: idem.record?.status ?? "unknown",
        reason: idem.record?.status === "unverified"
          ? "A prior attempt executed but read-back did not verify. Reconcile before retrying; this payload will not auto-retry."
          : "An identical payload is already executing. Duplicate suppressed.",
      }),
    };
  }

  return { ok: true, app, tool, verb, idemKey: idem.key };
}

/**
 * Post-handler gate. Records the result, performs read-back, downgrades
 * unverified side effects. Handlers may attach their own read_back field;
 * otherwise the custody layer reads the app back through the APA bridge.
 */
export async function apaPostflight(
  pre: ApaPreflightOk,
  args: Record<string, unknown>,
  result: any,
): Promise<any> {
  if (!pre.idemKey) return result;

  let payload = extractMcpJson(result);
  if (!payload) {
    await completeIdempotent(pre.idemKey, result);
    return result;
  }

  let readBack: ReadBackResult | null = payload.read_back ?? null;
  if (!readBack) {
    readBack = await runApaReadBack(pre.app, pre.verb, args, payload);
  }

  if (readBack && readBack.ok === false) {
    const reason = readBack.reason ?? "READ_BACK_FAILED";
    await unverifyIdempotent(pre.idemKey, reason);
    await recordApaDenial({
      tool: pre.tool,
      app: pre.app,
      gate: "APA_READ_BACK",
      reason,
      verb: pre.verb,
      args,
    });
    payload = {
      ...payload,
      verdict: "HOLD",
      read_back: readBack,
      apa: {
        state: "EXECUTED_UNVERIFIED",
        idempotency_key: pre.idemKey,
        note: "The external call may have succeeded but read-back did not verify it. Do not retry blindly.",
      },
    };
    return mcpJson(payload, true);
  }

  if (readBack) {
    payload = { ...payload, read_back: readBack };
    const augmented = mcpJson(payload, Boolean(result?.isError));
    await completeIdempotent(pre.idemKey, augmented);
    return augmented;
  }

  await completeIdempotent(pre.idemKey, result);
  return result;
}

export async function apaFail(pre: ApaPreflightOk, error: unknown): Promise<void> {
  if (!pre.idemKey) return;
  await failIdempotent(pre.idemKey, String(error));
}
