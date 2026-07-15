# 🌍 GEOX Kinematics — Deep Research & Activation Protocol

**Date:** 2026-07-08  
**Session:** SEAL-dce8fd188e31429e  
**Actor:** FORGE-000 (OBSERVE_ONLY)  
**Sovereign:** Arif (F13)  
**Verdict:** HOLD  
**Band:** ORANGE  

---

## STATUS: HOLD

**Reason:**  
The static GEOX stack is sufficient for current screening, evidence synthesis, seismic interpretation, prospect evaluation, and claim governance.

Kinematics is not shelved permanently, but it must not be activated without calibrated basin-history inputs. Required activation inputs are: stratigraphic ages, horizon surfaces, fault timing, well tops, velocity/depth anchors, thermal calibration, source-rock kinetics, erosion events, and uncertainty ranges.

**Activation threshold:**  
Proceed only when the project question depends on timing: source maturity, trap formation, migration, uplift, breach, pressure, or charge risk.

**Default:**  
Use static GEOX unless timing changes the decision.

---

## STATUS CLARIFICATION — 2026-07-09

**Kinematic physics kernels exist in the GEOX codebase**, including McKenzie rift kinematics, backstripping/decompaction, and maturity kinetics.

However, these kernels are **not yet exposed as a unified governed MCP endpoint**. Current blockage is therefore not conceptual absence, but **membrane exposure** and **dispatcher/Pydantic integration**.

```text
GEOX kinematic kernels:      EXIST
MCP callable unified endpoint: MISSING / NOT EXPOSED
Dispatcher/Pydantic path:      BLOCKED
Calibration packet:            MISSING FROM ARIF
Operational verdict:           HOLD
```

**Two-key activation model:**

1. **A-FORGE key:** expose the hidden kernels through one governed MCP endpoint.
2. **Arif/F13 key:** provide calibration data and approve timing-dependent activation.

Without both keys, kinematics stays **HOLD**.

**Promote it from "pending idea" to "forged-but-unexposed engine under HOLD."**

---

## 1. What "kinematics" means inside GEOX

In geoscience, **kinematics** describes motion without explaining the forces. For GEOX, it means tracking basin geometry through geological time: horizon positions, fault slip, burial depth, thermal state, and hydrocarbon phase. It is the bridge between present-day observation (Layer 1, PHYSICS_9) and petroleum-system timing (Layer 2, TIME4D).

Kinematics is **not** a single tool. It is a workflow that chains:

| Phase | GEOX module | Physics | Status |
|-------|-------------|---------|--------|
| P0 | Plate reconstruction (`geox_basin` mode=reconstruct) | GPlates / GWS | Callable, live |
| P1 | Rift kinematics (`geox_basin` mode=rift) | McKenzie (1978) pure-shear | Callable, verified |
| P2 | Backstripping + decompaction | Athy (1930), Steckler & Watts (1978) | **Exists as pure code, not exposed as tool** |
| P3 | Structural restoration / fault kinematics | Not implemented | Gap |
| P4 | Sediment routing / mass balance | `geox_simulate_routing` | Broken (Pydantic `req` issue) |
| P5 | Sequence generation from physics | `geox_simulate_sequences` | Broken (Pydantic `req` issue) |
| P6 | Thermal maturity kinetics | TTI / Easy%Ro / Sweeney & Burnham (1990) | **Exists as pure code, not exposed as tool** |

The key insight: **the physics kernels exist below the membrane** (`GEOX/src/geox_core/skills/subsurface/`), but they are **not safely exposed above the membrane** as a unified, callable MCP endpoint. The live GEOX surface (`geox_surface_status`) lists 87 tools, but none is a single `geox_kinematics` or `geox_basin_history` endpoint that consumes a full basin-history packet and returns burial/maturity/charge-timing output. The blockage is dispatcher/Pydantic integration, not missing science.

---

## 2. Current GEOX surface assessment for kinematics

### 2.1 Tools that work today

| Tool / mode | What it does | Kinematic relevance |
|-------------|--------------|---------------------|
| `geox_basin` `mode=rift` | Computes β, initial/thermal subsidence, rift phase | **Verified against McKenzie (1978)**. Direct kinematic input. |
| `geox_basin` `mode=reconstruct` | GPlates paleo-position, multi-model spread | Tectonic framework / WHERE was the basin. |
| `geox_basin` `mode=deep_time` | Earth State Vector at any age | Boundary conditions (CO₂, SL, day length, polarity). |
| `geox_biostrat_parse` | Extract NN/NP zones + calibrate ages | **Timing anchor for horizons.** Perfect calibration vs Martini 1971 / GPTS2020. |
| `geox_interpret` `sequence` | Sequence stratigraphy framework | Static stacking-pattern analysis. |
| `geox_compute` `contrast_detect` | 4-dimension anomaly detector | Falsification helper for kinematic predictions. |

### 2.2 Tools that exist as code but are not reliably callable

| Module | File | Why it is blocked |
|--------|------|-------------------|
| Backstripping / decompaction | `GEOX/src/geox_core/skills/subsurface/backstrip_decompaction.py` | Not registered as standalone MCP tool. Only reachable if another tool imports it. |
| Maturity kinetics | `GEOX/src/geox_core/skills/subsurface/maturity_kinetics.py` | Same — pure functions, no MCP wrapper. |
| STS rift bridge | `GEOX/src/geox_core/skills/subsurface/sts_rift_bridge.py` | Maps P1 → BasinState; not exposed. |
| Accommodation simulation | `geox_simulate_accommodation` | Pydantic `req` construction failure in dispatcher. |
| Routing simulation | `geox_simulate_routing` | Same Pydantic `req` failure. |
| Sequence simulation | `geox_simulate_sequences` | Same Pydantic `req` failure. |
| Surface simulation | `geox_simulate_surfaces` | Same Pydantic `req` failure. |

### 2.3 Root cause: Pydantic dispatch gap

The GEOX MCP dispatcher (`GEOX/src/geox_mcp/tools/unified_dispatcher.py`) passes flat argument dicts via `_safe_forward()`. Functions that expect a typed Pydantic model (`req: BackstripRequest`) receive no matching flat keys and fail with `missing 1 required positional argument: 'req'`. This is documented in `GEOX-CALIBRATION-REPORT.md` and affects 17 of 29 tested modes (58%).

**Consequence:** Even though the kinematic mathematics are forged and correct, the federation cannot honestly claim a callable kinematic engine endpoint from the live tool surface.

---

## 3. Why static GEOX is enough for now

The current exposed surface supports every non-timing-dependent exploration question:

- **Seismic attribute work** → `geox_seismic_compute`, `geox_seismic_interpret`, `geox_rsi_interpret`
- **Well ties** → `geox_well_tie_compute`, `geox_tie_preflight`, `geox_tie_receipt`
- **Sequence stratigraphy** → `geox_sequence`, `geox_simulate_*` (once dispatcher fixed)
- **Prospect screening** → `geox_prospect` (judgment lane, requires arifOS)
- **Volumetrics / POS / EVOI** → `geox_prospect` / `geox_wealth_bridge_run`
- **Claim/evidence governance** → `geox_claim`, `geox_evidence`, `geox_forbidden_claims_scan`
- **Structural-map support** → `geox_3d_model_build`, `geox_map_*`

Kinematics only becomes decision-critical when the answer changes with time. The canonical trigger questions are:

1. Did source rock mature **before** trap formation?
2. Did migration happen **before or after** fault sealing?
3. Is uplift/erosion destroying charge or preserving it?
4. Are present-day closures inherited, inverted, or late?
5. Does burial history support pressure, temperature, or HC phase?

Without calibrated inputs, a kinematic run produces a **scientific-looking animation** that weakens GEOX truth discipline (F2, F7, F9).

---

## 4. Unified kinematics architecture — how it fits GEOX

A future `geox_kinematics` engine should be a **pipeline**, not a monolith. It chains existing kernels in dependency order:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GEOX KINEMATICS PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  INPUTS                    STATIC FRAME              TIME DOMAIN             │
│  ───────                   ────────────              ──────────              │
│  basin bbox + CRS  ──────► basin resolve ──────► plate reconstruction (P0)   │
│  stratigraphy      ──────► biostrat_parse  ─────► age model                 │
│  horizons          ──────► depth conversion ────► paleo-depth grid          │
│  faults            ──────► fault framework  ────► slip timing               │
│  wells             ──────► well_tie + tops  ─────► calibration anchors      │
│  heat flow / BHT   ──────► thermal model    ─────► T(t) burial history      │
│  source kinetics   ──────► maturity_kinetics ────► Ro(t), charge_age        │
├─────────────────────────────────────────────────────────────────────────────┤
│  FALSIFICATION                                                              │
│  • predicted vs observed thickness (backstrip)                              │
│  • predicted vs measured Ro/Tmax                                            │
│  • predicted vs observed temperature                                        │
│  • fault timing vs cross-cutting relationships                              │
│  • paleo-SL / deep_time boundary conditions                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  OUTPUTS                       GOVERNANCE                                   │
│  • burial_history              confidence ≤ 0.90 (F7)                       │
│  • maturity_timing             epistemic_label = DER/INT                    │
│  • trap_charge_timing          888_HOLD if used for reserves/drill          │
│  • uplift_erosion_sensitivity  uncertainty bands mandatory                  │
│  • migration_risk_flags        alternatives mandatory                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Integration with existing GEOX tools

| Kinematic step | Existing GEOX tool | New wrapper needed? |
|----------------|-------------------|---------------------|
| Basin identity | `geox_basin` mode=resolve / macrostrat | No |
| Plate position | `geox_basin` mode=reconstruct | No |
| Stratigraphic ages | `geox_biostrat_parse`, `geox_biostrat_nn_age`, `geox_macrostrat_calibrate` | No |
| Depth conversion | `geox_well_tie_compute`, velocity model ingest | Maybe — unified T/D anchor |
| Rift subsidence | `geox_basin` mode=rift | No |
| Backstripping | `backstrip_decompaction.py` | **Yes — `geox_backstrip`** |
| Thermal history | `maturity_kinetics.py` | **Yes — `geox_maturity_history`** |
| Sequence emergence | `geox_simulate_sequences` / surfaces | Fix dispatcher |
| Sediment routing | `geox_simulate_routing` | Fix dispatcher |
| Fault restoration | — | **New module P3** |
| Claim governance | `geox_claim`, `geox_evidence` | No |

### 4.2 Epistemic rung assignment

| Output | Rung | Evidence required |
|--------|------|-------------------|
| Present-day depth | 2 (MEASUREMENT) | Well tops, checkshot |
| Decompacted thickness | 3 (DERIVATION) | Lithology, porosity law |
| Tectonic subsidence | 4 (INTERPRETATION) | Backstrip + paleobathymetry |
| Paleo heat flow | 4 (INTERPRETATION) | β, BHT, Ro |
| Charge age | 5 (MODEL) | Burial history + kinetics |
| Trap charge timing verdict | 6 (JUDGMENT) | All above + structural timing |

**Iron law:** A Rung 6 verdict cannot be sealed if any Rung 2–5 anchor is missing or contradicted.

---

## 5. Activation packet

Use this YAML as the complete input specification for activating GEOX Kinematics. Empty fields must be filled before the engine runs.

```yaml
geox_kinematics_activation_inputs:
  basin_identity:
    basin_name: ""
    country_region: ""
    project_area_bbox_lonlat: [min_lon, min_lat, max_lon, max_lat]
    coordinate_reference_system: "EPSG:"
    geological_context: "rift / passive margin / foreland / strike-slip / inverted basin / other"

  stratigraphic_framework:
    strat_column_name: ""
    formation_order_oldest_to_youngest:
      - formation: ""
        age_top_ma: null
        age_base_ma: null
        depositional_environment: ""
        lithology_primary: ""
        lithology_secondary: ""
    key_unconformities:
      - name: ""
        age_ma: null
        erosion_estimate_m_p10_p50_p90: [null, null, null]

  horizon_surfaces:
    required_surfaces:
      - horizon_name: ""
        age_ma: null
        surface_type: "time_map / depth_map / point_grid / interpreted_horizon"
        datum: "TVDSS / TVDKB / TWT"
        unit: "m / ms"
        artifact_ref: ""
        confidence: "low / medium / high"
    minimum_required:
      - basement_or_synrift_base
      - source_interval_top_base
      - reservoir_top
      - seal_top
      - present_day_seafloor_or_surface

  fault_framework:
    fault_sets:
      - fault_name: ""
        fault_type: "normal / reverse / strike-slip / thrust / growth_fault / inversion"
        age_active_start_ma: null
        age_active_end_ma: null
        throw_range_m_p10_p50_p90: [null, null, null]
        seal_risk: "low / medium / high / unknown"
        artifact_ref_fault_sticks_or_polygons: ""
    restoration_priority_faults:
      - ""

  wells_and_calibration:
    wells:
      - well_id: ""
        surface_x_y_or_lonlat: [null, null]
        kb_or_datum_m: null
        total_depth_m_md: null
        deviation_survey_ref: ""
        las_ref: ""
        tops_ref: ""
        checkshot_or_vsp_ref: ""
        temperature_data_ref: ""
        pressure_data_ref: ""
        maturity_data_ref: ""
    minimum_required:
      - at_least_1_well_with_tops
      - checkshot_or_velocity_model
      - temperature_or_bht_data
      - source_rock_maturity_anchor_if_available

  velocity_and_depth_conversion:
    velocity_model_type: "checkshot / VSP / seismic velocity / regional proxy"
    velocity_model_ref: ""
    time_depth_uncertainty_ms_or_m_p10_p50_p90: [null, null, null]
    known_depth_tie_errors:
      - well_id: ""
        horizon_name: ""
        error_m: null

  burial_thermal_history:
    present_day_heat_flow_mw_m2_p10_p50_p90: [null, null, null]
    paleo_heat_flow_events:
      - event_name: ""
        age_start_ma: null
        age_end_ma: null
        heat_flow_mw_m2_p10_p50_p90: [null, null, null]
    sediment_water_interface_temp_model: "default / supplied"
    source_rock_kinetics:
      source_interval: ""
      toc_pct_p10_p50_p90: [null, null, null]
      hi_mgHC_gTOC_p10_p50_p90: [null, null, null]
      kerogen_type: "I / II / III / mixed / unknown"
      kinetics_model: "default / supplied"

  compaction_and_lithology:
    lithology_compaction_curves:
      shale: "default / supplied"
      sand: "default / supplied"
      carbonate: "default / supplied"
    porosity_depth_calibration_refs:
      - ""
    pressure_compaction_notes: ""

  tectonic_events:
    events:
      - name: ""
        event_type: "extension / subsidence / uplift / inversion / compression / strike-slip / erosion"
        age_start_ma: null
        age_end_ma: null
        magnitude_m_or_beta_factor_p10_p50_p90: [null, null, null]
        affected_area: ""
        confidence: "low / medium / high"

  petroleum_system_targets:
    source_rocks:
      - name: ""
        interval_top_base: ["", ""]
        maturity_target: "Ro / Tmax / transformation_ratio"
    reservoirs:
      - name: ""
        trap_formation_age_ma_p10_p50_p90: [null, null, null]
    seals:
      - name: ""
        seal_effective_age_ma: null
    charge_questions:
      - "Did charge occur before trap formation?"
      - "Did inversion breach the trap?"
      - "Is the present closure older or younger than migration?"

  calibration_targets:
    maturity:
      ro_percent_by_well_ref: ""
      tmax_ref: ""
      vitrinite_or_biomarker_notes: ""
    temperature:
      bht_or_dst_temperature_ref: ""
    pressure:
      rft_mdt_dst_pressure_ref: ""
    present_day_depth:
      well_tops_depth_error_tolerance_m: null
    structural:
      restored_section_or_balanced_section_ref: ""

  uncertainty_policy:
    required_realizations_minimum: 30
    recommended_realizations: 100
    output_percentiles: [10, 50, 90]
    fail_closed_if_missing:
      - horizon_ages
      - well_tops
      - velocity_or_depth_conversion
      - thermal_calibration
      - tectonic_event_timing

  activation_scope:
    mode: "screen / appraise / decision"
    allowed_outputs:
      - burial_history
      - maturity_timing
      - trap_charge_timing
      - uplift_erosion_sensitivity
      - migration_risk_flags
    forbidden_outputs_without_F13:
      - sealed_reserves_claim
      - final_drill_decision
      - irreversible_investment_judgment
```

---

## 6. Minimum viable packet

For first activation, do **not** require the full perfect basin model. Require this:

| Input | Minimum |
|-------|---------|
| Basin area | bbox + CRS |
| Stratigraphy | formation tops with ages |
| Horizons | basement / base source / top reservoir / present day |
| Faults | main fault sticks or polygons with timing estimate |
| Wells | 1–3 calibrated wells with tops, logs, checkshot or velocity |
| Thermal | BHT/DST temperature or regional heat flow |
| Source rock | TOC, HI, kerogen, maturity anchor if available |
| Erosion | unconformity ages and erosion ranges |
| Calibration | present-day depth, temperature, Ro/Tmax if available |
| Uncertainty | P10/P50/P90 ranges, not single fake numbers |

---

## 7. Hard gate

Do **not** activate kinematics if these are missing:

1. **Horizon ages**
2. **Depth conversion or velocity anchor**
3. **Well tops**
4. **Thermal calibration**
5. **Tectonic event timing**
6. **At least one maturity or temperature anchor**

Without those, kinematics becomes decorative animation. It will look scientific but weaken GEOX truth discipline.

---

## 8. Falsification plan for kinematic outputs

Every kinematic run must produce predictions that can be checked against observations:

| Prediction | Observation | Pass criterion |
|------------|-------------|----------------|
| Decompacted thickness | Well tops / isopach | Δ ≤ 15% |
| Present-day depth | Well tops / seismic T/D | error within stated P10–P90 |
| Temperature at depth | BHT/DST/RFT | Δ ≤ 20°C |
| Vitrinite reflectance | Measured Ro/Tmax | within ±20% Easy%Ro range |
| Fault slip timing | Cross-cutting relationships / biostrat | consistent |
| Unconformity erosion | Truncation geometry / provenance | consistent |
| Charge age | Fluid inclusion / API gravity / gas isotopes | consistent |

If any prediction fails, the model must be demoted (Gödel Wall / cascade demotion), not smoothed.

---

## 9. Implementation path (when activated)

If Arif supplies the activation packet, build in this order:

1. **Fix dispatcher Pydantic construction** — unlocks `geox_simulate_*` and any new kinematic tools that use typed models.
2. **Expose `geox_backstrip`** — wrap `backstrip_decompaction.py` as MCP tool.
3. **Expose `geox_maturity_history`** — wrap `maturity_kinetics.py` as MCP tool.
4. **Wire P1 → P2 → P6** — `geox_basin` rift output feeds backstrip, backstrip feeds maturity.
5. **Add fault restoration module (P3)** — minimum 2D vertical/depth shear; flag as INT.
6. **Add `geox_kinematics` orchestrator** — consumes activation packet, calls the chain, returns unified report.
7. **Add falsification gates** — contrast detect + claim challenge on every output.

Stop after each step and verify against the calibration targets above.

---

## 10. Final position

**Static GEOX remains the production engine. Kinematics goes into HOLD until Arif supplies the calibration packet above.**

Kinematics is **not dead**. It is **held behind calibration**. Static tools are enough until basin timing becomes decision-critical.

---

*Receipt: Kinematics is not dead. It is held behind calibration. Static tools are enough until basin timing becomes decision-critical.*

*DITEMPA BUKAN DIBERI*
