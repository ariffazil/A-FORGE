# A-FORGE Tool Surface Audit — 28 Jun 2026
> 4 files read (3,190 lines). 73 forge_* tools classified.
> DITEMPA BUKAN DIBERI

---

## OUTPUT A — FULL TOOL INVENTORY

### core.ts (37 tools — primary surface)

| # | Tool Name | Description | Key Params | Category |
|---|-----------|-------------|------------|----------|
| 1 | forge_session_init | Constitutional session ignition. Proxies to arifOS. | actor_id, intent, mode | BRIDGE |
| 2 | forge_health_check | Server health + constitutional genome status | None (zero-param) | INFRA |
| 3 | forge_heart_critique | Risk assessment — delegates to arifOS 666 HEART | task | BRIDGE |
| 4 | forge_check_governance | Constitutional governance check — delegates to arifOS | task | BRIDGE |
| 5 | forge_execute | Execution and motor cortex (777 FORGE). Requires cc_id. | task, mode, evidence_receipt, peer_contract_id, constitutional_chain_id | CORE_GATE |
| 6 | forge_run | Run full agent task with governance floors | task, mode, evidence_receipt, peer_contract_id | CORE_GATE |
| 7 | forge_approve | **REFUSES** — A-FORGE cannot self-authorize | holdId, reason | CORE_GATE |
| 8 | forge_judge_proxy | Proxy forwarder to arifOS constitutional judge | mode, candidate, session_id, actor_id, constitutional_chain_id, vault_entry_id, action_tier, heart_critique, niat_params, context_source, peer_contract_id | BRIDGE |
| 9 | forge_vault | VAULT999 primitive. Modes: read, list, write, seal. | mode, name, category, limit, value, content, reason, tier, tags, metadata | INFRA |
| 10 | forge_wealth | Route to WEALTH organ. Modes: emv, conservation, flow, runway, wisdom. | mode, outcomes, probabilities, assets, liabilities, proposal | BRIDGE |
| 11 | forge_systemctl | Query systemd. Modes: status, list_units. | service, mode, pattern | EXECUTION |
| 12 | forge_journalctl | Query systemd logs. Modes: logs, errors, tail, grep. | service, mode, since, lines, pattern | EXECUTION |
| 13 | forge_well | WELL readiness primitive. Routes to WELL organ. Modes: state, readiness, floors, anchor. | mode, sessionId, agentId | BRIDGE |
| 14 | forge_filesystem | Canonical filesystem. Modes: read, write, glob, grep, stat. F8 scoped. | mode, path, content, overwrite, pattern, include, offset, limit | EXECUTION |
| 15 | forge_postgres | Postgres primitive. Modes: query, schema. Writes gated. | mode, query, mutate, schema, detail | EXECUTION |
| 16 | forge_memory | Memory primitive. Mode: recall. Reads VAULT999. | mode, query, limit | INFRA |
| 17 | forge_git | Git primitive. Modes: status, diff, log, commit. | mode, repo, staged, limit, count, message, files, push | EXECUTION |
| 18 | forge_github | GitHub primitive. Modes: search, pr, file, issue. | mode, query, type, limit, repo, owner, path, branch, content, message, sha, action, pr_number, issue_number, title, body, head, base, state, labels, create_pr | BRIDGE |
| 19 | forge_docker | Docker primitive. Modes: ps, logs, exec, images. | mode, all, container, command, interactive, tail | EXECUTION |
| 20 | forge_agent | Agent identity management. Modes: register, status, list. | mode, agent_id, agent_type, role, authority, identity_proof | INFRA |
| 21 | forge_lease | Lease lifecycle. Modes: request, status, revoke. Delegates to arifOS. | mode, lease_id, agent_id, scope, max_action_class, ttl_seconds, forbidden, reason | CORE_GATE |
| 22 | forge_registry_status | Full A-FORGE tool registry status | None (zero-param) | INFRA |
| 23 | forge_shell_dryrun | Preview shell output WITHOUT executing | command, timeout | CORE_GATE |
| 24 | forge_job | Background job system. Modes: submit, status. | mode, job_id, agent_id, tool, args, description | EXECUTION |
| 25 | forge_orchestrate | Multi-agent role-based orchestration | task, mode, roles, session_id, actor_id | CORE_GATE |
| 26 | forge_lock | Amanah/F1 lock primitive. Modes: acquire, release. | mode, resource_id, actor_id, justification, lock_id, release_reason, session_id, ttl_seconds, constitutional_chain_id | CORE_GATE |
| 27 | forge_pipeline_run | Autonomous intelligence pipeline. Modes: observe, forge, full. | task, mode, hold_id, constitutional_chain_id, session_id, actor_id | CORE_GATE |

### core.ts (inferred from proxyTools imports — 10 tools registered via register* functions)

| # | Tool Name | File Origin | Category |
|---|-----------|-------------|----------|
| 28 | forge_filesystem | proxyTools.ts (registers consolidated tool with 5 modes) | EXECUTION |
| 29 | forge_postgres | proxyTools.ts | EXECUTION |
| 30 | forge_memory | proxyTools.ts | INFRA |
| 31 | forge_git | proxyTools.ts | EXECUTION |
| 32 | forge_github | proxyTools.ts | BRIDGE |
| 33 | forge_docker | proxyTools.ts | EXECUTION |
| 34 | forge_agent | forgeTools.ts (registerIdentityTools) | INFRA |
| 35 | forge_lease | forgeTools.ts (registerLeaseTools) | CORE_GATE |
| 36 | forge_registry_status | forgeTools.ts (registerRegistryTools) | INFRA |
| 37 | forge_shell_dryrun | forgeTools.ts (registerShellTools) | CORE_GATE |
| 38 | forge_job | forgeTools.ts (registerJobTools) | EXECUTION |
| 39 | forge_orchestrate | forgeTools.ts (registerOrchestrationTools) | CORE_GATE |

### gatewayTools.ts (24 tools — consolidated as 8 named + 16 individual)

| # | Tool Name | Description | Key Params | Category |
|---|-----------|-------------|------------|----------|
| 40 | forge_research | Governed research across web sources | query, depth, sources, time_horizon, max_results, include_citations, request_id | BRIDGE |
| 41 | forge_search | NOT FOUND (comment says "duplicate of forge_research") | — | REDUNDANT |
| 42 | forge_docs_lookup | Governed docs lookup via Context7 | query, corpus, max_results, request_id | BRIDGE |
| 43 | forge_browser | Browser automation (6 sub-modes) | mode, url, selector, text, script, request_id, task_context, page_context | BRIDGE |
| 44 | forge_browser_navigate | Navigate to URL (internal handler) | url, request_id, task_context, page_context | BRIDGE |
| 45 | forge_browser_click | Click element (internal handler) | selector, button, request_id, task_context, page_context | BRIDGE |
| 46 | forge_browser_type | Type text (internal handler) | selector, text, submit, request_id, task_context, page_context | BRIDGE |
| 47 | forge_browser_screenshot | Take screenshot (internal handler) | selector, full_page, request_id, task_context, page_context | BRIDGE |
| 48 | forge_browser_extract_text | Extract page text (internal handler) | selector, max_chars, request_id, task_context, page_context | BRIDGE |
| 49 | forge_browser_evaluate_js | Evaluate JavaScript (internal handler) | script, request_id, task_context, page_context | BRIDGE |
| 50 | forge_github_search_code | Search GitHub code | q, per_page, page, request_id | BRIDGE |
| 51 | forge_github_search_repos | Search GitHub repos | q, per_page, page, request_id | BRIDGE |
| 52 | forge_github_get_file | Get GitHub file content | owner, repo, path, branch, request_id | BRIDGE |
| 53 | forge_github_create_or_update_file | Create/update GitHub file | owner, repo, path, branch, content, message, sha, create_pr, pr_base, request_id | BRIDGE |
| 54 | forge_github_create_issue | Create GitHub issue | owner, repo, title, body, labels, assignees, request_id | BRIDGE |
| 55 | forge_github_create_pull_request | Create GitHub PR | owner, repo, title, body, head, base, draft, request_id | BRIDGE |
| 56 | forge_netdata | Query Netdata monitoring | mode, host, status, chart, after, before, points, request_id | BRIDGE |
| 57 | forge_netdata_alarms | Netdata alarms (internal handler) | host, status, request_id | BRIDGE |
| 58 | forge_netdata_metrics | Netdata metrics (internal handler) | host, chart, after, before, points, request_id | BRIDGE |
| 59 | forge_minimax_search | Web search via MiniMax | query, max_results, request_id | BRIDGE |
| 60 | forge_minimax_text_to_image | Generate image via MiniMax | prompt, aspect_ratio, request_id | BRIDGE |
| 61 | forge_minimax_text_to_audio | Text to speech via MiniMax | text, voice_id, request_id | BRIDGE |
| 62 | forge_minimax_music_generation | Music generation via MiniMax | prompt, lyrics, request_id | BRIDGE |
| 63 | forge_minimax_understand_image | Image analysis via MiniMax | image_source, prompt, request_id | BRIDGE |

### proxyTools.ts (6 tools registered as consolidated)

| # | Tool Name | Description | Key Params | Category |
|---|-----------|-------------|------------|----------|
| 64 | forge_filesystem | Filesystem ops (read/write/glob/grep/stat) | mode, path, content, overwrite, pattern, include, offset, limit | EXECUTION |
| 65 | forge_postgres | Postgres query/schema | mode, query, mutate, schema, detail | EXECUTION |
| 66 | forge_memory | VAULT999 memory recall | mode, query, limit | INFRA |
| 67 | forge_git | Git ops (status/diff/log/commit) | mode, repo, staged, limit, count, message, files, push | EXECUTION |
| 68 | forge_github | GitHub ops (search/pr/file/issue) | mode, query, type, limit, repo, owner, path, branch, content, message, sha, action, pr_number, issue_number, title, body, head, base, state, labels, create_pr | BRIDGE |
| 69 | forge_docker | Docker ops (ps/logs/exec/images) | mode, all, container, command, interactive, tail | EXECUTION |

### forgeTools.ts (additional unique tools — 4 beyond duplicates)

| # | Tool Name | Description | Category |
|---|-----------|-------------|----------|
| 70 | forge_agent | Agent identity registration/status/list | INFRA |
| 71 | forge_lease | Lease lifecycle via arifOS | CORE_GATE |
| 72 | forge_registry_status | Tool registry status | INFRA |
| 73 | forge_shell_dryrun | Dry-run shell preview | CORE_GATE |
| 74 | forge_job | Background job submit/status | EXECUTION |
| 75 | forge_orchestrate | Multi-agent orchestration | CORE_GATE |

---

## CATEGORY SUMMARY

| Category | Count | Tools |
|----------|-------|-------|
| **CORE_GATE** | 9 | forge_execute, forge_run, forge_approve, forge_lease, forge_shell_dryrun, forge_orchestrate, forge_lock, forge_pipeline_run, forge_check_governance |
| **EXECUTION** | 12 | forge_systemctl, forge_journalctl, forge_filesystem, forge_postgres, forge_git, forge_docker, forge_job, forge_shell (via forge_shell_dryrun) |
| **BRIDGE** | 26 | forge_session_init, forge_heart_critique, forge_judge_proxy, forge_wealth, forge_well, forge_github, forge_research, forge_docs_lookup, forge_browser, forge_browser_*, forge_github_*, forge_netdata, forge_netdata_*, forge_minimax_*, forge_memory (proxy) |
| **INFRA** | 7 | forge_health_check, forge_vault, forge_memory, forge_registry_status, forge_agent |
| **REDUNDANT** | 2 | forge_search (duplicate of forge_research), forge_github (duplicate across proxyTools + gatewayTools) |

---

## FLAGS

### ❌ Flag: forge_search is documented as "REMOVED — duplicate of forge_research" 
But it still appears in `epistemicForTool()` at core.ts line 169. Dead code in the epistemic classifier. Not registered as a tool, but referenced.

### ❌ Flag: forge_github is registered TWICE
In `proxyTools.ts` (line 237) AND standalone handlers exist in `gatewayTools.ts` (lines 472-607). The gatewayTools.ts handlers are dead — not registered via server.tool() in the registration block (lines 816-822 explicitly state they are REMOVED). But the handler code is still live in the file.

### ❌ Flag: forge_memory is recall-only
No write mode. Can read VAULT999 but cannot store.

### ❌ Flag: forge_approve always refuses
Intentional (A-FORGE cannot self-authorize), but caller gets no guidance on what to do next. The error says "Route to arifOS arif_judge_deliberate" but doesn't provide the tool name.

### ❌ Missing schema strictification documentation
The schema strictification guard at core.ts lines 86-95 wraps `registerTool` but is explicitly noted as NOT wrapping `server.tool()` (the SDK's objectFromShape does not add .strict()). Tools registered via server.tool() (most of the surface) still accept extra fields.

---

## OUTPUT B — GAP REPORT

### Missing Canonical Tools

| Tool | Status | Recommendation |
|------|--------|---------------|
| forge_status | ❌ MISSING (forge_health_check exists but is server health, not execution state) | Add forge_status showing active jobs, sessions, leases |
| forge_probe | ❌ MISSING | Add: organ liveness check across all 5 organs + latency |
| forge_route | ❌ MISSING | Add: intent→organ routing (IntentRouter is internal only) |
| forge_abort | ❌ MISSING | Add: safe stop + rollback for running executions |
| forge_audit | ⚠️ forge_vault exists but as general vault read/write not execution audit | Add forge_audit mode or document forge_vault covers it |
| forge_scan | ❌ MISSING (SecurityScanner.ts internal only) | Expose as MCP tool: AST security scan before code exec |
| forge_file_read | ⚠️ Covered by forge_filesystem(mode=read) | Document as canonical |
| forge_file_write | ⚠️ Covered by forge_filesystem(mode=write) | Document as canonical |
| forge_fetch | ⚠️ Covered by forge_research (broader scope) | Acceptable |
| forge_agent_spawn | ⚠️ forge_agent(mode=register) exists but no spawn | Add spawn mode or separate forge_agent_spawn |
| forge_agent_kill | ❌ MISSING | Add: terminate agent + recover resources |
| forge_memory_write | ❌ MISSING | Add write mode to forge_memory |
| forge_memory_query | ⚠️ forge_memory(mode=recall) exists | Acceptable |

### Redundant/Noise Tools

| Tool | Issue | Recommendation |
|------|-------|---------------|
| forge_search | Dead — "REMOVED duplicate of forge_research" | Remove from epistemicForTool() references |
| forge_github (gatewayTools.ts handlers) | Dead code — handlers exist but not registered | Remove handler code or link to proxyTools.ts registration |
| forge_browser_* (6 standalone handlers) | Internal dispatch handlers — exposed via forge_browser consolidated | Acceptable as internal dispatch, not registered separately |
| forge_netdata_* (2 standalone handlers) | Internal dispatch — exposed via forge_netdata consolidated | Acceptable |
| forge_github_* (5 standalone handlers) | Dead code — registered via proxyTools forge_github | Remove dead handler code |

---

## OUTPUT C — FORGE ORDER

### P0 — Must Fix (safety/correctness)

| Action | Tool | File | Change |
|--------|------|------|--------|
| FIX | forge_search ref in epistemic | core.ts:169 | Remove dead reference to unregistered tool |
| FIX | server.tool() schema strictification | core.ts:296-298 | Apply .strict() to all server.tool() calls (currently only registerTool is wrapped) |

### P1 — Surface Hygiene

| Action | Tool | File | Change |
|--------|------|------|--------|
| REMOVE | forge_github_* dead handlers (5 functions) | gatewayTools.ts:472-607 | Remove dead code — registered via proxyTools.ts |
| UPDATE | forge_approve error message | core.ts:770-775 | Include exact route path: forge_judge_proxy |
| ADD | forge_memory write mode | proxyTools.ts:161-200 | Add mode=write for session memory persistence |

### P2 — Core Gap Fill (build missing tools)

| Action | Tool | File | Change |
|--------|------|------|--------|
| ADD | forge_probe | core.ts | Organ liveness: probe all 5 organs + latency |
| ADD | forge_status | core.ts | Active execution state: jobs, leases, sessions |
| ADD | forge_abort | core.ts | Safe stop + rollback for running executions |
| ADD | forge_agent_kill | forgeTools.ts | Terminate agent + resource recovery |
| ADD | forge_scan | core.ts | Expose SecurityScanner as MCP tool |

### P3 — Consolidation

| Action | Tool | File | Change |
|--------|------|------|--------|
| MERGE | forge_session_init → health_check session | core.ts | Reduce to one session tool |
| MERGE | forge_run → forge_execute | core.ts | forge_run is an alias — collapsible |
| DOCUMENT | Core 18 canonical tools | AGENTS.md | Define canonical surface explicitly |
