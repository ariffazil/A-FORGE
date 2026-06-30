# WAJIB-005: Authority Labels — MCP Tool Classification
**Date:** 2026-06-30 | **Author:** FORGE  
**Status:** DRAFT for F13 ratification

---

## Authority Levels

| Level | Label | Meaning | Autonomous? |
|-------|-------|---------|-------------|
| L0 | OBSERVE_ONLY | Read, search, probe, measure | ✅ Yes |
| L1 | PREPARE_ONLY | Draft, compute, simulate, stage | ⚠️ Must not commit |
| L2 | EXECUTE_REVERSIBLE | Git commit, deploy non-prod, shell | ✅ With lease |
| L3 | EXECUTE_HIGH_IMPACT | Production deploy, Caddy reload | ❌ 888_HOLD |
| L4 | F13_REQUIRED | Vault write, irreversible mutation | ❌ F13 approval |
| L5 | BLOCKED | Never callable by agent | 🚫 Hard block |

---

## arifOS (7 tools)

| Tool | Current | Should Be | Reason |
|------|---------|-----------|--------|
| arif_init | OBSERVE_ONLY | L0 | Session bootstrap, no mutation |
| arif_observe | OBSERVE_ONLY | L0 | Read-only sensing |
| arif_think | OBSERVE_ONLY | L0 | Internal reasoning |
| arif_route | OBSERVE_ONLY | L0 | Intent routing |
| arif_judge | OBSERVE_ONLY | L2 | Produces verdict structure, no mutation |
| arif_act | OBSERVE_ONLY | L4 | F13_REQUIRED — requires prior SEAL |
| arif_seal | OBSERVE_ONLY | L4 | F13_REQUIRED — irreversible vault write |

---

## A-FORGE (70 tools)

| Tool Group | Should Be | Reason |
|-----------|-----------|--------|
| forge_health_check, forge_probe, forge_search, forge_research, forge_docs_lookup | L0 | Read-only |
| forge_filesystem (read), forge_git (read), forge_postgres (read), forge_netdata_*, forge_browser_*, forge_github (read), forge_chart | L0 | Read-only |
| forge_filesystem (write)*, forge_shell*, forge_git (commit)*, forge_docker*, forge_postgres (write)* | L2 | Requires lease |
| forge_execute, forge_pipeline_run, forge_job | L2 | Requires lease |
| forge_skill, forge_register, forge_seal | L4 | Skill creation + seal = F13 |
| forge_execute_sealed | L4 | F13_REQUIRED |
| forge_approve | L5 | BLOCKED — A-FORGE cannot self-authorize |

*\*Mutating modes require mode-level gating, not tool-level.*

---

## GEOX (31 canonical tools)

| Tool Group | Should Be | Reason |
|-----------|-----------|--------|
| geox_basin, geox_deep_time_state, geox_atlas | L0 | Read-only earth data |
| geox_well_ingest, geox_well_qc, geox_well_desurvey | L0 | Evidence computation |
| geox_petrophysics, geox_sequence, geox_seismic_*, geox_geomechanics | L0 | Computation |
| geox_vision | L0 | Perception |
| geox_egs_query_* | L0 | Read-only queries |
| geox_egs_claim_create, geox_egs_claim_challenge, geox_egs_evidence_attach | L0 | Claim creation (evidence-only) |
| geox_evidence, geox_surface_status | L0 | Evidence/surface |
| geox_prospect | L1 | Risk computation — advisory only |
| geox_doctrine | L0 | Doctrine reference |

---

## WEALTH (28 tools)

| Tool Group | Should Be | Reason |
|-----------|-----------|--------|
| wealth_compute_npv/irr/emv/evoi | L0 | Pure computation |
| wealth_conservation/flow/runway | L0 | Balance sheet compute |
| wealth_market_data | L0 | External data fetch |
| wealth_stock_analysis | L0 | Read-only analysis |
| wealth_personal_finance | L0 | Read-only |
| wealth_omni_wisdom | L1 | Synthesis — advisory |
| wealth_power_audit, wealth_capture_scan, wealth_epistemic_audit | L0 | Audit |
| wealth_collapse_signature_scan, wealth_beautiful_mouse_scan | L0 | Pattern detection |
| wealth_boundary_governance | L1 | Governance check |
| wealth_vault_query | L0 | Read-only query |
| wealth_vault_write | L4 | F13_REQUIRED — immutable ledger |
| wealth_arifos_judge_handoff | L2 | Prepares verdict for judge |
| wealth_survival_engine | L0 | Computation |
| wealth_fiscal_breakeven | L0 | Computation |
| wealth_monte_carlo_simulate | L0 | Simulation |
| wealth_confluence_check, wealth_asymmetry_check | L0 | Statistical |
| wealth_agent_path | L0 | Routing |

---

## WELL (17 tools)

| Tool | Should Be | Reason |
|------|-----------|--------|
| well_health_check, well_registry_status | L0 | Read-only |
| well_medical_boundary | L0 | Boundary notice |
| well_classify_substrate, well_detect_boundary, well_measure_gradient | L0 | Classification |
| well_trace_lineage | L0 | Read-only |
| well_assess_metabolism, well_assess_homeostasis, well_assess_livelihood, well_assess_reliability | L0 | Read-only assessment |
| well_validate_vitality, well_check_repair | L0 | Pre-flight check |
| well_compute_metabolic_flux | L0 | Computation |
| well_assess_sovereign_entropy | L0 | Measurement |
| well_guard_dignity | L0 | Boundary guard |
| well_signal_coverage | L0 | Audit |
