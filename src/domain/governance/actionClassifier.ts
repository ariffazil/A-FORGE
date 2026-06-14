/**
 * Action Classifier — shared MUTATE/ATOMIC/OBSERVE classification for A-FORGE.
 *
 * Used by:
 *   - POST /execute (HTTP bridge)
 *   - MCP tool wrapper (core.ts)
 *
 * Conservative: tools not explicitly listed default to OBSERVE.
 */

export type ActionClass = "OBSERVE" | "MUTATE" | "ATOMIC";

// Tools that seal, approve, or cause irreversible / high-blast-radius effects.
const ATOMIC_TOOLS = new Set([
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

// Tools that mutate state, write files, commit, push, or execute commands.
const MUTATE_TOOLS = new Set([
  "forge_dry_run",
  "arif_systemctl",
  "arif_sudo",
  "arif_run",
  "write",
  "edit",
  "bash",
  "docker_container_start",
  "docker_container_restart",
  "git_push",
  "git_commit",
  // A-FORGE proxy / registry tools
  "forge_filesystem_write",
  "forge_filesystem_delete",
  "forge_memory_store",
  "forge_git_commit",
  "forge_github_pr",
  "forge_docker_exec",
  "forge_postgres_query",
  "forge_remember",
  "forge_vault_write",
  "forge_vault_delete",
  "request_amanah_lock",
  "release_amanah_lock",
  "forge_well_anchor",
]);

/**
 * Classify a tool name into OBSERVE / MUTATE / ATOMIC.
 */
export function classifyTool(toolName: string): ActionClass {
  if (ATOMIC_TOOLS.has(toolName)) return "ATOMIC";
  if (MUTATE_TOOLS.has(toolName)) return "MUTATE";
  return "OBSERVE";
}

/**
 * Check whether an action class requires session + lease gating.
 */
export function requiresGovernance(actionClass: ActionClass): boolean {
  return actionClass === "MUTATE" || actionClass === "ATOMIC";
}
