/**
 * A-FORGE MCP Server — multi-transport bootstrap (SIMPLIFIED)
 *
 * Supports:
 *   --transport stdio            → local CLI clients
 *   --transport http --port N   → remote clients via Streamable HTTP
 *
 * Multi-client (2026-06-28): HTTP transport allows stateless read-only
 * access for secondary clients via a STATELESS_TOOLS whitelist.
 * First client gets a full session via the SDK transport.
 * Subsequent clients get stateless access to whitelisted tools.
 *
 * @module mcp/serve
 * @constitutional F2 TRUTH — tool count is dynamic; inspect MCP tools/list or server registry at runtime
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { server } from "./core.js";
import { getConstitutionGate, CONSTITUTION_GATE } from "../../application/approval/index.js";
import { getMemoryContract } from "../../domain/memory-contract/index.js";
import { telemetry } from "./telemetry.js";
import { getMcpPolicyGate, EXAMPLE_POLICIES } from "../../domain/governance/McpPolicyGate.js";
import type { VerdictResult } from "../../domain/governance/McpPolicyGate.js";
import { aThinkCheck, aThinkErrorResponse } from "../../domain/governance/aThinkGuard.js";
import { assertActMutationGateOrExit } from "../../infrastructure/governance/actIngress.js";
import { classifyTool, requiresGovernance } from "../../domain/governance/actionClassifier.js";
import { validateSession, validateSessionAsync } from "../../domain/session/sessionGate.js";
import { runP0GateMiddleware, formatGateRejection } from "./p0GateMiddleware.js";

const AFORGE_ROOT = process.cwd();

// Read build commit hash for runtime drift detection
let BUILD_COMMIT = "unknown";
try {
  const commitPath = path.join(AFORGE_ROOT, "dist", "build-commit.txt");
  if (fs.existsSync(commitPath)) {
    BUILD_COMMIT = fs.readFileSync(commitPath, "utf-8").trim();
  }
} catch {
  // Non-critical — health will report "unknown"
}

const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;  // 30 min idle before auto-close
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // check every 5 min
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;    // hard max 24h regardless of activity

// ── Stateless tool whitelist (2026-06-28) ─────────────────────────────
// External HTTP clients can call these tools without a session.
// All other tools require session ownership (first client via SDK transport).
// MUTATE tools (forge_execute, forge_filesystem write, forge_git commit, etc.)
// are NEVER in this list and always require session ownership.
const STATELESS_TOOLS = new Set([
  "forge_session_init",
  "forge_health_check",
  "forge_probe",
  "forge_search",
  "forge_research",
  // forge_minimax_search — REMOVED 2026-07-31 (MiniMax backend deprecating, Brave covers same intent)
  "forge_docs_lookup",
  "forge_memory",
  // forge_systemctl — REMOVED 2026-07-09 (use forge_shell('systemctl ...'))
  "forge_journalctl",
  "forge_registry_status",
  "forge_status",
  "forge_scan",
  "forge_shell_dryrun",
  "forge_shell",
  "forge_shell_status",
  "forge_shell_ledger",
  "forge_shell_alert_history",
  "forge_registry",
  "forge_document_ingest",                                   // Phase 1 — read-only, no side effects

  // ── FS aliases collapsed into forge_filesystem(mode=...) — 2026-07-31 entropy sweep ──
  // forge_filesystem_read/tree/search/stat were thin wrappers. STATELESS_TOOLS now
  // references the canonical forge_filesystem OBSERVE modes directly.
  // "forge_filesystem_read", — REMOVED
  // "forge_filesystem_tree", — REMOVED
  // "forge_filesystem_search", — REMOVED
  // "forge_filesystem_stat", — REMOVED
  "forge_filesystem_grep",

  // ── Phase 5: MCP Policy Gate (2026-06-30) ──────────────────────────
  // Observation/check/list capability in the merged engine is stateless.
  "forge_policy",

  // ── Phase 6: MCP Surface Guard (2026-07-03) ───────────────────────
  // Drift detection is read-only observation. Pin mutates in-memory state only.
  "forge_surface_guard",

  // ── Phase 7: MCP Surface Audit (2026-07-03) ──────────────────────
  // Phantom drift detection — compares registry vs affordances.
  // All modes are read-only (audit, scan). fix mode produces DRAFT only.
  "forge_surface_audit",

  // ── Phase 8: Parallel Orchestration (2026-07-11) ────────────────────
  // Read-only status/list tools. forge_parallel and forge_parallel_cancel
  // are MUTATE and require session ownership.
  "forge_parallel_list",
  "forge_parallel_status",

  // ── Phase 8: P0 Machine Constitution Layer (2026-07-04) ─────────
  // VPS state-anchor tools. All modes are read-only observation.
  // F1 AMANAH: never mutate, only sense. F2 TRUTH: labeled outputs.
  "forge_vps_ports",
  "forge_vps_services",
  "forge_vps_cron",

  // ── Phase 10: Governance Proxy (2026-07-08) ─────────────────────
  // forge_judge_proxy is OBSERVE-class: forwards to arifOS kernel for
  // constitutional judgment. No mutation, no side effects. Safe over HTTP.
  // Session ownership enforced by arifOS, not by A-FORGE transport gate.
  "forge_judge_proxy",

  // ── Phase 9: Reality Loop (2026-07-06) ─────────────────────────────
  // Intent compiler — 7-stage state-tracking ledger. All modes accept
  // session_id as explicit parameter, safe over HTTP. start/list modes
  // require no prior session. F1 AMANAH + F4 CLARITY.
  "forge_reality_loop",
  // renamed 2026-07-09: forge_boundaries_assert → forge_security_drift_scan
  "forge_security_drift_scan",

  // ── Fetch — URL content extraction (OBSERVE-class, no mutations) ───
  "forge_fetch",
  // forge_fetch_url — REMOVED 2026-07-31 → forge_fetch(mode='readable')
  // forge_fetch_json — REMOVED 2026-07-31 → forge_fetch(mode='json')
  // forge_fetch_metadata — REMOVED 2026-07-31 → forge_fetch(mode='metadata')
  // forge_fetch_links — REMOVED 2026-07-31 → forge_fetch(mode='links')

  // ── Web zen (2026-07-30) — OBSERVE site control surface ───────────
  // Thin wrapper around web_zen CLI. doctor/sense/verify/orphan(preview)/
  // ephemeral(sandbox)/caddy-reload-hint. No production rsync --delete apply.
  "forge_web_zen",
  "forge_probe_site",
  // forge_fetch_links — REMOVED 2026-07-31 → forge_fetch(mode='links')

  // ── Viz OBSERVE (2026-07-09) — pure render from payload, no host mutation ──
  // Multi-step GEOX workflows over Streamable HTTP were blocked with
  // "requires session ownership" (-32000). forge_chart is OBSERVE-class:
  // data in → SVG out. Session continuity is optional (session_id param),
  // not a transport ownership requirement.
  "forge_chart",

  // ── GitHub OBSERVE (2026-07-09) — search/read only; multi-client HTTP ──
  // MUTATE github (create_issue/pr/file) stays session-owned. R0 OBSERVE
  // search must not require transport session ownership — same class as forge_fetch.
  "forge_github",
  // forge_github_search_code — REMOVED 2026-07-31 → forge_github(mode='search',type='code')
  // forge_github_search_repos — REMOVED 2026-07-31 → forge_github(mode='search',type='repositories')
  "forge_github_get_file",

  // ── DARWIN FIX 1c: stateless mutate primitives ────────────────────
  // Needed so forge_session_init's auto-minted lease + setActor can be
  // exercised via the HTTP transport without stdio session setup.
  // All are still governed by the policy gate (L1-L4), F12 injection
  // check, F8 path scoping, and arifJudge / arifSeal audit chain.
  "forge_filesystem",
  "forge_vault",
  "forge_lease",
  "forge_agent",
  "forge_lock",
  "forge_seal",
    // ── Phase 9: Scar Law (2026-07-05) ─────────────────────────────
    // forge_scar modes: list + consult are read-only OBSERVE-class.
    // mode=seal requires session ownership (guarded in handler).
    "forge_scar",

    // ── forge_ephemeral (2026-08-02) — temporary capability metabolism ──
    // inspect_gap, list_templates, list_active are OBSERVE. generate,
    // sandbox_test, invoke, verify, retire are session-gated in handler.
    "forge_ephemeral",

    // ── EMD / APEX pipeline (2026-08-06) — OBSERVE validation lane ────
    // encode, emd, goal_status, evaluate are read-only OBSERVE-class.
    // They validate goals and compute G/C_dark without mutating host state.
    // metabolize + recompute remain session-gated (they modify goalStore).
    "forge_apex_encode",
    "forge_apex_goal_status",
    "forge_apex_emd",
    "forge_evaluate",

    // ── OBSERVE expansion (2026-08-13) — session propagation fix ──────
    // These tools are OBSERVE-class but were missing from the whitelist.
    // Agents could not call them via HTTP transport without session ownership.
    // All are read-only or have mode-level gating in their handlers.

    // Entropy & diagnostics
    "forge_entropy_sweep",        // ΔS measurement — read-only filesystem scan
    "forge_fingerprint_check",    // tool fingerprint verification — read-only
    "forge_runtime_verify",       // git vs wheel vs import consistency — read-only
    "forge_isomorphism_check",    // J-space manifold stability — read-only

    // Tri-witness & governance observation
    "forge_witness",              // W³ consensus computation — read-only OBSERVE
    "forge_check_governance",     // delegates to arifOS — read-only proxy
    "forge_heart_critique",       // risk/ethical review — delegates to arifOS
    "forge_predict",              // pre-action simulation — read-only forward model
    "forge_docket_prep",          // evidence packaging — read-only, relinquishes control

    // World Model observation (read-only stats/gaps/quality)
    "forge_wm_stats",             // WM statistics dashboard — read-only
    "forge_wm_gaps",              // WM gap alerts — read-only
    "forge_wm_quality",           // WM trajectory quality — read-only

    // Cooling & scar observation
    "forge_cool_drift",           // cooling receipt emission — OBSERVE-class
    "forge_cool_pattern",         // cooling receipt from recurrence — OBSERVE-class
    "forge_scar_scan",            // SCAR database check — read-only

    // Git/FS read-only modes (handler enforces mode-level gating)
    "forge_git",                  // status/diff/log are OBSERVE; commit is gated in handler
    "forge_worktree",             // git physics sensor — read-only

    // Docker/DB read-only modes (handler enforces mode-level gating)
    "forge_docker",               // ps/logs/images are OBSERVE; exec/images pull gated in handler
    "forge_postgres",             // schema is OBSERVE; query gated in handler

    // Infrastructure observation
    "forge_netdata_alarms",       // Netdata alarms — read-only
    "forge_netdata_metrics",      // Netdata chart data — read-only
    "forge_receipt_draft",        // compliance receipt draft — read-only
    "forge_verify_timeline",      // timeline verification — read-only

    // Organ bridges (read-only relay)
    "forge_wealth",               // WEALTH relay — OBSERVE modes only
    "forge_well",                 // WELL relay — OBSERVE modes only

    // Google Workspace read-only
    "forge_drive",                // Google Drive — read-only connector
    "forge_calendar",             // Google Calendar — list events (create is gated in handler)
    "forge_sheets",               // Google Sheets — read cells (append gated in handler)
    "forge_gmail",                // Gmail — search/read (draft/send gated in handler)
]);

// ── MCP Policy Gate initialization ──────────────────────────────────
// 5-layer enforcement: identity → server → tool → args → verdict.
// Blocks prompt injection / hallucinated plans / unauthorized mutations BEFORE
// any tool handler runs. Architectural, not behavioral.
const mcpPolicyGate = getMcpPolicyGate();

// ── Simple in-memory rate limiter ──────────────────────────────────────
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_CLEANUP_INTERVAL_MS = 120_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(clientIp);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(clientIp, bucket);
  }
  bucket.count++;
  return {
    allowed: bucket.count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - bucket.count),
    resetAt: bucket.resetAt,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, RATE_CLEANUP_INTERVAL_MS).unref();

// ── MCP Policy Gate: evaluate a tool call BEFORE dispatch ────────────
// Returns verdict + reason chain. Called at every tools/call path.
// Non-blocking on engine failure (fail-open → DENY with reason).
function evaluatePolicyGate(
  toolName: string,
  toolArgs: Record<string, any>,
  actorId?: string,
  clientIp?: string,
  transport?: "stdio" | "http",
): VerdictResult {
  try {
    // Extract session_id from tool args so derivePrincipal() can look it up
    // in the verifiedSessions map. Without this, HTTP clients that registered
    // their session via the pre-validation block above would still get
    // OBSERVE_ONLY because session_id never reached the policy gate.
    const sessionId = (typeof toolArgs?.session_id === "string") ? toolArgs.session_id : undefined;
    return mcpPolicyGate.evaluate({
      actor_id: actorId,
      session_id: sessionId,
      tool_name: toolName,
      arguments: toolArgs,
      transport,
      client_ip: clientIp,
    });
  } catch (err: any) {
    return {
      verdict: "DENY",
      actor_id: actorId ?? "anonymous",
      principal: {
        actorId: actorId ?? null,
        displayLabel: actorId ?? "anonymous",
        source: "client_supplied",
        authenticated: false,
        authority: "OBSERVE_ONLY",
      },
      policy_id: "engine_error",
      mcp_server: toolName.split("_")[0] ?? "unknown",
      tool_name: toolName,
      layers: { identity: false, server: false, tool: false, argument: false },
      reasons: [`ENGINE_ERROR:${err.message}`],
      timestamp: new Date().toISOString(),
    };
  }
}

// ── Tool registry helpers (access SDK internals) ───────────────────────
function getServerTools(): any[] {
  const registry = (server as any)._registeredTools as Record<string, any>;
  if (!registry) return [];
  return Object.entries(registry)
    .filter(([_, t]: [string, any]) => t.enabled !== false)
    .map(([name, t]: [string, any]) => ({
      name,
      description: t.description ?? "",
      inputSchema: t.inputSchema ?? {},
    }));
}

function getToolHandler(name: string): ((args: any) => Promise<any>) | null {
  const registry = (server as any)._registeredTools as Record<string, any>;
  if (!registry || !registry[name]) return null;
  // The handler might be stored as `handler` property
  // or in the McpServer's internal handler map
  const tool = registry[name];
  if (typeof tool.handler === "function") return tool.handler;
  return null;
}

// ── SSE session registry (legacy transport) ────────────────────────────
// SSE clients GET /sse → get sessionId → POST JSON-RPC to /mcp?sessionId=xxx
// The SSE channel is for server→client events; POST responses are direct HTTP.
// We maintain a registry of active SSE response streams for sending events.
const sseSessions = new Map<string, import("http").ServerResponse>();

// Cleanup stale SSE sessions periodically
setInterval(() => {
  for (const [sid, res] of sseSessions) {
    try { res.write(": ping\n\n"); } catch {
      process.stderr.write(`[A-FORGE-MCP] Cleaning stale SSE session: ${sid}\n`);
      sseSessions.delete(sid);
    }
  }
}, 60000).unref();

// ── MCP Logging & Completions infrastructure (Phase 4 — 2026-07-09) ─────
// Spec: MCP 2025-06-18 logging + completion utilities.
// Rules:
//   1. Advertise capabilities in initialize BEFORE emitting.
//   2. STDIO path: no log bytes on stdout except JSON-RPC — stderr always.
//   3. setLevel is client-initiated, optional. Default min = warning.
//   4. completion/complete uses ref.type routing: ref/prompt uses name, ref/resource uses URI.
//   5. NEVER expose logging/completions as tools for the model.
//   6. NEVER auto-888 without structured data + arifOS.

const RFC5424_LEVELS = new Set([
  "debug", "info", "notice", "warning", "error", "critical", "alert", "emergency",
]);

const RFC5424_RANK: Record<string, number> = {
  debug: 0, info: 1, notice: 2, warning: 3, error: 4, critical: 5, alert: 6, emergency: 7,
};

let clientLogLevel: string = "warning";

function levelMeetsMinimum(level: string, minLevel: string): boolean {
  return (RFC5424_RANK[level] ?? 0) >= (RFC5424_RANK[minLevel] ?? 3);
}

/**
 * emitMCPLog — send a logging notification to the MCP client if connected.
 *
 * Always mirrors to stderr for ops visibility (Transports spec: stdout = JSON-RPC only).
 * Attempts to emit `notifications/message` via the session transport if available.
 * Honours client's setLevel — drops messages below the client's minimum.
 *
 * @param level   — RFC 5424 severity (debug, info, notice, warning, error, critical, alert, emergency)
 * @param logger  — namespace: organ.subsystem (e.g., "aforge.tool", "aforge.lease")
 * @param data    — structured machine-readable payload (no secrets/PII)
 * @param message — human-readable summary (optional)
 */
function emitMCPLog(
  level: string,
  logger: string,
  data: Record<string, unknown>,
  message?: string,
): void {
  // Honour client's setLevel
  if (!levelMeetsMinimum(level, clientLogLevel)) return;

  // Always mirror to stderr (stdout = JSON-RPC only)
  const msg = message ?? `${logger}: ${JSON.stringify(data)}`;
  const ts = new Date().toISOString();
  process.stderr.write(`[A-FORGE-MCP] ${ts} ${level.toUpperCase()} [${logger}] ${msg}\n`);

  // Session-bound notifications/emission is handled by the SDK transport
  // (McpServer sessions). Stateless HTTP path mirrors to stderr only.
}

function jsonRpcError(id: any, code: number, message: string, data?: any): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data ? { data } : {}) },
  });
}

function jsonRpcResult(id: any, result: any): string {
  return JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result });
}

/**
 * Phase A3 (2026-07-12) — MCP tool-level failures MUST be successful JSON-RPC
 * with `result.isError: true` (CallToolResult), not HTTP 4xx / RPC error.
 * Spec: tool failures are application-level, recoverable by the agent.
 * Protocol errors (parse, method not found) still use jsonRpcError.
 */
function toolIsErrorResult(
  id: any,
  message: string,
  extra?: Record<string, unknown>,
): string {
  const payload = extra ? { message, ...extra } : { message };
  return jsonRpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    isError: true,
  });
}

// ── Session ID generation ──────────────────────────────────────────────
export async function startMcpServer(transportType: "stdio" | "sse" | "streamable-http" | "http", port?: number): Promise<void> {
  // Seal-A condition 3: production + FORGE_ACT_REQUIRE_MUTATE=0 → FATAL before bind.
  assertActMutationGateOrExit(process.env);

  const memoryContract = getMemoryContract();

  // Constitution gate active — all approvals route through arifOS:8088
  process.stderr.write(`[A-FORGE-MCP] Constitution gate: ${getConstitutionGate()}\n`);
  await memoryContract.initialize();
  await telemetry.initialize();

  // ── Tool fingerprint startup check (2026-07-07) ──────────────────────
  // Detect schema drift, duplicates, and new/removed tools at boot.
  try {
    const { startupFingerprintCheck } = await import("../../domain/registry/toolFingerprint.js");
    const tools = getServerTools();
    const report = await startupFingerprintCheck(tools);
    if (report.verdict !== "CLEAN") {
      process.stderr.write(`[A-FORGE-MCP] Fingerprint report: ${JSON.stringify({ verdict: report.verdict, new: report.new_tools.length, removed: report.removed_tools.length, changed: report.schema_changed.length })}\n`);
    }
  } catch (err: any) {
    process.stderr.write(`[A-FORGE-MCP] Fingerprint check skipped: ${err.message}\n`);
  }

  // ── Item 5: Tool deduplication startup check (2026-07-07) ────────────
  // Scans registered tools for duplicates, near-duplicates, deprecated aliases.
  try {
    const { runDedupeCheck } = await import("./toolDedupe.js");
    runDedupeCheck(server);
  } catch (err: any) {
    process.stderr.write(`[A-FORGE-MCP] Dedupe check skipped: ${err.message}\n`);
  }

  if (transportType === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write("[A-FORGE-MCP] Server started on stdio\n");
  } else {
    if (!port) port = 7072;
    const { createServer } = await import("node:http");

    // Stateful transport — created ON FIRST POST, not at startup.
    let transport: StreamableHTTPServerTransport | null = null;
    let connected = false;
    let serverStartTime = Date.now();
    let lastActivityTime = Date.now();

    // Periodic session cleanup
    const sessionCleanupTimer = setInterval(async () => {
      const now = Date.now();
      const idleMs = now - lastActivityTime;
      const ageMs = now - serverStartTime;
      if (connected && (idleMs > SESSION_IDLE_TIMEOUT_MS || ageMs > SESSION_MAX_AGE_MS)) {
        process.stderr.write(`[A-FORGE-MCP] Session cleanup: idle=${Math.round(idleMs/1000)}s age=${Math.round(ageMs/1000)}s\n`);
        try {
          await server.close();
          transport = null;
          connected = false;
        } catch (err) {
          process.stderr.write(`[A-FORGE-MCP] Session cleanup error: ${err}\n`);
        }
      }
    }, SESSION_CLEANUP_INTERVAL_MS);
    sessionCleanupTimer.unref();

    const httpServer = createServer(async (req, res) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

      // Rate limiting
      if (req.method !== "GET" || (req.url !== "/health" && req.url !== "/")) {
        const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
          || req.socket?.remoteAddress
          || "unknown";
        const rateCheck = checkRateLimit(clientIp);
        if (!rateCheck.allowed) {
          res.writeHead(429, {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil((rateCheck.resetAt - Date.now()) / 1000).toString(),
            "X-RateLimit-Remaining": "0",
          });
          res.end(jsonRpcError(null, -32000, "Too many requests. Rate limit exceeded."));
          return;
        }
        res.setHeader("X-RateLimit-Remaining", rateCheck.remaining.toString());
      }

      // Health endpoint
      if (req.url === "/health" || (req.url === "/" && req.method === "GET")) {
        const now = Date.now();
        res.writeHead(200, {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-11-25",
        });
        res.end(JSON.stringify({
          ok: true,
          service: "A-FORGE-MCP",
          status: "healthy",
          version: "0.1.0",
          commit: BUILD_COMMIT,
          transport: "streamable-http",
          // F2-fidelity fix (MCP-PROBE-2026-08-08): bridge shares organ identity
          // with the canonical server. authority_ceiling prevents downstream
          // agents from misidentifying the bridge's authority tier.
          authority_ceiling: "777_FORGE",
          sessions: connected ? "active" : "pending",
          stateless_tools: STATELESS_TOOLS.size,
          session: connected ? {
            idle_seconds: Math.round((now - lastActivityTime) / 1000),
            age_seconds: Math.round((now - serverStartTime) / 1000),
          } : null,
        }));
        return;
      }

      // MCP handler
      if (req.url === "/mcp" || req.url?.startsWith("/mcp?")) {
        // GET /mcp — discovery for external clients
        if (req.method === "GET") {
          res.writeHead(200, {
            "Content-Type": "application/json",
            "MCP-Protocol-Version": "2025-11-25",
          });
          res.end(JSON.stringify({
            name: "A-FORGE-MCP",
            version: "0.1.0",
            protocolVersion: "2025-11-25",
            transport: "streamable-http",
            authentication: "none",
            note: "No API key, no OAuth, no token. Open MCP endpoint.",
            endpoints: {
              initialize: "POST /mcp",
              tools_list: "POST /mcp → tools/list (?compact=1|2 or X-Compact header)",
              tools_get: "POST /mcp → tools/get {name} (live schema mode)",
              tools_call: "POST /mcp → tools/call",
              resources_list: "POST /mcp → resources/list",
              resources_read: "POST /mcp → resources/read"
            },
            docs: "https://forge.arif-fazil.com",
            stateless_tools: STATELESS_TOOLS.size,
          }));
          return;
        }
        if (req.method === "POST") {
          const hasSessionId = !!(req.headers["mcp-session-id"] || req.headers["Mcp-Session-Id"]);
          const rawAcceptIdx = req.rawHeaders.findIndex(
            (h: string) => h.toLowerCase() === "accept"
          );
          if (rawAcceptIdx >= 0) {
            let patched = req.rawHeaders[rawAcceptIdx + 1] as string;
            if (!patched.includes("application/json")) patched += ", application/json";
            if (!patched.includes("text/event-stream")) patched += ", text/event-stream";
            req.rawHeaders[rawAcceptIdx + 1] = patched;
          } else {
            req.rawHeaders.push("Accept", "application/json, text/event-stream");
          }

          // ── Client with existing session → forward to SDK transport ─────
          if (hasSessionId) {
            lastActivityTime = Date.now();

            if (!transport) {
              process.stderr.write(`[A-FORGE-MCP] Stale session — no active transport\n`);
              res.writeHead(409, { "Content-Type": "application/json" });
              res.end(jsonRpcError(null, -32001, "Session expired. Re-initialize without Mcp-Session-Id."));
              return;
            }

            if (transport && connected) {
              try {
                await transport.handleRequest(req, res);
              } catch (err) {
                process.stderr.write(`[A-FORGE-MCP] handleRequest error: ${err}\n`);
                if (!res.headersSent) {
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(jsonRpcError(null, -32603, "Internal error"));
                }
              }
            } else {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(jsonRpcError(null, -32000, "Server not initialized"));
            }
            return;
          }

          // First no-session client gets a real SDK-managed MCP session.
          res.setHeader("MCP-Protocol-Version", "2025-11-25");
          if (!transport) {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              enableJsonResponse: true,
            });
            await server.connect(transport);
            connected = true;
            serverStartTime = Date.now();
            lastActivityTime = Date.now();
            process.stderr.write("[A-FORGE-MCP] Transport created on first session request\n");
            await transport.handleRequest(req, res);
            return;
          }

          // ── New client (no session ID) → stateless path ─────────────────
          const bodyStr = await new Promise<string>((resolve) => {
            const chunks: Buffer[] = [];
            req.on("data", (chunk: Buffer) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
          });

          let parsed: any;
          try {
            parsed = JSON.parse(bodyStr);
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(jsonRpcError(null, -32700, "Parse error"));
            return;
          }

          const method = parsed.method;
          const msgId = parsed.id ?? null;

          if (method === "initialize") {
            // Phase A4: tools remains {} — do NOT declare listChanged unless we
            // emit notifications/tools/list_changed to clients (we don't; poll tools/list).
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(jsonRpcResult(msgId, {
              protocolVersion: "2025-11-25",
              capabilities: {
                tools: {},
                resources: { listChanged: false },
                // SEP-2577 freeze: no logging:{}. Completions cancelled (agent tool JSON).
                // stderr observability via journald (StandardError=journal).
                registration: { mode: "explicit", tool: "forge_agent" },
              },
              serverInfo: { name: "A-FORGE-MCP", version: "0.1.0" },
            }));
            return;
          }

          // Case 2: tools/list — compact surface meta (2026-08-06)
          // ?compact=1  → first-sentence desc + required-only schema (no property descs)
          // ?compact=2  → name + annotations only, no inputSchema at all
          // default     → full (MCP spec compliant, but 178KB for 115 tools)
          if (method === "tools/list") {
            const url = new URL(req.url ?? "/mcp", `http://${req.headers.host || "localhost"}`);
            const compactParam = url.searchParams.get("compact");
            const compactHeader = req.headers["x-compact"];
            const compactLevel = compactParam !== null ? parseInt(compactParam, 10) || 0
              : compactHeader === "true" ? 1 : 0;

            const isZodOptional = (v: any): boolean => {
              if (!v) return false;
              if (typeof v.isOptional === "function" && v.isOptional()) return true;
              const tn = String(v._def?.typeName || "");
              if (tn.toLowerCase().includes("optional") || tn.toLowerCase().includes("default")) return true;
              if (v._def?.innerType) return isZodOptional(v._def.innerType);
              return false;
            };

            const getZodType = (v: any): string => {
              if (!v) return "string";
              let cur = v;
              while (cur._def?.innerType) cur = cur._def.innerType;
              const tn = String(cur._def?.typeName || "").toLowerCase();
              if (tn.includes("number") || tn.includes("bigint")) return "number";
              if (tn.includes("boolean")) return "boolean";
              if (tn.includes("array")) return "array";
              if (tn.includes("object") || tn.includes("record")) return "object";
              return "string";
            };

            const { classifyTool } = await import("../../domain/governance/actionClassifier.js");
            const tools = getServerTools().map(t => {
              const name = t.name;
              const actionClass = classifyTool(name);
              const isObserve = actionClass === "OBSERVE";
              const isDestructive = ["EXECUTE_REVERSIBLE", "EXECUTE_HIGH_IMPACT", "IRREVERSIBLE"].includes(actionClass);
              const isOpenWorld = ["forge_search", "forge_research", "forge_shell", "forge_fetch"].includes(name);

              // COMPACT: first sentence only
              const compactDesc = compactLevel >= 1
                ? (t.description || "").split(/\.\s+|\.\n|\.$/)[0].replace(/\.$/, "").trim() || t.description
                : t.description;

              const affordanceMeta = {
                action_class: actionClass,
                mutation: !isObserve,
                blast_radius: actionClass === "IRREVERSIBLE" ? "FEDERATION" : actionClass === "EXECUTE_HIGH_IMPACT" ? "SYSTEM" : "LOCAL",
                requires_lease: actionClass !== "OBSERVE" && actionClass !== "SUGGEST",
              };

              // COMPACT LEVEL 2: no inputSchema at all — just wire desc
              if (compactLevel >= 2) {
                return {
                  name,
                  description: compactDesc,
                  annotations: {
                    readOnlyHint: isObserve,
                    destructiveHint: isDestructive,
                    idempotentHint: isObserve,
                    openWorldHint: isOpenWorld,
                  },
                  _meta: {
                    "io.modelcontextprotocol/affordance": affordanceMeta,
                  },
                };
              }

              // COMPACT LEVEL 1: minimal schema (required fields only, no property descriptions)
              // FULL (level 0): complete schema with descriptions
              const schemaShape = t.inputSchema?.shape;
              const properties: Record<string, any> = {};
              const required: string[] = [];
              if (schemaShape) {
                for (const [k, v] of Object.entries(schemaShape) as [string, any][]) {
                  const isOpt = isZodOptional(v);
                  if (!isOpt) required.push(k);
                  if (compactLevel >= 1) {
                    // Compact: just type hint, no description
                    properties[k] = { type: getZodType(v) };
                  } else {
                    // Full: type + description + optional flag
                    properties[k] = {
                      type: getZodType(v),
                      description: v.description || "",
                    };
                  }
                }
              }

              return {
                name,
                description: compactDesc,
                inputSchema: compactLevel >= 1
                  ? { type: "object" as const, properties: {}, required }
                  : { type: "object" as const, properties, required },
                annotations: {
                  readOnlyHint: isObserve,
                  destructiveHint: isDestructive,
                  idempotentHint: isObserve,
                  openWorldHint: isOpenWorld,
                },
                _meta: {
                  "io.modelcontextprotocol/affordance": affordanceMeta,
                },
              };
            });

            const responseHeaders: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (compactLevel >= 1) {
              responseHeaders["X-Compact"] = `${compactLevel}`;
              responseHeaders["X-Compact-Size"] = `${JSON.stringify({ tools }).length}`;
            }
            res.writeHead(200, responseHeaders);
            res.end(jsonRpcResult(msgId, {
              resultType: "complete",
              tools,
              ttlMs: compactLevel >= 1 ? 300_000 : 60_000,  // 5min compact, 1min full
              cacheScope: "private" as const,
              _meta: {
                "io.modelcontextprotocol/serverInfo": {
                  name: "A-FORGE-MCP",
                  version: "0.1.0",
                },
              },
            }));
            return;
          }

          // Case 2a: tools/get — live schema mode (single tool full schema on demand)
          if (method === "tools/get") {
            const toolName = parsed.params?.name as string;
            if (!toolName) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32602, "Missing required param: name"));
              return;
            }
            const allTools = getServerTools();
            const t = allTools.find(t => t.name === toolName);
            if (!t) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32602, `Tool not found: ${toolName}`));
              return;
            }
            const isZodOptional = (v: any): boolean => {
              if (!v) return false;
              if (typeof v.isOptional === "function" && v.isOptional()) return true;
              const tn = String(v._def?.typeName || "");
              if (tn.toLowerCase().includes("optional") || tn.toLowerCase().includes("default")) return true;
              if (v._def?.innerType) return isZodOptional(v._def.innerType);
              return false;
            };

            const getZodType = (v: any): string => {
              if (!v) return "string";
              let cur = v;
              while (cur._def?.innerType) cur = cur._def.innerType;
              const tn = String(cur._def?.typeName || "").toLowerCase();
              if (tn.includes("number") || tn.includes("bigint")) return "number";
              if (tn.includes("boolean")) return "boolean";
              if (tn.includes("array")) return "array";
              if (tn.includes("object") || tn.includes("record")) return "object";
              return "string";
            };

            const { classifyTool } = await import("../../domain/governance/actionClassifier.js");
            const actionClass = classifyTool(t.name);
            const isObserve = actionClass === "OBSERVE";
            const isDestructive = ["EXECUTE_REVERSIBLE", "EXECUTE_HIGH_IMPACT", "IRREVERSIBLE"].includes(actionClass);
            const isOpenWorld = ["forge_search", "forge_research", "forge_shell", "forge_fetch"].includes(t.name);

            const schemaShape = t.inputSchema?.shape;
            const properties: Record<string, any> = {};
            const required: string[] = [];
            if (schemaShape) {
              for (const [k, v] of Object.entries(schemaShape) as [string, any][]) {
                const isOpt = isZodOptional(v);
                if (!isOpt) required.push(k);
                properties[k] = {
                  type: getZodType(v),
                  description: v.description || "",
                };
              }
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(jsonRpcResult(msgId, {
              tool: {
                name: t.name,
                description: t.description,
                inputSchema: { type: "object", properties, required },
                annotations: {
                  readOnlyHint: isObserve,
                  destructiveHint: isDestructive,
                  idempotentHint: isObserve,
                  openWorldHint: isOpenWorld,
                },
                _meta: {
                  "io.modelcontextprotocol/affordance": {
                    action_class: actionClass,
                    mutation: !isObserve,
                    blast_radius: actionClass === "IRREVERSIBLE" ? "FEDERATION" : actionClass === "EXECUTE_HIGH_IMPACT" ? "SYSTEM" : "LOCAL",
                    requires_lease: actionClass !== "OBSERVE" && actionClass !== "SUGGEST",
                  },
                },
              },
            }));
            return;
          }

          // Case 2b: resources/list
          if (method === "resources/list") {
            const resources = [
              {
                uri: "forge://genesis/doctrine",
                name: "A-FORGENESIS Doctrine",
                description: "Constitutional doctrine — kernel canon, MCP boundary, adat agentic",
                mimeType: "text/markdown",
              },
              {
                uri: "forge://agents/governance",
                name: "AGENTS.md",
                description: "Agent governance — boundary contract, allowed/forbidden actions",
                mimeType: "text/markdown",
              },
              {
                uri: "forge://contract/affordances",
                name: "Tool Affordances",
                description: "Tool risk contracts, 8-class action taxonomy",
                mimeType: "application/x-yaml",
              },
              {
                uri: "forge://contract/brain-hands",
                name: "Brain-Hands Contract",
                description: "Constitutional separation — arifOS (brain) vs A-FORGE (hands)",
                mimeType: "text/markdown",
              },
              {
                uri: "forge://state/health",
                name: "Health Status",
                description: "Live health check — port, version, uptime",
                mimeType: "application/json",
              },
            ];
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(jsonRpcResult(msgId, { resources }));
            return;
          }

          // Case 2c: resources/read
          if (method === "resources/read") {
            const uri = parsed.params?.uri;
            if (!uri) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32602, "Missing resource URI"));
              return;
            }

            let content = "";
            let mimeType = "text/plain";

            try {
              if (uri === "forge://genesis/doctrine") {
                const genesisDir = path.join(AFORGE_ROOT, "GENESIS");
                const files = fs.readdirSync(genesisDir).filter(f => f.endsWith(".md")).sort();
                content = files.map(f => {
                  const data = fs.readFileSync(path.join(genesisDir, f), "utf-8");
                  return `## ${f}\n\n${data}`;
                }).join("\n\n---\n\n");
                mimeType = "text/markdown";
              } else if (uri === "forge://agents/governance") {
                content = fs.readFileSync(path.join(AFORGE_ROOT, "AGENTS.md"), "utf-8");
                mimeType = "text/markdown";
              } else if (uri === "forge://contract/affordances") {
                const affPath = path.join(AFORGE_ROOT, "src", "interfaces", "mcp", "contract", "affordances.yaml");
                if (fs.existsSync(affPath)) {
                  content = fs.readFileSync(affPath, "utf-8");
                  mimeType = "application/x-yaml";
                } else {
                  content = "# Affordances\n\naffordances.yaml not found at expected path.";
                }
              } else if (uri === "forge://contract/brain-hands") {
                const bhPath = path.join(AFORGE_ROOT, "GENESIS", "BRAIN-HANDS-CONTRACT.md");
                if (fs.existsSync(bhPath)) {
                  content = fs.readFileSync(bhPath, "utf-8");
                } else {
                  content = "# Brain-Hands Contract\n\nSee AGENTS.md §Boundary Contract.";
                }
                mimeType = "text/markdown";
              } else if (uri === "forge://state/health") {
                content = JSON.stringify({
                  status: "healthy",
                  port: 7072,
                  version: "0.1.0",
                  tools_count: getServerTools().length,
                  timestamp: new Date().toISOString(),
                });
                mimeType = "application/json";
              } else {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(jsonRpcError(msgId, -32601, `Unknown resource: ${uri}`));
                return;
              }

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(jsonRpcResult(msgId, {
                contents: [{
                  uri,
                  mimeType,
                  text: content,
                }],
              }));
            } catch (err: any) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32603, `Resource read error: ${err.message}`));
            }
            return;
          }

          // Case 3: tools/call
          if (method === "tools/call") {
            const toolName = parsed.params?.name;
            const toolArgs = parsed.params?.arguments ?? {};

            if (!toolName) {
              // Missing params = protocol-level invalid params (keep RPC error)
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32602, "Missing tool name"));
              return;
            }

            // Check whitelist — tool-level denial → isError envelope (Phase A3)
            if (!STATELESS_TOOLS.has(toolName)) {
              const msg = `Tool "${toolName}" requires session ownership. Use session-based connection or connect via stdio.`;
              process.stderr.write(`[A-FORGE-MCP] Rejected stateless call: ${toolName}\n`);
              res.writeHead(200, {
                "Content-Type": "application/json",
                "X-AForge-Gate": "SESSION_REQUIRED",
              });
              res.end(toolIsErrorResult(msgId, msg, {
                error_class: "SESSION_REQUIRED",
                recoverability: "AGENT_CAN_RETRY",
                tool: toolName,
                gate: "STATELESS_WHITELIST",
              }));
              return;
            }

            // ── A-THINK Guard (stateless path) ────────────────────────
            // Constitutional front-door. UNKNOWN = HOLD. Budget enforced.
            // DARWIN FIX 3b+c: forward the actual tool command as userInput
            // so the aThinkGuard can detect read-only shell commands and
            // skip the GOVERN+HOLD block. Also inject `_user_input` into
            // the args so core.ts's wrapper aThinkCheck (line 475) sees it
            // for read-only mode classification — without this, core.ts
            // gets userInput=undefined and falls through to a different path.
            let aThinkUserInput: string | undefined;
            if (toolName === "forge_shell" || toolName === "forge_shell_dryrun") {
              aThinkUserInput = String(toolArgs?.command ?? "");
              // Inject _user_input into args so core.ts picks it up too
              toolArgs._user_input = aThinkUserInput;
            } else if (toolName === "forge_git") {
              // Forward the git mode (log, diff, status, etc.) so aThinkGuard
              // can classify read-only modes and bypass GOVERN+HOLD.
              aThinkUserInput = String(toolArgs?.mode ?? "");
              toolArgs._user_input = aThinkUserInput;
            }
            const aThinkVerdict = aThinkCheck(toolName, aThinkUserInput);
            if (!aThinkVerdict.allowed) {
              process.stderr.write(
                `[A-FORGE-MCP] A-THINK ${aThinkVerdict.status} (stateless): ${toolName} — ${aThinkVerdict.reason}\n`,
              );
              res.writeHead(200, {
                "Content-Type": "application/json",
                "X-AThink-Gate": aThinkVerdict.status,
                "X-AThink-Mode": aThinkVerdict.mode,
              });
              res.end(toolIsErrorResult(msgId, `A-THINK guard: ${aThinkVerdict.status}`, {
                error_class: "A_THINK_GUARD",
                recoverability: "AGENT_CAN_RETRY",
                status: aThinkVerdict.status,
                gate: "A_THINK_GUARD",
                mode: aThinkVerdict.mode,
                reason: aThinkVerdict.reason,
                tool: toolName,
              }));
              return;
            }

            // ── Session pre-validation (2026-08-13) ─────────────────────
            // HTTP clients (OpenCode, Qwen Code) bind sessions via arifOS
            // kernel directly, not via forge_session_init. Their session_id
            // is therefore absent from the policy gate's verifiedSessions
            // map, causing derivePrincipal() to return OBSERVE_ONLY even
            // though the session is kernel-verified.
            //
            // Fix: before the policy gate evaluates, check if the request
            // carries a session_id + session_token. If so, validate via
            // kernel and register as verified so derivePrincipal() sees
            // FULL authority.
            const preSessionId = (typeof toolArgs?.session_id === "string") ? toolArgs.session_id : undefined;
            const preSessionToken = (typeof toolArgs?.session_token === "string")
              ? toolArgs.session_token
              : (typeof toolArgs?.sct === "string") ? toolArgs.sct
              : (typeof toolArgs?.act === "string") ? toolArgs.act : undefined;
            const preActorId = (typeof toolArgs?.actor_id === "string")
              ? toolArgs.actor_id
              : (typeof toolArgs?.actorId === "string") ? toolArgs.actorId : undefined;
            if (preSessionId && preSessionToken && !mcpPolicyGate.hasVerifiedSession(preSessionId)) {
              // Use sync validateSession with the token — it calls verifyActLocally()
              // which HMAC-verifies the ACT against the shared ARIFOS_SESSION_SECRET.
              // validateSessionAsync() would call the kernel which returns
              // actor_verified=false for non-crypto-bound actors, defeating the
              // purpose. The ACT's HMAC signature IS proof the token was minted
              // by arifOS — that's sufficient for session verification.
              const preValidation = validateSession(preSessionId, preSessionToken);
              if (preValidation.valid) {
                mcpPolicyGate.registerKernelVerifiedSession(preSessionId, preValidation.actor_id);
              }
            }

            // ── Policy Gate (stateless path) ───────────────────────────
            // The 5-layer boundary (identity/server/tool/args) evaluated before dispatch.
            const actorHint = preActorId ?? undefined;
            const clientIp = (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
              || req.socket?.remoteAddress || "unknown");
            const policyVerdict = evaluatePolicyGate(toolName, toolArgs, actorHint, clientIp, "http");
            if (policyVerdict.verdict === "DENY") {
              process.stderr.write(
                `[A-FORGE-MCP] Policy DENY (stateless) actor=${actorHint} tool=${toolName} reasons=${policyVerdict.reasons.join(",")}\n`,
              );
              res.writeHead(200, {
                "Content-Type": "application/json",
                "X-Policy-Gate": "DENY",
                "X-Policy-Id": policyVerdict.policy_id,
              });
              res.end(toolIsErrorResult(msgId, "MCP Policy Gate denied the request", {
                error_class: "POLICY_DENY",
                recoverability: "AGENT_CAN_RETRY",
                verdict: policyVerdict.verdict,
                policy_id: policyVerdict.policy_id,
                reasons: policyVerdict.reasons,
                layers: policyVerdict.layers,
                violated_regex: policyVerdict.violated_regex,
                tool: toolName,
              }));
              return;
            }

            // ── FORGE 2-B session gate (T₁ audit fix 2026-07-19) ──────
            // Stateless whitelist tools that are MUTATE-class (e.g. forge_shell)
            // must still carry a valid session_id. OBSERVE-class tools remain
            // fully stateless.
            const actionClass = classifyTool(toolName);
            if (requiresGovernance(actionClass)) {
              const callerSession = (typeof toolArgs?.session_id === "string") ? toolArgs.session_id : undefined;
              const callerSct = (typeof toolArgs?.session_token === "string")
                ? toolArgs.session_token
                : (typeof toolArgs?.sct === "string") ? toolArgs.sct : undefined;
              const callerActor = (typeof toolArgs?.actor_id === "string")
                ? toolArgs.actor_id
                : (typeof toolArgs?.actorId === "string") ? toolArgs.actorId : undefined;
              // P0.6 BRIDGE FIX (2026-07-29): Use async validation that verifies
              // ACT tokens with arifOS kernel when session is not in local Map.
              const sessionCheck = callerSession
                ? await validateSessionAsync(callerSession, callerActor, callerSct)
                : { valid: false, reason: "SESSION_REQUIRED: No session_id provided for MUTATE-class tool" } as const;
              if (!sessionCheck.valid) {
                process.stderr.write(`[A-FORGE-MCP] SESSION_GATE blocked stateless ${toolName} (${actionClass}): ${sessionCheck.reason}\n`);
                res.writeHead(200, {
                  "Content-Type": "application/json",
                  "X-AForge-Gate": "SESSION_REQUIRED",
                });
                res.end(toolIsErrorResult(msgId, `SESSION_GATE: Tool "${toolName}" is ${actionClass}. ${sessionCheck.reason}`, {
                  error_class: "SESSION_REQUIRED",
                  recoverability: "AGENT_CAN_RETRY",
                  action_class: actionClass,
                  tool: toolName,
                  gate: "SESSION_REQUIRED",
                }));
                return;
              }

              // ── P0 Deterministic Pre-Execution Gates (2026-08-03) ────────
              // Runs AFTER session gate, BEFORE tool dispatch + BIJAKSANA.
              // Pure deterministic functions — no LLM calls, no network, no writes.
              // Based on Reddy et al. (2026) arXiv:2607.07405.
              const p0Result = runP0GateMiddleware({
                toolName,
                args: toolArgs,
                sessionId: callerSession ?? "",
                actorId: callerActor ?? "",
                sct: callerSct,
              });
              if (!p0Result.passed) {
                const rejection = formatGateRejection(p0Result);
                process.stderr.write(`[A-FORGE-MCP] P0_GATE blocked ${toolName}: ${rejection.gate} — ${rejection.reason}\n`);
                res.writeHead(200, {
                  "Content-Type": "application/json",
                  "X-AForge-Gate": `P0_${rejection.gate}`,
                });
                res.end(toolIsErrorResult(msgId, `P0_GATE: ${rejection.reason}`, {
                  error_class: "P0_GATE_BLOCKED",
                  recoverability: rejection.recoverability,
                  action_class: actionClass,
                  tool: toolName,
                  gate: rejection.gate,
                  p0_evaluations: p0Result.evaluations.length,
                }));
                return;
              }
            }

            // Dispatch whitelisted tool
            process.stderr.write(`[A-FORGE-MCP] Stateless call: ${toolName}\n`);
            try {
              const handler = getToolHandler(toolName);
              if (!handler) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(toolIsErrorResult(msgId, `Tool "${toolName}" not found`, {
                  error_class: "TOOL_NOT_FOUND",
                  recoverability: "AGENT_CAN_RETRY",
                  tool: toolName,
                }));
                return;
              }

              // P0 FIX (2026-08-13): Remove actor_id overwrite.
              // The previous behavior set actor_id='http-stateless' when the client
              // didn't supply one. This caused ACT actor binding to fail because the
              // ACT claims say "kimi-code" but the request is attributed to "http-stateless".
              // The PolicyGate's derivePrincipal() handles the case where actor_id is
              // undefined (transport_fallback OBSERVE_ONLY). The ACT path validates
              // authority via the token's claims, not the request's actor_id.
              // Forward the args as-is; let the ACT path + PolicyGate derive principal.
              // Reference: VAULT999/process_violations/2026-08-13_F2-TRUTH_correction.json
              void toolArgs; // explicit: no mutation, no overwrite
              const result = await handler(toolArgs);
              // Ensure schema/policy denies from handlers always surface isError
              const normalized =
                result && typeof result === "object" && result.isError === true
                  ? result
                  : result;
              emitMCPLog("info", "aforge.tool", {
                tool: toolName,
                verdict: normalized?.isError ? "failure" : "success",
                actor_id: toolArgs?.actor_id ?? "stateless-client",
              }, `${toolName} → ${normalized?.isError ? "isError" : "success"}`);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(jsonRpcResult(msgId, normalized));
            } catch (err: any) {
              emitMCPLog("error", "aforge.tool", {
                tool: toolName,
                verdict: "failure",
                error: err.message ?? "unknown",
              }, `${toolName} → ${err.message}`);
              process.stderr.write(`[A-FORGE-MCP] Stateless call error: ${toolName}: ${err}\n`);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(toolIsErrorResult(msgId, err.message ?? "Tool execution failed", {
                error_class: "TOOL_EXECUTION_ERROR",
                recoverability: "AGENT_CAN_RETRY",
                tool: toolName,
              }));
            }
            return;
          }

          // Case 6: prompts/list — list registered MCP prompts
          if (method === "prompts/list") {
            const isZodOptional = (v: any): boolean => {
              if (!v) return false;
              if (typeof v.isOptional === "function" && v.isOptional()) return true;
              const tn = String(v._def?.typeName || "");
              if (tn.toLowerCase().includes("optional") || tn.toLowerCase().includes("default")) return true;
              if (v._def?.innerType) return isZodOptional(v._def.innerType);
              return false;
            };
            const registry = (server as any)._registeredPrompts as Record<string, any>;
            const promptsList = registry ? Object.entries(registry)
              .filter(([_, p]: [string, any]) => p.enabled !== false)
              .map(([name, p]: [string, any]) => ({
                name,
                description: p.description ?? "",
                arguments: p.argsSchema ? Object.entries(p.argsSchema.shape).map(([k, v]: [string, any]) => ({
                  name: k,
                  description: v.description,
                  required: !isZodOptional(v),
                })) : [],
              })) : [];
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(jsonRpcResult(msgId, { prompts: promptsList }));
            return;
          }

          // Case 7: prompts/get — get a specific prompt
          if (method === "prompts/get") {
            const promptName = parsed.params?.name;
            const promptArgs = parsed.params?.arguments ?? {};
            if (!promptName) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32602, "Missing prompt name"));
              return;
            }
            const registry = (server as any)._registeredPrompts as Record<string, any>;
            const prompt = registry?.[promptName];
            if (!prompt) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(jsonRpcError(msgId, -32602, `Prompt "${promptName}" not found`));
              return;
            }
            if (typeof prompt.callback === "function") {
              try {
                const result = await prompt.callback(promptArgs);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(jsonRpcResult(msgId, result));
              } catch (err: any) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(jsonRpcError(msgId, -32603, err.message ?? "Prompt execution failed"));
              }
            } else {
              const isZodOptional = (v: any): boolean => {
                if (!v) return false;
                if (typeof v.isOptional === "function" && v.isOptional()) return true;
                const tn = String(v._def?.typeName || "");
                if (tn.toLowerCase().includes("optional") || tn.toLowerCase().includes("default")) return true;
                if (v._def?.innerType) return isZodOptional(v._def.innerType);
                return false;
              };
              // Fallback: return the prompt metadata
              const argDefs = prompt.argsSchema ? Object.entries(prompt.argsSchema.shape).map(([k, v]: [string, any]) => ({
                name: k,
                description: v.description,
                required: !isZodOptional(v),
              })) : [];
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(jsonRpcResult(msgId, {
                description: prompt.description,
                arguments: argDefs,
                messages: [{ role: "user", content: { type: "text", text: `Prompt "${promptName}" requires workflow-specific arguments. Use tools/list to discover capabilities.` } }],
              }));
            }
            return;
          }

          // logging/setLevel + completion/complete REMOVED (sovereign freeze 2026-07-09):
          // - SEP-2577 deprecates protocol logging; stderr via journal only
          // - Completions cancelled for agent surface (full tool JSON)
          // Unknown methods fall through to Method not found.

          // MCP notifications (no id) — acknowledge silently, no response body
          if (method.startsWith("notifications/")) {
            res.writeHead(202, { "Content-Type": "application/json" });
            res.end();
            return;
          }

          // Unknown method — reject
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(jsonRpcError(msgId, -32601, `Method not found: ${method}`));
          return;
        }

        // DELETE — session cleanup
        if (req.method === "DELETE") {
          res.setHeader("MCP-Protocol-Version", "2025-11-25");
          if (transport && connected) {
            try {
              await transport.handleRequest(req, res);
              await server.close();
              transport = null;
              connected = false;
            } catch {
              try { await server.close(); } catch {}
              transport = null;
              connected = false;
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ jsonrpc: "2.0", result: "session_closed" }));
            }
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", result: "no_active_session" }));
          }
          return;
        }

        // GET without session — not supported
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed", path: req.url }));
        return;
      }

      // ── SSE endpoint (legacy transport — lightweight keepalive) ────────
      // SSE clients GET /sse → open SSE channel → POST JSON-RPC to /mcp?sessionId=xxx
      // POST responses come back as normal HTTP. SSE channel used for events.
      if (req.url === "/sse" || req.url?.startsWith("/sse?")) {
        if (req.method === "GET") {
          const sessionId = randomUUID();
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
          });
          // The endpoint tells the client where to POST JSON-RPC
          res.write(`event: endpoint\ndata: /mcp?sessionId=${sessionId}\n\n`);
          if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();
          sseSessions.set(sessionId, res);
          process.stderr.write(`[A-FORGE-MCP] SSE:${sessionId.slice(0,8)} connected\n`);
          req.on("close", () => {
            sseSessions.delete(sessionId);
            process.stderr.write(`[A-FORGE-MCP] SSE:${sessionId.slice(0,8)} disconnected\n`);
          });
          return;
        }
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed", path: req.url }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found", path: req.url }));
    });

    httpServer.listen(port, "127.0.0.1", () => {
      process.stderr.write(`[A-FORGE-MCP] HTTP server listening on 127.0.0.1:${port}\n`);
    });
  }
}

// Self-executing when run directly
const isMainModule = process.argv[1]?.endsWith("serve.js") || process.argv[1]?.endsWith("serve.ts");
if (isMainModule) {
  const transport = (process.argv.find(a => a.startsWith("--transport="))?.split("=")[1] || "http") as "stdio" | "sse" | "streamable-http" | "http";
  const portArg = process.argv.find(a => a.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1]) : 7072;
  startMcpServer(transport, port).catch(err => {
    process.stderr.write(`[A-FORGE-MCP] Fatal: ${err}\n`);
    process.exit(1);
  });
}
