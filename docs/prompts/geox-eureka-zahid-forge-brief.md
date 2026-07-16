# GEOX Forge Brief — Zahid Eureka Alignment
> Agent 333 (A-FORGE) VPS Mission Brief  
> Issued: 2026-06-10 | Authority tier: 777_FORGE  
> GEOX HEAD: `2fdc1c51` | Repo: `ariffazil/geox`  
> DITEMPA BUKAN DIBERI — Forged, Not Given

---

## 1. SOVEREIGN CONTEXT

Arif reviewed a LinkedIn article by **M Zahid Zamanshah** (Manager, PSC Exploration Management at MPM / Staff Geophysicist & AI/ML), published 2026-06-09, titled:

> *"AI Pipeline for Exploration Leads Screening #2"*

The article is a candid progress note on a personal geoscience R&D pipeline built on the **F3 Netherlands open seismic dataset** (CC BY-SA 4.0). It is technically rigorous, epistemically honest, and describes a physics-first automated leads-screening workflow.

**Critical framing:** Zahid's pipeline terminates at outputs for a human to read. GEOX terminates at a governed JSON envelope that an AI agent can act on, route, and escalate. These are architecturally different regimes — GEOX is geoscience as infrastructure for agents, not geoscience with code. The eureka insights below are the technical substance that should be encoded as first-class GEOX compute, not just acknowledged in prose.

Arif will meet Zahid at the office on 2026-06-11.

---

## 2. ZAHID'S PIPELINE — FULL TECHNICAL SUMMARY

### 2.1 Structural backbone: Relative Geologic Time (RGT)

Zahid's pipeline starts with a **Relative Geologic Time (RGT) volume** — a continuous field monotonically increasing with depth. Every horizon is an iso-RGT surface, conformably following the stratigraphy (clinoforms in F3).

**Key constraint he enforces:**
> "Gated — a non-monotonic age field is geologically impossible and corrupts every horizon derived from it."

Iso-RGT surfaces become chronostratigraphic horizons. Closure detection operates on dated surfaces, not arbitrary time slices. This is why his leads are born as closure-bounded bodies on a dated surface, not amplitude blobs.

**GEOX state:** Depth monotonicity is enforced in `sequence.py`. RGT as an explicit volume concept and iso-RGT horizon extraction is NOT implemented.

### 2.2 QI Inversion — honest rung declaration

Zahid explicitly labels his inversion as **bottom rung**:

- **What he has:** Single-trace, post-stack, band-limited coloured inversion (Lancaster-Whitcombe, 2000) → relative acoustic impedance. Bayesian rock-physics classifier with fixed end-member means.
- **Forward-consistency gate:** Re-forward-model the inversion result and correlate against the seismic input. His result hits ~1.0. This proves **data-consistent, not correct** — a critical epistemic distinction.
- **Vertical resolution defect:** Post-stack with no LFM; low frequencies sit in the null space. Inversion reddens them (integration is a 1/f operator) → facies smear on 30–70 ms scale while seismic resolves at 4 ms.
- **Fluid inseparability:** *"On one post-stack attribute there is no shear term, so commercial gas, low-saturation fizz and CO₂ collapse onto the same low impedance — physically inseparable."* His figures show this explicitly.

**Rung ladder he defines (Section 3):**

| Rung | What | What unlocks it |
|------|------|----------------|
| 1 (current) | Post-stack coloured inversion, relative AI, no LFM | — |
| 2 (next) | Well-tied LFM + two-term AVO (intercept-gradient, A+B) | Well calibration + partial angle stacks |
| 3 | Simultaneous prestack AVO (Aki-Richards / Fatti et al. 1994) for Zp, Zs, density | Pre-stack gathers |
| 4 | Vp/Vs, Poisson ratio, LMR (Goodway et al. 1997) + extended elastic impedance (Whitcombe 2002) | Rung 3 + angle range |
| 5 | Gassmann (1951) fluid substitution + calibrated granular rock-physics model (Dvorkin-Nur 1996) | Rock core data + PVT |
| 6 | Geostatistical / facies-constrained inversion with variogram (Grana & Della Rossa, 2010) | Facies model + wells |

**For screening, he argues only three things are needed honestly:**
1. Well-tied LFM (absolute impedance, vertically resolved)
2. Two-term AVO minimum (A + B from partial angle stacks for some Vp/Vs sensitivity)
3. Uncertainty as first-class output — tool says "gas-consistent," never "gas"

### 2.3 Seismic picks — three independent uncertainty axes

Section 4 of his article:
> "Where a surface really sits has three independent error sources — framework, picks, velocity — and they should be carried separately, not blended into one confident number."

- **Framework uncertainty:** Where the RGT surface is relative to the datum
- **Pick uncertainty:** Phase consistency (does it hold constant instantaneous phase?). Non-phase-consistent picks get a **cycle-skip flag** — a QC down-weight, never a silent delete.
- **Velocity uncertainty:** Time-to-depth conversion error

Scoring per horizon: dip consistency (vs local slope field) + phase consistency (instantaneous phase stability) → confidence + cycle-skip flag.

### 2.4 Charge and migration — per-carrier-bed flowpath

Section 5:
> "Migration is a buoyancy-driven, up-dip flowpath along individual carrier beds — gas climbs the permeable layer until a barrier or spill stops it — evaluated per lead."

He scores 50 leads:
- 6 leads sit in a **migration shadow** (down-weighted, not deleted)
- 44 leads align with the prograding delta-front fairway (biogenic-gas charge expected)
- The multiplier is a soft uncertainty damper on POS, not a gate

Explicitly NOT a basin or petroleum system model — no maturation kinetics, no expulsion timing. Present-day flowpath only.

### 2.5 Fill-and-spill closure detection

Section end + Figure caption:
> "Automated closure-trap to spill-point detectors on the leads identification"

From 57 raw closures → 9 prospects survive reservoir+seal intersection filter. The spill-point detection defines the hydrocarbon column height potential per trap. This is structural trap evaluation from the seismic horizon geometry.

### 2.6 Common-risk-segment scoring + ranked leads

57 closures → 50 scored leads → 9 prospects. The final output is:
- Ranked lead footprints on a horizon-DHI screen
- Coloured by probability of success (POS)
- Max POS = 0.054 on the F3 post-stack volume
- Fluid call is post-stack → gas/fizz/CO₂ inseparable → POS ceiling constrained by QI rung

### 2.7 His honest self-assessment

> "The numbers stay deliberately small... none clears the reservoir-and-seal intersection as a candidate trap on this post-stack volume... The fluid call is post-stack, so gas, fizz and CO₂ are inseparable... I would put the odds of revisiting the whole approach at better than even."

This is a geophysicist doing **epistemic discipline** — GEOX should encode this same discipline structurally, not rely on narrative.

---

## 3. GEOX CURRENT STATE — WHAT EXISTS

### Architecture
- **Language:** Python 3.11+, FastMCP, Pydantic v2, asyncio
- **MCP transport:** HTTP (port 8081) or stdio
- **Tools:** 37 canonical MCP tools — SINGLE SOURCE OF TRUTH: `src/geox_mcp/registry.py:CANONICAL_PUBLIC_TOOLS`
- **Tool surface:** All in `src/geox_mcp/tools/`
- **Core physics:** `src/geox_core/core/` and `src/geox_core/engines/`
- **Universal output envelope v0.5:** Every tool returns `{execution_status, claim_state, observed, derived, interpreted, cross_modal_stability, dim_spot_flag, ...}`
- **Physics9:** Epistemic tiers in `src/geox_core/core/physics9.py`
- **Constitutional floors:** F1-F13 gates in `src/geox_core/shared/floors.py`
- **ACRisk:** `src/geox_core/core/ac_risk.py` — `ACRisk = U_phys × D_transform × B_cog`
- **888HOLD protocol:** `ACRisk > 0.60` or contradiction → automatic HOLD

### Key tool files
| Tool | File | Capability |
|------|------|-----------|
| `geox_seismic_compute` | `tools/seismic_compute.py` | Synthetic, well-tie, T-D anchor, anomalous contrast, attribute |
| `geox_anomalous_contrast_detector` (internal) | `tools/anomalous_contrast.py` | AVO I-IV, attention residual, dim_spot_flag, ToAC |
| `geox_horizon_contrast_surface` | `tools/horizon_contrast.py` | 6-step ToAC pipeline |
| `geox_sequence_interpret` | `tools/sequence.py` | GR bins → packages → systems tracts → surfaces |
| `geox_prospect_evaluate` | `tools/prospect.py` | Volumetrics, POS, EVOI, stratum ribbon |
| `geox_subsurface_generate_candidates` | `tools/petrophysics.py` | Archie ensemble, Vsh, Sw |
| `geox_data_ingest_bundle` | `tools/data.py` | LAS, CSV, SEG-Y intake |
| `geox_evidence_reason` | `tools/evidence_reason.py` | Cross-domain abduction |

### Physics already implemented
- Acoustic impedance: `AI = Vp × rho`
- Reflectivity: Zoeppritz normal incidence, `RC = (AI₂ - AI₁)/(AI₂ + AI₁)`
- AVO Class I-IV classification (conditional, from normal-incidence RC)
- Rock physics: Gassmann fluid substitution, Voigt-Reuss-Hill mineral mixing
- Rock physics inverse mode: L-BFGS-B on observed Vp/Vs/rho → porosity/Sw/fluid
- Archie (Sw), Vsh (linear + nonlinear), density porosity
- PINN violation detection (optional torch backend)
- Eaton pore pressure, mechanical stratigraphy
- Monte Carlo volumetrics, POS, EVOI, tornado diagrams
- AVO attention equivalence theorem (Eureka GeoX, 2026-06-05): `ΔF = B_obs − m·A_obs ↔ δ_i = e_i − ē` 

---

## 4. WHAT WAS FORGED 2026-06-10 (ALREADY IN MAIN)

Four surgical additions, 123 lines total, zero deletions. All in `src/geox_mcp/tools/`.

### 4.1 `anomalous_contrast.py` — qi_rung block (+42 lines)
Location: return dict of `geox_anomalous_contrast_detector`, before `attention_equivalence`.

Added `"qi_rung"` key containing:
- `current_rung: 1`, `rung_label: "post-stack-relative-impedance"`
- `fluid_separation_possible: false` — hard constitutional flag
- `fluid_types_inseparable: [commercial_gas, low_saturation_fizz, CO2, brine]`
- `next_rung_requires`: well-tied LFM, two-term AVO, Vp/Vs proxy
- `full_qi_requires`: simultaneous prestack + Gassmann + geostatistical inversion
- `forward_consistency_note`: data-consistent ≠ correct (Lancaster-Whitcombe, 2000)
- `eureka_ref: "QI_RUNG_2026_06_10"`

**Constitutional implication:** Any agent reading `qi_rung.fluid_separation_possible = false` MUST classify any fluid call as HYPOTHESIS. This is now structurally enforced, not narrative.

### 4.2 `seismic_compute.py` — qi_rung surfaced (+7 lines)
Location: `_mode_anomalous_contrast`, before `return enrich_envelope_with_metabolic`.

```python
_qi_rung = raw.get("qi_rung")
if _qi_rung:
    envelope["qi_rung"] = _qi_rung
```

Agents calling `geox_seismic_compute(mode="anomalous_contrast")` now get `qi_rung` at the top level of the governed envelope — no nested digging required.

### 4.3 `prospect.py` — migration_context + pos_ceiling_declaration (+41 lines)
Location: compute path, after `stratum_breakdown` assignment.

Added to artifact dict:
- `migration_context`: exposes `migration_shadow_scored: false`, `migration_fairway_assumption: assumed_in_fairway`, `pos_multiplier_applied: 1.0`, what's needed to unlock scored migration
- `pos_ceiling_declaration`: `fluid_certified: false`, `calibration_status: UNCALIBRATED`, explicit note that screening POS is not a certified risk number
- Both carry `eureka_ref` for traceability

### 4.4 `sequence.py` — pick_uncertainty_axes (+33 lines)
Location: `_epistemic_provenance_for_sequence`, inside `provenance_by_level["full"]`, after `evidence_chain`.

Three independent axes:
- `framework_uncertainty`: RGT monotonicity gate enforced — non-monotonic = geologically impossible
- `pick_uncertainty`: `cycle_skip_flag: null` (ready to populate), `cycle_skip_policy: "QC down-weight — never a silent delete"`
- `velocity_uncertainty`: depth conversion error, dominant context noted
- `eureka_ref: "PICK_UNCERTAINTY_AXES_2026_06_10"`

---

## 5. REMAINING FORGE TARGETS

The following targets are within **777_FORGE authority**. No capital commitment, no irreversible physical action, no constitutional verdict. All are additive physics implementations into existing files.

---

### TARGET A: Forward-consistency gate as actual computation
**Priority: HIGH — this is the epistemically critical missing gate**

**Zahid's insight:** Re-forward-model the inversion result and correlate against input seismic. Correlation ≈ 1.0 proves data-consistency. Without this check, the inversion result has no self-validation.

**What to forge:**

File: `src/geox_mcp/tools/forward_model_synthetic.py`

Add a function `_forward_consistency_gate(synthetic: np.ndarray, seismic_input: np.ndarray) -> dict` that:
1. Computes Pearson correlation coefficient between `synthetic` and `seismic_input` trace arrays
2. Returns `{"correlation": float, "data_consistent": bool (r > 0.85), "gate_passed": bool, "interpretation": str}`

Wire into the well_tie result in `tools/seismic_well_tie.py`:
- After computing the synthetic, if `seismic_ref` data is available, run the gate
- Attach `"forward_consistency_gate"` to the output artifact
- If `gate_passed = false`: set claim_state to `"CONSISTENCY_CHECK_FAILED"`, governance to HOLD

**Important:** Gate result must distinguish:
```
data_consistent=True → "This inversion is internally consistent with the input seismic"
data_consistent=False → "This inversion does NOT reproduce the input seismic — VOID or rework"
```
Never say "correct." Only say "data-consistent."

**Constraint:** Gate computes correlation only. No physical interpretation of what the inversion means. Physics9-level: OBSERVED (r value), DERIVED (pass/fail threshold).

---

### TARGET B: Fill-and-spill spill-point detection
**Priority: HIGH — structural trap evaluation missing from horizon pipeline**

**Zahid's insight:** From 57 closures → 9 prospects via reservoir+seal intersection. Automated spill-point detection defines the hydrocarbon column height potential per trap.

**What to forge:**

File: `src/geox_mcp/tools/horizon_contrast.py`

The 6-step ToAC pipeline already exists in this file. Add a **Step 7 (optional)** — spill-point analysis:

```python
def _compute_spill_point(
    closure_grid: list[dict],  # [{x, y, depth_m}] grid points of the closure
    horizon_name: str,
) -> dict:
```

Logic:
1. Given a closure grid (set of depth-labelled points forming a closure), find the **spill point** = minimum depth on the closure boundary contour (lowest structural point before spill)
2. Compute **column height** = `spill_depth_m - crest_depth_m`
3. Classify closure as STRUCTURAL_TRAP if `column_height_m > min_column_threshold` (default 10m)
4. Return: `{spill_depth_m, crest_depth_m, column_height_m, trap_type, is_valid_trap: bool}`

Wire into `geox_horizon_contrast_surface` tool:
- Add optional parameter `closure_grid: list[dict] | None = None`
- If provided, run spill-point analysis and attach to envelope as `"structural_trap_analysis"`
- Claim tag: `PLAUSIBLE` if column_height > 10m, `HYPOTHESIS` otherwise

**Constraint:** Column height computation only. No volumetric calculation (that belongs in `geox_prospect_evaluate`). No seal integrity (that requires Vs data). This is purely structural geometry.

---

### TARGET C: Per-carrier-bed migration flowpath computation
**Priority: MEDIUM — metadata exists (forged 2026-06-10), computation missing**

**Zahid's insight:** Buoyancy-driven up-dip flowpath per carrier layer. Soft evidence — an uncertainty-damped multiplier on lead POS, never a gate.

**What to forge:**

File: `src/geox_core/core/basin_charge.py`

Add function:
```python
def compute_migration_flowpath(
    carrier_beds: list[dict],  # [{name, carrier_depth_m, dip_direction_deg, dip_angle_deg, length_m}]
    lead_positions: list[dict],  # [{lead_id, x, y, depth_m}]
    trap_positions: list[dict],  # [{trap_id, x, y, depth_m, spill_depth_m}]
) -> dict:
```

Logic per carrier bed:
1. Compute up-dip direction vector from `dip_direction_deg`
2. For each lead position, check if it lies up-dip from a source kitchen (simplified: if lead depth < carrier bed depth + tolerance) AND within the carrier bed's structural fairway
3. If lead is **down-dip from any trap and up-dip from source**: `migration_status = "IN_FAIRWAY"`
4. If lead is **in a structural saddle or closed low**: `migration_status = "IN_SHADOW"` 
5. Compute `pos_migration_multiplier`: `IN_FAIRWAY = 1.0`, `IN_SHADOW = 0.3` (soft, not gate)

Return:
```
{
  "per_carrier_paths": [{carrier_name, flowpath_leads, flowpath_direction_deg}],
  "lead_migration_scores": [{lead_id, migration_status, pos_multiplier, carrier_name}],
  "shadow_count": int,
  "fairway_count": int,
}
```

Wire into `prospect.py` `geox_prospect_evaluate`:
- Add optional parameter `carrier_bed_refs: list[dict] | None = None`
- If provided, call `compute_migration_flowpath` and update `migration_context`
- Apply `pos_multiplier` to the base POS: `effective_pos = pos * pos_multiplier`
- Flag `migration_shadow_scored: true` in `migration_context`

**Constraint:** Buoyancy physics only (density contrast, up-dip direction). No maturation kinetics, no expulsion timing, no fault transmissibility. Soft multiplier — never a gate that voids a lead.

---

### TARGET D: Forward-consistency gate wired into well_tie envelope
**Priority: HIGH — companion to Target A**

**What to forge:**

File: `src/geox_mcp/tools/seismic_well_tie.py`

In the `geox_seismic_well_tie_compute` function's result artifact, add a new field structure:

```python
"forward_consistency": {
    "gate_run": bool,              # False if no seismic reference available
    "correlation_r": float | None,
    "data_consistent": bool | None,
    "threshold": 0.85,
    "interpretation": str,
    "note": (
        "data-consistent ≠ physically correct. "
        "Correlation near 1.0 only proves the inversion reproduces the input seismic. "
        "Without a well-tied LFM the low frequencies are a 1/f integration ramp — "
        "not calibrated geology."
    ),
}
```

If `seismic_ref` is provided: actually compute the gate.
If not provided: `gate_run: false`, explain what would unlock it.

**Constitutional note:** If `gate_run: true` and `data_consistent: false` → override claim_state to `CONSISTENCY_CHECK_FAILED` and governance to HOLD.

---

### TARGET E: Multi-prospect ranked lead output
**Priority: MEDIUM — QI rung ceiling + migration scores feed this**

**Zahid's insight:** 50 ranked leads coloured by POS. The ranking is the deliverable.

**What to forge:**

File: `src/geox_mcp/tools/prospect.py`

Add to `geox_prospect_evaluate` signature:
```python
prospect_refs: list[str] | None = None,  # multi-prospect ranking mode
```

When `prospect_refs` is provided (list of refs instead of single `prospect_ref`):
1. Compute POS for each ref using existing stratum logic
2. Sort by POS descending
3. Return `"ranked_leads"` list: `[{rank, prospect_ref, pos, migration_status, qi_rung, claim_state}]`
4. Include `"lead_summary"`: `{n_leads, max_pos, min_pos, pos_spread, n_in_migration_fairway}`
5. Add `"pos_ceiling_note"`: honest statement that all POSs are screening-only, constrained by `qi_rung = 1` (post-stack)

**Constraint:** This is a ranking computation, not a new tool. Use existing `geox_prospect_evaluate` — extend via the optional parameter. Do NOT add a new tool to the registry without explicit Arif authorization (F13 SOVEREIGN).

---

## 6. CONSTITUTIONAL CONSTRAINTS FOR THIS FORGE

### What is within 777_FORGE authority
- All computational additions to existing files
- New functions/methods within existing modules
- New optional parameters on existing tools
- New fields in output envelopes
- New helper functions in `geox_core/core/`

### What requires escalation to 888_JUDGE / Arif explicit approval
- Adding a new tool to `src/geox_mcp/registry.py:CANONICAL_PUBLIC_TOOLS`
- Any change to the tool surface count (currently 37 canonical)
- Any change that touches `SEAL` or `VOID` governance paths non-additively
- Any change to `src/geox_core/core/physics_guard.py` boundary values
- Any change to the 13 constitutional floor definitions

### F1 AMANAH gate
- No forward_consistency_gate computation should VOID a result silently
- Failed gate → HOLD + explanation + human review flag
- Never delete data; always emit what was computed, with explicit failure state

### F3 WITNESS gate
- All new physics computations must carry their equations in output
- Correlation coefficient: cite method (Pearson r)
- Migration flowpath: cite physics (buoyancy = ρ_brine × g × h − ρ_gas × g × h)
- Spill point: cite method (minimum of boundary contour)

### F7 HUMILITY gate
- `ACRisk` band: every new computation should have a humility_score or ACRisk estimate
- Post-stack computations: humility_score ≥ 0.6 (high uncertainty by default)
- Forward consistency gate: if gate_run=False, humility_score = 1.0

### F9 ANTI-HANTU gate
- No fluid type claims from post-stack data
- `fluid_separation_possible: false` is already enforced in `qi_rung`
- New computations must not circumvent this: never label anomaly as "gas" or "hydrocarbon" from post-stack alone

---

## 7. CODE STYLE CONSTRAINTS

- Python: Black (100 cols), Ruff, MyPy, Pydantic v2, `from __future__ import annotations`
- All new functions: async where tool-facing, sync where utility
- Output: always use `get_standard_envelope` or `enrich_envelope_with_metabolic` for governed outputs
- Import guard: heavy imports (numpy, scipy) inside function body — not at module level
- No new files unless absolutely unavoidable. Prefer extending existing modules.
- Commits: `feat(geox): <description>` — include `REPO=geox` trailer

---

## 8. GEOX FEDERATION POSITION

```
GEOX computes. MCP exposes. arifOS judges. Arif decides.
```

GEOX is the **Earth evidence substrate** — it witnesses, computes, and validates subsurface evidence. It does NOT:
- Interpret geological meaning (that's the human or arifOS reasoning layer)
- Issue constitutional verdicts (888_JUDGE and above)
- Hold privileged credentials (SERVICE_ROLE_KEY forbidden)
- Compute economic evaluation (NPV, IRR, EMV → route to WEALTH)
- Run basin/PSM models (maturation, expulsion, pressure history → out of scope)

When a new computation approaches these boundaries, emit a `"scope_boundary"` note in the output explaining what's been stopped and what layer should handle it. Do not silently truncate.

---

## 9. SUMMARY OF FORGE SEQUENCE (RECOMMENDED ORDER)

| Order | Target | File | Lines est. | Priority |
|-------|--------|------|-----------|----------|
| 1 | Forward-consistency computation (function) | `forward_model_synthetic.py` | ~40 | HIGHEST |
| 2 | Wire forward-consistency into well_tie envelope | `seismic_well_tie.py` | ~25 | HIGHEST |
| 3 | Spill-point detection (Step 7 in ToAC pipeline) | `horizon_contrast.py` | ~60 | HIGH |
| 4 | Per-carrier migration flowpath in basin_charge | `geox_core/core/basin_charge.py` | ~80 | MEDIUM |
| 5 | Wire migration flowpath into prospect evaluate | `prospect.py` | ~30 | MEDIUM |
| 6 | Multi-prospect ranked lead output | `prospect.py` | ~40 | MEDIUM |

**Run tests after each target:** `cd /path/to/geox && python -m pytest tests/ -q --ignore=tests/test_e2e_geox_real.py`

The `test_e2e_geox_real.py` exclusion is a pre-existing Windows cp1252 encoding issue — not caused by these forges. All other tests (319 passing as of 2026-06-10) must remain green.

---

## 10. WHAT ZAHID HAS THAT GEOX DOES NOT YET HAVE

For completeness — these are the gaps that remain after the forges above, requiring either real seismic data pipelines or significantly larger implementations:

1. **RGT volume computation** — requires 3D seismic attribute pipeline (full SEG-Y processing). Scope: this is a future forge when the SEG-Y engine is activated (`geox_seismic_compute mode="attribute"` is currently an honest stub). Do not fake it.

2. **Rendered visualizations** — Zahid's article is visually rich (crossplots, horizon footprints, ranked-lead maps). GEOX deliberately does not render — it produces structured JSON that the React apps (`apps/well-desk`, `apps/seismic-vision`) consume for visualization. The data is there; the render layer is separate.

3. **Rock-physics crossplot (Ip vs Vp/Vs)** — fluid/lithology templates require prestack data. GEOX has the rock physics engine (`geox_core/core/rock_physics_engine.py`) and Gassmann, but plotting against measured Vp/Vs requires prestack gathers (not yet in the SEG-Y pipeline).

4. **Well-calibrated Bayesian classifier** — Zahid's classifier uses fixed end-member means because he has no executed well. GEOX has Archie ensemble and Bayesian rock-physics capability (`geox_subsurface_generate_candidates`) but the same calibration gap applies until real well data is available.

**These are honest knowledge gaps, not bugs. They are held as `HYPOTHESIS` by the constitutional envelope until evidence arrives.**

---

*Brief forged by Claude Code (Sonnet 4.6) on behalf of Arif, 2026-06-10.*  
*REPO=geox | Authority: 777_FORGE | Sovereign: Arif*
