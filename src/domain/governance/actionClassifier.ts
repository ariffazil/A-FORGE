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
// arif_seal and arif_judge are KERNEL tools (constitutional, not bypass) —
// they are the LEGAL path to irreversible action, not a bypass.
const IRREVERSIBLE_TOOLS = new Set([
  "arif_vault_seal",
  "arif_seal",
  "forge_vault_seal",
  "forge_kernel_seal",
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
  "forge_github_create_or_update_file",
  "forge_github_create_pull_request",
]);

// Tools that execute high-impact operations (deploy, data mutation, billing)
// arif_judge is a KERNEL constitutional tool — it is the LEGAL path to SEAL, not a bypass.
const HIGH_IMPACT_TOOLS = new Set([
  "arif_judge",
  "arif_forge",
  "forge_kernel_judge",
  "forge_kernel_forge",
  "forge_execute",
  "docker_container_start",
  "docker_container_restart",
  "git_push",
  "forge_git_commit",  // consistent with registered tool names
  "forge_filesystem_write",
  "forge_filesystem_delete",
  "forge_postgres_query",
  "forge_github_pr",
  "forge_vault_write",
  "forge_github_create_issue",
]);

// Tools that execute reversible operations
// arif_init/observe/think/route/memory are KERNEL constitutional tools.
// They are the LEGAL path to governance, not bypass attempts.
const REVERSIBLE_EXEC_TOOLS = new Set([
  "arif_init",
  "arif_observe",
  "arif_think",
  "arif_route",
  "arif_memory",
  "forge_kernel_init",
  "forge_kernel_observe",
  "forge_kernel_think",
  "forge_kernel_route",
  "forge_kernel_memory",
  "write",
  "edit",
  "bash",
  "arif_systemctl",
  "arif_sudo",
  "arif_run",
  "forge_docker_exec",
  "forge_remember",
  "request_amanah_lock",
  "release_amanah_lock",
  "forge_well_anchor",
  "forge_agent_register",   // identity mutation — requires session
  "forge_job_submit",       // async job submission — requires session
  "forge_lease_request",    // lease issuance — requires session
  "forge_lease_revoke",     // lease revocation — requires session
  "forge_shell",            // shell execution — governed, session required (T₁ 2026-07-19)
]);

// Tools that should always be simulated first
const SIMULATE_FIRST_TOOLS = new Set([
  "forge_dry_run",
  "geox_prospect_evaluate",
  "geox_seismic_compute",
]);
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

// Explicit OBSERVE-class tools (documentation + future-proofing)
// These default to OBSERVE anyway, but listing them makes the contract explicit.
const OBSERVE_TOOLS = new Set([
  "forge_pipeline",           // routing tool — no mutation
  "forge_check_governance",   // governance check — read-only
  "forge_job_status",         // job status — read-only
  "forge_job_result",         // job result — read-only
  "forge_log_tail",           // log read — read-only
  "forge_registry_status",    // registry read — read-only
  "forge_lease_status",       // lease status — read-only
  "forge_agent_list",         // agent list — read-only
  "forge_agent_status",       // agent status — read-only
  "forge_health_check",       // health check — read-only
  "forge_probe",              // federation organ liveness — read-only (hits /health endpoints)
  "forge_memory_recall",      // memory read — read-only
  "forge_filesystem_read",    // file read — read-only (stateless HTTP OK)
  "forge_filesystem_tree",    // dir tree — read-only
  "forge_filesystem_search",  // content search alias — read-only
  "forge_filesystem_glob",    // file search — read-only
  "forge_filesystem_grep",    // content search — read-only
  "forge_filesystem_stat",    // file metadata — read-only
  "forge_document_ingest",    // document intelligence — read-only
  "forge_security_drift_scan", // Machine Constitution security drift — read-only
  "forge_git_status",         // git status — read-only
  "forge_git_log",            // git log — read-only
  "forge_git_diff",           // git diff — read-only
  "forge_docker_ps",          // docker ps — read-only
  "forge_docker_images",      // docker images — read-only
  "forge_docker_logs",        // docker logs — read-only
  "forge_postgres_schema",    // schema read — read-only
  "forge_search",             // web search — read-only
  "forge_minimax_search",     // web search — read-only
  "forge_research",           // web research — read-only
  "forge_docs_lookup",        // docs lookup — read-only
  "forge_browser_navigate",   // browser nav — read-only (observe-class)
  "forge_browser_click",      // browser click — read-only (observe-class)
  "forge_browser_type",       // browser type — read-only (observe-class)
  "forge_browser_screenshot", // browser screenshot — read-only
  "forge_browser_extract_text", // browser text extract — read-only
  "forge_browser_evaluate_js",  // browser JS eval — read-only
  "forge_well_state_read",    // well state — read-only
  "forge_well_readiness_check", // well readiness — read-only
  "forge_well_floor_scan",    // well floor scan — read-only
  "forge_shell_status",       // shell subsystem status — read-only
  "forge_shell_dryrun",       // shell preview — read-only (no mutation)
  "forge_shell_ledger",       // shell ledger — read-only
  "forge_shell_alert_history", // shell alert history — read-only
  "forge_worktree",           // local git physics sensor — read-only, OBSERVE
  "forge_runtime_verify",     // runtime hash verification — read-only, OBSERVE
  "forge_cool_drift",         // cooling receipt drift — read-only, OBSERVE
  "forge_cool_pattern",       // cooling receipt pattern — read-only, OBSERVE
]);

/**
 * P0.1 FIX (2026-07-19): Unknown tools MUST return HOLD, not OBSERVE.
 * Fail-open is not fail-safe. A new mutation tool omitted from the
 * classifier could be treated as read-only and bypass the session gate.
 *
 * Mode-aware tools (forge_agent, forge_filesystem, forge_vault etc.)
 * MUST be classified by tool+mode, not tool name alone.
 */
export type UnknownActionBehaviour = "HOLD" | "OBSERVE";

let unknownBehaviour: UnknownActionBehaviour = "HOLD";

/** Override unknown-tool behaviour (TESTING ONLY). */
export function setUnknownActionBehaviour(b: UnknownActionBehaviour): void {
  unknownBehaviour = b;
}

/**
 * P0.1 FIX: classify by tool name + mode. Mode-aware tools are resolved
 * to their specific action class. Unknown tools return IRREVERSIBLE
 * (maximum blast radius) to force explicit classification — never OBSERVE.
 */
export function classifyTool(toolName: string, mode?: string): ActionClass {
  // Mode-aware resolution: combine tool + mode for accurate classification
  const fullKey = mode ? `${toolName}/${mode}` : toolName;

  // ── Mode-aware overrides ──
  // forge_agent: list/status=OBSERVE, register=EXECUTE_REVERSIBLE, kill=IRREVERSIBLE
  if (toolName === "forge_agent") {
    if (mode === "list" || mode === "status") return "OBSERVE";
    if (mode === "register") return "EXECUTE_REVERSIBLE";
    if (mode === "kill") return "IRREVERSIBLE";
  }
  // forge_filesystem: read/tree/search/stat/glob/grep=OBSERVE, write/patch/move=EXECUTE_REVERSIBLE, delete(quarantine)=EXECUTE_REVERSIBLE, delete(hard)=IRREVERSIBLE
  if (toolName === "forge_filesystem") {
    if (["read", "tree", "search", "stat", "glob", "grep"].includes(mode ?? "")) return "OBSERVE";
    if (["write", "patch", "move"].includes(mode ?? "")) return "EXECUTE_REVERSIBLE";
    if (mode === "delete") return "EXECUTE_HIGH_IMPACT";
  }
  // forge_vault: read/list=OBSERVE, write/seal=EXECUTE_HIGH_IMPACT
  if (toolName === "forge_vault") {
    if (mode === "read" || mode === "list") return "OBSERVE";
    if (mode === "write" || mode === "seal") return "EXECUTE_HIGH_IMPACT";
  }
  // forge_git: status/diff/log=OBSERVE, commit=EXECUTE_REVERSIBLE
  if (toolName === "forge_git") {
    if (["status", "diff", "log"].includes(mode ?? "")) return "OBSERVE";
    if (mode === "commit") return "EXECUTE_REVERSIBLE";
  }
  // forge_docker: ps/images/logs=OBSERVE, exec=EXECUTE_REVERSIBLE
  if (toolName === "forge_docker") {
    if (["ps", "images", "logs"].includes(mode ?? "")) return "OBSERVE";
    if (mode === "exec") return "EXECUTE_REVERSIBLE";
  }
  // forge_lease: status/list=OBSERVE, request/revoke=EXECUTE_REVERSIBLE
  if (toolName === "forge_lease") {
    if (["status", "list"].includes(mode ?? "")) return "OBSERVE";
    if (["request", "revoke"].includes(mode ?? "")) return "EXECUTE_REVERSIBLE";
  }

  // ── Name-only classification (existing sets) ──
  if (IRREVERSIBLE_TOOLS.has(toolName)) return "IRREVERSIBLE";
  if (HIGH_IMPACT_TOOLS.has(toolName)) return "EXECUTE_HIGH_IMPACT";
  if (SIMULATE_FIRST_TOOLS.has(toolName)) return "SIMULATE";
  if (REVERSIBLE_EXEC_TOOLS.has(toolName)) return "EXECUTE_REVERSIBLE";
  if (SUGGEST_TOOLS.has(toolName)) return "SUGGEST";
  if (QUEUE_TOOLS.has(toolName)) return "QUEUE";
  if (OBSERVE_TOOLS.has(toolName)) return "OBSERVE";

  // P0.1 FIX: Unknown tools → IRREVERSIBLE (fail-closed).
  // Forces explicit classification before any new tool can be used.
  // Previously returned OBSERVE — that was fail-open, not fail-safe.
  return "IRREVERSIBLE";
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
