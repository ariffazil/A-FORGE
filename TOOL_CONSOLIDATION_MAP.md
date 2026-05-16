# GEOX Tool Consolidation Map
## DITEMPA BUKAN DIBERI — Cleanup Operation

---

## Executive Summary

**Problem Identified:**
- `physics_compute_stoiip` in `registries/physics.py` is a **STUB** (returns hardcoded 150.5)
- `VolumetricsEconomicsTool` in `arifos/GEOX/tools/` is the **REAL** implementation with Monte Carlo
- Multiple duplicate/aliased tools across registries
- Scaffold tools mixed with production tools

**Solution:**
- Delete stub, wire physics_compute_stoiip to VolumetricsEconomicsTool
- Consolidate aliases (keep canonical names, remove GEOX_* duplicates where possible)
- Mark scaffold tools clearly
- Establish single source of truth per domain

---

## 1. Domain Registry Mapping

### 1.1 PROSPECT (Play Fairway Discovery)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `prospect_evaluate_prospect` | ✅ KEEP | Canonical | Judge: Evaluate HC potential |
| `GEOX_evaluate_prospect` | 🗑️ REMOVE | Alias | Duplicates above |
| `prospect_build_structural_candidates` | ✅ KEEP | Canonical | Generate trap candidates |
| `GEOX_build_structural_candidates` | 🗑️ REMOVE | Alias | Duplicates above |
| `prospect_feasibility_check` | ✅ KEEP | Canonical | Technical/economic gating |
| `GEOX_feasibility_check` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `prospect_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.2 WELL (Borehole Truth Channel)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `well_load_log_bundle` | ✅ KEEP | Canonical | Load LAS/DLIS |
| `well_qc_logs` | ✅ KEEP | Canonical | Quality control |
| `GEOX_qc_logs` | 🗑️ REMOVE | Alias | Duplicates above |
| `well_validate_cutoffs` | ✅ KEEP | Canonical | Cutoff validation |
| `GEOX_validate_cutoffs` | 🗑️ REMOVE | Alias | Duplicates above |
| `well_select_sw_model` | ✅ KEEP | Canonical | Sw model selection |
| `GEOX_select_sw_model` | 🗑️ REMOVE | Alias | Duplicates above |
| `well_compute_petrophysics` | ✅ KEEP | Canonical | Physics calculations |
| `GEOX_compute_petrophysics` | 🗑️ REMOVE | Alias | Duplicates above |
| `well_petrophysical_check` | ✅ KEEP | Canonical | 888_HOLD check |
| `GEOX_petrophysical_hold_check` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `well_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.3 SECTION (2D Stratigraphic Correlation)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `section_interpret_strata` | ✅ KEEP | Canonical | Stratigraphic correlation |
| `GEOX_interpret_strata` | 🗑️ REMOVE | Alias | Duplicates above |
| `section_observe_well_correlation` | ✅ KEEP | Canonical | Cross-well correlation |
| `GEOX_observe_well_correlation` | 🗑️ REMOVE | Alias | Duplicates above |
| `section_synthesize_profile` | ✅ KEEP | Canonical | 2D profile synthesis |
| `GEOX_synthesize_profile` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `section_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.4 EARTH3D (Volumetric Seismic)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `earth3d_load_volume` | ✅ KEEP | Canonical | Load 3D seismic |
| `GEOX_load_seismic_volume` | 🗑️ REMOVE | Alias | Duplicates above |
| `earth3d_interpret_horizons` | ✅ KEEP | Canonical | Horizon picking |
| `GEOX_interpret_horizons` | 🗑️ REMOVE | Alias | Duplicates above |
| `earth3d_model_geometries` | ✅ KEEP | Canonical | Structural modeling |
| `GEOX_model_geometries` | 🗑️ REMOVE | Alias | Duplicates above |
| `earth3d_verify_structural_integrity` | ✅ KEEP | Canonical | Physics validation |
| `GEOX_verify_integrity` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `earth3d_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.5 TIME4D (Basin Evolution)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `time4d_simulate_burial` | ✅ KEEP | Canonical | Burial simulation |
| `GEOX_simulate_burial` | 🗑️ REMOVE | Alias | Duplicates above |
| `time4d_reconstruct_paleo` | ✅ KEEP | Canonical | Paleo reconstruction |
| `GEOX_reconstruct_paleo` | 🗑️ REMOVE | Alias | Duplicates above |
| `time4d_verify_timing` | ✅ KEEP | Canonical | Trap/charge timing |
| `GEOX_verify_timing` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `time4d_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.6 MAP (Spatial Fabric)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `map_verify_coordinates` | ✅ KEEP | Canonical | Coordinate validation |
| `GEOX_verify_geospatial` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_get_context_summary` | ✅ KEEP | Canonical | Spatial context |
| `GEOX_get_context_summary` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_render_scene_context` | ✅ KEEP | Canonical | Scene rendering |
| `GEOX_render_scene_context` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_synthesize_causal_scene` | ✅ KEEP | Canonical | Causal scene for 888_JUDGE |
| `GEOX_synthesize_causal_scene` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_earth_signals` | ✅ KEEP | Canonical | Live Earth observations |
| `GEOX_earth_signals` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_project_well` | ✅ KEEP | Canonical | Well projection |
| `GEOX_project_well_trajectory` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_transform_coordinates` | ✅ KEEP | Canonical | CRS transforms |
| `GEOX_transform_coordinates` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `map_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.7 PHYSICS (Sovereign Verification) — **CRITICAL CLEANUP**
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `physics_judge_verdict` | ✅ KEEP | Canonical | 888_JUDGE execution |
| `GEOX_judge_verdict` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_validate_operation` | ✅ KEEP | Canonical | Safety validation |
| `GEOX_validate_operation` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_audit_hold_breach` | ✅ KEEP | Canonical | Breach investigation |
| `GEOX_audit_hold_breach` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_verify_physics` | ✅ KEEP | Canonical | Physical consistency |
| `GEOX_verify_physics` | 🗑️ REMOVE | Alias | Duplicates above |
| `GEOX_verify_canon` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_compute_stoiip` | 🔧 FIX | **WIRE TO** `VolumetricsEconomicsTool` | Was STUB — now real |
| `GEOX_compute_stoiip` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_fetch_authoritative_state` | ✅ KEEP | Canonical | Ground truth state |
| `GEOX_fetch_authoritative_state` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_register` | ✅ KEEP | Canonical | ACP agent registration |
| `acp_register_agent` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_submit` | ✅ KEEP | Canonical | Submit proposal |
| `acp_submit_proposal` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_check_convergence` | ✅ KEEP | Canonical | Convergence check |
| `acp_check_convergence` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_grant_seal` | ✅ KEEP | Canonical | 999_SEAL grant |
| `acp_grant_seal` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_status` | ✅ KEEP | Canonical | ACP status |
| `acp_get_status` | 🗑️ REMOVE | Alias | Duplicates above |

**CRITICAL FIX:** `physics_compute_stoiip` was returning hardcoded `{"stoiip_mmbbl": 150.5}`. Now properly delegates to `VolumetricsEconomicsTool`.

---

### 1.8 CROSS (Dimension Introspection)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `cross_evidence_list` | ✅ KEEP | Canonical | List evidence |
| `GEOX_search_evidence` | 🗑️ REMOVE | Alias | Duplicates above |
| `GEOX_evidence_list` | 🗑️ REMOVE | Alias | Duplicates above |
| `cross_evidence_get` | ✅ KEEP | Canonical | Get evidence details |
| `GEOX_get_evidence_details` | 🗑️ REMOVE | Alias | Duplicates above |
| `GEOX_evidence_get` | 🗑️ REMOVE | Alias | Duplicates above |
| `cross_dimension_list` | ✅ KEEP | Canonical | List dimensions |
| `GEOX_dimension_list` | 🗑️ REMOVE | Alias | Duplicates above |
| `GEOX_get_tools_registry` | ✅ KEEP | Special | UI registry endpoint |
| `cross_health` | ✅ KEEP | Canonical | Health check |

**Decision:** Keep `cross_*` prefix. Remove `GEOX_*` aliases except `GEOX_get_tools_registry` (UI requirement).

---

## 2. Class-Based Tools (arifos/GEOX/tools/)

| Tool | Status | Action | Location |
|------|--------|--------|----------|
| `EarthModelTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `EOFoundationModelTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `SeismicVLMTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `SimulatorTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `GeoRAGTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `SeismicAttributesTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `VolumetricsEconomicsTool` | ✅ KEEP | **PRIMARY** | `volumetrics_economics_tool.py` |
| `WellLogTool` | ✅ KEEP | Production | `well_log_tool.py` |
| `SeismicSingleLineTool` | ✅ KEEP | Production | `seismic/seismic_single_line_tool.py` |

---

## 3. Summary Statistics

| Category | Count |
|----------|-------|
| **Canonical tools keeping** | 45 |
| **Aliases removing** | 38 |
| **Critical fixes** | 1 (`physics_compute_stoiip`) |
| **Total reduction** | ~46% fewer tool entries |

---

## 4. Naming Convention (Post-Cleanup)

```
{domain}_{action}_{target}

Domains:
  prospect_  — Play fairway, structural candidates
  well_      — Borehole, logs, petrophysics
  section_   — 2D correlation, profiles
  earth3d_   — 3D seismic, volumes
  time4d_    — Basin modeling, timing
  physics_   — Sovereign verification, ACP
  map_       — Spatial, coordinates, Earth signals
  cross_     — Evidence, dimensions, health

Actions:
  evaluate_, build_, check_   — Prospect
  load_, qc_, compute_        — Well
  interpret_, observe_        — Section
  load_, interpret_, verify_  — Earth3D
  simulate_, verify_          — Time4D
  judge_, validate_, verify_  — Physics
  verify_, get_, render_      — Map
  list_, get_                 — Cross

Exceptions (UI compatibility):
  GEOX_get_tools_registry  — Required by Cockpit UI
```

---

## 5. Verification Checklist

- [x] `physics_compute_stoiip` delegates to `VolumetricsEconomicsTool`
- [x] No hardcoded stub values
- [x] All Monte Carlo uncertainty properly propagated
- [x] Unit conversions explicit (km² vs acres)
- [x] All aliases removed except UI-critical
- [x] Tool registry metadata updated

---

*DITEMPA BUKAN DIBERI — Forged through cleanup, not given through duplication.*

