# A-FORGE MCP Tool Catalog — 122 live tools

> **GENERATED — do not edit by hand.** `node scripts/generate-tool-catalog.mjs`
> **Generated:** 2026-10-01 12:33Z · **Source of truth:** live `tools/list` from `dist/src/interfaces/mcp/cli.js`
> **Class / Lease columns:** derived from `classifyTool()` + `requiresGovernance()` — the same
> component the runtime elicitation and policy gates consult, so this table cannot disagree with the gate.
> **Surface:** 122 tools = 40 union (mode-dispatched) + 82 atomic · 42 require governance for at least one mode.

---

## Brain vs Hands — arifOS vs A-FORGE

A-FORGE is **the hands** of the federation. It does not make constitutional law; it executes under law.

| | arifOS MCP (the brain) | A-FORGE MCP (the hands) |
|---|---|---|
| **Role** | Constitutional kernel / sovereign governor / judge | Governed execution shell / actuator / forger |
| **Owns** | Law (F1–F13), truth, judgment, memory routing, VAULT999 seals | Build, deploy, run, shell, browser, orchestration, artifacts, leases |
| **Naming** | 8 canonical verbs: `arif_init`, `arif_observe`, `arif_think`, `arif_route`, `arif_memory`, `arif_judge`, `arif_forge`, `arif_seal` — capability selected by `mode` | `forge_<domain>` tools, most of them **union tools** — capability selected by `mode` |
| **Verdict authority** | Issues final verdicts: SEAL, SABAR, HOLD, VOID | Never issues final constitutional verdicts; routes judgment to arifOS |
| **Transport** | streamable-http (`127.0.0.1:8088/mcp`) | stdio (preferred for agents) + streamable-http (`127.0.0.1:7072/mcp`) |

> **CALLABLE SYNTAX — read this before calling anything.** Most A-FORGE tools are
> **union tools**: one registered name plus a `mode` discriminator. There is no
> `forge_git_status`, no `forge_filesystem_read`, no `forge_lease_request`, no `forge_run`.
> Those names appear in older prose and in no live registry. The correct forms are
> `forge_git(mode="status")`, `forge_filesystem(mode="read")`, `forge_lease(mode="request")`.
> Every example in this file is emitted from the live schema, so every example is callable.

### Typical agent flow (all names verified live)

1. **Bootstrap identity** — `arif_init` (arifOS)
2. **Observe / think** — `arif_observe()`, `arif_think(mode="critique")` (arifOS)
3. **Get authority** — `forge_lease(mode="request")` + `arif_judge` (arifOS)
4. **Execute** — `forge_filesystem(mode="write")`, `forge_shell(command=…)`, `forge_git(mode="commit")`, `forge_browser_navigate()`
5. **Seal the record** — `arif_seal` (arifOS)

> **One-line rule:** arifOS decides what is lawful. A-FORGE forges what is permitted under law.

---

## How to read this catalog

| Column | Meaning |
|---|---|
| **Tool** | Exact registered name. Union tools show their `mode` values. |
| **Class** | From `classifyTool()`: `OBSERVE`, `SUGGEST`, `SIMULATE`, `DRAFT`, `QUEUE`, `EXECUTE_REVERSIBLE`, `EXECUTE_HIGH_IMPACT`, `IRREVERSIBLE`. Unknown tools fail closed to `IRREVERSIBLE`. |
| **Gov?** | `requiresGovernance(class)` — anything other than `OBSERVE`/`SUGGEST` needs a session + lease, and external callers face the `-32042` elicitation gate. |
| **Use when** | The description's own trigger clause. **Blank = the tool ships no discriminator** — a known gap, not an omission by this generator. |

**Iron rules**
- `IRREVERSIBLE` and `EXECUTE_HIGH_IMPACT` require an `arif_judge` SEAL + kernel lease.
- `EXECUTE_REVERSIBLE` requires a kernel lease — `forge_lease(mode="request")`.
- `OBSERVE` needs no lease. Read modes of union tools are `OBSERVE` and are **not** confirmation-gated.
- Trust is verified, not asserted: a self-declared `session_id`, `lease_id` or acknowledgement
  boolean does not grant trust (S1, 2026-10-01). Only `validateSession()` — registry or HMAC ACT — does.

---

## browser — 6 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_browser_click()` | OBSERVE | no | Click a browser element. OBSERVE-class. |
| `forge_browser_evaluate_js()` | OBSERVE | no | — |
| `forge_browser_extract_text()` | OBSERVE | no | — |
| `forge_browser_navigate()` | OBSERVE | no | — |
| `forge_browser_screenshot()` | OBSERVE | no | Take a browser screenshot. OBSERVE-class. |
| `forge_browser_type()` | OBSERVE | no | — |

## confirm — 2 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_send_confirm()` | EXECUTE_HIGH_IMPACT | yes | — |
| `forge_transfer_confirm()` | EXECUTE_HIGH_IMPACT | yes | — |

## db — 1 tool

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_postgres()`<br>modes: `query` `schema` | OBSERVE | no | Canonical Postgres primitive. Modes: query, schema. Writes require mutate=true and remain floor-gate. Use when: Canonical Postgres primitive. Modes: query, schema. Writes require mutate=true and remain floor-gate. |

## docker — 1 tool

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_docker()`<br>modes: `ps` `logs` `exec` `images` | `ps`→OBSERVE<br>`logs`→OBSERVE<br>`exec`→EXECUTE_REVERSIBLE<br>`images`→OBSERVE | yes | Canonical Docker primitive. Modes: ps, logs, exec, images. Destructive operations stay out of this r. Use when: Canonical Docker primitive. Modes: ps, logs, exec, images. Destructive operations stay out of this r. |

## execute — 6 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_abort()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_compose()`<br>modes: `execute` `status` `cancel` `analyze` | `execute`→EXECUTE_REVERSIBLE<br>`status`→OBSERVE<br>`cancel`→EXECUTE_REVERSIBLE<br>`analyze`→OBSERVE | yes | ACTUATOR [execute/MUTATE] Composition Bus — orchestrate multi-tool execution across MCP servers. 4 patterns: sequential, parallel, conditional, loop. Each step produces a receipt. DAG-based resolution with cycle detection. Modes: execute, status, cancel, analyze. Constitutional: F1 AMANAH, F2 TRUTH, F4 CLARITY, F11 AUDIT. |
| `forge_execute()`<br>modes: `internal_mode` `external_safe_mode` | EXECUTE_HIGH_IMPACT | yes | — |
| `forge_execute_sealed()` | EXECUTE_HIGH_IMPACT | yes | Execute with VAULT999 seal. FAILS HARD without valid seal — no self-authorization possible. |
| `forge_pipeline_run()`<br>modes: `observe` `forge` `full` | EXECUTE_REVERSIBLE | yes | — |
| `forge_sandbox_run()` | EXECUTE_REVERSIBLE | yes | — |

## fs — 1 tool

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_filesystem()`<br>modes: `read` `write` `patch` `glob` `grep` `stat` `tree` `move` `delete` `restore` | `read`→OBSERVE<br>`write`→EXECUTE_REVERSIBLE<br>`patch`→EXECUTE_REVERSIBLE<br>`glob`→OBSERVE<br>`grep`→OBSERVE<br>`stat`→OBSERVE<br>`tree`→OBSERVE<br>`move`→EXECUTE_REVERSIBLE<br>`delete`→EXECUTE_HIGH_IMPACT<br>`restore`→EXECUTE_REVERSIBLE | yes | — |

## git — 6 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_git()`<br>modes: `status` `diff` `log` `commit` | `status`→OBSERVE<br>`diff`→OBSERVE<br>`log`→OBSERVE<br>`commit`→EXECUTE_REVERSIBLE | yes | Canonical git primitive. Modes: status, diff, log, commit. Mutating modes are floor-gated by A-FORGE. Use when: Canonical git primitive. Modes: status, diff, log, commit. Mutating modes are floor-gated by A-FORGE. |
| `forge_github()`<br>modes: `search` `pr` | OBSERVE | no | Canonical GitHub primitive. Modes: search, pr. Use type for search variants instead of separate tool. Use when: Canonical GitHub primitive. Modes: search, pr. Use type for search variants instead of separate tool. |
| `forge_github_create_issue()` | EXECUTE_HIGH_IMPACT | yes | Create a GitHub issue. MUTATE — lease required. |
| `forge_github_create_or_update_file()` | IRREVERSIBLE | yes | — |
| `forge_github_get_file()` | OBSERVE | no | Read a file from GitHub. OBSERVE-class. |
| `forge_worktree()` | OBSERVE | no | Local git physics sensor. Returns branch, dirty state, stash, conflicts, in-progress ops, blast radi. |

## governance — 9 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_check_governance()` | OBSERVE | no | — |
| `forge_evaluate()` | OBSERVE | no | APEX v36Ω evaluation gate (V3 canonical). Computes G = (A·P·E·X)^(1/4) — 4-term geometric mean; Φ is scar pressure, not a 5th dial. C_dark = A·(1-P)·(1-X). Returns SEAL/REVIEW/VOID. |
| `forge_heart_critique()` | OBSERVE | no | — |
| `forge_judge_proxy()` | OBSERVE | no | — |
| `forge_predict()` | OBSERVE | no | — |
| `forge_reality_loop()`<br>modes: `start` `advance` `record` `seal` `report` `metrics` `list` `destroy` | `start`→OBSERVE<br>`advance`→EXECUTE_REVERSIBLE<br>`record`→EXECUTE_REVERSIBLE<br>`seal`→EXECUTE_REVERSIBLE<br>`report`→OBSERVE<br>`metrics`→OBSERVE<br>`list`→OBSERVE<br>`destroy`→EXECUTE_REVERSIBLE | yes | — |
| `forge_session_init()`<br>modes: `internal` `external` | OBSERVE | no | — |
| `forge_trust_score()`<br>modes: `score` `evaluate` `list` `history` `verify` | `score`→EXECUTE_REVERSIBLE<br>`evaluate`→EXECUTE_REVERSIBLE<br>`list`→OBSERVE<br>`history`→OBSERVE<br>`verify`→OBSERVE | yes | ACTUATOR [governance/OBSERVE] Trust scoring engine for external MCP servers. Scores on 5 dimensions (identity, uptime, auditability, mutation_risk, witnessability), maps to bands (ALLOW/LIMITED/HOLD/DENY), and gates access. Modes: score, evaluate, list, history, verify. Constitutional: F2 TRUTH, F7 HUMILITY, F11 AUDIT, F13 SOVEREIGN. |
| `forge_witness()` | OBSERVE | no | — |

## health — 3 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_health_check()` | OBSERVE | no | — |
| `forge_netdata_alarms()` | OBSERVE | no | Read Netdata alarms. OBSERVE-class. |
| `forge_netdata_metrics()` | OBSERVE | no | Read Netdata chart data. OBSERVE-class. |

## job — 1 tool

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_job()`<br>modes: `submit` `status` | OBSERVE | no | — |

## memory — 1 tool

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_memory()`<br>modes: `recall` | OBSERVE | no | Canonical memory primitive. Modes: recall. Reads VAULT999 local files, then vault999-api fallback. Use when: Canonical memory primitive. Modes: recall. Reads VAULT999 local files, then vault999-api fallback. |

## meta — 45 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `auth_pipeline()` | OBSERVE | no | — |
| `forge_apex_emd()` | OBSERVE | no | — |
| `forge_apex_encode()` | OBSERVE | no | — |
| `forge_apex_goal_status()` | OBSERVE | no | — |
| `forge_apex_metabolize()` | OBSERVE | no | — |
| `forge_apex_recompute()` | OBSERVE | no | — |
| `forge_canon_recall()` | OBSERVE | no | — |
| `forge_canonize()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_chart()` | OBSERVE | no | — |
| `forge_collect_evidence()` | IRREVERSIBLE | yes | — |
| `forge_compile_task()` | IRREVERSIBLE | yes | — |
| `forge_cool()` | OBSERVE | no | — |
| `forge_dispatch_lane()` | IRREVERSIBLE | yes | — |
| `forge_docket_prep()` | OBSERVE | no | — |
| `forge_docsgpt()`<br>modes: `query` `native` | OBSERVE | no | — |
| `forge_document_ingest()`<br>modes: `analyze` `extract` `chunk` `compare` | OBSERVE | no | — |
| `forge_entropy_sweep()` | OBSERVE | no | — |
| `forge_ephemeral()`<br>modes: `inspect_gap` `generate` `sandbox_test` `invoke` `verify` `retire` `list_templates` `list_active` `propose_promotion` | `inspect_gap`→OBSERVE<br>`generate`→EXECUTE_REVERSIBLE<br>`sandbox_test`→EXECUTE_REVERSIBLE<br>`invoke`→EXECUTE_REVERSIBLE<br>`verify`→EXECUTE_REVERSIBLE<br>`retire`→EXECUTE_REVERSIBLE<br>`list_templates`→OBSERVE<br>`list_active`→OBSERVE<br>`propose_promotion`→EXECUTE_REVERSIBLE | yes | — |
| `forge_experience_query()` | OBSERVE | no | — |
| `forge_experience_trace()` | OBSERVE | no | — |
| `forge_gemini()` | OBSERVE | no | — |
| `forge_git_commit()` | EXECUTE_HIGH_IMPACT | yes | — |
| `forge_hf_import()`<br>modes: `import_model` `import_dataset` `preflight` `batch_screen` | EXECUTE_REVERSIBLE | yes | — |
| `forge_kernel()`<br>modes: `init` `observe` `think` `route` `memory` `judge` `forge` `seal` | EXECUTE_REVERSIBLE | yes | — |
| `forge_parallel()`<br>modes: `parallel` | EXECUTE_REVERSIBLE | yes | — |
| `forge_parallel_cancel()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_parallel_list()` | OBSERVE | no | — |
| `forge_parallel_status()` | OBSERVE | no | — |
| `forge_rsi_dual_rate_fq()` | OBSERVE | no | 'FQ governance', 'dual rate', 'aliased FQ', '7-day FQ', 'governance signal'. |
| `forge_rsi_impulse_response()` | OBSERVE | no | 'impulse response', 'HOLD influence', 'how long does a HOLD last', 'causal half-life', 'h(t)', 'RSI measurement'. |
| `forge_rsi_state_vector()` | OBSERVE | no | 'state vector', 'RSI snapshot', 's_t', 'controller state', 'Imp state'. |
| `forge_runtime_verify()` | OBSERVE | no | — |
| `forge_sandbox_auto_evict()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_sandbox_list_paused()` | OBSERVE | no | — |
| `forge_sandbox_pause()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_sandbox_resume()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_seal_run()` | IRREVERSIBLE | yes | — |
| `forge_skill_select_query()` | OBSERVE | no | — |
| `forge_visual_qa()`<br>modes: `validate_only` `iterate_and_fix` `full_loop` | OBSERVE | no | — |
| `forge_visual_seal()` | IRREVERSIBLE | yes | — |
| `forge_web_extract()` | OBSERVE | no | — |
| `forge_web_zen()`<br>modes: `sense` `verify` `orphan` `ephemeral` `doctor` `caddy-reload-hint` | OBSERVE | no | site audit, missions 404, vitals proxies, SPA deploy check, ephemeral site parser. |
| `forge_wm_gaps()` | OBSERVE | no | — |
| `forge_wm_quality()` | OBSERVE | no | — |
| `forge_wm_stats()` | OBSERVE | no | — |

## org_bridge — 2 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_wealth()`<br>modes: `emv` `conservation` `flow` `runway` `wisdom` | OBSERVE | no | — |
| `forge_well()`<br>modes: `state` `readiness` `floors` `anchor` `machine_intelligence` | OBSERVE | no | WELL human readiness primitive. Routes to WELL organ (port 18083). Modes: state, readiness, floors,. Use when: WELL human readiness primitive. Routes to WELL organ (port 18083). Modes: state, readiness, floors,. |

## probe — 9 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_fingerprint_check()` | OBSERVE | no | — |
| `forge_isomorphism_check()` | OBSERVE | no | — |
| `forge_probe()` | OBSERVE | no | — |
| `forge_probe_site()` | OBSERVE | no | — |
| `forge_scan()` | OBSERVE | no | — |
| `forge_security_drift_scan()` | OBSERVE | no | Production security telemetry (renamed from forge_boundaries_assert). |
| `forge_surface_audit()`<br>modes: `audit` `scan` `fix` | OBSERVE | no | — |
| `forge_surface_guard()`<br>modes: `check` `status` `pin` `config` | OBSERVE | no | — |
| `forge_verify_timeline()`<br>modes: `verify` `audit` `suggest_sources` | OBSERVE | no | — |

## registry — 9 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_agent()`<br>modes: `register` `status` `list` `kill` | `register`→EXECUTE_REVERSIBLE<br>`status`→OBSERVE<br>`list`→OBSERVE<br>`kill`→IRREVERSIBLE | yes | — |
| `forge_lease()`<br>modes: `request` `status` `revoke` | `request`→EXECUTE_REVERSIBLE<br>`status`→OBSERVE<br>`revoke`→EXECUTE_REVERSIBLE | yes | — |
| `forge_lock()`<br>modes: `acquire` `release` | EXECUTE_REVERSIBLE | yes | — |
| `forge_policy()`<br>modes: `check` `set` `remove` `list` `save` | OBSERVE | no | — |
| `forge_register()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_registry()`<br>modes: `status` `list` `get` `scars` `fingerprint` `scan` | OBSERVE | no | Dynamic skill registry. Modes: list (all generated tools + Decision Field), get (one tool manifest),. |
| `forge_registry_status()` | OBSERVE | no | — |
| `forge_status()`<br>modes: `overview` `jobs` `leases` `agents` | OBSERVE | no | — |
| `forge_tier_bind()` | EXECUTE_REVERSIBLE | yes | — |

## research — 2 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_fetch()`<br>modes: `html` `markdown` `text` `json` `readable` `metadata` `links` `search` | OBSERVE | no | Governed URL evidence intake + self-hosted web search. Modes: html, markdown, text, json, readable,. Use when: Governed URL evidence intake + self-hosted web search. Modes: html, markdown, text, json, readable,. |
| `forge_search()` | OBSERVE | no | Governed web search via Brave. OBSERVE-class. |

## shell — 5 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_shell()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_shell_alert_history()` | OBSERVE | no | — |
| `forge_shell_dryrun()` | OBSERVE | no | — |
| `forge_shell_ledger()` | OBSERVE | no | — |
| `forge_shell_status()` | OBSERVE | no | — |

## skill — 4 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_skill()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_skillstore_read()` | OBSERVE | no | — |
| `forge_skillstore_write()` | EXECUTE_REVERSIBLE | yes | — |
| `forge_synthesize()` | EXECUTE_REVERSIBLE | yes | — |

## vault — 5 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_receipt_draft()` | OBSERVE | no | — |
| `forge_scar()`<br>modes: `seal` `list` `consult` | OBSERVE | no | — |
| `forge_seal()` | IRREVERSIBLE | yes | — |
| `forge_stage()`<br>modes: `artifact` `governance` | EXECUTE_REVERSIBLE | yes | Move artifact to quarantine staging. Spec becomes IMMUTABLE after staging. |
| `forge_vault()`<br>modes: `read` `list` `write` `receipt` | `read`→OBSERVE<br>`list`→OBSERVE<br>`write`→EXECUTE_REVERSIBLE<br>`receipt`→IRREVERSIBLE | yes | VAULT999 primitive. Modes: read, list, write, seal. Use when: VAULT999 primitive. Modes: read, list, write, seal. |

## vps — 4 tools

| Tool | Class | Gov? | Use when |
|---|---|---|---|
| `forge_journalctl()`<br>modes: `logs` `errors` `tail` `grep` | OBSERVE | no | — |
| `forge_vps_cron()`<br>modes: `scan` `registry` `assert` | OBSERVE | no | — |
| `forge_vps_ports()`<br>modes: `scan` `registry` `assert` | OBSERVE | no | — |
| `forge_vps_services()`<br>modes: `scan` `registry` `assert` | OBSERVE | no | — |

---

## Known gaps (measured, not editorialised)

- **95 of 122 tools give a router no usable trigger clause.** Of those, **1 append a `Use when:` that merely repeats their own description** — noise, not a discriminator. Fixing this means editing each tool's description at its registration site, not this file.
- The 8 governance parameters (`session_id`, `actor_id`, `lease_id`, `session_token`, `sct`, `act`, `justification`, `claim_class`) are injected into every tool from `GOVERNANCE_FIELDS` in `src/interfaces/mcp/core.ts`. `session_token`, `sct` and `act` alias one token; `act` is preferred.
- Outbound cross-organ conformance is audited by `forge_surface_audit` (axis `OUTBOUND_ABI_DRIFT`), not by this file.
