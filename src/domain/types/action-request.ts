/**
 * ActionRequest — canonical shape for any consequential action in arifOS.
 *
 * F10 ONTOLOGY requires every action to declare this shape. Unknown or
 * missing fields → VOID (F10), then HOLD (C1 hard rule).
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 * @constitutional F10 ONTOLOGY — schema and category integrity
 */

import type { Mission } from "./outcome-spec.js";

// ─── Epistemic tiers (F2 TRUTH) ───────────────────────────────────────

/**
 * Epistemic tier of a claim. F2 TRUTH requires every action that involves
 * model output to declare its tier.
 *
 * 0 — UNKNOWN: not yet assessed
 * 1 — HYPOTHESIS: untested, speculative
 * 2 — ESTIMATE: rough quantitative guess, high uncertainty
 * 3 — PLAUSIBLE: moderate confidence, some evidence
 * 4 — CLAIM: strong, evidence-backed, citable
 * 5 — VERIFIED: physically measured, cross-organ consensus
 */
export type EpistemicTier = 0 | 1 | 2 | 3 | 4 | 5;

export const ALL_TIERS: EpistemicTier[] = [0, 1, 2, 3, 4, 5];

// ─── Sensitivity (from P5 OutcomeSpec) ─────────────────────────────────

export type Sensitivity = "LOW" | "MEDIUM" | "HIGH" | "SOVEREIGN";

// ─── Action categories (F10 ONTOLOGY) ─────────────────────────────────

export type ActionCategory =
  | "READ"           // Pure read, no side effects
  | "WRITE"          // Local file write
  | "DELETE"         // Local file delete
  | "EXECUTE"        // Run code/command
  | "NETWORK_OUT"    // Outbound network call
  | "NETWORK_IN"     // Inbound network accept
  | "FORM_SUBMIT"    // Browser form submit
  | "EMAIL_SEND"     // Outbound email
  | "DATABASE_WRITE" // DB write
  | "VAULT_SEAL"     // Immutable audit seal
  | "VAULT_READ"     // Read vault
  | "PRODUCTION_DEPLOY" // Deploy to live
  | "FINANCIAL_TRANSACTION"
  | "SECRET_ROTATION"
  | "CONSTITUTIONAL_FLOOR_CHANGE"
  | "AGENT_SPAWN"    // Spawn sub-agent
  | "AGENT_HALT"     // Halt sub-agent
  | "MEMORY_WRITE"   // Persist to L1/L2/L3/L4/L5/L6
  | "MEMORY_READ"    // Read from any memory layer
  | "INFRASTRUCTURE_RESTART"
  | "OTHER";

export const ALL_CATEGORIES: ActionCategory[] = [
  "READ", "WRITE", "DELETE", "EXECUTE",
  "NETWORK_OUT", "NETWORK_IN", "FORM_SUBMIT", "EMAIL_SEND",
  "DATABASE_WRITE", "VAULT_SEAL", "VAULT_READ",
  "PRODUCTION_DEPLOY", "FINANCIAL_TRANSACTION", "SECRET_ROTATION",
  "CONSTITUTIONAL_FLOOR_CHANGE", "AGENT_SPAWN", "AGENT_HALT",
  "MEMORY_WRITE", "MEMORY_READ", "INFRASTRUCTURE_RESTART", "OTHER",
];

// ─── F12 INJECTION threat patterns (data, not buried code) ───────────

/**
 * Patterns that F12 INJECTION checks against. Detected in tool args.
 * - SHELL_METACHARS: `;|&$\`<>\\n\\r!*?{}[]` for shell injection
 * - PATH_TRAVERSAL: `../`, absolute sensitive paths
 * - PROMPT_INJECTION: phrases that try to override safety
 * - SECRET_ACCESS: files that hold credentials
 * - AUTHORITY_SMUGGLING: text that self-authorizes F13
 */
export const F12_THREAT_PATTERNS = {
  SHELL_METACHARS: /[;|&$`<>!\*\?{}\[\]\\]/,
  PATH_TRAVERSAL: /(\.\.\/|\.\.\\)/,
  ABSOLUTE_SENSITIVE: /^(\/etc\/|\/root\/|\/proc\/|\/sys\/|\/var\/log\/|\/dev\/)/,
  PROMPT_INJECTION_PHRASES: [
    /ignore\s+(all\s+)?previous/i,
    /bypass\s+(safety|guard|gate|floor|filter|check)/i,
    /override\s+(system|safety|policy|floor|gate)/i,
    /reveal\s+(secret|password|token|key|credential)/i,
    /disable\s+(safety|guard|gate|filter|check|floor)/i,
    /act\s+as\s+(root|admin|sovereign|arif|owner)/i,
    /exfiltrate|leak|dump\s+(data|secrets?|creds?)/i,
    /you\s+are\s+now\s+(root|jailbroken|unrestricted|free)/i,
  ],
  SECRET_FILE_PATTERNS: [
    /\.env($|\.)/i,
    /id_rsa|id_ed25519|id_dsa/i,
    /(private|secret)[_-]?key/i,
    /(password|token|credential|api[_-]?key)/i,
  ],
  AUTHORITY_SMUGGLING_PHRASES: [
    /f13[_\s-]?ratified/i,
    /i\s+am\s+arif/i,
    /sovereign\s+ack/i,
    /arif\s+approved/i,
    /ack[_\s-]?irreversible/i,
    /self[_\s-]?authorize/i,
  ],
} as const;

// ─── F5 PEACE² destructive verbs ──────────────────────────────────────

/** Verbs that F5 PEACE² flags as potentially destructive. */
export const F5_DESTRUCTIVE_VERBS = [
  "delete", "wipe", "destroy", "kill", "purge",
  "reset", "drop", "force", "overwrite", "revoke",
  "shutdown", "rotate-secret", "chmod-777", "truncate",
  "terminate", "abort", "evict", "demolish",
] as const;

// ─── ActionRequest (the canonical action shape) ───────────────────────

/**
 * The canonical action envelope. F10 ONTOLOGY requires this for every
 * consequential tool call. Mutating actions missing required fields → VOID.
 */
export interface ActionRequest {
  /** Unique action identifier (UUID v4 recommended). */
  action_id: string;
  /** Tool name being invoked (e.g. "aforge_browser_navigate"). */
  tool_name: string;
  /** Action category. Must be in ALL_CATEGORIES. */
  action_type: ActionCategory;
  /** Target of the action (file path, URL, tool arg, organ name). */
  target: string;
  /** Epistemic tier of the underlying claim. */
  tier: EpistemicTier;
  /** Actor invoking the action (e.g. "arif-fazil", "opencode-session-1"). */
  actor: string;
  /** Session identifier (e.g. "SEAL-81c333c962734407"). */
  session_id: string;
  /** Plain-language intent for the action. */
  intent: string;
  /** Expected outcome after action completes. */
  expected_outcome: string;
  /** Tool arguments (opaque, will be inspected by F12/F5). */
  args?: Record<string, unknown>;
  /** Optional P5 Mission envelope. */
  mission?: Mission;
  /** Reversibility score 0.0 (irreversible) to 1.0 (fully reversible). */
  reversibility_score?: number;
  /** Blast radius scope. */
  blast_radius?: "local" | "repo" | "service" | "vps" | "federation" | "external";
  /** Rollback plan (free text). F5 PEACE² requires this for destructive actions. */
  rollback_plan?: string;
  /** Evidence count backing the action. F2 TRUTH. */
  evidence_count?: number;
  /** Sensitivity tier (overrides P5 mission sensitivity if both present). */
  sensitivity?: Sensitivity;
  /** Free-form metadata for audit. */
  metadata?: Record<string, unknown>;
}

// ─── FloorContext (input to FloorEnforcer.checkAll) ──────────────────

/**
 * Context passed to FloorEnforcer.checkAll. Combines ActionRequest with
 * session/actor info that floors may need.
 */
export interface FloorContext {
  action: ActionRequest;
  /** Current actor (may be a sub-agent of session.actor). */
  actor_id: string;
  /** Current session id. */
  session_id: string;
  /** Current F13 halt status (true if halt is active). */
  f13_halt_active: boolean;
  /** Optional F13 halt scope if halt is active. */
  f13_halt_scope?: "action" | "tool" | "organ" | "federation";
  /** F8: G-score from APEX G-math — G = (A×P×X×E²)×(1-h). Threshold: ≥ 0.80. */
  g_score?: number;
  /** F3: Quad-witness W₄ = (H×A×E×V)^(1/4). Threshold: ≥ 0.75. */
  quad_witness?: number;
  /** F3: Per-witness breakdown for diagnostics. */
  witness_breakdown?: {
    human: number;
    ai: number;
    earth: number;
    verifier: number;
  };
}
