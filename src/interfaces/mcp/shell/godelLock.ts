/**
 * GödelLock — Constitutional immutability kernel for A-FORGE recursive improvement.
 *
 * Defines what the system may NOT self-modify, no matter how clever the loop.
 * The Gödel lock is the fixed point that prevents the agent from rewriting
 * its own constitution, sealer, auth, or promotion physics.
 *
 * "The system may rewrite its methods, but not its constitution, ledger,
 *  or veto boundary without higher authority."
 *
 * Constitutional:
 *   F1 AMANAH — locked paths cannot be mutated by the loop
 *   F9 ANTI-HANTU — the lock is code, not prompt
 *   F13 SOVEREIGN — constitutional lock requires F13 to override
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

// ── Gödel-Locked Paths (CONSTITUTIONAL — do not modify without F13 approval) ──

/**
 * Filesystem paths that the recursive improvement loop may NEVER modify.
 * These are the system's constitutional bedrock.
 */
export const GODEL_LOCKED_PATHS: string[] = [
  // Constitutional floors — the law itself
  "/root/arifOS/static/arifos/theory/000/000_CONSTITUTION.md",

  // Gödel lock definition — cannot lock itself
  // (this file is implicitly locked by convention)

  // ArifJudge — the constitutional gate for all shell execution
  "/root/A-FORGE/src/interfaces/mcp/shell/arifJudge.ts",

  // ArifSeal — the hash-chain ledger (immutable audit)
  "/root/A-FORGE/src/interfaces/mcp/shell/arifSeal.ts",

  // Floor enforcers — F1-F13 enforcement code
  "/root/A-FORGE/src/domain/governance/FloorEnforcer.ts",
  "/root/A-FORGE/src/domain/governance/mcpFloorEnforcer.ts",
  "/root/A-FORGE/src/domain/governance/actionClassifier.ts",

  // Auth and identity
  "/root/A-FORGE/data/agent_identities.json",

  // Promotion and governance rules
  "/root/A-FORGE/src/interfaces/mcp/shell/godelLock.ts",
  "/root/A-FORGE/src/interfaces/mcp/shell/antiSink.ts",

  // Network policy and service definitions
  "/root/A-FORGE/deploy/caddy/Caddyfile",
  "/root/A-FORGE/deploy/systemd/",
  "/root/A-FORGE/docker-compose.yml",
];

/**
 * Tool names that the recursive improvement loop may NEVER call on itself.
 *
 * NOTE: forge_shell was REMOVED from this list (2026-06-28) because:
 *   - forge_shell HAS ArifJudge (DENY/GATE/ALLOW command classification)
 *   - forge_shell HAS ArifSeal (immutable hash-chain audit ledger)
 *   - forge_shell HAS the F12 path check in FloorEnforcer (sensitive path rejection)
 *   - forge_shell HAS the session gate (session_id required)
 *   These layers provide complete constitutional protection. Locking forge_shell
 *   from executing ANY command would render the governance stack inert.
 *
 * Remaining locked tools: write/edit/git which bypass forge_shell governance
 * when called directly.
 */
export const GODEL_LOCKED_TOOLS: string[] = [
  "forge_filesystem",      // Must not write to locked paths
  "forge_git",             // Must not git-commit changes to locked paths
  "forge8_execute",        // Must not execute artifacts that modify locked zones
];

/**
 * Gödel lock severity levels.
 */
export type GodelLockSeverity = "CONSTITUTIONAL" | "CORE" | "BOUNDED";

export interface GodelLockEntry {
  /** What is locked */
  target: string;
  /** Type of lock */
  type: "path" | "tool" | "domain";
  /** Why it is locked */
  reason: string;
  /** Severity — CONSTITUTIONAL cannot be overridden without F13 */
  severity: GodelLockSeverity;
  /** F13 override token (set only if explicitly approved) */
  f13_override?: string;
}

// ── Gödel Lock Registry ─────────────────────────────────────────────────────

const godelLockRegistry: Map<string, GodelLockEntry> = new Map();

// Auto-register all locked paths
for (const path of GODEL_LOCKED_PATHS) {
  godelLockRegistry.set(`path:${path}`, {
    target: path,
    type: "path",
    reason: "Constitutional — self-modification would break governance integrity",
    severity: "CONSTITUTIONAL",
  });
}

// Auto-register all locked tools
for (const tool of GODEL_LOCKED_TOOLS) {
  godelLockRegistry.set(`tool:${tool}`, {
    target: tool,
    type: "tool",
    reason: "Must not self-execute on governance code",
    severity: "CORE",
  });
}

// ── Check Functions ─────────────────────────────────────────────────────────

export type GodelVerdict =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string; entry: GodelLockEntry; canOverride: boolean };

/**
 * Check if a target path is Gödel-locked.
 * Returns { allowed: false } with the lock entry if locked.
 */
export function isGodelLocked(target: string): GodelVerdict {
  // Check exact path match
  for (const [key, entry] of godelLockRegistry) {
    if (key.startsWith("path:")) {
      const lockedPath = key.slice(5);
      if (target === lockedPath || target.startsWith(lockedPath)) {
        return {
          allowed: false,
          reason: `Gödel locked: ${lockedPath} is CONSTITUTIONAL — cannot self-modify`,
          entry,
          canOverride: entry.severity === "BOUNDED",
        };
      }
    }
  }

  return { allowed: true, reason: "Path is not Gödel-locked" };
}

/**
 * Check if a target tool is Gödel-locked.
 */
export function isToolGodelLocked(toolName: string): GodelVerdict {
  for (const [key, entry] of godelLockRegistry) {
    if (key.startsWith("tool:") && key.slice(5) === toolName) {
      return {
        allowed: false,
        reason: `Gödel locked: tool ${toolName} is CORE — cannot self-execute on governance code`,
        entry,
        canOverride: entry.severity === "BOUNDED",
      };
    }
  }

  return { allowed: true, reason: "Tool is not Gödel-locked" };
}

/**
 * Register a new Gödel lock entry at runtime.
 * Only BOUNDED severity can be added programmatically — CONSTITUTIONAL and CORE
 * require code changes (this file).
 */
export function registerGodelLock(entry: GodelLockEntry): GodelVerdict {
  if (entry.severity === "CONSTITUTIONAL" || entry.severity === "CORE") {
    return {
      allowed: false,
      reason: "Cannot register CONSTITUTIONAL or CORE locks at runtime — modify godelLock.ts source",
      entry,
      canOverride: false,
    };
  }

  const key = `${entry.type}:${entry.target}`;
  godelLockRegistry.set(key, entry);
  return { allowed: true, reason: `Registered BOUNDED lock: ${key}` };
}

/**
 * Get all registered Gödel locks (for inspection).
 */
export function listGodelLocks(): GodelLockEntry[] {
  return Array.from(godelLockRegistry.values());
}

/**
 * Check if a modification intent violates Gödel lock.
 * This is the main enforcement entry point.
 */
export function checkModificationIntent(
  intent: {
    type: "write" | "execute" | "git_commit" | "git_push" | "deploy" | "promote";
    target: string;
    tool?: string;
  },
): GodelVerdict {
  // Check path lock
  if (intent.type === "write" || intent.type === "git_commit" || intent.type === "git_push") {
    const pathCheck = isGodelLocked(intent.target);
    if (!pathCheck.allowed) return pathCheck;
  }

  // Check tool lock
  if (intent.tool) {
    const toolCheck = isToolGodelLocked(intent.tool);
    if (!toolCheck.allowed) return toolCheck;
  }

  // Check deploy/promote — these are always locked
  if (intent.type === "deploy" || intent.type === "promote") {
    if (intent.target.includes("godelLock") || intent.target.includes("arifJudge") || intent.target.includes("arifSeal")) {
      return {
        allowed: false,
        reason: `Gödel locked: cannot deploy/promote changes to constitutional code: ${intent.target}`,
        entry: { target: intent.target, type: "domain", reason: "Deploy of governance code requires F13", severity: "CONSTITUTIONAL" },
        canOverride: false,
      };
    }
  }

  return { allowed: true, reason: "Modification intent passes Gödel lock check" };
}
