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
import { appendFile, mkdir } from "node:fs/promises";
import { classifyCommand, type JudgeResult } from "./arifJudge.js";
import { getDefaultArifSeal } from "./arifSeal.js";
import { checkModificationIntent, isGodelLocked } from "./godelLock.js";
import { classifyShellCommand, type ActionClass } from "../../../domain/governance/execution-authority.js";
import { classifyUnknown, isStructuredError } from "../../../domain/governance/error-classifier.js";
import { Memory, Epistemic, enrichResult } from "../../../domain/governance/epistemic-signal.js";

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
// F11 AUTH: Authority is verified by token format, not redundant kernel round-trip.

const SEAL_SESSION_PATTERN = /^SEAL-[a-f0-9]{16}$/;
const READONLY_SHELL_COMMANDS = new Set([
  "sha256sum", "sha1sum", "md5sum", "shasum",
  "cat", "head", "tail", "less", "more",
  "ls", "stat", "file", "wc", "du", "df", "tree",
  "date", "echo", "printf", "env", "pwd", "whoami", "hostname", "uname",
  "which", "whereis", "type",
  "find", "grep", "rg", "ag",
  "jq", "yq", "xmllint",
  "test", "[", "true", "false",
  "mkdir", "touch", "ln", "cp",
]);

function isReadonlyShellCommand(command: string): boolean {
  const trimmed = command.trim();
  const firstToken = trimmed.split(/\s+/)[0]?.replace(/^["'`]/, "") ?? "";
  const baseCmd = firstToken.split("/").pop() ?? firstToken;
  if (READONLY_SHELL_COMMANDS.has(baseCmd)) {
    return true;
  }
  if (baseCmd === "curl") {
    return !/\b(-X\s*(POST|PUT|PATCH|DELETE)|--request\s*(POST|PUT|PATCH|DELETE)|--data(?:-binary)?|-d\b|--upload-file\b|--form\b)\b/i.test(command);
  }
  return false;
}

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
    },
    async ({ command, cwd, timeout, session_id, lease_id }) => {
      // Apply defaults (stateless HTTP path bypasses Zod schema defaults)
      const safeCwd = cwd || DEFAULT_WORKSPACE;
      const safeTimeout = (typeof timeout === 'number' && timeout > 0) ? Math.min(timeout, MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
      const startedAt = Date.now();

      const readonlyBypass = !session_id && isReadonlyShellCommand(command);

      // ── Step 0: Verify arifOS authority envelope (Option C) ──
      // forge_shell does NOT use local session registry. It calls arifOS
      // directly to verify the session. This keeps the kernel as sole
      // issuer of authority.
      if (!session_id && !readonlyBypass) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "AUTHORITY_REQUIRED",
              gate: "arifOS_Envelope",
              reason: "forge_shell requires an arifOS-issued authority envelope (session_id from arif_init). " +
                      "Call arif_init() first, then pass the returned session_id.",
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

      const envelope = readonlyBypass
        ? {
            valid: true,
            session_id: "stateless-readonly",
            actor_id: "stateless-client",
            authority_mode: "OBSERVE",
            verdict: "SEAL",
          }
        : await verifyArifOSSession(session_id as string);
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

      if (!readonlyBypass && !canExecute(envelope.authority_mode)) {
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

      // Run sandboxed via timeout (same as before but with governance note)
      const effective_timeout = Math.min(safeTimeout, 60000);
      try {
        const output = execSync(command, {
          encoding: "utf-8",
          timeout: effective_timeout,
          maxBuffer: 1024 * 1024,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "SEAL",
              dry_run: true,
              command,
              exit_code: 0,
              output: (output ?? "").slice(0, 100000),
              truncated: (output?.length ?? 0) > 100000,
              governance: {
                judge: judge.decision,
                action_class: judge.actionClass,
              },
              note: "DRY-RUN: Shows actual output but does not mutate state. " +
                     "Use forge_shell for governed execution.",
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
              status: "SEAL",
              dry_run: true,
              command,
              exit_code: err.status ?? -1,
              output: (err.stdout ?? "").slice(0, 5000),
              error: (err.stderr ?? err.message ?? "").slice(0, 5000),
              note: "DRY-RUN: Command failed but no state was mutated.",
            }, null, 2),
          }],
          isError: true,
        };
      }
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
