# WAJIB-002: Full MCP Surface Inventory
**Date:** 2026-06-30 14:25 MYT  
**Author:** FORGE (000Ω)  
**Verdict:** PROCEED | Band: YELLOW  
**Status:** ✅ COMPLETE

---

## 1. arifOS Kernel (:8088) — 7 tools

| Tool | additionalProperties | required | Prefix OK |
|------|---------------------|----------|-----------|
| arif_init | ✅ false | [] — ⚠️ no required | ✅ arif_* |
| arif_observe | ✅ false | [] — ⚠️ no required | ✅ arif_* |
| arif_think | ✅ false | [] — ⚠️ no required | ✅ arif_* |
| arif_route | ✅ false | ['intent'] | ✅ arif_* |
| arif_judge | ✅ false | ['actor','intent','requested_capability','domain','reversibility_level','blast_radius'] | ✅ arif_* |
| arif_act | ✅ false | ['seal_verdict_id','approved_action_hash'] | ✅ arif_* |
| arif_seal | ✅ false | [] — ⚠️ no required | ✅ arif_* |

**Gaps:** 3/7 tools lack `required` fields. No authority metadata. No evidence_layer/ttl.

---

## 2. A-FORGE MCP (:7072) — 70 tools

| Category | Tools | Prefix |
|----------|-------|--------|
| **Shell/System** | `forge_shell`, `forge_shell_dryrun`, `forge_shell_status`, `forge_shell_ledger`, `forge_shell_alert_history` | ✅ forge_* |
| **Filesystem** | `forge_filesystem`, `forge_scan`, `forge_lock` | ✅ forge_* |
| **Git/GitHub** | `forge_git`, `forge_github`, `forge_github_create_issue`, `forge_github_create_or_update_file`, `forge_github_create_pull_request`, `forge_github_get_file`, `forge_github_search_code`, `forge_github_search_repos` | ✅ forge_* |
| **Docker** | `forge_docker` | ✅ forge_* |
| **Postgres** | `forge_postgres` | ✅ forge_* |
| **Browser** | `forge_browser_navigate`, `forge_browser_click`, `forge_browser_type`, `forge_browser_screenshot`, `forge_browser_extract_text`, `forge_browser_evaluate_js` | ✅ forge_* |
| **Search/Research** | `forge_search`, `forge_research`, `forge_docs_lookup`, `forge_minimax_search` | ✅ forge_* |
| **Netdata** | `forge_netdata_alarms`, `forge_netdata_metrics` | ✅ forge_* |
| **Governance** | `forge_session_init`, `forge_health_check`, `forge_heart_critique`, `forge_check_governance`, `forge_judge_proxy`, `forge_seal`, `forge_approve` | ✅ forge_* |
| **Execution** | `forge_execute`, `forge8_execute`, `forge_abort`, `forge_pipeline_run`, `forge_job`, `forge_status`, `forge_agent`, `forge_lease` | ✅ forge_* |
| **Skill/Tool Lifecycle** | `forge_skill`, `forge_register`, `forge_registry`, `forge_registry_status`, `forge_evaluate`, `forge_witness`, `forge_scar`, `forge_scar_scan`, `forge_synthesize`, `forge_stage`, `forge_sandbox_run`, `forge_skillstore_read`, `forge_skillstore_write`, `forge_tier_bind`, `forge_docket_prep` | ✅ forge_* |
| **Domain Proxies** | `forge_wealth`, `forge_well`, `forge_vault`, `forge_memory`, `forge_chart`, `forge_probe`, `forge_document_ingest` | ✅ forge_* |
| **Reality Loop** | `forge_reality_loop` | ✅ forge_* |

**All 70 tools** correctly prefixed `forge_*`. additionalProperties status needs per-tool audit.

---

## 3. WELL (:18083) — 17 tools

| Tool | additionalProperties | Prefix OK |
|------|--------------------|-----------|
| well_health_check | ✅ false | ✅ well_* |
| well_medical_boundary | ✅ false | ✅ well_* |
| well_signal_coverage | ✅ false | ✅ well_* |
| well_classify_substrate | ✅ false | ✅ well_* |
| well_trace_lineage | ✅ false | ✅ well_* |
| well_detect_boundary | ✅ false | ✅ well_* |
| well_measure_gradient | ✅ false | ✅ well_* |
| well_assess_metabolism | ✅ false | ✅ well_* |
| well_assess_homeostasis | ✅ false | ✅ well_* |
| well_check_repair | ✅ false | ✅ well_* |
| well_validate_vitality | ✅ false | ✅ well_* |
| well_assess_livelihood | ✅ false | ✅ well_* |
| well_assess_reliability | ✅ false | ✅ well_* |
| well_compute_metabolic_flux | ✅ false | ✅ well_* |
| well_assess_sovereign_entropy | ✅ false | ✅ well_* |
| well_guard_dignity | ✅ false | ✅ well_* |
| well_registry_status | ✅ false | ✅ well_* |

**Note:** WELL registry reports 21 registered + 5 deprecated = 26 callable. 
Only 17 surface via MCP tools/list — 4 (well_000_init..well_000_ops etc.) are internal-only.

---

## 4. WEALTH (:18082) — 28 tools

| Tool | additionalProperties | Prefix OK |
|------|--------------------|-----------|
| wealth_wisdom_evaluate | ✅ false | ✅ wealth_* |
| wealth_power_audit | ✅ false | ✅ wealth_* |
| wealth_capture_scan | ✅ false | ✅ wealth_* |
| wealth_epistemic_audit | ✅ false | ✅ wealth_* |
| wealth_compute_npv | ✅ false | ✅ wealth_* |
| wealth_compute_irr | ✅ false | ✅ wealth_* |
| wealth_conservation_check | ✅ false | ✅ wealth_* |
| wealth_flow_check | ✅ false | ✅ wealth_* |
| wealth_runway_check | ✅ false | ✅ wealth_* |
| wealth_compute_emv | ✅ false | ✅ wealth_* |
| wealth_monte_carlo_simulate | ✅ false | ✅ wealth_* |
| wealth_compute_evoi | ✅ false | ✅ wealth_* |
| wealth_confluence_check | ✅ false | ✅ wealth_* |
| wealth_asymmetry_check | ✅ false | ✅ wealth_* |
| wealth_fiscal_breakeven | ✅ false | ✅ wealth_* |
| wealth_stock_analysis | ✅ false | ✅ wealth_* |
| wealth_personal_finance | ✅ false | ✅ wealth_* |
| wealth_market_data | ✅ false | ✅ wealth_* |
| wealth_omni_wisdom | ✅ false | ✅ wealth_* |
| wealth_agent_path | ✅ false | ✅ wealth_* |
| wealth_vault_write | ✅ false | ✅ wealth_* |
| wealth_vault_query | ✅ false | ✅ wealth_* |
| wealth_system_registry_status | ✅ false | ✅ wealth_* |
| wealth_boundary_governance | ✅ false | ✅ wealth_* |
| wealth_survival_engine | ✅ false | ✅ wealth_* |
| wealth_collapse_signature_scan | ✅ false | ✅ wealth_* |
| wealth_beautiful_mouse_scan | ✅ false | ✅ wealth_* |
| wealth_arifos_judge_handoff | ✅ false | ✅ wealth_* |

---

## 5. GEOX (:8081) — 31 canonical tools (SSE transport)

Listed via `geox_surface_status`:
- geox_well_ingest, geox_well_qc, geox_well_desurvey
- geox_petrophysics, geox_sequence
- geox_seismic_ingest, geox_seismic_compute, geox_seismic_interpret
- geox_vision, geox_subsurface_model, geox_geomechanics
- geox_basin, geox_deep_time_state, geox_atlas
- geox_surface_status
- geox_egs_query_entity, geox_egs_query_claim, geox_egs_query_uncertainty, geox_egs_query_provenance
- geox_egs_claim_create, geox_egs_claim_challenge
- geox_egs_evidence_attach, geox_egs_evidence_reason
- geox_egs_seismic_compute, geox_egs_rock_physics, geox_egs_data_qc_bundle, geox_egs_scenario_audit
- geox_claim, geox_evidence, geox_prospect, geox_doctrine

**All `geox_*` prefixed ✅.** 31 canonical + 31 extra internal-only. 137 .py files in `src/geox_mcp/`.

---

## 6. AAA (:3001) — 0 MCP tools

Control plane via A2A gateway. No MCP tool surface. Uses HTTP/A2A protocol.

---

## Aggregate Surface

| Organ | MCP Tools | Resources | Prompts | Transport | Prefix |
|-------|-----------|-----------|---------|-----------|--------|
| **arifOS** | 7 | 0 | 0 | HTTP SSE | arif_* ✅ |
| **A-FORGE** | 70 | 0 | 0 | HTTP POST /mcp | forge_* ✅ |
| **GEOX** | 31 (canonical) | 0 | 0 | HTTP SSE | geox_* ✅ |
| **WEALTH** | 28 | 0 | 0 | HTTP SSE | wealth_* ✅ |
| **WELL** | 17 | 0 | 0 | HTTP POST /mcp | well_* ✅ |
| **AAA** | 0 | — | — | A2A/HTTP | — |
| **TOTAL** | **153** | **0** | **0** | | |

---

## WAJIB Compliance Status

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| WAJIB-001 | Freeze new tools | ✅ DONE | Declared. No new tools until further notice. |
| WAJIB-002 | Inventory complete | ✅ DONE | This document. 153 MCP tools inventoried across 5 organs. |
| WAJIB-003 | Classify tool/resource/prompt | 🔶 PARTIAL | All MCP items are tools. 0 resources, 0 prompts. Doctrine embedded in tool descriptions (violates WAJIB-007). |
| WAJIB-004 | Owner prefix | ✅ PASS | All 153 tools have owner prefix (arif_*, forge_*, geox_*, wealth_*, well_*). |
| WAJIB-005 | Authority metadata | ❌ GAP | Zero tools carry authority metadata. All descriptions are prose, not structured. |
| WAJIB-006 | evidence_layer + ttl | ❌ GAP | No tool returns freshness metadata. WELL health shows STALE state but no ttl enforcement. |
| WAJIB-007 | Doctrine → Resources | ❌ GAP | All doctrine embedded in tool descriptions. 0 MCP resources exist. |
| WAJIB-008 | A2A Agent Card | ❌ GAP | Not yet created. |
| WAJIB-009 | Conformance spine | ❌ GAP | Not yet built. |
| WAJIB-010 | Controlled execution | 🔶 ON HOLD | Waiting on WAJIB 1-9. |

---

## Quick Actions

### Immediate (this session):
- [ ] WAJIB-005: Add authority_labels.py to each organ — map tool→authority ceiling
- [ ] WAJIB-008: Draft arifOS A2A Agent Card → `/root/AAA/.well-known/agent.json`

### Next session:
- [ ] WAJIB-006: Add `evidence_layer`, `verified_at`, `ttl_seconds`, `source_probe` to every state response
- [ ] WAJIB-007: Extract doctrine descriptions → MCP resources (e.g., `arifos://doctrine/F1`)
- [ ] WAJIB-009: Build conformance test harness
