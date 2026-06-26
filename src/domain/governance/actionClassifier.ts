/**
 * Action Classifier — 7-tier action taxonomy for arifOS MCP Gate.
 *
 * Replaces the legacy 3-class (OBSERVE/MUTATE/ATOMIC) with a
 * 7-class model that lets agents move fast where safe and
 * stop only where necessary.
 *
 * Used by:
 *   - POST /execute (HTTP bridge)
 *   - MCP tool wrapper (core.ts)
 *   - arifOS MCP Gate v0 (cross-organ)
 *
 * Conservative: tools not explicitly listed default to OBSERVE.
 *
 * DITEMPA BUKAN DIBERI — 7 classes, not 3. Precision over simplicity.
 */

// ── 7-Tier Action Class ────────────────────────────────────────────────────

export type ActionClass =
  | "OBSERVE"              // Read-only, no side effects
  | "SUGGEST"              // Recommend, draft, propose — no commit
  | "SIMULATE"             // Dry run, forward model, preview
  | "DRAFT"                // Write unsent/composed content
  | "QUEUE"                // Schedule, defer, enqueue
  | "EXECUTE_REVERSIBLE"   // Git commit, create file, restart service
  | "EXECUTE_HIGH_IMPACT"  // Deploy, billing, data mutation
  | "IRREVERSIBLE";        // rm -rf, DROP TABLE, vault seal, physical actuation

// ── Class priority (lower = higher severity) ────────────────────────────────

const CLASS_PRIORITY: Record<ActionClass, number> = {
  "OBSERVE": 7,
  "SUGGEST": 6,
  "SIMULATE": 5,
  "DRAFT": 4,
  "QUEUE": 3,
  "EXECUTE_REVERSIBLE": 2,
  "EXECUTE_HIGH_IMPACT": 1,
  "IRREVERSIBLE": 0,
};

/**
 * Returns true if classA is more severe than classB.
 */
export function isMoreSevere(a: ActionClass, b: ActionClass): boolean {
  return CLASS_PRIORITY[a] < CLASS_PRIORITY[b];
}

// ── Tool Classifications ───────────────────────────────────────────────────

// Tools that seal, approve, or cause irreversible / high-blast-radius effects.
const IRREVERSIBLE_TOOLS = new Set([
  "arif_vault_seal",
  "forge_approve",
  "arif_forge_execute",
]);

// Tools that execute high-impact operations (deploy, data mutation, billing)
const HIGH_IMPACT_TOOLS = new Set([
  "forge_execute",
  "forge_postgres_query",
  "forge_github_pr",
]);

// Tools that execute reversible operations
const REVERSIBLE_EXEC_TOOLS = new Set([
  "forge_lock_acquire",
  "forge_lock_release",
]);

// Tools that should always be simulated first
const SIMULATE_FIRST_TOOLS = new Set([
  "forge_dry_run",
  "forge_shell_dryrun",
]);

// Explicit OBSERVE-class tools (merged mode-gated primitives)
// These tools have modes — most modes are OBSERVE, some are MUTATE.
// The FloorEnforcer handles mode-level classification.
const OBSERVE_TOOLS = new Set([
  // Merged primitives — default OBSERVE (mode-level gating in FloorEnforcer)
  "forge_filesystem",
  "forge_docker",
  "forge_git",
  "forge_github",
  "forge_agent",
  "forge_lease",
  "forge_job",
  "forge_vault",
  "forge_well",
  "forge_systemctl",
  "forge_journalctl",
  "forge_browser",
  "forge_netdata",
  "forge_wealth",
  // Non-merged tools
  "forge_pipeline_run",
  "forge_check_governance",
  "forge_registry_status",
  "forge_health_check",
  "forge_memory",
  "forge_orchestrate",
  "forge_postgres",
  "forge_minimax_search",
  "forge_minimax_text_to_image",
  "forge_minimax_text_to_audio",
  "forge_minimax_music_generation",
  "forge_minimax_understand_image",
  "forge_research",
  "forge_docs_lookup",
  "forge_lock_acquire",
  "forge_lock_release",
]);

// Suggest and queue tools (currently none registered — placeholder for future)
const SUGGEST_TOOLS = new Set<string>();
const QUEUE_TOOLS = new Set<string>();

/**
 * Classify a tool name into one of 7 action classes.
 *
 * Default: OBSERVE (conservative — if we don't know, it's read-only).
 *
 * Explicit OBSERVE_TOOLS set documents known read-only tools.
 * Unknown tools also default to OBSERVE (fail-safe: read-only by default).
 */
export function classifyTool(toolName: string): ActionClass {
  if (IRREVERSIBLE_TOOLS.has(toolName)) return "IRREVERSIBLE";
  if (HIGH_IMPACT_TOOLS.has(toolName)) return "EXECUTE_HIGH_IMPACT";
  if (SIMULATE_FIRST_TOOLS.has(toolName)) return "SIMULATE";
  if (REVERSIBLE_EXEC_TOOLS.has(toolName)) return "EXECUTE_REVERSIBLE";
  if (SUGGEST_TOOLS.has(toolName)) return "SUGGEST";
  if (QUEUE_TOOLS.has(toolName)) return "QUEUE";
  // OBSERVE_TOOLS and unknown tools both return OBSERVE (fail-safe)
  return "OBSERVE";
}

/**
 * Check whether an action class requires session + lease gating.
 */
export function requiresGovernance(actionClass: ActionClass): boolean {
  return actionClass !== "OBSERVE" && actionClass !== "SUGGEST";
}

/**
 * Check whether an action class requires 888_HOLD.
 */
export function requires888Hold(actionClass: ActionClass): boolean {
  return actionClass === "IRREVERSIBLE" || actionClass === "EXECUTE_HIGH_IMPACT";
}
