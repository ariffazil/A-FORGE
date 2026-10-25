/**
 * Action Classifier — 8-tier action taxonomy for arifOS MCP Gate.
 *
 * Replaces the legacy 3-class (OBSERVE/MUTATE/ATOMIC) with an
 * 8-class model that lets agents move fast where safe and
 * stop only where necessary.
 *
 * Used by:
 *   - POST /execute (HTTP bridge)
 *   - MCP tool wrapper (core.ts)
 *   - arifOS MCP Gate v0 (cross-organ)
 *
 * FEDERATION_HARDENING P1 (2026-10-25, sovereign directive) — hardening pass:
 *   - Registry is source of truth: every entry here names a tool that is LIVE
 *     on the A-FORGE :7072 surface (tools_sot.yaml, generated from live
 *     tools/list) or a LIVE cross-organ tool verified on its own organ
 *     (arifOS kernel :8088, GEOX). Dead entries removed (registry-is-SOT).
 *   - Default class is the MUTATE floor (EXECUTE_REVERSIBLE): an unknown tool
 *     is treated as mutation-capable. Fail-closed — never read-only by default.
 *   - isClassifiedTool() stays the policy-gate intercept: an unknown tool is
 *     still forced to HOLD at McpPolicyGate (L4b) regardless of the class
 *     fallback, so the fallback only governs direct classifyTool() consumers.
 *   - Mode-aware overrides exist for every live tool that mutates only in some
 *     modes (forge_policy set/remove, forge_scar seal, forge_github non-read
 *     modes, forge_job submit, auth_pipeline non-dry_run, arif_report write
 *     modes) — a write mode may never hide behind an OBSERVE base class.
 *   - CI coverage test: test/classifierCoverage.test.ts fails the build when
 *     any live tool is unclassified or any entry here is dead.
 *
 * DITEMPA BUKAN DIBERI — 8 classes, not 3. Precision over simplicity.
 */

// ── 8-Tier Action Class ────────────────────────────────────────────────────

export type ActionClass =
  | "OBSERVE"              // Read-only, no side effects
  | "SUGGEST"              // Recommend, draft, propose — no commit
  | "SIMULATE"             // Dry run, forward model, preview
  | "DRAFT"                // Write unsent/composed content
  | "QUEUE"                // Schedule, defer, enqueue
  | "EXECUTE_REVERSIBLE"   // Git commit, create file, restart service
  | "EXECUTE_HIGH_IMPACT"  // Deploy, billing, data mutation
  | "IRREVERSIBLE";        // rm -rf, DROP TABLE, vault seal, physical actuation

/** The MUTATE floor: the class an unknown (unclassified) tool falls back to. */
export const MUTATE_FLOOR: ActionClass = "EXECUTE_REVERSIBLE";

// ── Class priority (lower = higher severity) ───────────────────────────────

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
//
// P1 (2026-10-25): every entry below was verified against the live A-FORGE
// tools/list (118 tools, tools_sot.yaml generated 2026-10-24) or against the
// live organ it belongs to (arifOS kernel :8088 — 9 tools; GEOX :8081).
// Entries naming tools not live anywhere were deleted; adding one back
// without a live registry entry fails test/classifierCoverage.test.ts.

// Tools that seal, approve, or cause irreversible / high-blast-radius effects.
// arif_seal and arif_judge are KERNEL tools (constitutional, not bypass) —
// they are the LEGAL path to irreversible action, not a bypass.
const IRREVERSIBLE_TOOLS = new Set([
  "arif_seal",                          // KERNEL :8088 — live cross-organ
  "forge_seal",                         // VAULT999 seal — IRREVERSIBLE
  "forge_github_create_or_update_file", // remote repo file write — IRREVERSIBLE
]);

// Tools that execute high-impact operations (deploy, data mutation, billing)
// arif_judge is a KERNEL constitutional tool — it is the LEGAL path to SEAL, not a bypass.
const HIGH_IMPACT_TOOLS = new Set([
  "arif_judge",              // KERNEL :8088 — live cross-organ
  "arif_forge",              // KERNEL :8088 — live cross-organ (governed execution)
  "forge_execute",
  "forge_git_commit",        // consistent with registered tool names
  // ── H1 HARDENING (2026-09-27, sovereign directive, 333-AGI audit):
  // Tightening-only ratchet — money/egress/sealed-execution stay HIGH_IMPACT.
  "forge_execute_sealed",   // sealed execution — EXECUTE_HIGH_IMPACT (H1)
  "forge_transfer_confirm", // money transfer — EXECUTE_HIGH_IMPACT (H1)
  "forge_send_confirm",     // outbound send with confirmation — EXECUTE_HIGH_IMPACT (H1)
]);

// Tools that execute reversible operations
// arif_init/observe/think/route/memory are KERNEL constitutional tools.
// They are the LEGAL path to governance, not bypass attempts.
const REVERSIBLE_EXEC_TOOLS = new Set([
  // ── KERNEL :8088 — live cross-organ ──
  "arif_init",
  "arif_observe",
  "arif_think",
  "arif_route",
  "arif_memory",
  // ── A-FORGE live surface (verified 2026-10-25 against :7072 tools/list) ──
  "forge_kernel",           // constitutional kernel proxy to arifOS — EXECUTE_REVERSIBLE
  "forge_shell",            // shell execution — governed, session required (T₁ 2026-07-19)
  "forge_canonize",         // draft → canonical promotion — EXECUTE_REVERSIBLE (file copy)
  "forge_parallel",         // spawn N concurrent A2A tasks — EXECUTE_REVERSIBLE
  "forge_parallel_cancel",  // cancel running parallel agents — EXECUTE_REVERSIBLE
  "forge_skill",            // dynamic tool generation — EXECUTE_REVERSIBLE
  "forge_skillstore_write", // artifact store write — EXECUTE_REVERSIBLE
  "forge_register",         // APEX-gated tool registration — EXECUTE_REVERSIBLE
  "forge_sandbox_run",      // sandbox execution — EXECUTE_REVERSIBLE (isolated)
  "forge_tier_bind",        // trust tier binding — EXECUTE_REVERSIBLE
  "forge_lock",             // amanah lock acquire/release — EXECUTE_REVERSIBLE
  "forge_abort",            // safe stop + rollback — EXECUTE_REVERSIBLE
  // ── Sandbox Lifecycle Operations ──
  "forge_sandbox_pause",    // pause sandbox upperdir — EXECUTE_REVERSIBLE
  "forge_sandbox_resume",   // resume sandbox overlay — EXECUTE_REVERSIBLE
  "forge_sandbox_auto_evict", // evict stale sandbox snapshots — EXECUTE_REVERSIBLE
  "forge_hf_import",        // HuggingFace model import — EXECUTE_REVERSIBLE
  // ── P1 (2026-10-25): formerly unclassified live tools ──
  // Measured handler behaviour: each writes in-memory compiler/run state.
  "forge_compile_task",     // intent → immutable TaskIR — writes taskirStore
  "forge_dispatch_lane",    // TaskIR → bounded lane invocation — writes dispatchLog
  "forge_collect_evidence", // runtime → typed evidence packet — writes evidenceStore
  "forge_seal_run",         // TaskIR+evidence → AWAITING_VERIFICATION — governance submission (fail-closed MUTATE floor)
  // P1 false-readonly closure: appends to the experience trace store.
  "forge_experience_trace", // record experience trace — append-only WRITE, not OBSERVE
]);

// Tools that should always be simulated first (cross-organ, LIVE on GEOX :8081)
const SIMULATE_FIRST_TOOLS = new Set([
  "geox_prospect",
  "geox_seismic_compute",
]);

// Explicit OBSERVE-class tools (documentation + future-proofing)
// Every name here is LIVE on the A-FORGE :7072 surface (verified 2026-10-25).
// Mode-aware tools that mutate in some modes are NOT listed here — they are
// resolved in classifyTool() so a write mode can never hide behind OBSERVE.
const OBSERVE_TOOLS = new Set([
  "forge_apex_emd",          // EMD consistency check — OBSERVE
  "forge_apex_encode",       // goal → task vector — read-only J-space model, OBSERVE
  "forge_apex_goal_status",  // inspect J-space goal vector — read-only, OBSERVE
  "forge_apex_metabolize",   // metabolic weight adjustment in session store — OBSERVE
  "forge_apex_recompute",    // sparse sensitivity recomputation — OBSERVE
  "forge_browser_navigate",  // browser nav — OBSERVE
  "forge_canon_recall",      // semantic recall over federation canon — OBSERVE
  "forge_chain_state",       // P1: THE read surface for chain liveness — reads only (R5 header: never writes a chain)
  "forge_chart",             // charting/visualization — OBSERVE
  "forge_check_governance",  // governance check — read-only
  "forge_cool",              // H4 (2026-09-27): cooling verb — contract INV-C1 OBSERVE-only; cooling appends are audit-witness writes, not state mutation
  "forge_docket_prep",       // evidence packaging — OBSERVE
  "forge_docsgpt",           // DocsGPT knowledge spine — OBSERVE (FORGE-1 membrane)
  "forge_document_ingest",   // document intelligence — OBSERVE
  "forge_drive",             // Google Drive search/list — OBSERVE
  "forge_entropy_sweep",     // workspace entropy measurement — OBSERVE
  "forge_evaluate",          // APEX G-space evaluation — computes G + C_dark, no mutation
  "forge_experience_query",  // query experience traces — read-only
  "forge_fetch",             // URL fetch — OBSERVE
  "forge_fingerprint_check", // tool fingerprint verification — OBSERVE
  "forge_gemini",            // Gemini bridge — OBSERVE inference
  "forge_health_check",      // health check — read-only
  "forge_heart_critique",    // risk/ethics critique — OBSERVE
  "forge_isomorphism_check", // manifold stability check — OBSERVE
  "forge_journalctl",        // journal log query — OBSERVE
  "forge_judge_proxy",       // proxy to arifOS judge — OBSERVE (delegates, never adjudicates)
  "forge_memory",            // memory recall — OBSERVE
  "forge_netdata_alarms",    // netdata alarms — OBSERVE
  "forge_netdata_metrics",   // netdata metrics — OBSERVE
  "forge_parallel_list",     // task group list — OBSERVE
  "forge_parallel_status",   // task group status — OBSERVE
  "forge_predict",           // pre-action simulation — OBSERVE
  "forge_probe",             // federation organ liveness — OBSERVE (hits /health endpoints)
  "forge_probe_site",        // site probe — OBSERVE
  "forge_receipt_draft",     // receipt drafting — OBSERVE (generates draft, no mutation)
  "forge_registry",          // skill registry (status/list) — OBSERVE
  "forge_registry_status",   // registry read — OBSERVE
  "forge_rsi_dual_rate_fq",  // RSI dual rate FQ signal — OBSERVE
  "forge_rsi_impulse_response", // RSI impulse response sensor — OBSERVE
  "forge_rsi_state_vector",  // RSI state vector snapshot — OBSERVE
  "forge_runtime_verify",    // runtime hash verification — OBSERVE
  "forge_sandbox_list_paused", // list paused sandboxes — OBSERVE
  "forge_scan",              // security scan — OBSERVE
  "forge_search",            // web search — OBSERVE
  "forge_security_drift_scan", // Machine Constitution security drift — OBSERVE
  "forge_session_init",      // constitutional session ignition — OBSERVE (creates context, no mutation)
  "forge_shell_alert_history", // shell alert history — OBSERVE
  "forge_shell_dryrun",      // shell preview — OBSERVE (no mutation)
  "forge_shell_ledger",      // shell ledger — OBSERVE
  "forge_shell_status",      // shell subsystem status — OBSERVE
  "forge_skill_select_query", // skill selection events — read-only
  "forge_skillstore_read",   // artifact store query — OBSERVE
  "forge_status",            // execution state overview — OBSERVE
  "forge_surface_audit",     // tool surface audit — OBSERVE
  "forge_surface_guard",     // surface guard check — OBSERVE
  "forge_verify_timeline",   // timeline claim verification — OBSERVE
  "forge_vps_cron",          // VPS cron registry — OBSERVE
  "forge_vps_ports",         // VPS port scanning — OBSERVE
  "forge_vps_services",      // VPS service listing — OBSERVE
  "forge_wealth",            // WEALTH organ bridge — OBSERVE (deprecated relay)
  "forge_web_extract",       // Universal web extract — SSRF-safe, OBSERVE
  "forge_web_zen",           // web zen CLI wrapper — OBSERVE (doctor/sense/verify; orphan dry-run)
  "forge_well",              // WELL organ relay — OBSERVE (deprecated relay)
  "forge_witness",           // tri-witness consensus — computes W³, no mutation
  "forge_wm_gaps",           // WM gap alerts — read-only
  "forge_wm_quality",        // WM trajectory quality — read-only
  "forge_wm_stats",          // WM statistics dashboard — read-only
  "forge_worktree",          // local git physics sensor — read-only
]);

/**
 * P0.1 FIX (2026-07-19): Unknown tools MUST NOT resolve to OBSERVE.
 * FEDERATION_HARDENING P1 (2026-10-25): the fallback class is the MUTATE
 * floor (EXECUTE_REVERSIBLE) — an unknown tool is treated as mutation-capable
 * and therefore governed (session + lease). It is NOT treated as harmless.
 * Fail-closed is preserved by isClassifiedTool()=false → McpPolicyGate L4b
 * forces HOLD before any execution, so the class fallback only shapes
 * direct classifyTool() consumers (HTTP /execute, MCP annotations).
 */
/**
 * Tools whose schema REQUIRES the action carrier (`verb: z.enum(...)` with no
 * `.optional()` — forgeApaConnectors.ts:188, forgeGoogleWorkspace.ts:160/193/209).
 * A call without a carrier is malformed; classifyTool must never admit it as a
 * read (2026-10-25 verb/mode carrier fix).
 */
const REQUIRED_ACTION_CARRIERS = new Set<string>([
  "forge_telegram",
  "forge_gmail",
  "forge_sheets",
  "forge_calendar",
]);

export function classifyTool(
  toolName: string,
  modeArg?: string | Record<string, unknown>,
): ActionClass {
  // Action-carrier normalization (2026-10-25): the APA/Workspace tool schemas
  // carry the action in `verb` (z.enum required), while callers extracted only
  // `args.mode` — so a real `forge_telegram {verb:"send"}` (external Telegram
  // egress) classified OBSERVE and skipped ACT/lease/FQ governance (reproduced
  // live 2026-10-25 against the deployed build). Accept either carrier as the
  // action; unrecognized carriers fall through the per-tool chains to the
  // fail-closed MUTATE floor below.
  let mode: string | undefined;
  if (typeof modeArg === "string") {
    mode = modeArg;
  } else if (modeArg && typeof modeArg === "object") {
    const carriers = modeArg as { mode?: unknown; verb?: unknown };
    mode =
      typeof carriers.mode === "string"
        ? carriers.mode
        : typeof carriers.verb === "string"
          ? carriers.verb
          : undefined;
  }
  // Required-carrier tools (schema: verb z.enum REQUIRED — not optional):
  // a dispatch that omits the carrier is malformed and must never be admitted
  // as a read. This also makes registration-time classifyTool(name) (used for
  // MCP annotations) conservative over the whole tool, per the surface-audit
  // doctrine: one annotation must describe the tool's most dangerous mode.
  if (mode === undefined && REQUIRED_ACTION_CARRIERS.has(toolName)) {
    return "EXECUTE_REVERSIBLE";
  }
  // ── Mode-aware overrides ──
  // forge_agent: list/status=OBSERVE, register=EXECUTE_REVERSIBLE, kill=IRREVERSIBLE
  if (toolName === "forge_agent") {
    if (mode === "list" || mode === "status") return "OBSERVE";
    if (mode === "register") return "EXECUTE_REVERSIBLE";
    if (mode === "kill") return "IRREVERSIBLE";
  }
  // forge_filesystem: read/tree/search/stat/glob/grep=OBSERVE, write/patch/move/restore=EXECUTE_REVERSIBLE, delete=EXECUTE_HIGH_IMPACT
  // No-mode default is OBSERVE (registration-time annotations and policy-gate
  // pre-classification must not treat a read as IRREVERSIBLE).
  // Handler re-classifies with the actual mode on each call.
  if (toolName === "forge_filesystem") {
    if (!mode) return "OBSERVE";
    if (["read", "tree", "search", "stat", "glob", "grep"].includes(mode)) return "OBSERVE";
    if (["write", "patch", "move", "restore"].includes(mode)) return "EXECUTE_REVERSIBLE";
    if (mode === "delete") return "EXECUTE_HIGH_IMPACT";
  }
  // forge_vault: read/list=OBSERVE, write/seal=EXECUTE_REVERSIBLE, no-mode=OBSERVE (P2.1 fix)
  // VAULT999 is append-only, so write is effectively reversible (new entry,
  // never overwrite). Session + lease gate still applies. Without mode the
  // policy gate pre-classifies OBSERVE; the per-call handler re-classifies.
  if (toolName === "forge_vault") {
    if (!mode) return "OBSERVE";
    if (mode === "read" || mode === "list") return "OBSERVE";
    if (mode === "write" || mode === "seal") return "EXECUTE_REVERSIBLE";
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
  // forge_lease: status/list/request=OBSERVE, revoke=EXECUTE_REVERSIBLE
  //
  // WHY request is OBSERVE (333-AGI 2026-10-20, bootstrap-circularity fix):
  // it was EXECUTE_REVERSIBLE, and the lease gate ranked it against the caller's
  // CURRENT lease class. So raising a lease required already holding the class it
  // grants — nobody could bootstrap out of OBSERVE, and the autonomous-receipt
  // path (forge_vault) was unreachable for every agent, silently.
  // Requesting authority is not an action: A-FORGE does not self-issue
  // ("arifOS mints them"), so the call is a forward of a request and the DECISION
  // stays with arifOS. It remains session-gated — an unbound caller still fails.
  // `revoke` stays EXECUTE_REVERSIBLE: that IS a mutation of live authority.
  if (toolName === "forge_lease") {
    if (["status", "list", "request"].includes(mode ?? "")) return "OBSERVE";
    if (mode === "revoke") return "EXECUTE_REVERSIBLE";
  }
  // forge_postgres: query/schema=OBSERVE (read), query with mutate=true=EXECUTE_HIGH_IMPACT
  if (toolName === "forge_postgres") {
    if (mode === "schema") return "OBSERVE";
    if (mode === "query") return "OBSERVE"; // base query is read; mutate flag raises to HIGH_IMPACT at execution gate
  }
  // forge_ephemeral: inspect_gap/list_templates/list_active=OBSERVE, rest=EXECUTE_REVERSIBLE
  if (toolName === "forge_ephemeral") {
    if (!mode) return "OBSERVE"; // default: stateless list_templates probe
    if (["inspect_gap", "list_templates", "list_active"].includes(mode)) return "OBSERVE";
    if (["generate", "sandbox_test", "invoke", "verify", "retire", "propose_promotion"].includes(mode)) return "EXECUTE_REVERSIBLE";
  }
  // forge_reality_loop: start/list/report/metrics=OBSERVE, advance/record/seal/destroy=EXECUTE_REVERSIBLE
  if (toolName === "forge_reality_loop") {
    if (!mode) return "OBSERVE"; // default: status query
    if (["start", "list", "report", "metrics"].includes(mode)) return "OBSERVE";
    if (["advance", "record", "seal", "destroy"].includes(mode)) return "EXECUTE_REVERSIBLE";
  }
  // forge_calendar: list/default=OBSERVE, create=EXECUTE_REVERSIBLE
  if (toolName === "forge_calendar") {
    if (!mode || mode === "list") return "OBSERVE";
    if (mode === "create") return "EXECUTE_REVERSIBLE";
  }
  // forge_sheets: read/default=OBSERVE, append=EXECUTE_REVERSIBLE
  if (toolName === "forge_sheets") {
    if (!mode || mode === "read") return "OBSERVE";
    if (mode === "append") return "EXECUTE_REVERSIBLE";
  }
  // forge_gmail: read-unread/default=OBSERVE, send=EXECUTE_REVERSIBLE
  if (toolName === "forge_gmail") {
    if (!mode || mode === "read-unread") return "OBSERVE";
    if (mode === "send") return "EXECUTE_REVERSIBLE";
  }
  // forge_telegram: get_me/default=OBSERVE, send=EXECUTE_REVERSIBLE
  if (toolName === "forge_telegram") {
    if (!mode || mode === "get_me") return "OBSERVE";
    if (mode === "send") return "EXECUTE_REVERSIBLE";
  }
  // forge_drive_create: always a reversible external write
  if (toolName === "forge_drive_create") return "EXECUTE_REVERSIBLE";
  // forge_trust_score: list/history/verify=OBSERVE (read-only trust ledger queries),
  // score/evaluate=EXECUTE_REVERSIBLE (persist to Postgres trust_scores + trust_history).
  if (toolName === "forge_trust_score") {
    if (!mode) return "OBSERVE"; // default: harmless list query
    if (["list", "history", "verify"].includes(mode)) return "OBSERVE";
    if (["score", "evaluate"].includes(mode)) return "EXECUTE_REVERSIBLE";
  }
  // forge_compose: status/analyze=OBSERVE, execute/cancel=EXECUTE_REVERSIBLE.
  // Irreversible compositions carry hold_id and are gated INTERNALLY by F13
  // (composition bus refuses irreversible steps without hold).
  if (toolName === "forge_compose") {
    if (!mode) return "OBSERVE"; // default: status query
    if (["status", "analyze"].includes(mode)) return "OBSERVE";
    if (["execute", "cancel"].includes(mode)) return "EXECUTE_REVERSIBLE";
  }
  // ── P1 (2026-10-25) false-readonly closures — measured handler behaviour ──
  // forge_policy: check/list=OBSERVE (read-only policy engine), set/remove/save
  // =EXECUTE_REVERSIBLE (mutates the governed MCP policy store — policyTools.ts
  // mode dispatch). Was name-classified OBSERVE: a policy WRITE read as read-only.
  if (toolName === "forge_policy") {
    if (!mode) return "OBSERVE"; // default: status/list query
    if (["check", "list", "status"].includes(mode)) return "OBSERVE";
    if (["set", "remove", "save"].includes(mode)) return "EXECUTE_REVERSIBLE";
  }
  // forge_scar: list/consult=OBSERVE (read-only scar ledger), seal=EXECUTE_REVERSIBLE
  // (records a failure into the scar ledger — a write; was name-classified OBSERVE).
  if (toolName === "forge_scar") {
    if (!mode) return "OBSERVE"; // default: list/consult read
    if (["list", "consult", "scan"].includes(mode)) return "OBSERVE";
    if (mode === "seal") return "EXECUTE_REVERSIBLE";
  }
  // forge_github: search/get=OBSERVE (read-only GitHub queries via forge_github
  // mode='search' | 'get'), every other mode (pr create etc.) =EXECUTE_REVERSIBLE.
  // Unknown mode falls to the MUTATE floor — fail-closed.
  if (toolName === "forge_github") {
    if (mode === "search" || mode === "get") return "OBSERVE";
    return "EXECUTE_REVERSIBLE";
  }
  // forge_job: status/list=OBSERVE (read-only), submit=EXECUTE_REVERSIBLE
  // (spawns a background job — an execution, not a query).
  if (toolName === "forge_job") {
    if (!mode) return "OBSERVE"; // default: status query
    if (["status", "list", "result"].includes(mode)) return "OBSERVE";
    if (mode === "submit") return "EXECUTE_REVERSIBLE";
  }
  // auth_pipeline: dry_run=OBSERVE (pure contract validation), otherwise
  // EXECUTE_REVERSIBLE — the handler runs executePipeline(contract) which walks
  // the full AUTH pipeline (lease → lock → runtime_verify → execute …) for any
  // non-dry_run, non-OBSERVE contract. The OBSERVE base class was a false
  // readonly (P1 2026-10-25); modeless calls now take the MUTATE floor.
  if (toolName === "auth_pipeline") {
    if (mode === "dry_run") return "OBSERVE";
    return "EXECUTE_REVERSIBLE";
  }
  // arif_report (KERNEL :8088 — live cross-organ): inbox/stats=OBSERVE (read the
  // peer lane), report/ack/flush=EXECUTE_REVERSIBLE (append/mutate the
  // append-only peer-lane store — arifosmcp/abi/mode_contracts.json:
  // file=MATERIAL, ack=MATERIAL, flush=MATERIAL after P1-2 2026-10-25).
  if (toolName === "arif_report") {
    if (mode === "inbox" || mode === "stats") return "OBSERVE";
    return "EXECUTE_REVERSIBLE";
  }

  // ── Name-only classification (existing sets) ──
  if (IRREVERSIBLE_TOOLS.has(toolName)) return "IRREVERSIBLE";
  if (HIGH_IMPACT_TOOLS.has(toolName)) return "EXECUTE_HIGH_IMPACT";
  if (SIMULATE_FIRST_TOOLS.has(toolName)) return "SIMULATE";
  if (REVERSIBLE_EXEC_TOOLS.has(toolName)) return "EXECUTE_REVERSIBLE";
  if (OBSERVE_TOOLS.has(toolName)) return "OBSERVE";

  // P1 (2026-10-25): unknown tool → MUTATE floor (fail-closed toward
  // governance, never toward read-only). isClassifiedTool() stays false, so
  // McpPolicyGate L4b still forces HOLD before any execution.
  return MUTATE_FLOOR;
}

/** Mode-aware base names — classified per-tool+mode in classifyTool(). */
const MODE_AWARE_TOOLS = [
  "forge_agent",
  "forge_filesystem",
  "forge_vault",
  "forge_git",
  "forge_docker",
  "forge_lease",
  "forge_postgres",
  "forge_ephemeral",
  "forge_reality_loop",
  "forge_calendar",
  "forge_sheets",
  "forge_gmail",
  "forge_telegram",
  "forge_drive_create",
  "forge_trust_score",
  "forge_compose",
  // P1 (2026-10-25) — false-readonly closures + cross-organ lane:
  "forge_policy",
  "forge_scar",
  "forge_github",
  "forge_job",
  "auth_pipeline",
  "arif_report",
];

/**
 * P0.6: Returns true if the tool is explicitly classified in any set
 * (mode-aware tools whose base name is listed count as classified).
 * Unknown tools must be intercepted by the policy gate and forced HOLD.
 */
export function isClassifiedTool(toolName: string): boolean {
  if (IRREVERSIBLE_TOOLS.has(toolName)) return true;
  if (HIGH_IMPACT_TOOLS.has(toolName)) return true;
  if (REVERSIBLE_EXEC_TOOLS.has(toolName)) return true;
  if (OBSERVE_TOOLS.has(toolName)) return true;
  if (SIMULATE_FIRST_TOOLS.has(toolName)) return true;
  if (MODE_AWARE_TOOLS.includes(toolName)) return true;
  return false;
}

/**
 * P1 (2026-10-25): every tool name this classifier explicitly knows —
 * the union of the name sets and the mode-aware base names. Consumed by
 * test/classifierCoverage.test.ts to prove live_tools == classified_tools
 * and dead_entries == 0 against the registry SOT (tools_sot.yaml).
 */
export function classifiedToolRegistry(): string[] {
  return [
    ...IRREVERSIBLE_TOOLS,
    ...HIGH_IMPACT_TOOLS,
    ...REVERSIBLE_EXEC_TOOLS,
    ...SIMULATE_FIRST_TOOLS,
    ...OBSERVE_TOOLS,
    ...MODE_AWARE_TOOLS,
  ];
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
