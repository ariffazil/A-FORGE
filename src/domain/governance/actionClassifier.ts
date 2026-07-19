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
  "forge_visual_seal",      // VAULT999 composite seal — IRREVERSIBLE
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
  "forge_canonize",         // draft → canonical promotion — EXECUTE_REVERSIBLE (file copy)
  "forge_parallel",         // spawn N concurrent A2A tasks — EXECUTE_REVERSIBLE
  "forge_parallel_cancel",  // cancel running parallel agents — EXECUTE_REVERSIBLE
  "forge_kernel",           // constitutional kernel proxy to arifOS — EXECUTE_REVERSIBLE
  // ── P0.2 FIX: newly-classified mutation tools ──
  "forge_execute_sealed",      // execute with VAULT999 seal — EXECUTE_HIGH_IMPACT (moved below)
  "forge_transfer_confirm",    // transfer with human confirmation — EXECUTE_HIGH_IMPACT
  "forge_send_confirm",        // send with human confirmation — EXECUTE_HIGH_IMPACT
  "forge_github_create_or_update_file", // GitHub file write — EXECUTE_REVERSIBLE
  "forge_github_create_issue", // GitHub issue create — EXECUTE_REVERSIBLE
  "forge_github_create_pull_request", // GitHub PR create — EXECUTE_REVERSIBLE
  "forge_skill",               // dynamic tool generation — EXECUTE_REVERSIBLE
  "forge_skillstore_write",    // artifact store write — EXECUTE_REVERSIBLE
  "forge_seal",                // VAULT999 seal — IRREVERSIBLE (moved below)
  "forge_register",            // APEX-gated tool registration — EXECUTE_REVERSIBLE
  "forge_reality_loop",        // 7-stage intent compiler — EXECUTE_REVERSIBLE (stages are governed)
  "forge_sandbox_run",         // sandbox execution — EXECUTE_REVERSIBLE (isolated)
  "forge_synthesize",          // code generation — DRAFT (moved to draft below)
  "forge_stage",               // artifact staging — EXECUTE_REVERSIBLE
  "forge_tier_bind",           // trust tier binding — EXECUTE_REVERSIBLE
  "forge_lock",                // amanah lock acquire/release — EXECUTE_REVERSIBLE
  "forge_pipeline_run",        // autonomous intelligence pipeline — EXECUTE_REVERSIBLE
  "forge_abort",               // safe stop + rollback — EXECUTE_REVERSIBLE
  "forge_parallel",            // spawn N concurrent tasks — EXECUTE_REVERSIBLE
  "forge_parallel_cancel",     // cancel parallel agents — EXECUTE_REVERSIBLE
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
  "forge_parallel_list",      // task group list — read-only, OBSERVE
  "forge_parallel_status",    // task group status query — read-only, OBSERVE
  "forge_visual_qa",          // constitutional visual QA — read-only analysis, OBSERVE
  "forge_heart_critique",     // risk assessment — read-only, OBSERVE
  "forge_session_init",       // constitutional session ignition — OBSERVE
  "forge_memory",             // memory recall — read-only, OBSERVE
  "forge_predict",            // pre-action simulation — read-only, OBSERVE
  "forge_isomorphism_check",  // J-space manifold check — read-only, OBSERVE
  "forge_fingerprint_check",  // tool fingerprint verification — read-only, OBSERVE
  "forge_entropy_sweep",      // workspace entropy measurement — read-only, OBSERVE
  "forge_status",             // active execution state — read-only, OBSERVE
  "forge_surface_guard",      // MCP surface drift detection — read-only, OBSERVE
  "forge_surface_audit",      // MCP tool surface audit — read-only, OBSERVE
  "forge_netdata_alarms",     // Netdata alarms read — read-only, OBSERVE
  "forge_netdata_metrics",    // Netdata metrics read — read-only, OBSERVE
  "forge_journalctl",         // systemd journal read — read-only, OBSERVE
  "forge_vps_ports",          // VPS port scanning — read-only, OBSERVE
  "forge_vps_services",       // VPS service listing — read-only, OBSERVE
  "forge_vps_cron",           // VPS cron registry — read-only, OBSERVE
  "forge_receipt_draft",      // compliance receipt draft — read-only, OBSERVE
  "forge_docket_prep",        // evidence packaging — read-only, OBSERVE
  "forge_verify_timeline",    // timeline claim verification — read-only, OBSERVE
  "forge_scar_scan",          // artifact SCAR database check — read-only, OBSERVE
  "forge_skillstore_read",    // artifact store query — read-only, OBSERVE
  "forge_registry",           // skill registry (list/get) — read-only, OBSERVE
  "forge_policy",             // MCP policy engine (check/list) — read-only, OBSERVE
  "forge_lock",               // Amanah lock (acquire/release) — read-only, OBSERVE
  "forge_job",                // background job (submit/status) — read-only base, OBSERVE
  "forge_wealth",             // WEALTH organ bridge — read-only, OBSERVE
  "forge_well",               // WELL organ relay — read-only, OBSERVE
  "forge_github_get_file",    // GitHub file read — read-only, OBSERVE
  "forge_github_search_code", // GitHub code search — read-only, OBSERVE
  "forge_github_search_repos",// GitHub repo search — read-only, OBSERVE
  "forge_visual_seal",        // VAULT999 composite seal — IRREVERSIBLE (requires tri-witness)
  // ── P0.2 FIX (2026-07-19): 68 previously-unclassified tools now explicitly assigned ──
  "forge_session_init",        // session ignition — OBSERVE (creates context, no mutation)
  "forge_heart_critique",      // risk/ethics critique — OBSERVE
  "forge_judge_proxy",         // proxy to arifOS judge — OBSERVE (delegates, never adjudicates)
  "forge_chart",               // charting/visualization — OBSERVE
  "forge_scan",                // security scan — OBSERVE
  "forge_fetch",               // URL fetch — OBSERVE
  "forge_fetch_url",           // URL fetch alias — OBSERVE
  "forge_fetch_json",          // JSON fetch — OBSERVE
  "forge_fetch_metadata",      // metadata fetch — OBSERVE
  "forge_fetch_links",         // link extraction — OBSERVE
  "forge_fingerprint_check",   // tool fingerprint check — OBSERVE
  "forge_github",              // GitHub ops — mode-aware (search/get=OBSERVE)
  "forge_github_search_code",  // code search — OBSERVE
  "forge_github_search_repos", // repo search — OBSERVE
  "forge_github_get_file",     // file read — OBSERVE
  "forge_journalctl",          // journal log query — OBSERVE
  "forge_memory",              // memory recall/list — OBSERVE
  "forge_netdata_alarms",      // netdata alarms — OBSERVE
  "forge_netdata_metrics",     // netdata metrics — OBSERVE
  "forge_probe_site",          // site probe — OBSERVE
  "forge_receipt_draft",       // receipt drafting — OBSERVE (generates draft, no mutation)
  "forge_registry",            // registry read — OBSERVE
  "forge_scar",                // scar ledger — mode-aware (list/consult=OBSERVE)
  "forge_skillstore_read",     // skill store read — OBSERVE
  "forge_status",              // execution state overview — OBSERVE
  "forge_surface_audit",       // tool surface audit — OBSERVE
  "forge_surface_guard",       // surface guard check — OBSERVE
  "forge_vps_ports",           // port scan — OBSERVE
  "forge_vps_services",        // service scan — OBSERVE
  "forge_vps_cron",            // cron scan — OBSERVE
  "forge_verify_timeline",     // timeline verification — OBSERVE
  "forge_isomorphism_check",   // manifold stability check — OBSERVE
  "forge_policy",              // policy engine — mode-aware (list/check=OBSERVE)
  "forge_parallel_list",       // task group list — OBSERVE
  "forge_parallel_status",     // task group status — OBSERVE
  "forge_evaluate",            // tool evaluation — OBSERVE (computes G + C_dark, no mutation)
  "forge_witness",             // tri-witness consensus — OBSERVE (computes W³, no mutation)
  "forge_entropy_sweep",       // entropy measurement — OBSERVE
  "forge_scar_scan",           // artifact check against SCAR DB — OBSERVE
  "forge_predict",             // pre-action simulation — SIMULATE (moved to simulate set below)
  "forge_document_ingest",     // already above, kept for clarity
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
