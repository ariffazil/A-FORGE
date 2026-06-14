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
  "forge_vault_seal",
  "forge_approve",
  "arif_forge_execute",
  "docker_container_remove",
  "docker_volume_remove",
  "systemctl_stop",
  "systemctl_restart",
  "git_push_force",
  "git_hard_reset",
  "hostinger_vps_restart",
  "hostinger_vps_stop",
]);

// Tools that execute high-impact operations (deploy, data mutation, billing)
const HIGH_IMPACT_TOOLS = new Set([
  "forge_execute",
  "docker_container_start",
  "docker_container_restart",
  "git_push",
  "git_commit",
  "forge_filesystem_write",
  "forge_filesystem_delete",
  "forge_postgres_query",
  "forge_github_pr",
  "forge_vault_write",
  "forge_vault_delete",
]);

// Tools that execute reversible operations
const REVERSIBLE_EXEC_TOOLS = new Set([
  "write",
  "edit",
  "bash",
  "arif_systemctl",
  "arif_sudo",
  "arif_run",
  "forge_memory_store",
  "forge_git_commit",
  "forge_docker_exec",
  "forge_remember",
  "request_amanah_lock",
  "release_amanah_lock",
  "forge_well_anchor",
]);

// Tools that should always be simulated first
const SIMULATE_FIRST_TOOLS = new Set([
  "forge_dry_run",
  "geox_prospect_evaluate",
  "geox_seismic_compute",
]);

// Tools that are pure suggestions / drafts
const SUGGEST_TOOLS = new Set([
  "arif_suggest",
  "forge_suggest",
  "wealth_suggest_allocation",
  "geox_suggest_prospect",
]);

// Queued / scheduled tools
const QUEUE_TOOLS = new Set([
  "forge_queue",
  "forge_schedule",
  "jobs_schedule",
]);

/**
 * Classify a tool name into one of 7 action classes.
 *
 * Default: OBSERVE (conservative — if we don't know, it's read-only).
 */
export function classifyTool(toolName: string): ActionClass {
  if (IRREVERSIBLE_TOOLS.has(toolName)) return "IRREVERSIBLE";
  if (HIGH_IMPACT_TOOLS.has(toolName)) return "EXECUTE_HIGH_IMPACT";
  if (SIMULATE_FIRST_TOOLS.has(toolName)) return "SIMULATE";
  if (REVERSIBLE_EXEC_TOOLS.has(toolName)) return "EXECUTE_REVERSIBLE";
  if (SUGGEST_TOOLS.has(toolName)) return "SUGGEST";
  if (QUEUE_TOOLS.has(toolName)) return "QUEUE";
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
