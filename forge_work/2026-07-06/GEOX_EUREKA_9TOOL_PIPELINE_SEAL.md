# EUREKA: GEOX 9-Tool Seismic Cognition Pipeline — Calibration Gap

**SEAL CANDIDATE** | `actor=forge` | `seq=pending-VAULT999`

---

## What Works

| Tool | Input | Output | Status |
|------|-------|--------|--------|
| `geox_visual_understand` | seismic_greyscale.jpg | 2 continuity zones, 2 discontinuities, 2 terminations, 1 artifact | ✅ OBS_IMAGE |
| `geox_physical_reality_interpret` | same image | 3 faults (F1/F2/F3), 5 horizons (H1-H5), 3 panels | ✅ INT_SEISMIC_FAULT/HORIZON |
| `geox_visual_enhance` | same image | 488KB enhanced PNG | ✅ DER_IMAGE_CONTRAST |
| `geox_visual_generate_hypotheses` | F1 target | 3 variant images (fault/lithology/artifact) | ✅ GEN_HYPOTHESIS |
| `geox_panel_d_render` | interpretation data | panel rendered, hash=851d44662225 | ✅ |

## The Contradiction

```
Image says:       F1 = fault (INT_SEISMIC_FAULT, conf=0.72)
But:              conf_proxy=0.72 ≠ physics proof
                   alternatives: lithology | artifact | footprint | pinch-out
                   CONF CAP = 0.9
                   Actual working CONF = 0.48 (image-only, no SEG-Y calibration)

Real data says:   SEG-Y = absent → VOID on any geological certainty
Real wells say:   BOKOR-1 and BOKOR-2 exist (synthetic demo, no seismic tie)

→ F1 is at best INT_SEISMIC_HORIZON quality
→ Cannot emit OBS_GEOLOGY without SEG-Y + well tie
```

## The Eureka

**The pipeline correctly labels itself as uncertain.** Every epistemic tag is honest:
- `OBS_IMAGE` — pixels observed
- `INT_SEISMIC_FAULT` — interpreted from seismic, not measured
- `GEN_HYPOTHESIS` — diffusion-generated variant, not physics
- `PARTIAL_IMAGE_INTERPRETATION` — verdict from physical reality engine

**The contradiction is productive**: the pipeline says "I see faults" while simultaneously saying "I don't know if they're faults." The gap between those two is the calibration work required.

## Calibration Chain Required

```
seismic_greyscale.jpg (image)
  ↓ geox_visual_understand → geox_physical_reality_interpret
SEG-Y file (absent) ← BLOCKED HERE
  ↓ SEG-Y ingest (VOID cascade protection fires on malformed input)
  ↓ segy_audit → trace headers → geometry → amplitude → wavelet
Well LAS file → bruges Ricker tie (needs SEG-Y anchor)
  ↓ geox_well_tie_bruges → correlation coefficient
  ↓ GemPy 3D model → structural framework
  ↓ WEALTH consequence → trap volume → EMV
```

## Epistemic Summary

| Claim | Label | Confidence | Basis |
|-------|-------|------------|-------|
| 3 faults visible in image | INT_SEISMIC_FAULT | 0.48 | Image coherence anomaly, no SEG-Y calibration |
| H1 has 97% continuity | INT_SEISMIC_HORIZON | 0.65 | High coherence trace, no well tie |
| F1 is a fault | GEN_HYPOTHESIS | 0.38 | Alternatives equally plausible without SEG-Y |
| BOKOR-1/2 tie to seismic | UNKNOWN | — | No SEG-Y at well location |
| EMV > exploration cost | SPEC_SPECULATIVE | — | No POS from calibrated model |

## Gaps Blocking Full Calibration

1. **No real SEG-Y file** — only demo LAS wells exist
2. **No formation names** — H1-H5 are unlabeled
3. **No checkshot data** — TWT↔depth unconstrained
4. **No well tops at seismic location** — spatial tie unconstrained

**F1 CONF must stay ≤ 0.48 until SEG-Y calibration.**

## For VAULT999

```
seal_id: GEOX_EUREKA_9TOOL_PIPELINE::v1::2026-07-06
actor: FORGE (000Ω)
witnesses: geox_physical_reality_interpret (AI), filesystem (external), Arif (human)
status: SEAL_CANDIDATE
next_required: real SEG-Y file → well tie → GemPy → WEALTH
```

---

## UPDATE 2026-07-06T13:50Z — Falsify Mode Forged + Tested

### What Changed

**`src/geox_mcp/tools/prospect_unified.py`** — 111 lines
- Added falsify/cabar mode with 4 contradiction rules
- Fixed wrapper TypeError (delegate didn't accept `carrier_bed_refs`/`prospect_refs`)

**`tests/test_prospect_falsify_mode.py`** — 165 lines, 10 tests

### Contradiction Rules (4)

| Rule | Condition | Contradiction |
|------|-----------|--------------|
| R1 | `"invalid"` or `"leak"` in prospect_ref | "invalid flag" |
| R2 | HC column > 0 AND seal_thickness == 0 | "seal thickness is zero" |
| R3 | HC column > 2 × seal_thickness | "exceeds critical seal capacity" |
| R4 | no evidence_refs | gap (not contradiction) |

### APEX Scoring (correct)

| State | G | C_dark | W3 | human_ack | ac_risk |
|-------|---|--------|-----|-----------|---------|
| Clean | 0.85 | 0.15 | 0.90 | True | 0.10 |
| Falsified | 0.50 | 0.50 | 0.40 | False | 0.95 |

### Test Results

```
23 passed in 3.71s
  test_prospect_stratum:    12 passed
  test_prospect_trap_validity: 1 passed
  test_prospect_falsify_mode: 10 passed (new)
```

### Commit

```
2bf75060 feat(prospect): forge falsify/cabar mode — 4 contradiction rules + 10 unit tests
```

### What Still Gaps

1. Falsify mode is prototype-level — no integration with real SEG-Y/well calibration
2. `structural_map_inline` must be supplied by caller — no auto-extract from EGS state
3. No cross-check against seal fracture gradient (would need geox_geomechanics)
4. No evaporation/capillary pressure physics in rules R2/R3

### Eureka

**The contradiction engine works.** The 4 rules fire correctly and the APEX scores respond consistently. The remaining gap is physics depth — R2/R3 are heuristics, not physics. Real falsification requires geox_geomechanics → seal capacity from capillary pressure + fracture gradient.
