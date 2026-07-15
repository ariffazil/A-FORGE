/**
 * A-THINK Guard — TypeScript enforcement layer for MCP tool calls.
 *
 * Ported from Python A-THINK v1 (/root/A-FORGE/a_think/).
 * Single source of truth for affordance YAML + budget YAML.
 *
 * THE LAW:
 *   No MCP tool may be called directly.
 *   Every call: classify → budget → affordance → permission → trace
 *   UNKNOWN = HOLD
 *   Smallest safe tool only
 *
 * Integration:
 *   - core.ts: wraps every server.tool() handler
 *   - serve.ts: gates every stateless HTTP tools/call
 *
 * DITEMPA BUKAN DIBERI.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Mode ─────────────────────────────────────────────────────────────────

export type AThinkMode = "FAST" | "THINK" | "GOVERN";

// ── Budget ───────────────────────────────────────────────────────────────

export interface Budget {
  max_steps: number;
  max_tools: number;
  max_agents: number;
  max_time_seconds: number;
  memory: boolean | string;
  receipt: boolean | string;
  human_gate: boolean;
}

// ── Affordance Card ──────────────────────────────────────────────────────

export type RiskLabel = "R0" | "R1" | "R2" | "R3" | "R4" | "R5";

export interface AffordanceCard {
  name: string;
  purpose: string;
  reads: string[];
  writes: string[];
  external_side_effect: boolean;
  destructive: boolean;
  reversible: boolean;
  requires_human_approval: boolean;
  min_mode: AThinkMode;
  risk_label: RiskLabel;
}

// ── Decision ─────────────────────────────────────────────────────────────

export type DecisionStatus = "ALLOW" | "DENY" | "HOLD" | "STOP";

export interface PermissionDecision {
  status: DecisionStatus;
  reason: string;
  mode: AThinkMode;
  tool_name: string;
  risk_label?: RiskLabel;
  requires_human_approval: boolean;
}

// ── Session State ────────────────────────────────────────────────────────

export interface SessionState {
  session_id: string;
  mode: AThinkMode;
  budget: Budget;
  tools_used: number;
  steps_used: number;
  start_time: number;
}

// ── Signal Detection (ported from router.py) ─────────────────────────────

const GOVERN_KEYWORDS = [
  "send", "delete", "publish", "deploy", "commit", "push", "transfer",
  "pay", "buy", "sell", "submit", "email now", "execute", "run", "install",
  "remove", "drop", "truncate", "force push", "rebase", "merge to main",
  "money", "legal", "lawsuit", "contract", "public statement", "press release",
  "announce", "irreversible", "production", "customer", "client facing", "reputation",
];

const THINK_KEYWORDS = [
  "compare", "audit", "critique", "assess", "diagnose", "plan", "strategy",
  "risk", "risks", "architecture", "why", "analyze", "evaluate", "review",
  "design", "trade-off", "tradeoff", "pros and cons", "should i", "what if",
  "recommend", "suggest approach", "how should", "uncertain", "ambiguous",
  "complex", "investigate",
];

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(lower));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasExternalSideEffect(text: string): boolean {
  return containsAny(text, [
    "send", "email", "publish", "deploy", "post", "transfer", "pay",
    "buy", "sell", "commit", "push", "merge", "release", "announce",
  ]);
}

function isIrreversible(text: string): boolean {
  return containsAny(text, [
    "delete", "drop", "truncate", "remove permanently", "force push",
    "rebase", "destroy", "purge", "revoke", "terminate", "cancel subscription",
  ]);
}

function hasReputationRisk(text: string): boolean {
  return containsAny(text, [
    "public", "press", "announce", "customer", "client", "reputation",
    "legal", "lawsuit", "compliance", "regulatory", "media",
  ]);
}

function needsAnalysis(text: string): boolean {
  return containsAny(text, THINK_KEYWORDS);
}

function hasAmbiguity(text: string): boolean {
  return containsAny(text, [
    "not sure", "unclear", "ambiguous", "depends", "either way",
    "trade-off", "tradeoff", "pros and cons", "what should", "which is better",
  ]);
}

// ── Mode Classifier ──────────────────────────────────────────────────────

export function classifyMode(userInput: string): AThinkMode {
  if (hasExternalSideEffect(userInput)) return "GOVERN";
  if (isIrreversible(userInput)) return "GOVERN";
  if (hasReputationRisk(userInput)) return "GOVERN";
  if (needsAnalysis(userInput)) return "THINK";
  if (hasAmbiguity(userInput)) return "THINK";
  return "FAST";
}

// ── YAML Loaders ─────────────────────────────────────────────────────────

const A_THINK_DIR = resolve(__dirname, "../../../../a_think");

function loadBudgets(): Record<AThinkMode, Budget> {
  const raw = readFileSync(resolve(A_THINK_DIR, "budgets.yaml"), "utf-8");
  const parsed = parseYaml(raw);
  return parsed.budgets as Record<AThinkMode, Budget>;
}

function loadAffordances(): Map<string, AffordanceCard> {
  const yamlPath = resolve(A_THINK_DIR, "affordances.yaml");
  const raw = readFileSync(yamlPath, "utf-8");
  const parsed = parseYaml(raw);
  const cards = new Map<string, AffordanceCard>();
  const toolList: any[] = parsed.tools ?? [];
  process.stderr.write(`[A-THINK] Loaded ${toolList.length} affordance cards from ${yamlPath}\n`);
  for (const tool of toolList) {
    cards.set(tool.name, {
      name: tool.name,
      purpose: tool.purpose ?? "",
      reads: tool.reads ?? [],
      writes: tool.writes ?? [],
      external_side_effect: tool.external_side_effect ?? false,
      destructive: tool.destructive ?? false,
      reversible: tool.reversible ?? true,
      requires_human_approval: tool.requires_human_approval ?? false,
      min_mode: (tool.min_mode ?? "GOVERN") as AThinkMode,
      risk_label: (tool.risk_label ?? "R0") as RiskLabel,
    });
  }
  // Debug: log a few specific cards
  const fsg = cards.get("forge_surface_guard");
  const fsl = cards.get("forge_shell_ledger");
  process.stderr.write(`[A-THINK] forge_surface_guard: ${fsg ? `OK (risk=${fsg.risk_label}, destructive=${fsg.destructive})` : "MISSING"}\n`);
  process.stderr.write(`[A-THINK] forge_shell_ledger: ${fsl ? `OK (risk=${fsl.risk_label}, destructive=${fsl.destructive})` : "MISSING"}\n`);
  return cards;
}

// DARWIN FIX 3+5: hoisted readonly shell command set — used by both the
// FAST→GOVERN reclassification. Reading-only commands (sha256sum, cat, ls,
// curl with read-only verbs, etc.) are safe to budget in FAST mode and must
// reach the inner arifJudge for proper DENY/GATE/ALLOW classification.
// NOTE: mkdir/touch/cp/ln are MUTATION — they are intentionally excluded here.
// The execution gate is in forgeShell.ts (classifyShellCommandRisk).
const READONLY_SHELL_COMMANDS = new Set([
      "sha256sum", "sha1sum", "md5sum", "shasum",
      "cat", "head", "tail", "less", "more",
      "ls", "stat", "file", "wc", "du", "df", "tree",
      "date", "echo", "printf", "env", "pwd", "whoami", "hostname", "uname",
      "which", "whereis", "type",
      "find", "grep", "rg", "ag",
      "jq", "yq", "xmllint",
      "test", "[", "true", "false",
      // mkdir, touch, cp, ln are MUTATION — handled by forgeShell.ts gate
    ]);

function isReadonlyShellCommand(baseCmd: string, command: string): boolean {
  if (READONLY_SHELL_COMMANDS.has(baseCmd)) {
    return true;
  }

  if (baseCmd === "curl") {
    // Permit read-only probes like:
    //   curl -sf http://localhost:8088/health | python3 -c ...
    // but reject explicit mutation verbs.
    return !/\b(-X\s*(POST|PUT|PATCH|DELETE)|--request\s*(POST|PUT|PATCH|DELETE)|--data(?:-binary)?|-d\b|--upload-file\b|--form\b)\b/i.test(command);
  }

  return false;
}

const MODE_ORDER: Record<AThinkMode, number> = { FAST: 0, THINK: 1, GOVERN: 2 };

function isKnown(card: AffordanceCard | undefined): boolean {
  if (!card) return false;
  if (!card.purpose || card.purpose.trim() === "") return false;
  if (card.reads.length === 0 && card.writes.length === 0) return false;
  if (card.external_side_effect === null || card.external_side_effect === undefined) return false;
  if (card.destructive === null || card.destructive === undefined) return false;
  if (card.reversible === null || card.reversible === undefined) return false;
  if (card.requires_human_approval === null || card.requires_human_approval === undefined) return false;
  if (!card.min_mode) return false;
  return true;
}

function checkAffordance(
  cards: Map<string, AffordanceCard>,
  toolName: string,
  mode: AThinkMode,
): { allowed: boolean; reason: string; card?: AffordanceCard } {
  const card = cards.get(toolName);

  // Debug: log lookup result
  if (toolName.includes("surface") || toolName.includes("shell_ledger")) {
    process.stderr.write(`[A-THINK] checkAffordance(${toolName}): card=${card ? "FOUND" : "MISSING"}, map_size=${cards.size}\n`);
    if (card) {
      process.stderr.write(`[A-THINK]   card: risk=${card.risk_label} destructive=${card.destructive} requires_human=${card.requires_human_approval}\n`);
    }
    // List all keys that contain 'surface' or 'shell'
    for (const [k] of cards) {
      if (k.includes("surface") || k.includes("shell")) {
        process.stderr.write(`[A-THINK]   map key: "${k}"\n`);
      }
    }
  }

  // HARAM 1: No card = UNKNOWN = HOLD
  if (!card) {
    return {
      allowed: false,
      reason: `HARAM: tool '${toolName}' has no affordance card (UNKNOWN = HOLD)`,
    };
  }

  // HARAM 1: Incomplete card = UNKNOWN = HOLD
  if (!isKnown(card)) {
    return {
      allowed: false,
      reason: `HARAM: tool '${toolName}' has incomplete affordance card (UNKNOWN = HOLD)`,
    };
  }

  // Mode enforcement: request must be >= tool's min_mode
  const toolMin = MODE_ORDER[card.min_mode] ?? 99;
  const requestLevel = MODE_ORDER[mode] ?? -1;
  if (requestLevel < toolMin) {
    return {
      allowed: false,
      reason: `HARAM: tool '${toolName}' requires min_mode=${card.min_mode}, requested=${mode}`,
    };
  }

  // HARAM 3: Destructive actions require human approval
  if (card.destructive && !card.requires_human_approval) {
    return {
      allowed: false,
      reason: `HARAM: tool '${toolName}' is destructive but does not require human approval`,
    };
  }

  return { allowed: true, reason: "ALLOWED", card };
}

// ── A-THINK Guard ────────────────────────────────────────────────────────

export interface AThinkVerdict {
  allowed: boolean;
  status: DecisionStatus;
  reason: string;
  mode: AThinkMode;
  tool_name: string;
  risk_label?: RiskLabel;
  requires_human_approval: boolean;
}

export class AThinkGuard {
  private budgets: Record<AThinkMode, Budget>;
  private affordanceCards: Map<string, AffordanceCard>;
  private sessions: Map<string, SessionState> = new Map();

  constructor() {
    this.budgets = loadBudgets();
    this.affordanceCards = loadAffordances();
    // Debug: log card count and specific lookups
    process.stderr.write(`[A-THINK] Guard initialized: ${this.affordanceCards.size} cards\n`);
    for (const [name, card] of this.affordanceCards) {
      if (name.includes("surface") || name.includes("shell_ledger")) {
        process.stderr.write(`[A-THINK]   ${name}: risk=${card.risk_label} destructive=${card.destructive}\n`);
      }
    }
  }

  /**
   * Pre-execution check. Every MCP tool call MUST pass through this.
   *
   * Flow: classify → budget → affordance → permission → verdict
   */
  check(
    toolName: string,
    userInput?: string,
    sessionId?: string,
  ): AThinkVerdict {
    // Step 1: Classify mode (from user input or default to GOVERN for safety)
    // DARWIN FIX 5: read-only forge_shell commands (sha256sum, cat, ls, curl, etc.)
    // get reclassified from FAST → GOVERN so they hit the readonly exemption
    // path rather than the FAST BUDGET=0 STOP. FAST mode disallows tools
    // entirely; read-only shell commands are safe and must reach the inner
    // arifJudge which has the proper read/write DENY/GATE/ALLOW patterns.
    let mode: AThinkMode = userInput ? classifyMode(userInput) : "GOVERN";
    if (mode === "FAST" && (toolName === "forge_shell" || toolName === "forge_shell_dryrun")) {
      const u = (userInput ?? "").trim();
      const firstToken = u.split(/\s+/)[0]?.replace(/^["'`]/, "") ?? "";
      const baseCmd = firstToken.split("/").pop() ?? firstToken;
      if (isReadonlyShellCommand(baseCmd, u)) {
        mode = "GOVERN";  // force GOVERN so readonly exemption applies
      }
    }
    const budget = this.budgets[mode];

    // Step 2: Ensure session exists
    let session: SessionState;
    if (sessionId && this.sessions.has(sessionId)) {
      session = this.sessions.get(sessionId)!;
    } else if (sessionId) {
      session = {
        session_id: sessionId,
        mode,
        budget,
        tools_used: 0,
        steps_used: 0,
        start_time: Date.now(),
      };
      this.sessions.set(sessionId, session);
    } else {
      // No session — create ephemeral
      session = {
        session_id: `ephemeral-${Date.now()}`,
        mode,
        budget,
        tools_used: 0,
        steps_used: 0,
        start_time: Date.now(),
      };
    }

    // Step 3: Budget check — tools
    if (session.tools_used >= budget.max_tools) {
      return {
        allowed: false,
        status: "STOP",
        reason: `BUDGET: max_tools=${budget.max_tools} reached (used=${session.tools_used})`,
        mode,
        tool_name: toolName,
        requires_human_approval: false,
      };
    }

    // Step 4: Budget check — steps
    if (session.steps_used >= budget.max_steps) {
      return {
        allowed: false,
        status: "STOP",
        reason: `BUDGET: max_steps=${budget.max_steps} reached (used=${session.steps_used})`,
        mode,
        tool_name: toolName,
        requires_human_approval: false,
      };
    }

    // Step 5: Affordance check (UNKNOWN = HOLD)
    const affordance = checkAffordance(this.affordanceCards, toolName, mode);
    if (!affordance.allowed) {
      const isUnknown = affordance.reason.includes("UNKNOWN") || affordance.reason.includes("no affordance card");
      return {
        allowed: false,
        status: isUnknown ? "HOLD" : "DENY",
        reason: affordance.reason,
        mode,
        tool_name: toolName,
        requires_human_approval: false,
      };
    }

    // Step 6: GOVERN + destructive = HOLD for human approval
    // DARWIN FIX 3: read-only shell commands bypass the GOVERN+HOLD block.
    // (READONLY_SHELL_COMMANDS Set is hoisted to top of check() — see above.)
    const card = affordance.card!;
    if (mode === "GOVERN" && card.requires_human_approval) {
      // Exempt read-only forge_shell invocations from the HOLD gate.
      // forge_shell is the only GOVERN-mode tool that takes a `command`
      // string; check the first token against the allowlist.
      if (toolName === "forge_shell" || toolName === "forge_shell_dryrun") {
        // The aThinkGuard doesn't see command args directly, so we read
        // them from the user input when available. Best-effort: if the
        // user input contains a read-only command, allow.
        const u = (userInput ?? "").trim();
        const firstToken = u.split(/\s+/)[0]?.replace(/^["'`]/, "") ?? "";
        const baseCmd = firstToken.split("/").pop() ?? firstToken;
        process.stderr.write(`[A-THINK] readonly check: tool=${toolName} userInput="${userInput}" firstToken="${firstToken}" baseCmd="${baseCmd}" inSet=${isReadonlyShellCommand(baseCmd, u)}\n`);
        if (isReadonlyShellCommand(baseCmd, u)) {
          // Allow through — inner arifJudge will still classify.
        } else {
          return {
            allowed: false,
            status: "HOLD",
            reason: "GOVERN mode: destructive tool requires human approval",
            mode,
            tool_name: toolName,
            risk_label: card.risk_label,
            requires_human_approval: true,
          };
        }
      } else {
        return {
          allowed: false,
          status: "HOLD",
          reason: "GOVERN mode: destructive tool requires human approval",
          mode,
          tool_name: toolName,
          risk_label: card.risk_label,
          requires_human_approval: true,
        };
      }
    }

    // Step 7: ALLOW — record tool usage
    session.tools_used++;
    session.steps_used++;

    return {
      allowed: true,
      status: "ALLOW",
      reason: "ALLOWED",
      mode,
      tool_name: toolName,
      risk_label: card.risk_label,
      requires_human_approval: card.requires_human_approval,
    };
  }

  /**
   * Get session state for diagnostics.
   */
  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get affordance card for a tool.
   */
  getAffordance(toolName: string): AffordanceCard | undefined {
    return this.affordanceCards.get(toolName);
  }

  /**
   * List all registered affordance cards.
   */
  listAffordances(): AffordanceCard[] {
    return Array.from(this.affordanceCards.values());
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _guard: AThinkGuard | null = null;

export function getAThinkGuard(): AThinkGuard {
  if (!_guard) {
    _guard = new AThinkGuard();
  }
  return _guard;
}

/**
 * Convenience: check a tool call against A-THINK guard.
 * Returns verdict. If !verdict.allowed, caller MUST NOT proceed.
 */
export function aThinkCheck(
  toolName: string,
  userInput?: string,
  sessionId?: string,
): AThinkVerdict {
  return getAThinkGuard().check(toolName, userInput, sessionId);
}

/**
 * Convert A-THINK verdict to MCP error response.
 */
export function aThinkErrorResponse(verdict: AThinkVerdict): {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
} {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        status: verdict.status,
        gate: "A_THINK_GUARD",
        tool: verdict.tool_name,
        mode: verdict.mode,
        reason: verdict.reason,
        risk_label: verdict.risk_label,
        requires_human_approval: verdict.requires_human_approval,
        law: "No MCP tool may be called directly. Every call: classify → budget → affordance → permission → trace.",
      }, null, 2),
    }],
    isError: true,
  };
}
