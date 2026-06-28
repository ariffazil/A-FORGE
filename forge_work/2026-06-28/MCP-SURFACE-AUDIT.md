# MCP SURFACE AUDIT — Full Federation Tool/Resource/Prompt Map
> **2026-06-28** · 6/6 Organs Alive · Auditor: FORGE (000Ω)

---

## EXECUTIVE SUMMARY

| Organ | Tools | Resources | Resource Templates | Status | Risk |
|-------|-------|-----------|-------------------|--------|------|
| **arifOS** :8088 | 8 (+0 hidden) | 140+ | 60+ | ✅ CLEAN | LOW |
| **GEOX** :8081 | 30 canonical (+31 hidden) | 19 | 9 | ⚠️ NAMING CHAOS | MEDIUM |
| **WEALTH** :18082 | 21 | 16 | 0 | ✅ CLEAN | LOW |
| **WELL** :18083 | 23 somatic (+77 hidden) | 29 | 3 | ⚠️ HIDDEN SURFACE | MEDIUM |
| **A-FORGE** :7072 | UNKNOWN | UNKNOWN | UNKNOWN | ❌ COULDN'T LIST | HIGH |
| **AAA** :3001 | UNKNOWN | UNKNOWN | UNKNOWN | ❌ NOT AUDITED | LOW |

---

## 1. arifOS (8088) — Constitutional Kernel

### Tools (8)
| # | Tool | Modes | Classification |
|---|------|-------|---------------|
| 1 | `arif_init` | init, light, resume, validate, epoch_open, epoch_seal, opt_out, opt_out_profiling | METABOLIC |
| 2 | `arif_observe` | search, hybrid_discovery, ingest, compass, atlas, entropy_dS, vitals | OBSERVE |
| 3 | `arif_think` | reason, reflect, verify, critique, axioms, plan, plan_review, plan_approve, refactor_plan, metabolize | REASON |
| 4 | `arif_route` | intent routing | ROUTE |
| 5 | `arif_judge` | judge, compare, history, explain, floor_status, witness_consensus | JUDGE |
| 6 | `arif_act` | execution gate (requires prior SEAL) | FORGE |
| 7 | `arif_seal` | seal, verify, ledger, changelog, audit | SEAL |
| 8 | `hermes_vault_query` | recent, by_session, by_tool, by_event_id | UTILITY |

### Resources (140+)
- Governance: constitution, doctrine, identity, jurisdiction, memory, civilization, trinity
- Operational: bootstrap, quickstart, vitals, seal-readiness, MCP alignment
- Skills: 40+ skill manifests + SKILL.md files (a2a-federation-builder, agentic-builder, arifos-*, geox-*, wealth-*, well-*, mcp-*, iron-shell-render, etc.)
- Data: reality_state, resource_index, resource_audit, human_metabolized
- Tree777: concepts, scars, skills indexed
- Sovereign: sovereign_file_resource (index, soul-map, scars, family, floors, organs, etc.)
- Vault: VAULT999 entry reader (judge, heart, sense, outcomes, governance)
- Runner: policy, receipt
- Web: source, receipt, contrast, void

### Resource Templates (60+)
- Skill file access (all 40+ skills)
- Tool self-model, composition matrix, permissions, domain boundaries
- Witness log/stats
- Vault reader templates

### Verdict: ✅ CLEAN — well-organized, consistent naming, comprehensive documentation

---

## 2. GEOX (8081) — Earth Intelligence

### Tools (30 canonical + 31 hidden)

**Canonical (14 geox_*):**
| # | Tool | Domain |
|---|------|--------|
| 1 | `geox_well_ingest` | earth.well |
| 2 | `geox_well_qc` | earth.well |
| 3 | `geox_well_desurvey` | earth.well |
| 4 | `geox_petrophysics` | earth.petrophysics |
| 5 | `geox_sequence` | earth.stratigraphy |
| 6 | `geox_seismic_ingest` | earth.seismic |
| 7 | `geox_seismic_compute` | earth.seismic |
| 8 | `geox_seismic_interpret` | earth.seismic |
| 9 | `geox_vision` | earth.perception |
| 10 | `geox_subsurface_model` | earth.model |
| 11 | `geox_geomechanics` | earth.mechanics |
| 12 | `geox_basin` | earth.basin |
| 13 | `geox_deep_time_state` | earth.deep_time |
| 14 | `geox_surface_status` | earth.general |

**Governance (3 geox_*):**
| # | Tool | Domain |
|---|------|--------|
| 15 | `geox_claim` | governance.claims |
| 16 | `geox_evidence` | governance.evidence |
| 17 | `geox_prospect` | governance.prospect |

> ⚠️ Tool #30 (`geox_doctrine`) is in the canonical list but may not be registered.

**EGS Module — WRONG PREFIX (13 egs_*):**
| # | Tool | Domain | Should Be |
|---|------|--------|-----------|
| 18 | `egs_query_entity` | earth.general | `geox_egs_query_entity` |
| 19 | `egs_query_claim` | earth.general | `geox_egs_query_claim` |
| 20 | `egs_query_uncertainty` | earth.general | `geox_egs_query_uncertainty` |
| 21 | `egs_query_provenance` | earth.general | `geox_egs_query_provenance` |
| 22 | `egs_claim_create` | earth.general | `geox_egs_claim_create` |
| 23 | `egs_claim_challenge` | earth.general | `geox_egs_claim_challenge` |
| 24 | `egs_evidence_attach` | earth.general | `geox_egs_evidence_attach` |
| 25 | `egs_evidence_reason` | earth.general | `geox_egs_evidence_reason` |
| 26 | `egs_seismic_compute` | earth.general | `geox_egs_seismic_compute` |
| 27 | `egs_rock_physics` | earth.general | `geox_egs_rock_physics` |
| 28 | `egs_data_qc_bundle` | earth.general | `geox_egs_data_qc_bundle` |
| 29 | `egs_scenario_audit` | earth.general | `geox_egs_scenario_audit` |

### RED FLAGS

| Issue | Severity | Detail |
|-------|----------|--------|
| **PREFIX VIOLATION** | MEDIUM | 13 EGS tools lack `geox_` prefix. Violates `geox_*` convention. AI agents see two separate families. |
| **DUPLICATE NAMING** | LOW | `egs_seismic_compute` vs `geox_seismic_compute` — same capability, different prefixes |
| **HIDDEN TOOLS** | MEDIUM | 31 extra tools registered in FastMCP but NOT in canonical surface — what are they? |
| **geox_doctrine** | LOW | Listed in canonical but may be judgment-only (arifOS lane) |

### Resources (19)
geox:// artifacts_index, basin profiles, basins_index, capabilities, claims graph/index, identity, literature index/papers, reality_context, resources_index + sub-indices (ontology, playbooks, prompts, schemas), surface_truth, tree777_index, profile_status, apps registry

### Resource Templates (9)
cube bricks/manifest, render slices/surfaces, resource access, tree777 concepts/scars/skills

### Verdict: ⚠️ NAMING CHAOS — EGS prefix inconsistency creates two tool families for one organ

---

## 3. WEALTH (18082) — Capital Intelligence

### Tools (21)
| # | Tool | Classification |
|---|------|---------------|
| 1 | `wealth_agent_path` | ROUTE |
| 2 | `wealth_asymmetry_check` | ANALYZE |
| 3 | `wealth_beautiful_mouse_scan` | ANALYZE |
| 4 | `wealth_capture_scan` | ANALYZE |
| 5 | `wealth_collapse_signature_scan` | ANALYZE |
| 6 | `wealth_compute_emv` | COMPUTE |
| 7 | `wealth_compute_evoi` | COMPUTE |
| 8 | `wealth_compute_irr` | COMPUTE |
| 9 | `wealth_compute_npv` | COMPUTE |
| 10 | `wealth_confluence_check` | ANALYZE |
| 11 | `wealth_conservation_check` | COMPUTE |
| 12 | `wealth_fiscal_breakeven` | COMPUTE |
| 13 | `wealth_flow_check` | COMPUTE |
| 14 | `wealth_market_data` | OBSERVE |
| 15 | `wealth_monte_carlo_simulate` | COMPUTE |
| 16 | `wealth_omni_wisdom` | REASON |
| 17 | `wealth_personal_finance` | COMPUTE |
| 18 | `wealth_power_audit` | ANALYZE |
| 19 | `wealth_runway_check` | COMPUTE |
| 20 | `wealth_stock_analysis` | ANALYZE |
| 21 | `wealth_wisdom_evaluate` | REASON |

### Resources (16)
affordance/contracts, handoff/arifos-schema, canon/002-human-law, domains/index, federation/contract, glossary, health, market/sources, prompts/index (7 prompts), reality/context, replay/receipt-schema, risk/thresholds, runtime/policy, schema, tools/registry

### Resource Templates: 0

### Verdict: ✅ CLEAN — consistent `wealth_*` prefix, well-organized domains, comprehensive resources. Missing resource templates (lower priority).

---

## 4. WELL (18083) — Human Readiness

### Tools — Somatic (23, public surface)
| # | Tool | Classification |
|---|------|---------------|
| 1 | `well_health_check` | OBSERVE |
| 2 | `well_registry_status` | OBSERVE |
| 3 | `well_system_registry_status` | OBSERVE |
| 4 | `well_classify_substrate` | ANALYZE |
| 5 | `well_detect_boundary` | ANALYZE |
| 6 | `well_measure_gradient` | ANALYZE |
| 7 | `well_assess_metabolism` | ANALYZE |
| 8 | `well_assess_homeostasis` | ANALYZE |
| 9 | `well_check_repair` | ANALYZE |
| 10 | `well_validate_vitality` | ANALYZE |
| 11 | `well_assess_livelihood` | ANALYZE |
| 12 | `well_assess_reliability` | ANALYZE |
| 13 | `well_compute_metabolic_flux` | COMPUTE |
| 14 | `well_assess_sovereign_entropy` | ANALYZE |
| 15 | `well_guard_dignity` | ANALYZE |
| 16 | `well_trace_lineage` | OBSERVE |
| 17 | `well_medical_boundary` | GATE |
| 18 | `well_13_signal_coverage` | ⚠️ DEPRECATED → use `well_signal_coverage` |
| 19 | `well_attest_to_kernel` | GATE |
| 20 | `well_handoff_dignity_to_arifos` | ROUTE |
| 21 | `well_handoff_livelihood_to_wealth` | ROUTE |
| 22 | `well_classify_state` | ANALYZE |
| 23 | `mcp_health_check` | ALIAS → `well_health_check` |

### Tools — Autonomic (77, hidden from surface)
`well_000_init`, `well_000_ops`, `well_111_sense`, `well_222_fetch`, `well_333_mind`, `well_444_gateway`, `well_444_kernel`, `well_444_reply`, `well_555_memory`, `well_666_heart`, `well_777_forge`, `well_888_judge`, `well_999_vault`, plus 64 more (machine health, decision classify, forge mode, recovery, etc.)

### Canonical Aliases
`well_000_init` → `well_classify_substrate`,
`well_111_sense` → `well_classify_substrate`,
`well_222_fetch` → `well_measure_gradient`,
`well_333_mind` → `well_assess_metabolism`,
`well_444_kernel` → `well_detect_boundary`,
`well_555_memory` → `well_trace_lineage`,
`well_666_heart` → `well_assess_homeostasis`,
`well_777_forge` → `well_check_repair`,
`well_888_judge` → `well_validate_vitality`,
`well_999_vault` → `well_trace_lineage`,
`well_000_ops` → `well_assess_reliability`

### Resources (29)
causal_dag, events/recent, floors, readiness, schema, sovereign_entropy, state/arif, substrate/registry, telemetry, vitals, bio_signals, bridges (arifos, geox, wealth), chemistry_glue, consent_integrity, coupling, decision_classes, doctrine, flux, human/machine substrate, identity, info_asymmetry, interaction_substrate, physics_laws, registry, tools/canon_map, transport_loop/stages

### RED FLAGS

| Issue | Severity | Detail |
|-------|----------|--------|
| **HIDDEN SURFACE** | MEDIUM | 77 autonomic tools hidden. AI agents can't discover them — but they exist in code. What do they do? |
| **DEPRECATED TOOL** | LOW | `well_13_signal_coverage` — still listed, should be removed or replaced |
| **ALIAS OVERLAP** | LOW | `mcp_health_check` = `well_health_check` — legacy alias clutter |
| **REGISTRY DEGRADED** | LOW | `registry_truth: DEGRADED` — identity_valid=false |

### Verdict: ⚠️ LARGE HIDDEN SURFACE — 77 autonomic tools create opacity. Plus 1 deprecated tool still listed.

---

## 5. A-FORGE (7072) — Execution Shell

### Tools: ❌ COULDN'T AUDIT
- MCP `/tools/list` on :7072 returned nothing
- API `/api/tools` on :7071 returned nothing
- Service is alive and healthy (health check passes)

### Expected tools (per AGENTS.md):
`forge_dry_run`, `forge_approve`, `forge_execute`, `forge_run`, `forge_health_check`, `forge_systemctl`, `forge_journalctl`, `forge_filesystem`, `forge_shell`, `forge_git`, `forge_docker`, `forge_browser`, `forge_lease_request`, `forge_lease_release`, `forge_health`, `forge_surface_status`

### Verdict: ❌ CONCERN — MCP gateway doesn't expose tool list. This is a runtime geometry gap — AI agents can't discover what A-FORGE offers.

---

## 6. AAA (3001) — Control Plane

### Status: NOT AUDITED
- Service alive on :3001
- MCP tools not queried — AAA is the cockpit, not a domain organ

---

## CROSS-CUTTING FINDINGS

### 🔴 Naming Chaos — GEOX EGS
13 tools registered as `egs_*` instead of `geox_egs_*`. This breaks the federation naming convention. AI agents see:
- `geox_seismic_compute` (canonical)  
- `egs_seismic_compute` (non-canonical)
Both exist. Both do similar things. LLM routing becomes ambiguous.

**Fix:** Rename all `egs_*` → `geox_egs_*` in registry.py and server.py.

### 🟡 Hidden Surface Bloat — GEOX + WELL
- GEOX: 31 tools hidden from canonical surface
- WELL: 77 autonomic tools hidden
- Total: 108 hidden tools across 2 organs

These tools exist in code but aren't discoverable. If an AI agent accidentally calls one (via MCP introspection bypass), behavior becomes unpredictable.

**Recommendation:** Audit and either canonicalize or remove. Every tool should be either PUBLIC or DELETED.

### 🟡 Deprecated Tool — WELL
`well_13_signal_coverage` marked [DEPRECATED]. Should point to replacement or be removed.

### 🟡 Missing Tool Discovery — A-FORGE
A-FORGE MCP doesn't return a tool list. This is the biggest runtime geometry gap — agents can't know what execution tools are available.

### 🟢 Clean Organs
- **arifOS**: 8 tools, consistent `arif_*` prefix, comprehensive 140+ resources ✅
- **WEALTH**: 21 tools, consistent `wealth_*` prefix, well-organized ✅

---

## REDUNDANCY ANALYSIS

| Capability | arifOS | GEOX | WEALTH | WELL | Overlap? |
|-----------|--------|------|--------|------|----------|
| Search web | `arif_observe(search)` | — | — | — | ✅ Single source |
| Seismic compute | — | `geox_seismic_compute` | — | — | ⚠️ ALSO `egs_seismic_compute` |
| Rock physics | — | `egs_rock_physics` | — | — | ONLY `egs_*` — no `geox_` version |
| Claim operations | — | `geox_claim` + `egs_claim_*` | — | — | ⚠️ Two claim surfaces |
| NPV/IRR/EMV | — | — | `wealth_compute_*` | — | ✅ Single source |
| Health check | `arif_observe(vitals)` | `geox_surface_status` | `wealth://health` | `well_health_check` | ✅ Each organ owns its health |
| Registry/status | — | `geox_surface_status` | `wealth://tools/registry` | `well_registry_status` | ✅ Per-organ, no overlap |
| Capital wisdom | — | — | `wealth_omni_wisdom` + `wealth_wisdom_evaluate` | — | ⚠️ Two wisdom tools — intentional? |

### True Redundancy
Only **one** confirmed redundancy: GEOX has `geox_seismic_compute` AND `egs_seismic_compute`. All other overlaps are intentional per-organ surfaces.

---

## RECOMMENDATIONS (Priority Order)

| P | Action | Organ | Effort |
|---|--------|-------|--------|
| **P1** | Rename `egs_*` → `geox_egs_*` (13 tools) | GEOX | 30 min |
| **P1** | Fix A-FORGE MCP tool listing | A-FORGE | 1 hr |
| **P2** | Audit 31 hidden GEOX tools — canonicalize or delete | GEOX | 2 hrs |
| **P2** | Audit 77 hidden WELL autonomic tools | WELL | 3 hrs |
| **P2** | Remove deprecated `well_13_signal_coverage` | WELL | 15 min |
| **P3** | Add resource templates to WEALTH | WEALTH | 1 hr |
| **P3** | Audit AAA surface | AAA | 30 min |

---

## LLM METABOLISM IMPACT

For an AI agent consuming this MCP surface, the current state creates these friction points:

1. **GEOX ambiguity**: Must choose between `geox_seismic_compute` and `egs_seismic_compute` — wastes tokens on uncertainty
2. **A-FORGE blindness**: Can't discover execution tools — forced to guess or read docs manually
3. **Hidden tools everywhere**: 108 tools exist but aren't visible — risk of phantom tool calls
4. **Deprecated clutter**: `well_13_signal_coverage` adds noise to tool selection

Clean resolution: ~1 day of focused cleanup work across 3 organs.

---

*DITEMPA BUKAN DIBERI — Audit complete. Surface truth observed. Chaos mapped.*
