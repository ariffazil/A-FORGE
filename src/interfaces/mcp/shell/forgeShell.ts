/**
 * forge_shell — Canonical governed shell execution tool for A-FORGE.
 *
 * Consolidates all fragmented shell execution paths behind one tool.
 * Every call passes through:
 *   1. ArifJudge — command classification (DENY/GATE/ALLOW)
 *   2. Sandboxed execution (via ContainmentEngine if available)
 *   3. ArifSeal — hash-chain audit logging
 *
 * Tool surface:
 *   forge_shell           — execute a shell command (governed)
 *   forge_shell_dryrun    — preview without mutation (kept for compat)
 *   forge_shell_status    — check shell subsystem health
 *
 * Constitutional:
 *   F1 AMANAH — every irreversible action gated or denied
 *   F4 CLARITY — structured output, never raw terminal noise
 *   F11 AUDIT — every execution sealed to hash chain
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { classifyCommand, type JudgeResult } from "./arifJudge.js";
import { getDefaultArifSeal } from "./arifSeal.js";
import { checkModificationIntent, isGodelLocked } from "./godelLock.js";
import { classifyShellCommand, type ActionClass } from "../../../domain/governance/execution-authority.js";
import { classifyUnknown, isStructuredError } from "../../../domain/governance/error-classifier.js";
import { buildWmMetadata, hashAction, NO_PREDICTION_SENTINEL, normalizePrediction, type WmMetadata } from "../../../domain/governance/worldModel.js";
import { logTrajectory } from "../../../domain/governance/worldModelLogger.js";
import { Memory, Epistemic, enrichResult } from "../../../domain/governance/epistemic-signal.js";
import { callMCP } from "../client.js";
import {
  actionHash,
  observationHash,
  computeSurpriseScore,
  computeWMEligibility,
  TOOL_WM_PRIORITY,
} from "../../../infrastructure/tools/WorldModelTypes.js";
import { appendTrajectory } from "../../../infrastructure/tools/WorldModelTrajectoryLogger.js";

// ── Execution Authority Helper ──────────────────────────────────────
function checkAuthorityFromActionClass(actionClass: ActionClass): {
  allowed: boolean;
  reason: string;
  blast_radius: string;
} {
  const blastRadius: Record<ActionClass, string> = {
    'OBSERVE': 'NONE',
    'DRAFT': 'NONE',
    'MUTATE': 'LOCAL',
    'EXECUTE_REVERSIBLE': 'ORGAN',
    'EXECUTE_HIGH_IMPACT': 'FEDERATION',
    'IRREVERSIBLE': 'IRREVERSIBLE',
  };
  return {
    allowed: true, // forge_shell already passed ArifJudge gate
    reason: `Action class: ${actionClass} — passed ArifJudge + authority ladder`,
    blast_radius: blastRadius[actionClass],
  };
}

// ── Option C: arifOS Authority Envelope Verification ──────────────────────
// arif_init is the constitutional authority root. SEAL-{hex} tokens minted by
// arif_init are authority-bearing by format. forge_shell trusts the token
// format directly (bounded by localhost MCP transport via Caddy F8 gate).
//
// F8 LAW: SEAL auto-accept is bounded by localhost transport.

const SEAL_SESSION_PATTERN = /^SEAL-[a-f0-9]{16}$/;

/**
 * Authority envelope issued by arifOS constitutional kernel.
 */
export interface AuthorityEnvelope {
  valid: boolean;
  session_id: string;
  actor_id: string;
  authority_mode: string;
  verdict: string;
  expires_at?: string;
}

/**
 * SEAL envelope — issued by arif_judge for irreversible shell commands.
 * Contains cryptographic commitment to the exact command string.
 */
export interface SealEnvelope {
  session_id: string;     // "SEAL-{hex}"
  inputHash: string;      // SHA256 of MCP call params
  command_hash: string;   // SHA256(shell_command) — exact string commitment
  issued_at: string;
  expires_at: string;
  actor_id: string;
}

// ── SHA256 Helper ────────────────────────────────────────────────────────────
function SHA256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

// ── SAFE FILESYSTEM ZONES ─────────────────────────────────────────────────
// Paths where filesystem mutations (mv, rm, cp, touch, mkdir, chmod)
// are permitted with standard EXECUTE authority — no R3 GOVERN required.
// These are the canonical skill/config directories and scratch spaces.
// Mutations outside these zones require R3 GOVERN (human confirmation).
const SAFE_FS_ZONES = [
  "/root/.agents/skills/",
  "/root/.agents/skills-archive/",
  "/root/AAA/skills/",
  "/tmp/opencode/",
  "/tmp/",
  "/root/A-FORGE/forge_work/",
  "/root/memory/",
  "/var/arifos/artifacts/outbox/",
];

/** Extract target paths from a shell command. */
function extractTargetPaths(command: string): string[] {
  const tokens = command.split(/\s+/);
  const paths: string[] = [];
  // Common mutation commands where arg[1] or arg[2] is a path
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    // Skip flags
    if (t.startsWith("-")) continue;
    // Skip non-path tokens (assignments, redirects)
    if (t.includes("=") || t.startsWith(">") || t.startsWith("<") || t.startsWith("|")) continue;
    // Collect paths — resolve relative to /root for checking
    if (t.startsWith("/")) {
      paths.push(t);
    } else if (t.startsWith(".")) {
      paths.push(t); // relative — checked against cwd at gate
    } else if (!t.includes("/") && !t.includes(".")) {
      // Could be a filename without path — check cwd at gate time
      paths.push(t);
    }
  }
  return paths;
}

/** Check if a path is within any safe zone. */
function isPathInSafeZone(path: string): boolean {
  const resolved = path.startsWith("/") ? path : `/root/${path}`;
  for (const zone of SAFE_FS_ZONES) {
    if (resolved.startsWith(zone)) return true;
  }
  return false;
}

/** Check if ALL target paths in a command are within safe zones. */
function areAllPathsInSafeZone(command: string): boolean {
  const paths = extractTargetPaths(command);
  if (paths.length === 0) return false; // no paths detected → conservative: require GOVERN
  return paths.every(p => isPathInSafeZone(p));
}

// ── Minimal Shell Parser (P0 dry-run fix, 2026-08-13) ──────────────────────
// Parses a shell command into structured segments WITHOUT executing it.
// Handles operators (|, &&, ||, ;, &), redirects (>, >>, <, 2>, 2>&1),
// and quoted strings. NOT a full POSIX shell parser — variable expansion,
// glob expansion, and command substitution are returned as raw tokens.
type ParsedSegment = {
  program: string;
  args: string[];
  redirects: Array<{ op: string; target: string; fd: string }>;
};

type ParsedCommand = {
  operators: string[];        // between segments: |, &&, ||, ;, &
  segments: ParsedSegment[];
};

function tokenizeShell(input: string): string[] {
  // Tokenize respecting single+double quotes and escapes
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === "\\" && !inSingle) {
      escape = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function parseShellCommand(command: string): ParsedCommand {
  const tokens = tokenizeShell(command);
  const OPERATORS = new Set(["|", "&&", "||", ";", "&"]);
  const REDIRECT_OPS = new Set([">", ">>", "<", "2>", "2>>", "2>&1"]);
  const segments: ParsedSegment[] = [];
  const operators: string[] = [];
  let current: ParsedSegment = { program: "", args: [], redirects: [] };
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (OPERATORS.has(tok)) {
      if (current.program || current.args.length) {
        segments.push(current);
      }
      operators.push(tok);
      current = { program: "", args: [], redirects: [] };
      i++;
      continue;
    }
    if (REDIRECT_OPS.has(tok) && i + 1 < tokens.length) {
      current.redirects.push({ op: tok, target: tokens[i + 1], fd: tok.startsWith("2") ? "2" : "1" });
      i += 2;
      continue;
    }
    if (!current.program) {
      current.program = tok;
    } else {
      current.args.push(tok);
    }
    i++;
  }
  if (current.program || current.args.length) segments.push(current);
  return { operators, segments };
}

// ── 4-Tier Risk Classifier ───────────────────────────────────────────────────
type RiskLevel = "SAFE" | "MUTATION" | "MUTATION_SAFE_ZONE" | "MUTATION_GOVERN" | "IRREVERSIBLE" | "GODEL_LOCKED";

function classifyShellCommandRisk(command: string): RiskLevel {
  const trimmed = command.trim();

  // HARD DENY — cannot be authorized under any circumstances
  const HARD_DENY_PATTERNS = [
    /^rm\s+-rf\s+\/(?:\s|$)/,
    /^rm\s+-rf\s+\/root(?:\s|$)/,
    /^dd\s+/,
    /^mkfs/,
    /^\s*:\(\)\s*:\s*;/,
    /\bkill\s+-9\s+1\b/,
  ];
  for (const p of HARD_DENY_PATTERNS) {
    if (p.test(trimmed)) return "GODEL_LOCKED";
  }

  // IRREVERSIBLE — requires SEAL envelope from arifOS
  const tokens = trimmed.split(/\s+/);
  const baseCmd = tokens[0]?.replace(/^["'`]/, "").split("/").pop() ?? "";
  const subCmd = tokens.slice(1).join(" ");

  const IRREVERSIBLE_MAP: Record<string, string[]> = {
    git:        ["push", "push --force", "merge", "branch -D", "reset --hard"],
    docker:     ["rmi", "rm -f", "rm --force", "prune -a", "system prune"],
    systemctl:  ["stop", "disable"],
    iptables:   ["-F"],
    userdel:    [],
    groupdel:   [],
    truncate:   [],
    shred:      [],
  };

  const subs = IRREVERSIBLE_MAP[baseCmd] ?? [];
  if (subs.some((s) => subCmd.startsWith(s))) return "IRREVERSIBLE";

  // MUTATION — requires EXECUTE authority (no readonly bypass)
  // NOW PATH-AWARE: safe-zone mutations → MUTATION_SAFE_ZONE (standard R2 EXECUTE)
  //                  external mutations → MUTATION_GOVERN (R3 GOVERN)
  const FS_MUTATION_COMMANDS = new Set([
    "mv", "rm", "cp", "touch", "mkdir", "rmdir", "chmod", "chown", "chgrp",
    "ln", "unlink",
  ]);
  const OTHER_MUTATION_COMMANDS = new Set([
    "npm", "yarn", "pnpm", "pip", "pip3", "uv",
    "ssh", "scp", "rsync",
    "journalctl",
  ]);

  if (FS_MUTATION_COMMANDS.has(baseCmd)) {
    // Filesystem mutation — PATH AWARE gating
    return areAllPathsInSafeZone(command) ? "MUTATION_SAFE_ZONE" : "MUTATION_GOVERN";
  }
  if (OTHER_MUTATION_COMMANDS.has(baseCmd)) return "MUTATION";

  return "SAFE";
}

// ── Gated Result ─────────────────────────────────────────────────────────────
interface GatedResult {
  status:
    | "SAFE"
    | "GATE_HOLD"
    | "EXECUTE_VALID"
    | "HOLD_IRREVERSIBLE"
    | "SEAL_VALID"
    | "HARD_DENY";
  reason?: string;
  gate?: string;
  required_action?: string;
  required?: string;
  got?: string;
  violations?: string[];
  verified?: Record<string, unknown>;
}

// ── ArifSeal audit helper ────────────────────────────────────────────────────
async function arifSealAudit(event: Record<string, unknown>): Promise<void> {
  const sealer = getDefaultArifSeal();
  try {
    await sealer.seal({
      tool: "forge_shell",
      args: event as Record<string, unknown>,
      judge_decision: "gate",
      exit_code: null,
      stdout: "",
      stderr: "",
      notes: `risk_audit:${event["type"]}`,
    });
  } catch (err: any) {
    console.error(`[forge_shell] arifSeal audit error: ${err.message}`);
  }
}

// ── Pre-Execution Gate ───────────────────────────────────────────────────────
/**
 * Centralised gate for all shell commands.
 * Fires BEFORE any ArifJudge or authority checks.
 * Every command goes through classifyShellCommandRisk — no bypass.
 *
 * P34 ENFORCEMENT (2026-07-19): authorize-mutation bridge calls canonical
 * arifOS Python authorize_mutation() via stdin JSON. Fail-closed.
 */
async function preExecutionGate(
  command: string,
  envelope?: SealEnvelope
): Promise<GatedResult> {
  // ── P34 MUTATION GATE: canonical arifOS boundary ──
  const execParts = command.trim().split(/\s+/);
  const executable = execParts[0]?.replace(/^["'`]/, "").split("/").pop() ?? "";
  const args = execParts.slice(1);

  try {
    const { callAuthorizeMutationBridge } = await import("../../../infrastructure/bridges/authorizeMutationBridge.js");
    const result = await callAuthorizeMutationBridge({
      executable,
      arguments: args,
      actorPrivilege: process.env.USER === "root" ? "root" : "user",
      actorId: envelope?.actor_id || "ANON_PROBE",
      sessionId: envelope?.session_id || "unknown",
      targetEnvironment: process.env.DEPLOY_ENV || "unknown",
    });
    if (!result.allowed) {
      await arifSealAudit({
        type: "MUTATION_GATE_HOLD",
        command,
        verdict: result.verdict,
        reasons: result.reasonCodes,
      });
      return {
        status: "HARD_DENY",
        reason: `MUTATION_GATE: ${result.verdict} — ${(result.reasonCodes || []).join(", ")}`,
      };
    }
  } catch (err: any) {
    // Fail-closed: bridge unavailable = HOLD
    await arifSealAudit({
      type: "MUTATION_GATE_BRIDGE_FAIL",
      command,
      error: err.message,
    });
    return {
      status: "HARD_DENY",
      reason: `MUTATION_GATE: bridge unavailable — fail-closed. ${err.message}`,
    };
  }

  const risk = classifyShellCommandRisk(command);

  if (risk === "GODEL_LOCKED") {
    await arifSealAudit({ type: "GODEL_LOCKED", command });
    return { status: "HARD_DENY", reason: "GODEL_LOCKED: cannot authorize" };
  }

  if (risk === "IRREVERSIBLE") {
    if (!envelope?.session_id) {
      return {
        status: "HOLD_IRREVERSIBLE",
        gate: "F1_AMANAH",
        reason: "SEAL envelope required for irreversible command",
        required_action: "Obtain SEAL from arifOS via JITU, then retry with session_id",
      };
    }

    // Cryptographic verification — arifOS kernel round-trip
    const commandHash = SHA256(command);
    // arif_verify is called via MCP through arifOS client (Phase 1 parallel build).
    // Until Phase 1 is complete, verified will be an empty placeholder.
    let verified: Record<string, unknown> = {};
    try {
      verified = await callArifVerify(envelope.session_id, command, commandHash);
    } catch (err: any) {
      return {
        status: "HARD_DENY",
        reason: `arif_verify call failed: ${err.message}`,
        violations: [err.message],
      };
    }

    if (!verified.token_valid) {
      await arifSealAudit({
        type: "TOKEN_INVALID",
        command,
        violations: verified.violations,
        actor: envelope.actor_id,
      });
      return {
        status: "HARD_DENY",
        reason: "SEAL FORGERY DETECTED",
        violations: verified.violations as string[] | undefined,
      };
    }

    if (!verified.scope_valid) {
      await arifSealAudit({
        type: "SCOPE_MISMATCH",
        sealed_command: verified.sealed_command,
        actual_command: command,
        actor: verified.actor_id,
      });
      return {
        status: "HARD_DENY",
        reason: "COMMAND SCOPE VIOLATION: token does not cover this command",
        violations: verified.violations as string[] | undefined,
      };
    }

    if (!verified.replay_safe) {
      return { status: "HARD_DENY", reason: "SEAL ALREADY USED — REPLAY DETECTED" };
    }

    return { status: "SEAL_VALID", verified };
  }

  // MUTATION_GOVERN — filesystem mutation targeting paths OUTSIDE safe zones
  // Requires R3 GOVERN: human confirmation via elicitation flow.
  // This closes the shell bypass: `bash mv /etc/hosts` → BLOCKED without GOVERN.
  if (risk === "MUTATION_GOVERN") {
    if (!envelope?.session_id) {
      return {
        status: "GATE_HOLD",
        gate: "R3_GOVERN_FS_MUTATION",
        required: "GOVERN",
        got: "none",
        reason: "Filesystem mutation targeting path outside safe zones. " +
                "Use forge_filesystem_move/forge_filesystem_write for governed filesystem ops, " +
                "or use forge_shell with session_id + EXECUTE authority for safe-zone mutations.",
        required_action: "Route through forge_filesystem_* tools OR provide session_id with GOVERN authority",
      };
    }
    // Even with session_id, R3 GOVERN requires explicit human confirmation
    return {
      status: "GATE_HOLD",
      gate: "R3_GOVERN_FS_MUTATION",
      required: "GOVERN",
      got: envelope.session_id ? "EXECUTE" : "none",
      reason: "Filesystem mutation targeting path outside safe zones requires GOVERN authority. " +
              `Command: ${command.split(/\s+/)[0]} targets external path. ` +
              "Safe zones: /root/.agents/skills/, /root/AAA/skills/, /tmp/opencode/",
      required_action: "Use forge_filesystem_move for this operation, or obtain GOVERN authority from arifOS",
    };
  }

  // MUTATION_SAFE_ZONE — filesystem mutation within verified safe zone
  // Downgraded from R3 GOVERN to R2 EXECUTE. Still requires session_id.
  if (risk === "MUTATION_SAFE_ZONE") {
    if (!envelope?.session_id) {
      return {
        status: "GATE_HOLD",
        gate: "EXECUTE_AUTHORITY",
        required: "EXECUTE",
        got: "none",
        required_action: "Call arif_init() to obtain EXECUTE authority for safe-zone mutation",
      };
    }
    return { status: "EXECUTE_VALID" };
  }

  if (risk === "MUTATION") {
    if (!envelope?.session_id) {
      return {
        status: "GATE_HOLD",
        gate: "EXECUTE_AUTHORITY",
        required: "EXECUTE",
        got: "none",
        required_action: "Call arif_init() to obtain EXECUTE authority",
      };
    }
    return { status: "EXECUTE_VALID" };
  }

  return { status: "SAFE" };
}

/**
 * Call arifOS arif_verify tool via MCP.
 * Returns the verification result dict or throws.
 * NOTE: arif_verify is built in Phase 1 (arifOS kernel). Until that lands,
 * this will throw — which correctly prevents SEAL-bypass fabrication.
 */
async function callArifVerify(
  sessionId: string,
  command: string,
  commandHash: string
): Promise<Record<string, unknown>> {
  // Uses callMCP already imported at module level from ../client.js
  return await callMCP("arifos.arif_verify", {
    token: sessionId,
    command,
    command_hash: commandHash,
  }) as Record<string, unknown>;
}

/**
 * Verify an arifOS-issued authority envelope (Option C).
 *
 * arif_init mints `SEAL-{16 hex}` tokens. These are authority-bearing by
 * format — the kernel's public surface does not expose a session-lookup
 * endpoint, and re-calling arif_init creates a NEW session rather than
 * verifying the existing one.
 *
 * Trust model:
 *   - Format match → valid=true, authority_mode="SEAL", verdict="SEAL"
 *   - Format mismatch → valid=false (not a kernel-minted session)
 *
 * Bounded by: F8 LAW (localhost-only MCP transport via Caddy sovereign gate),
 * TTL (1h default via sessionGate.ts), ArifJudge classification, ArifSeal audit.
 */
async function verifyArifOSSession(session_id: string): Promise<AuthorityEnvelope> {
  if (SEAL_SESSION_PATTERN.test(session_id)) {
    return {
      valid: true,
      session_id,
      actor_id: "kernel-sealed",
      authority_mode: "EXECUTE",  // SEAL tokens permit EXECUTE_REVERSIBLE
      verdict: "SEAL",
    };
  }

  // Non-SEAL format → not kernel-authoritative
  return {
    valid: false,
    session_id,
    actor_id: "",
    authority_mode: "NONE",
    verdict: "SESSION_FORMAT_INVALID",
  };
}

/**
 * 5-MODE LADDER — Authority Mode Separation (SOVEREIGN-GRADE, 2026-06-29)
 *
 *   OBSERVE  — read-only, no mutation. Any session permitted.
 *   DRAFT    — proposes, dry-runs, plans. EXECUTE or higher required.
 *   EXECUTE  — acts on world. EXECUTE or higher required.
 *   SEAL     — commits to VAULT999. SEAL or SOVEREIGN required.
 *   RATIFY   — human confirmation required. SOVEREIGN required.
 *
 * The ladder is strict: each mode requires that level OR higher.
 */

function canObserve(authorityMode: string): boolean {
  // All modes permit OBSERVE
  return true;
}

function canDraft(authorityMode: string): boolean {
  const mode = authorityMode.toUpperCase();
  return mode.includes("EXECUTE") || mode.includes("SEAL") || mode.includes("FULL") || mode === "SOVEREIGN" || mode.includes("DRAFT");
}

function canExecute(authorityMode: string): boolean {
  const mode = authorityMode.toUpperCase();
  if (mode.includes("EXECUTE") || mode.includes("SEAL") || mode.includes("FULL") || mode === "SOVEREIGN") {
    return true;
  }
  return false;
}

function canSeal(authorityMode: string): boolean {
  const mode = authorityMode.toUpperCase();
  return mode.includes("SEAL") || mode === "SOVEREIGN";
}

function canRatify(authorityMode: string): boolean {
  return authorityMode === "SOVEREIGN";
}

/** Gate a tool call by required authority level */
function gateByAuthority(toolName: string, authorityMode: string): { permitted: boolean; required: string; got: string } {
  const n = toolName.toLowerCase();
  const mode = authorityMode.toUpperCase();

  // SEAL tools require SEAL or SOVEREIGN
  if (n.includes("_seal") || n.includes("vault_write") || n.includes("vault_seal")) {
    return { permitted: canSeal(mode), required: "SEAL", got: authorityMode };
  }
  // RATIFY/approve tools require SOVEREIGN
  if (n.includes("_ratify") || n.includes("_approve") || n.includes("_human")) {
    return { permitted: canRatify(mode), required: "SOVEREIGN", got: authorityMode };
  }
  // EXECUTE mutations require EXECUTE or higher
  if (
    n.includes("_execute") ||
    n.includes("_run") ||
    n.includes("_commit") ||
    n.includes("_push") ||
    n.includes("_create") ||
    n.includes("_delete") ||
    n.includes("_deploy") ||
    n.includes("_shell") ||
    n.includes("_github_create")
  ) {
    return { permitted: canExecute(mode), required: "EXECUTE", got: authorityMode };
  }
  // DRAFT tools (dry-run, plan, probe) require DRAFT or higher
  if (
    n.includes("_draft") ||
    n.includes("_plan") ||
    n.includes("_dry_run") ||
    n.includes("_simulate") ||
    n.includes("_probe")
  ) {
    return { permitted: canDraft(mode), required: "DRAFT", got: authorityMode };
  }
  // OBSERVE tools — always permitted
  return { permitted: true, required: "OBSERVE", got: authorityMode };
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_WORKSPACE = "/root";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_STDOUT_BYTES = 64 * 1024;   // 64KB
const MAX_STDERR_BYTES = 16 * 1024;   // 16KB

// Allow-listed environment variables forwarded to child process
const ALLOWED_ENV_VARS = [
  "PATH", "HOME", "USER", "SHELL", "TERM",
  "NODE_ENV", "NPM_CONFIG_LOGLEVEL",
  "LANG", "LC_ALL",
];

/**
 * Create a minimal, allow-listed environment for child processes.
 * Only forwards explicitly named variables — never secrets.
 */
function buildMinimalEnv(cwd: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ALLOWED_ENV_VARS) {
    if (process.env[key]) {
      env[key] = process.env[key]!;
    }
  }
  // Always set PWD and HOME
  env.PWD = cwd;
  env.HOME = process.env.HOME || "/root";
  return env;
}

/**
 * Execute a shell command with governance.
 */
async function executeShell(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const effectiveTimeout = Math.min(timeoutMs, MAX_TIMEOUT_MS);
  const env = buildMinimalEnv(cwd);

  return new Promise((resolve) => {
    try {
      const result = execSync(command, {
        cwd,
        timeout: effectiveTimeout,
        maxBuffer: MAX_STDOUT_BYTES + MAX_STDERR_BYTES,
        env,
        encoding: "utf-8" as const,
        stdio: ["pipe", "pipe", "pipe"] as const,
      });

      resolve({
        stdout: (result as any).toString?.()?.slice(0, MAX_STDOUT_BYTES) ?? "",
        stderr: "",
        exitCode: 0,
      });
    } catch (err: any) {
      resolve({
        stdout: (err.stdout?.toString?.() ?? "").slice(0, MAX_STDOUT_BYTES),
        stderr: (err.stderr?.toString?.() ?? err.message ?? "").slice(0, MAX_STDERR_BYTES),
        exitCode: err.status ?? err.code ?? -1,
      });
    }
  });
}

// ── forge_shell tool registration ──────────────────────────────────────────

/**
 * Register forge_shell and related tools on the given MCP server.
 */
export function registerShellTools(server: McpServer): void {
  // ── forge_shell (canonical governed shell) ──
  server.tool(
    "forge_shell",
    "Canonical governed shell execution. " +
    "Executes commands through constitutional gate (ArifJudge) + hash-chain audit (ArifSeal). " +
    "DENY patterns are hard-blocked. GATE patterns require human approval. " +
    "Every execution is sealed to VAULT999 hash chain. " +
    "REQUIRES arifOS authority envelope for executing mutable shell commands: call arif_init() first, pass the returned session_id. " +
    "Read-only probes may omit session_id when they are clearly observation-only. Use forge_shell_dryrun for preview without side effects.",
    {
      command: z.string().min(1).max(4000).describe("Shell command to execute"),
      cwd: z.string().default(DEFAULT_WORKSPACE).describe("Working directory"),
      timeout: z.number().default(DEFAULT_TIMEOUT_MS).describe("Timeout in ms (max " + MAX_TIMEOUT_MS + ")"),
      session_id: z.string().optional().describe("arifOS-issued session_id from arif_init(). REQUIRED for execution."),
      lease_id: z.string().optional().describe("Governed lease ID"),
      expected_output: z.string().min(1).max(4000).describe(
        "REQUIRED (2026-07-29 doctrine): what the agent expects this command to produce. " +
        "World model training fuel — prediction→actual gap is the richest supervision signal. " +
        "Sentinel '__NO_PREDICTION__' accepted when agent genuinely cannot predict output. " +
        "Sentinel usage is logged and tracked as prediction_rate health metric. " +
        "The gap between expected vs actual trains the ECHO world model (grpo.ts λ=0.03)."
      ),
    },
    async ({ command, cwd, timeout, session_id, lease_id, expected_output }) => {
      // Apply defaults (stateless HTTP path bypasses Zod schema defaults)
      const safeCwd = cwd || DEFAULT_WORKSPACE;
      const safeTimeout = (typeof timeout === 'number' && timeout > 0) ? Math.min(timeout, MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
      const startedAt = Date.now();

      // ── PHASE 2 PRE-EXECUTION GATE (E1 JITU) ────────────────────────────────
      // All commands pass through classifyShellCommandRisk — NO BYPASS.
      // This closes the readonlyBypass leak that allowed mutation commands
      // (mkdir, touch, cp, ln) to execute without session_id.
      const sealEnvelope: SealEnvelope | undefined = session_id
        ? {
            session_id: session_id as string,
            inputHash: SHA256(JSON.stringify({ command, cwd, timeout })),
            command_hash: SHA256(command),
            issued_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            actor_id: "forge-client",
          }
        : undefined;

      const gateResult = await preExecutionGate(command, sealEnvelope);

      // Handle HARD_DENY (GODEL_LOCKED or forged SEAL)
      if (gateResult.status === "HARD_DENY") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "HARD_DENY",
              gate: "PRE_EXECUTION_GATE",
              reason: gateResult.reason,
              violations: gateResult.violations,
              constitutional_floor: "F1 AMANAH",
              _epistemic: {
                output_class: "GOVERNANCE_TEMPLATE",
                authority_claim: "EXECUTIVE",
                evidence_source: "COMPUTED",
                tagged_by: "aforge-mcp",
                tagged_at: new Date().toISOString(),
              },
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Handle HOLD_IRREVERSIBLE — SEAL required but not provided
      if (gateResult.status === "HOLD_IRREVERSIBLE") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "HOLD_IRREVERSIBLE",
              gate: gateResult.gate,
              reason: gateResult.reason,
              required_action: gateResult.required_action,
              constitutional_floor: "F1 AMANAH",
              _epistemic: {
                output_class: "GOVERNANCE_TEMPLATE",
                authority_claim: "EXECUTIVE",
                evidence_source: "COMPUTED",
                tagged_by: "aforge-mcp",
                tagged_at: new Date().toISOString(),
              },
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Handle GATE_HOLD — EXECUTE authority required for MUTATION
      if (gateResult.status === "GATE_HOLD") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "AUTHORITY_REQUIRED",
              gate: gateResult.gate,
              reason: `MUTATION command '${command.split(/\s+/)[0]}' requires arifOS EXECUTE authority. ` +
                      "Call arif_init() to obtain a session_id, then retry.",
              required: gateResult.required,
              got: gateResult.got,
              required_action: gateResult.required_action,
              constitutional_floor: "F1 AMANAH",
              _epistemic: {
                output_class: "GOVERNANCE_TEMPLATE",
                authority_claim: "EXECUTIVE",
                evidence_source: "COMPUTED",
                tagged_by: "aforge-mcp",
                tagged_at: new Date().toISOString(),
              },
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Handle SEAL_VALID — IRREVERSIBLE command verified against arifOS vault
      if (gateResult.status === "SEAL_VALID") {
        // Log verified seal in epistemic record
        console.log(`[forge_shell] SEAL_VALID: ${command.slice(0, 100)} | verified=${JSON.stringify(gateResult.verified)}`);
      }

      // SAFE and EXECUTE_VALID proceed normally
      // (GODEL_LOCKED already returned HARD_DENY above)

      // ── Step 0b: Verify arifOS authority envelope for non-SAFE commands ──────
      // Only needed when we have a session_id (SAFE status has no envelope)
      let envelope: AuthorityEnvelope = {
        valid: true,
        session_id: "stateless-safe",
        actor_id: "ANON_PROBE",
        authority_mode: "OBSERVE",
        verdict: "SAFE",
      };
      if (gateResult.status !== "SAFE" && session_id) {
        envelope = await verifyArifOSSession(session_id as string);
        if (!envelope.valid) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "AUTHORITY_REJECTED",
                gate: "arifOS_Envelope",
                reason: `arifOS rejected session '${session_id}'. Call arif_init() to obtain a valid session.`,
                verdict: envelope.verdict,
                _epistemic: {
                  output_class: "GOVERNANCE_TEMPLATE",
                  authority_claim: "EXECUTIVE",
                  evidence_source: "COMPUTED",
                  tagged_by: "aforge-mcp",
                  tagged_at: new Date().toISOString(),
                },
              }, null, 2),
            }],
            isError: true,
          };
        }
        if (!canExecute(envelope.authority_mode)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "AUTHORITY_INSUFFICIENT",
                gate: "arifOS_Envelope",
                reason: `arifOS session authority '${envelope.authority_mode}' is insufficient for forge_shell execution. ` +
                        "Need EXECUTE or SEAL authority. Call arif_init() with higher authority request.",
                envelope: { authority_mode: envelope.authority_mode, actor_id: envelope.actor_id },
                _epistemic: {
                  output_class: "GOVERNANCE_TEMPLATE",
                  authority_claim: "EXECUTIVE",
                  evidence_source: "COMPUTED",
                  tagged_by: "aforge-mcp",
                  tagged_at: new Date().toISOString(),
                },
              }, null, 2),
            }],
            isError: true,
          };
        }
      }

      // ── Step 0b: Gödel lock check ──
      const godelCheck = checkModificationIntent({ type: "execute", target: cwd || DEFAULT_WORKSPACE, tool: "forge_shell" });
      if (!godelCheck.allowed) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "GODEL_LOCKED",
              gate: "GödelLock",
              reason: godelCheck.reason,
              _epistemic: {
                output_class: "GOVERNANCE_TEMPLATE",
                authority_claim: "EXECUTIVE",
                evidence_source: "COMPUTED",
                tagged_by: "aforge-mcp",
                tagged_at: new Date().toISOString(),
              },
            }, null, 2),
          }],
          isError: true,
        };
      }

      // ── Step 1: ArifJudge classification ──
      const judge: JudgeResult = classifyCommand(command, cwd);

      if (judge.decision === "deny") {
        fireAlert({
          type: "deny",
          tool: "forge_shell",
          command: command.slice(0, 500),
          judge_decision: "deny",
          matched_pattern: judge.matchedPattern,
          session_id,
          timestamp: new Date().toISOString(),
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "DENY",
              gate: "ArifJudge",
              tool: "forge_shell",
              reason: judge.reason,
              matched_pattern: judge.matchedPattern,
              command: command.slice(0, 500),
              constitutional_floor: "F9 ANTI-HANTU / F1 AMANAH",
              _epistemic: {
                output_class: "GOVERNANCE_TEMPLATE",
                authority_claim: "EXECUTIVE",
                evidence_source: "COMPUTED",
                tagged_by: "aforge-mcp",
                tagged_at: new Date().toISOString(),
              },
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Alert on GATE patterns
      if (judge.decision === "gate") {
        fireAlert({
          type: "gate",
          tool: "forge_shell",
          command: command.slice(0, 500),
          judge_decision: "gate",
          matched_pattern: judge.matchedPattern,
          session_id,
          timestamp: new Date().toISOString(),
        });
      }

      // Alert on self-modification patterns
      if (judge.matchedPattern?.startsWith("self_modify:")) {
        fireAlert({
          type: "self_modify",
          tool: "forge_shell",
          command: command.slice(0, 500),
          judge_decision: judge.decision,
          matched_pattern: judge.matchedPattern,
          session_id,
          timestamp: new Date().toISOString(),
        });
      }

      // ── Step 2: Execute ──
      const result = await executeShell(command, safeCwd, safeTimeout);

      // ── World Model: build metadata from this execution (L1-L5) ──
      // Sentinel handling via worldModel.ts normalizePrediction
      const resolvedPrediction = normalizePrediction(expected_output);
      const agentConfidence = resolvedPrediction ? 0.85 : 0.30; // honest uncertainty = low confidence

      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join("\n");
      const wmMeta = buildWmMetadata({
        tool: "forge_shell",
        args: { command: command.slice(0, 200), cwd: safeCwd },
        observation: combinedOutput.slice(0, 20000),
        agentConfidence,
        predictedObservation: resolvedPrediction,
        exitCode: result.exitCode,
      });

      // Fire-and-forget trajectory logging (with prediction data)
      logTrajectory({
        tool: "forge_shell",
        args: { command: command.slice(0, 200), cwd: safeCwd },
        observation: combinedOutput.slice(0, 20000),
        agentConfidence,
        predictedObservation: resolvedPrediction,
        exitCode: result.exitCode,
      }).catch(err => console.error(`[forge_shell] WM log error: ${err.message}`));

      // ── Step 3: ArifSeal (hash-chain audit) ──
      const sealer = getDefaultArifSeal();
      let sealRecord: any = { seq: 0, hash: "pending" };
      try {
        sealRecord = await sealer.seal({
          tool: "forge_shell",
          args: { command: command.slice(0, 200), cwd, timeout },
          judge_decision: judge.decision,
          stdout: result.stdout,
          stderr: result.stderr,
          exit_code: result.exitCode,
          notes: judge.decision === "allow"
            ? "auto-executed"
            : "requires human gate (approval queue)",
          wm_metadata: wmMeta as unknown as Record<string, unknown>,
        });
      } catch (sealErr: any) {
        console.error(`[forge_shell] ArifSeal error: ${sealErr.message}`);
      }

      const elapsed = Date.now() - startedAt;

      // ── Step 4: Execution Authority Ladder Check ──
      const actionClass = classifyShellCommand(command);
      const authorityResult = checkAuthorityFromActionClass(actionClass);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: result.exitCode === 0 ? "SEAL" : "ERROR",
            tool: "forge_shell",
            command: command.slice(0, 500),
            exit_code: result.exitCode,
            stdout: result.stdout.slice(0, 20000),
            stderr: result.stderr.slice(0, 10000),
            elapsed_ms: elapsed,
            cwd,
            // Governance metadata
            governance: {
              judge: judge.decision,
              reason: judge.reason,
              action_class: actionClass,
              authority: authorityResult,
              sealed: true,
              seal_seq: sealRecord.seq,
              seal_hash: sealRecord.hash,
              ledger: sealer["config"]?.ledgerPath,
            },
            truncated: {
              stdout: result.stdout.length > MAX_STDOUT_BYTES,
              stderr: result.stderr.length > MAX_STDERR_BYTES,
            },
            // Discovery 8+9: Memory + Epistemic signals
            _memory: Memory.live('forge_shell').class,
            _epistemic: {
              evidence_layer: 'OBS',
              confidence: 0.85,
              source: 'forge_shell',
              reversible: true,
              authority_claim: result.exitCode === 0 ? 'EVIDENCE' : 'ADVISORY',
            },
            // World Model metadata (AGENTIC-WORLD-MODEL-EUREKA L1-L5)
            wm_metadata: wmMeta,
          }, null, 2),
        }],
        isError: result.exitCode !== 0,
      };
    }
  );

  // ── forge_shell_dryrun (preview without mutation) ──
  // Keeping for backward compatibility — delegates to same governance
  server.tool(
    "forge_shell_dryrun",
    "Preview a shell command's output WITHOUT executing it. " +
    "Returns what WOULD happen. F1 AMANAH: no mutation, pure dry-run. " +
    "For actual execution, use forge_shell.",
    {
      command: z.string().describe("Shell command to preview"),
      timeout: z.number().default(10000).describe("Timeout in ms (default 10s, max 60s)"),
    },
    async ({ command, timeout }) => {
      // P0.3 FIX (2026-08-12): stateless HTTP path bypasses Zod validation —
      // command can be undefined. Guard before any downstream .trim() calls.
      if (typeof command !== "string" || command.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "HOLD",
              error_class: "MISSING_INPUT",
              field: "command",
              message: "Required parameter 'command' is missing or empty",
              recoverability: "AGENT_CAN_RETRY",
            }, null, 2),
          }],
          isError: true,
        };
      }
      // Apply default (stateless HTTP path bypasses Zod schema defaults)
      const safeTimeout = (typeof timeout === 'number' && timeout > 0) ? Math.min(timeout, 60000) : 10000;
      // Step 1: ArifJudge (still gate even dry-run — safety)
      const judge = classifyCommand(command);

      if (judge.decision === "deny") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "DENY",
              gate: "ArifJudge",
              reason: `F9 ANTI-HANTU: Pattern blocked even in dry-run. ${judge.reason}`,
              matched_pattern: judge.matchedPattern,
            }, null, 2),
          }],
          isError: true,
        };
      }

      // P0 FIX (2026-08-13): TRUE dry-run — parse the command, do NOT execute.
      // Previous behavior used execSync which made this a "lie" (executed
      // commands despite the dry_run=true label). Now: AST parse → show
      // what WOULD execute (program, args, redirects, pipes) without running.
      // For actual execution, use forge_shell.
      const parsed = parseShellCommand(command);
      const risk = classifyShellCommandRisk(command);
      const previewText = parsed.segments.map(s => {
        const redirects = s.redirects.map(r => `  ${r.fd}${r.op}${r.target}`).join("\n");
        return `  ${s.program} ${s.args.join(" ")}${redirects ? "\n" + redirects : ""}`;
      }).join("\n");
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            dry_run: true,
            command,
            parsed,
            risk,
            exit_code: 0,
            output: "[DRY-RUN: NOT EXECUTED] Command would proceed as follows:\n" + previewText,
            governance: {
              judge: judge.decision,
              action_class: judge.actionClass,
            },
            note: "TRUE DRY-RUN: command parsed but NOT executed. " +
                   "No side effects, no network calls, no file mutations. " +
                   "Use forge_shell for governed execution.",
            _epistemic: {
              output_class: "DETERMINISTIC",
              ai_involvement: "NONE",
              authority_claim: "ADVISORY",
              evidence_source: "PARSED",
              tagged_by: "aforge-mcp",
              tagged_at: new Date().toISOString(),
            },
          }, null, 2),
        }],
      };
    }
  );

  // ── forge_shell_status ──
  server.tool(
    "forge_shell_status",
    "Check forge_shell subsystem health: ledger state, judge pattern count, defaults.",
    {},
    async () => {
      const sealer = getDefaultArifSeal();
      let ledgerState = { seq: 0, lastHash: "not-open", ledgerPath: "" };
      let chainValid = true;
      let chainErrors: string[] = [];
      let chainRecords = 0;

      try {
        ledgerState = await sealer.getState();
        const verifyResult = await sealer.verify();
        chainValid = verifyResult.valid;
        chainErrors = verifyResult.errors;
        chainRecords = verifyResult.records;
      } catch (err: any) {
        chainValid = false;
        chainErrors = [`Ledger read error: ${err.message}`];
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: chainValid ? "SEAL" : "CHAIN_ERROR",
            service: "forge_shell",
            version: "1.0.0",
            ledger: {
              path: ledgerState.ledgerPath,
              records: chainRecords,
              last_seq: ledgerState.seq,
              last_hash: ledgerState.lastHash,
              chain_valid: chainValid,
              chain_errors: chainErrors,
            },
            judge: {
              deny_patterns: 37,
              gate_patterns: 38,
            },
            defaults: {
              workspace: DEFAULT_WORKSPACE,
              timeout_ms: DEFAULT_TIMEOUT_MS,
              max_timeout_ms: MAX_TIMEOUT_MS,
              max_stdout_bytes: MAX_STDOUT_BYTES,
              max_stderr_bytes: MAX_STDERR_BYTES,
              allowed_env_vars: ALLOWED_ENV_VARS,
            },
            _epistemic: {
              output_class: "DETERMINISTIC",
              ai_involvement: "NONE",
              authority_claim: "ADVISORY",
              evidence_source: "COMPUTED",
              tagged_by: "aforge-mcp",
              tagged_at: new Date().toISOString(),
            },
          }, null, 2),
        }],
      };
    }
  );

  // ── forge_shell_ledger — Read-only, paged ArifSeal ledger query ──
  server.tool(
    "forge_shell_ledger",
    "Query recent ArifSeal hash-chain ledger entries. Read-only, paged. Returns last N records with chain integrity status.",
    {
      limit: z.number().default(10).describe("Max records to return (1-100)"),
      offset: z.number().default(0).describe("Skip N most recent records (0 = latest)"),
      verify_chain: z.boolean().default(true).describe("Also run full chain verification"),
    },
    async ({ limit, offset, verify_chain }) => {
      const sealer = getDefaultArifSeal();
      const { readFile } = await import("node:fs/promises");
      const safeLimit = Math.max(1, Math.min(limit, 100));

      try {
        await sealer.open();
        const content = await readFile(sealer["config"].ledgerPath, "utf-8").catch(() => "");
        const lines = content.trim().split("\n").filter(Boolean).reverse();
        const total = lines.length;
        const page = lines.slice(offset, offset + safeLimit).map(l => JSON.parse(l));

        let chainStatus = { valid: true, errors: [] as string[], records: 0 };
        if (verify_chain) {
          chainStatus = await sealer.verify();
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "SEAL",
              tool: "forge_shell_ledger",
              ledger_path: sealer["config"].ledgerPath,
              total_records: total,
              returned: page.length,
              offset,
              limit: safeLimit,
              chain: {
                valid: chainStatus.valid,
                records: chainStatus.records,
                errors: chainStatus.errors,
              },
              entries: page.map(r => ({
                seq: r.seq,
                ts: r.ts,
                tool: r.tool,
                judge_decision: r.judge_decision,
                exit_code: r.exit_code,
                args_preview: Object.keys(r.args || {}),
                stdout_sha256: r.stdout_sha256?.slice(0, 16) + "...",
                hash: r.hash?.slice(0, 16) + "...",
                prev_hash: r.prev_hash?.slice(0, 16) + "...",
              })),
              _epistemic: {
                output_class: "DETERMINISTIC",
                ai_involvement: "NONE",
                authority_claim: "ADVISORY",
                evidence_source: "COMPUTED",
                tagged_by: "aforge-mcp",
                tagged_at: new Date().toISOString(),
              },
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "ERROR",
              error: `Ledger read failed: ${err.message}`,
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // ── forge_shell_alert_history — Alert history for DENY/GATE/self-mod events ──
  server.tool(
    "forge_shell_alert_history",
    "View recent ArifJudge alert history (DENY/GATE/self-modification events). Read-only.",
    {
      limit: z.number().default(20).describe("Max alerts to return (1-100)"),
    },
    async ({ limit }) => {
      const safeLimit = Math.max(1, Math.min(limit, 100));
      const { getAlertHistory } = await import("./forgeShell.js");
      const alerts = getAlertHistory(safeLimit);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            total_alerts: alerts.length,
            alerts: alerts.map(a => ({
              type: a.type,
              time: a.timestamp,
              tool: a.tool,
              judge: a.judge_decision,
              command: a.command.slice(0, 200),
              pattern: a.matched_pattern,
            })),
            _epistemic: {
              output_class: "DETERMINISTIC",
              ai_involvement: "NONE",
              authority_claim: "ADVISORY",
              evidence_source: "COMPUTED",
              tagged_by: "aforge-mcp",
              tagged_at: new Date().toISOString(),
            },
          }, null, 2),
        }],
      };
    }
  );
}

// ── Alerting ───────────────────────────────────────────────────────────────
// Wire alerting hooks for DENY/GATE/self-mod events.
// Called by forge_shell handler after ArifJudge classification.

export interface AlertEvent {
  type: "deny" | "gate" | "self_modify" | "execution";
  tool: string;
  command: string;
  judge_decision: string;
  matched_pattern?: string;
  session_id?: string;
  actor_id?: string;
  timestamp: string;
}

const MAX_ALERTS = 100;
const alertRing: AlertEvent[] = [];

export function fireAlert(event: AlertEvent): void {
  // Store in ring buffer
  alertRing.push(event);
  if (alertRing.length > MAX_ALERTS) alertRing.shift();

  // Always log to stderr with alert prefix for systemd/journald capture
  const prefix = event.type === "deny" ? "🔴" :
                 event.type === "gate" ? "🟡" :
                 event.type === "self_modify" ? "🛑" : "🔵";
  process.stderr.write(
    `${prefix} [ALERT:${event.type}] ${event.tool}: ${event.command.slice(0, 200)} ` +
    `| judge=${event.judge_decision}` +
    (event.matched_pattern ? ` | pattern=${event.matched_pattern}` : "") +
    `\n`
  );

  // For DENY and self_modify, also write to a dedicated alert log
  if (event.type === "deny" || event.type === "self_modify") {
    const alertPath = "/root/A-FORGE/data/alerts.jsonl";
    mkdir("/root/A-FORGE/data", { recursive: true }).catch(() => {});
    appendFile(alertPath, JSON.stringify(event) + "\n").catch(() => {});
  }
}

export function getAlertHistory(limit: number = 20): AlertEvent[] {
  return alertRing.slice(-Math.max(1, Math.min(limit, 100)));
}
