/**
 * ArifJudge — Constitutional gate for A-FORGE terminal execution.
 *
 * Classifies every command into one of three bands:
 *   ALLOW — read-only and low-blast-radius ops → auto-execute
 *   GATE  — irreversible or high-blast-radius ops → require human approval
 *   DENY  — constitutionally blocked ops → raise ToolError
 *
 * Classification is EFFECT-BASED, not name-based. It parses the command
 * string for dangerous patterns (argv-style, not just names).
 *
 * Constitutional:
 *   F1 AMANAH — irreversible action sensed before execution
 *   F9 ANTI-HANTU — blocked patterns enforced
 *   F13 SOVEREIGN — hard gate for sovereign-touching actions
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

// ── Classification Result ──────────────────────────────────────────────────

export type JudgeDecision = "allow" | "gate" | "deny";

export interface JudgeResult {
  decision: JudgeDecision;
  /** Human-readable reason */
  reason: string;
  /** Which constitutional band was matched */
  matchedPattern?: string;
  /** Suggested action class for the caller */
  actionClass?: string;
}

// ── Pattern Sets ───────────────────────────────────────────────────────────

/**
 * DENY list — constitutionally blocked operations.
 * These patterns are NEVER allowed. Matched before GATE or ALLOW.
 *
 * Can be bypassed with creative shell (e.g., rm -rf /* instead of rm -rf /),
 * so this is defense-in-depth, not a security boundary.
 * The sandbox (ContainmentEngine) is the actual security boundary.
 */
const DENY_PATTERNS: RegExp[] = [
  // Destructive filesystem (root-level only)
  /\brm\s+-rf\s+\/\s*$/,           // rm -rf /  (exact root wipe)
  /\brm\s+-rf\s+\/(dev|etc|bin|boot|proc|sys|usr|var|opt|lib|mnt|media)(\s|\/|$)/,  // rm -rf system dir
  /\bmkfs\b/,                      // mkfs (filesystem creation)
  /\bdd\b/,                        // dd (raw device write)
  /\bmkswap\b/,                    // mkswap (swap creation)
  /\bfdisk\b/,                     // fdisk (partition table)

  // Fork bombs and resource exhaustion
  /:\s*\(\s*\)\s*\{/,             // fork bomb pattern: :(){ ... }
  /\|:\s*&\s*:/,                  // fork bomb variant

  // Privilege escalation
  /\bsudo\s/,                      // sudo (privilege escalation)
  /\bsu\s/,                        // su (switch user)
  /\bchmod\s+4\d{3}\b/,           // chmod 4xxx (setuid)
  /\bchown\b/,                     // chown (ownership change)
  /\bpasswd\b/,                    // passwd (password change)
  /\buseradd\b/,                   // useradd
  /\busermod\b/,                   // usermod
  /\bgroupadd\b/,                  // groupadd

  // Direct kernel interface
  /\binsmod\b/,                    // kernel module insert
  /\bmodprobe\b/,                  // kernel module management
  /\bkexec\b/,                     // kernel exec
  /\breboot\b/,                    // reboot
  /\bshutdown\b/,                  // shutdown
  /\bhalt\b/,                      // halt
  /\bpoweroff\b/,                  // poweroff
  /\binit\s+0\b/,                  // init 0
  /\binit\s+6\b/,                  // init 6

  // Service management (unsupervised — requires GATE at minimum)
  /\bsystemctl\s+(stop|restart|start|enable|disable|mask|unmask)\b/,

  // Container escape
  /\bdocker\s+exec\s+-it\b/,      // interactive docker exec
  /\bdocker\s+run\s+--privileged\b/,

  // Destructive git
  /\bgit\s+push\s+--force\b/,     // force push
  /\bgit\s+reset\s+--hard\b/,     // hard reset

  // Database destruction
  /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i,

  // Network manipulation
  /\biptables\b/,                  // firewall changes
  /\broute\s+(add|del|replace)\b/, // routing table changes
  /\bifconfig\s+\w+\s+(up|down)\b/, // interface manipulation
  /\bip\s+link\s+(set|add|del)\b/, // ip link manipulation

  // Config file modification (outside workspace)
  /\/etc\/.*(passwd|shadow|sudoers|ssh|ssl|certs)\b/,

  // MCP stdio injection — OX Security Advisory April 2026 (Family 2: hardening bypass)
  // Blocks command injection via allowed-command argument abuse in MCP server launchers
  /\bnpx\s+-c\b/,                  // npx -c <injected-command>
  /\bnpm\s+exec\s+-c\b/,           // npm exec -c <injected-command>
  /\buvx\s+--from\s+\S+\s+-c\b/,  // uvx --from <pkg> -c <injected-command>
  /\buv\s+run\s+-c\b/,             // uv run -c <injected-command>
  /\bpython3?\s+-c\s+/,            // python -c <injected-command> (in MCP launcher context)
  /\bbash\s+-c\s+/,                // bash -c <injected-command> (in MCP launcher context)

  // MCP STDIO transport type spoofing — Family 4 (MITM transport substitution)
  // Blocks JSON payloads that inject stdio transport into HTTP-only MCP configs
  /"transport_type"\s*:\s*"stdio"/,
  /'transport_type'\s*:\s*'stdio'/,

  // MCP launcher self-modification — block creation of new malicious launchers
  /mcp-launchers\//,
  /mcpServers/,
];

/**
 * GATE list — operations that require human approval.
 * These are reversible-ish but high blast radius.
 */
const GATE_PATTERNS: RegExp[] = [
  // Destructive operations on workspace (non-root)
  /\brm\s+-rf\b/,                  // recursive rm (workspace-scoped, non-root caught by DENY)
  /\brm\s+-r\b/,                   // recursive rm
  /\brmdir\b/,                     // directory removal

  // Network-modifying git
  /\bgit\s+push\b/,                // git push (network write)
  /\bgit\s+fetch\b/,               // git fetch (network read but triggers hooks)
  /\bgit\s+pull\b/,                // git pull (network + merge)

  // Package management
  /\bnpm\s+(install|publish|uninstall)\b/,
  /\byarn\s+(add|remove|publish)\b/,
  /\bpip\s+(install|uninstall)\b/,
  /\bapt\s+(install|remove)\b/,
  /\bapt-get\s+(install|remove)\b/,
  /\bdnf\s+(install|remove)\b/,
  /\bbrew\s+(install|uninstall)\b/,
  /\bcargo\s+(install|publish)\b/,

  // Network writes
  /\bcurl\s+.*-X\s*(POST|PUT|DELETE|PATCH)\b/,
  /\bwget\s+.*-O\s+/,
  /\bscp\b/,
  /\brsync\b/,

  // Service management (non-destructive)
  /\bsystemctl\s+(reload|reload-or-restart)\b/,
  /\bdocker\s+(stop|kill|rm)\s+/,
  /\bdocker\s+compose\s+(down|stop|rm)\b/,

  // File mutations outside workspace
  /\/var\/log\//,
  /\/etc\//,

  // Process management
  /\bkill\b/,
  /\bpkill\b/,
  /\bkillall\b/,

  // Environment mutation
  /\bexport\s+\w+=/,

  // Database writes
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+(TABLE|DATABASE|SCHEMA)\b/i,
  /\bCREATE\s+(TABLE|DATABASE|INDEX)\b/i,
];

// ── Classifier ─────────────────────────────────────────────────────────────

/**
 * Classify a shell command into ALLOW/GATE/DENY.
 *
 * Uses effect-based classification: looks for patterns in the command
 * string that indicate irreversible, stateful, or read-only operations.
 *
 * @param command - The shell command string to classify
 * @param cwd - Working directory (used for workspace-scoped decisions)
 * @returns JudgeResult with decision, reason, and matched pattern
 */
export function classifyCommand(command: string, cwd?: string): JudgeResult {
  const trimmed = command.trim();

  // Empty command
  if (!trimmed) {
    return {
      decision: "allow",
      reason: "Empty command — no action needed",
      actionClass: "OBSERVE",
    };
  }

  // ── DENY check (hard block) ──
  for (const pattern of DENY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        decision: "deny",
        reason: `888_HOLD: Constitutionally blocked operation — matched DENY pattern`,
        matchedPattern: pattern.source,
        actionClass: "IRREVERSIBLE",
      };
    }
  }

  // ── GATE check (human approval required) ──
  for (const pattern of GATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        decision: "gate",
        reason: `888_HOLD: High-blast-radius operation — requires human approval`,
        matchedPattern: pattern.source,
        actionClass: "EXECUTE_HIGH_IMPACT",
      };
    }
  }

  // ── Self-modification check ──
  // Any command that touches A-FORGE's own source, config, or service lifecycle
  // F7 STREAMLINED (2026-07-28): Only protect kernel/binary/systemd paths.
  // Agent modifies its own dist during dev — that's fine.
  // /root/A-FORGE/dist/ is excluded because agents modify their own dist.
  const aforgePaths = [
    "/opt/a-forge/bin",
    "/etc/systemd/system/a-forge",
  ];
  for (const afPath of aforgePaths) {
    if (trimmed.includes(afPath)) {
      return {
        decision: "gate",
        reason: `888_HOLD: Self-modification risk — command touches protected path '${afPath}'`,
        matchedPattern: `self_modify:${afPath}`,
        actionClass: "IRREVERSIBLE",
      };
    }
  }

  // Service lifecycle commands (stop/restart/reload A-FORGE services)
  const aforgeServices = ["a-forge", "a-forge-mcp", "arifos", "forge"];
  for (const svc of aforgeServices) {
    if (new RegExp(`\\b${svc}\\b`).test(trimmed)) {
      // Check if it's a restart/stop/reload command
      if (/\b(restart|stop|reload|kill|shutdown)\b/i.test(trimmed)) {
        return {
          decision: "gate",
          reason: `888_HOLD: Self-modification risk — command targets A-FORGE service '${svc}'`,
          matchedPattern: `self_modify:service:${svc}`,
          actionClass: "IRREVERSIBLE",
        };
      }
    }
  }

  // ── ALLOW (read-only or low-blast-radius) ──
  return {
    decision: "allow",
    reason: "Read-only or low-blast-radius operation — auto-allowed",
    actionClass: "EXECUTE_REVERSIBLE",
  };
}

/**
 * Quick check: is this command safe to auto-execute?
 */
export function isCommandSafe(command: string): boolean {
  return classifyCommand(command).decision === "allow";
}

/**
 * Get the list of patterns for display/debugging.
 */
export function getPatternSets(): { deny: RegExp[]; gate: RegExp[] } {
  return {
    deny: DENY_PATTERNS,
    gate: GATE_PATTERNS,
  };
}
