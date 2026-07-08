# 🌍 GEOX KINEMATICS — Activation Protocol

**Date:** 2026-07-08
**Session:** SEAL-dce8fd188e31429e
**Actor:** FORGE-000 (OBSERVE_ONLY)
**Sovereign:** Arif (F13)

---

## 8-Step Workflow → GEOX Tool Mapping

| Step | Name | GEOX Tool(s) | Output Type |
|------|------|---------------|-------------|
| 1 | **OBSERVE** | `geox_observe` (atlas, well_ingest, seismic_ingest) + `geox_spatial` (map_layers, spatial_intersection) | OBS — horizons, faults, thickness, facies, unconformities |
| 2 | **DATE** | `geox_interpret` (biostrat_parse, biostrat_nn_age, well_tie, sequence) + `geox_tie_preflight` + `geox_tie_receipt` | DER/INT — NN/NP/CC zones, biostrat ties, seismic markers |
| 3 | **STRAIN** | `geox_compute` (geomechanics, desurvey) + `geox_model` (3d_model) | DER — extension, shortening, uplift, subsidence, rotation |
| 4 | **MASS** | `geox_model` (basin, accommodation, routing) + `geox_compute` (petrophysics) | DER — sediment budget, carbonate budget, erosion volume |
| 5 | **RHEOLOGY** | `geox_compute` (rock_physics, geomechanics) + `geox_interpret` (physical_reality) | INT — brittle/ductile, detachment, serpentinization |
| 6 | **KINEMATICS** | `geox_model` (3d_model, routing, basin) + `geox_spatial` (spatial_intersection, block_spec) | INT — block/polygon motion through time |
| 7 | **FALSIFY** | `geox_evidence` (contradict) + `geox_interpret` (physical_reality, cognitive_rank_hypotheses) + `geox_govern` (forbidden_claims_scan) | OBS/DER — predictions vs observed thickness, fault timing, drowning, unconformity |
| 8 | **SEAL/HOLD** | `geox_claim` (seal) + `geox_govern` (claim lifecycle) | SEAL/HOLD — only if strat + structure + physics agree |

---

## Explorer Metabolism Alignment

This 8-step workflow maps to the canonical 4-phase explorer metabolism:

```
OBSERVE (Steps 1-2) → HYPOTHESIZE (Steps 3-5) → FALSIFY (Step 7) → VERIFY (Step 8)
                                        ↑
                                KINEMATICS (Step 6)
                          = the hypothesis engine
```

Steps 3-5 (STRAIN, MASS, RHEOLOGY) are the **hypothesis generation** phase —
they constrain what the kinematic model CAN do before moving blocks.

Step 6 (KINEMATICS) is the **model execution** — blocks moved through time
ONLY after strain, mass, and rheology are bounded.

Step 7 (FALSIFY) tests whether the kinematic model predicts observed geology.

Step 8 (SEAL/HOLD) is the constitutional gate.

---

## Falsification Gates (Step 7)

| Gate | Test | Pass Condition |
|------|------|----------------|
| Thickness | Predicted vs observed isopach | Δ ≤ 15% |
| Fault timing | Predicted slip vs cross-cutting relationships | Consistent |
| Carbonate drowning | Predicted subsidence rate vs production rate | Drowning reproduced |
| Clastic entry | Predicted sediment routing vs provenance | Entry point matched |
| Unconformity geometry | Predicted erosion surface vs seismic truncation | Geometry consistent |

---

## Required Inputs (pending from Arif)

- [ ] **Basin/Study Area** — which petroleum system?
- [ ] **Data available** — seismic volumes, well logs, biostrat reports?
- [ ] **Decision context** — prospect evaluation, basin screening, or academic?
- [ ] **Time horizon** — which tectonic phases to model?

---

## Status

- ✅ GEOX healthy (14 canonical tools)
- ✅ Explorer Intelligence Architecture loaded
- ✅ Session bound (SEAL-dce8fd188e31429e)
- ⏳ Awaiting basin/area specification from Arif

---

*Activation protocol. Not yet executing — needs study area.*
*DITEMPA BUKAN DIBERI*
