# A-FORGE MCP Tool Catalog — 78 Tools by Cognitive Function

> **Purpose:** Give agents (and humans) a single-page map of the A-FORGE MCP surface so the right tool is chosen for the right intent.  
> **Canonical source:** `A-FORGE/src/interfaces/mcp/core.ts` + `proxyTools.ts` + `forgeTools.ts` + `gatewayTools.ts`.  
> **Last audited:** 2026-06-23 by Kimi Code for F13 SOVEREIGN.

---

## Brain vs Hands — arifOS vs A-FORGE

A-FORGE is **the hands** of the federation. It does not make constitutional law; it executes under law.

| | arifOS MCP (the brain) | A-FORGE MCP (the hands) |
|---|---|---|
| **Role** | Constitutional kernel / sovereign governor / judge | Governed execution shell / actuator / forger |
| **Owns** | Law (F1–F13), truth, judgment, memory routing, VAULT999 seals | Build, deploy, run, shell, browser, orchestration, artifacts, leases |
| **Target naming** | **2-term dot** (`arif.judge`) — one name = one constitutional axis | **3-term underscore** (`forge_filesystem_read`) — one name = one operational capability |
| **Verdict authority** | Issues final verdicts: SEAL, SABAR, HOLD_888, VOID | Never issues final constitutional verdicts; routes judgment to arifOS |
| **Governance model** | Floor enforcer + INIT → JUDGE → SEAL contract | FloorEnforcer + lease gates + session gates; must obtain authorization from arifOS |
| **Transport** | streamable-http (`127.0.0.1:8088/mcp`) | stdio (preferred for agents) + streamable-http (`127.0.0.1:7072/mcp`) |

### Typical agent flow

1. **Bootstrap identity** — `arif_session_init` (arifOS)
2. **Think / observe / critique** — `arif_mind_reason`, `arif_sense_observe`, `arif_heart_critique` (arifOS)
3. **Get authority** — `forge_lease_request` + `forge_judge_proxy` / `arif_judge_deliberate` (arifOS)
4. **Execute** — `forge_run`, `forge_filesystem_write`, `forge_git_commit`, `forge_browser_navigate` (A-FORGE)
5. **Seal the record** — `arif_vault_seal` (arifOS)

> **One-line rule:** arifOS decides what is lawful. A-FORGE forges what is permitted under law. They are separated so governance cannot be bypassed by execution power.

---

## How to Read This Catalog

| Column | Meaning |
|--------|---------|
| **Tool** | Exact MCP tool name. |
| **Class** | Authority class: `OBSERVE` (read-only), `EXECUTE_REVERSIBLE` (mutates but undoable), `EXECUTE_HIGH_IMPACT` (deploy/billing), `IRREVERSIBLE` (vault seal, deletes). |
| **Lease?** | Does the tool require a valid kernel lease for non-observe calls? |
| **Use When** | Agent-level intent → tool mapping. |

**Iron rules:**
- `IRREVERSIBLE` and `EXECUTE_HIGH_IMPACT` tools require an `arif_judge_deliberate` SEAL + kernel lease.
- `EXECUTE_REVERSIBLE` tools require a kernel lease (issued via `forge_lease_request`).
- `OBSERVE` tools may run without a lease unless they touch sensitive surfaces.
- Always start a session with `arif_session_init` before lease-gated work.

---

## 1. Constitutional Kernel & Judgment (7 tools)

The arifOS bridge inside A-FORGE. Use these when the task is about governance, session bootstrap, risk review, or asking the kernel for a SEAL/HOLD verdict.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `arif_session_init` | `EXECUTE_REVERSIBLE` | No | Start any governed session. Returns `session_id`. |
| `arif_health_check` | `OBSERVE` | No | Ping A-FORGE / check constitutional genome status. |
| `arif_sense_observe` | `OBSERVE` | No | Ground a query in reality before acting. |
| `arif_mind_reason` | `SUGGEST` | No | Synthesize grounded facts into a reasoning path. |
| `arif_heart_critique` | `OBSERVE` | No | Run F3/F6/F9/W0 risk critique on a proposed task. |
| `forge_check_governance` | `OBSERVE` | No | Alias for `arif_heart_critique`; use either. |
| `forge_judge_proxy` | `EXECUTE_HIGH_IMPACT` | Yes | Forward a candidate action to arifOS `arif_judge_deliberate`. |

---

## 2. Execution & Motor Cortex (4 tools)

Use these when you actually want A-FORGE to *do* something autonomously.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `arif_forge_execute` | `EXECUTE_HIGH_IMPACT` | Yes + JUDGE SEAL | Execute an action plan via AgentEngine. |
| `forge_run` | `EXECUTE_HIGH_IMPACT` | Yes + JUDGE SEAL | Full agent run with governance floors. |
| `forge_pipeline` | `EXECUTE_REVERSIBLE`/`HIGH_IMPACT` | Yes (mode-dependent) | One-call 000→999 autonomous pipeline (SENSE → ROUTE → FORGE → JUDGE → VAULT). |
| `forge_approve` | `IRREVERSIBLE` | Yes | **Deprecated proxy.** Always returns `SELF_AUTHORIZE_REFUSED`; route to `forge_judge_proxy` instead. |

---

## 3. Vault & Memory Stewardship (9 tools)

Use these to read/write the federation memory graph and VAULT999 ledger.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `arif_vault_seal` | `IRREVERSIBLE` | Yes | Seal a terminal verdict to VAULT999. |
| `forge_vault_seal` | `IRREVERSIBLE` | Yes | Lower-level VAULT999 seal with full telemetry. |
| `forge_remember` | `EXECUTE_REVERSIBLE` | Yes | Store a memory entry. |
| `forge_memory_store` | `EXECUTE_REVERSIBLE` | Yes | Store value in federation memory (arifOS + VAULT999 fallback). |
| `forge_memory_recall` | `OBSERVE` | No | Search past sessions / sealed events / codebase context. |
| `forge_vault_read` | `OBSERVE` | No | Read a vault record by name. |
| `forge_vault_list` | `OBSERVE` | No | List vault records by category. |
| `forge_vault_write` | `EXECUTE_REVERSIBLE` | Yes | Write a vault record. |
| `forge_vault_delete` | `IRREVERSIBLE` | Yes | Delete a vault record. |

---

## 4. Identity, Authority & Lease (8 tools)

F11 AUTH surface. Use these to register agents, mint/inspect/revoke leases, and acquire Amanah locks before irreversible mutations.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_agent_register` | `EXECUTE_REVERSIBLE` | Yes | Register a new agent identity + authority profile. |
| `forge_agent_status` | `OBSERVE` | No | Query one agent's identity and active leases. |
| `forge_agent_list` | `OBSERVE` | No | List all registered agents. |
| `forge_lease_request` | `EXECUTE_REVERSIBLE` | Yes | Request a bounded authority lease from arifOS. |
| `forge_lease_status` | `OBSERVE` | No | Inspect a lease (TTL, scope, revoked). |
| `forge_lease_revoke` | `EXECUTE_REVERSIBLE` | Yes | Revoke a lease early. |
| `request_amanah_lock` | `EXECUTE_REVERSIBLE` | Yes | Acquire an F1 Amanah lock on a resource. |
| `release_amanah_lock` | `EXECUTE_REVERSIBLE` | Yes | Release an Amanah lock you own. |

---

## 5. Local Filesystem Workspace (5 tools)

Tier 1 coder gateway. Scoped to `/root`, `/tmp`, `/data`, `/var/log` (F8 LAW).

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_filesystem_read` | `OBSERVE` | No | Read a file or directory listing. |
| `forge_filesystem_write` | `EXECUTE_REVERSIBLE` | Yes | Write a file; `overwrite=true` required for existing files. |
| `forge_filesystem_glob` | `OBSERVE` | No | Find files by glob pattern. |
| `forge_filesystem_grep` | `OBSERVE` | No | Search file contents with regex. |
| `forge_filesystem_stat` | `OBSERVE` | No | Get file/directory metadata. |

---

## 6. Database & Persistence (2 tools)

Direct Postgres access to the local vault999 database.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_postgres_query` | `EXECUTE_REVERSIBLE` | Yes (`mutate=true`) | Execute raw SQL; read-only by default. |
| `forge_postgres_schema` | `OBSERVE` | No | List tables / columns. |

---

## 7. Git — Local Repo Operations (4 tools)

Read + commit git state in allowed repo roots (`/root/arifOS`, `/root/A-FORGE`, `/root/AAA`, `/root/geox`, `/root/WEALTH`, `/root/WELL`, `/root/APEX`).

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_git_status` | `OBSERVE` | No | Working tree status + branch + ahead count. |
| `forge_git_diff` | `OBSERVE` | No | Uncommitted diff (optionally staged). |
| `forge_git_log` | `OBSERVE` | No | Recent commit history. |
| `forge_git_commit` | `EXECUTE_REVERSIBLE` | Yes | Stage and commit; `push=true` requires 888_HOLD. |

---

## 8. GitHub — Read-Only Proxy (2 tools)

Lightweight curl-based GitHub search / PR queries. No official SDK dependency.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_github_search` | `OBSERVE` | No | Search repos, code, issues, or PRs. |
| `forge_github_pr` | `OBSERVE` | No | List/get/create PRs (create is mutating). |

---

## 9. GitHub — Full Gateway (6 tools)

Full REST gateway with receipt logging. Mutating actions are lease-gated and should prefer draft PRs.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_github_search_code` | `OBSERVE` | No | GitHub code search. |
| `forge_github_search_repos` | `OBSERVE` | No | GitHub repository search. |
| `forge_github_get_file` | `OBSERVE` | No | Read a file from a GitHub repo. |
| `forge_github_create_or_update_file` | `EXECUTE_REVERSIBLE` | Yes | Commit a file; optionally auto-create a draft PR. |
| `forge_github_create_issue` | `EXECUTE_REVERSIBLE` | Yes | Open a GitHub issue. |
| `forge_github_create_pull_request` | `EXECUTE_REVERSIBLE` | Yes | Create a PR. |

---

## 10. Docker & Infrastructure (4 tools)

Inspect and interact with local containers. Destructive ops require 888_HOLD.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_docker_ps` | `OBSERVE` | No | List running / all containers. |
| `forge_docker_logs` | `OBSERVE` | No | Tail container logs. |
| `forge_docker_exec` | `EXECUTE_REVERSIBLE` | Yes | Run a command inside a container (read-only policy enforced). |
| `forge_docker_images` | `OBSERVE` | No | List Docker images. |

---

## 11. Research, Search & Browser (12 tools)

Web grounding and browser automation. All browser actions require task_context + page_context and pass through the browser injection sentinel.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_research` | `OBSERVE` | No | Governed research across web sources (Brave fallback). |
| `forge_search` | `OBSERVE` | No | Governed web search via Brave. |
| `forge_minimax_search` | `OBSERVE` | No | Search via local MiniMax MCP. |
| `minimax_web_search` | `OBSERVE` | No | Direct MiniMax web search. |
| `minimax_understand_image` | `OBSERVE` | No | MiniMax vision analysis of an image. |
| `forge_docs_lookup` | `OBSERVE` | No | Context7 docs lookup across federation corpora. |
| `forge_browser_navigate` | `EXECUTE_REVERSIBLE` | Yes | Navigate browser to URL. |
| `forge_browser_click` | `EXECUTE_REVERSIBLE` | Yes | Click an element. |
| `forge_browser_type` | `EXECUTE_REVERSIBLE` | Yes | Type into an element. |
| `forge_browser_screenshot` | `OBSERVE` | No | Take a screenshot. |
| `forge_browser_extract_text` | `OBSERVE` | No | Extract visible text from page/element. |
| `forge_browser_evaluate_js` | `EXECUTE_REVERSIBLE` | Yes | Evaluate JS in browser context. |

---

## 12. Monitoring & Telemetry (3 tools)

Read federation health, logs, and Netdata metrics.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_log_tail` | `OBSERVE` | No | Tail systemd logs for any federation organ. |
| `forge_netdata_alarms` | `OBSERVE` | No | Read Netdata alarms. |
| `forge_netdata_metrics` | `OBSERVE` | No | Read Netdata chart data. |

---

## 12.5. Visualization & Agentic Data Analysis (1 tool)

Shared surface for all domain organs. Agentic charts + automatic "eureka margin" detection (turning points, high deviation, curvature). Enables GEOX crossplots, WEALTH time-series + distributions, WELL vitality trends, and quantum discovery pattern finding without each organ owning viz code.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_chart` | `OBSERVE` | No | Generate SVG chart from data + receive eureka_candidates (reversals/outliers/curvature as discovery margins). Types: line, bar, scatter, pie, area, histogram. |

**Pattern:** query data (forge_postgres / forge_wealth / raw series) → forge_chart → agent sees SVG + margins → iterate / eureka.

**Upstream reference:** antvis/mcp-server-chart (25+ @antv charts) — this is the A-FORGE canonical always-on subset for federation unity.

---

## 13. Domain Organs — WEALTH & WELL (7 tools)

A-FORGE's native wrappers for capital and human-readiness evidence.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `wealth_evaluate_ROI` | `OBSERVE` | No | Evaluate investment ROI scenarios. |
| `wealth_compute_EMV` | `OBSERVE` | No | Compute Expected Monetary Value. |
| `wealth_thermodynamic_scan` | `OBSERVE` | No | Landauer-cost scan of actions. |
| `forge_well_state_read` | `OBSERVE` | No | Read WELL telemetry snapshot. |
| `forge_well_readiness_check` | `OBSERVE` | No | WELL readiness verdict. |
| `forge_well_floor_scan` | `OBSERVE` | No | Scan all 13 W-floors. |
| `forge_well_anchor` | `EXECUTE_REVERSIBLE` | Yes | Anchor WELL state to VAULT999. |

---

## 14. Utilities & Meta (4 tools)

Diagnostics, dry-run, and background job plumbing.

| Tool | Class | Lease? | Use When |
|------|-------|--------|----------|
| `forge_registry_status` | `OBSERVE` | No | List A-FORGE tool registry truth state. |
| `forge_shell_dryrun` | `SIMULATE` | No | Preview what a shell command *would* do without executing. |
| `forge_job_submit` | `EXECUTE_REVERSIBLE` | Yes | Submit an async background job. |
| `forge_job_status` | `OBSERVE` | No | Poll job status/result. |

---

## Quick Decision Map

| I want to... | Start here |
|--------------|------------|
| Begin a governed session | `arif_session_init` |
| Check if an action is safe | `arif_heart_critique` → `forge_judge_proxy` |
| Read code/files | `forge_filesystem_read` / `forge_filesystem_grep` |
| Edit code/files | `forge_filesystem_write` (lease) |
| Search the web | `forge_search` or `forge_research` |
| Open a browser | `forge_browser_navigate` (lease) |
| Commit changes | `forge_git_commit` (lease) |
| Open a GitHub issue/PR | `forge_github_create_issue` / `forge_github_create_pull_request` (lease) |
| Run shell commands safely | `forge_shell_dryrun` first, then `arif_forge_execute` with SEAL |
| Store a memory | `forge_remember` or `forge_memory_store` (lease) |
| Seal a final verdict | `arif_vault_seal` (lease + JUDGE SEAL) |
| Check system health | `arif_health_check`, `forge_log_tail`, `forge_netdata_alarms` |

---

## Governance Reminder for Agents

> **A-FORGE is not a free-for-all.** Every `EXECUTE_*` call leaves a receipt. Every lease is minted by arifOS, not by A-FORGE. When in doubt, run `arif_heart_critique` first, then request a lease scoped to exactly the tools you need.
