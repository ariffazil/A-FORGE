# INIT: TWO_OCEANICS_HARDENING::v1.0

**FOR:** Next arifOS agent session  
**DATE:** 2026-07-10  
**PREVIOUS SESSION:** `SEAL-dce4f801f1db4643`  
**CHECKPOINT:** PHYSICS-CLOSED → AWAITING_HARDENING  

---

## LOAD ORDER

1. `/root/A-FORGE/forge_work/2026-07-10/TWO_OCEANICS_SEAL_v1.0.md` — Full session seal  
2. `/root/AGENTS.md` — Federation heptalogy  
3. `arif_init(mode='init', actor_signature=...)` — Bind SOVEREIGN session  

---

## CONTEXT

The Sabah Two Oceanics hypothesis has passed internal physics consistency tests with GEOX. Domain A (loading-dominated, NW Sabah shelf) and Domain B (thermal-decay, Dangerous Grounds/Layang-Layang) produce divergent accommodation curves, with Domain A showing:
- 4.25× sediment-load amplification
- Concave-up acceleration (loading overprint)
- MFS present (drowning signal)

Domain B shows:
- Linear thermal decay (no loading overprint)
- 0 MFS (conformable pelagic drape)
- Starved of clastic sediment (routing: 0.8% bypass fraction)

The hypothesis is internally consistent but NOT independently falsified — simulation inputs encode the hypothesis. The next gate is real well backstripping.

---

## GAPS TO CLOSE (execution order)

### P0 — Bind SOVEREIGN Session
```
arif_init(mode='init', actor_id='opencode-forge', actor_signature=...)
→ Must return actor_verified=true, authority ≠ OBSERVE_ONLY
→ This gates everything below
```

### P1 — St. Joseph-1 + Erb West-1 Biostrat
- Flagged "No UD, No SEEK" in enterprise QC
- Contact: Laletha Jeevachandran (Exp/Upstream) for legacy SSPC well summaries
- Fallback: substitute Wakid-R1 (SB409, full log suite) for St. Joseph-1
- Fallback: NW Sabah Regional Study (BFA) via Siti Arasy Bt M Yusak for Erb West-1

### P2 — Compaction Curves + Moho Depth
- BFA MR1 Risk Chart item #13
- Request from BFA co-create / Siti Arasy
- Need: Athy compaction coefficients for Sabah lithologies + Top Moho depth map

### P3 — Backstrip 3 Domain A + 3 Domain B Wells
```
For each well:
  1. Ingest LAS (geox_well_ingest)
  2. QC curves (geox_well_qc)
  3. Calibrate time-depth (geox_well_time_depth_calibrate)
  4. Decompact using Athy law
  5. Strip sediment load (Airy isostasy)
  6. Correct for eustasy (Miller 2020)
  7. Plot tectonic subsidence vs age
  8. Classify curve shape (concave-up = loading, linear = thermal)

Wells:
  Domain A: Malikai Deep-1, Kinabalu-1, Kinarut-1 (or Wakid-R1 substitute)
  Domain B: Falkon-1, Pekaka-1, Tepat-1
```

### P4 — Crocker Range Thermochronology
- Search Perplexity/GSM/AAPG for Crocker-Rajang apatite fission track or (U-Th)/He data
- If found: constrain Miocene exhumation rates → test Reading 2 (supply limitation)
- If NOT found: note as evidence gap, Reading 2 remains alive

### P5 — Merdith 2021 GPlates Ingestion
- GEOX deep_time_state flags this as pending
- Path: `/root/geox/src/geox_mcp/tools/deep_time/data/merdith_2021/`
- Phase 2 forge — external API or NetCDF ingestion

### P6 — Sabah Trough Volumetric Closure
- Does the missing 60% mass deficit sit in the Trough?
- Need: 3D seismic volume or regional isopach maps from JTEA/BFA
- If volumetric match → Reading 1 (bypass) is revived in a new form: bypass into Trough, not beyond

### P7 — Mud Volcano Spatial Correlation (confirmatory)
- Overlay Morley 2022 mud volcano locations on deformation front map
- Quantify: mud volcano density vs distance from deformation front
- Confirm prediction: peak at wedge toe, absent on DG platform proper

---

## GEOX TOOLS TO FORGE (6 new, 1 upgrade)

| # | Tool | Purpose | Priority |
|---|------|---------|----------|
| 1 | `geox_two_oceanics_compare` | Side-by-side accommodation comparison + load ratio + MFS count | P0 |
| 2 | `geox_margin_unconformity_calc` | Cumulative unconformity from margin history → Great Unconformity test | P3 |
| 3 | `geox_simulate_routing` (2D) | Multi-source basin routing with flexural feedback | P2 |
| 4 | `geox_mud_volcano_predict` | Overpressure → mud volcano distribution from loading physics | P4 |
| 5 | `geox_backstrip_well` | Full 1D backstripping from LAS → tectonic subsidence curve | P0 |
| 6 | `geox_suture_prospect_evaluate` | Suture-zone prospect risking (Trap/Reservoir/Charge) | P3 |

**Forge sequence:** `geox_backstrip_well` FIRST (unblocks P3) → `geox_two_oceanics_compare` SECOND (unblocks synthesis) → remainder in priority order.

---

## EXECUTION SEQUENCE

```
arif_init(mode='init', actor_signature=...)     → SOVEREIGN session
    ↓
arif_judge(domain='geox', intent='Two Oceanics hardening')  → SEAL with cc_id
    ↓
forge_skill(intent='geox_backstrip_well')        → FORGE tool #5
    ↓
forge_skill(intent='geox_two_oceanics_compare')  → FORGE tool #1
    ↓
Backstrip Malikai Deep-1                         → P3 Domain A anchor
    ↓
Backstrip Falkon-1                               → P3 Domain B anchor
    ↓
Overlay curves on Two Oceanics prediction        → FALSIFICATION GATE
    ↓
If CONVERGENT: SEAL as PROVEN
If DIVERGENT: diagnose which domain fails → revise input parameters
    ↓
Forge remaining 4 tools                          → P2-P4 tools
    ↓
SEAL 999 — final verdict
```

---

## SEAL TO LOAD

Full session seal at: `/root/A-FORGE/forge_work/2026-07-10/TWO_OCEANICS_SEAL_v1.0.md`

Contains:
- Evidence chain (17 GEOX calls)
- Falsification scoreboard (8 proven, 4 not proven)
- Collision timeline (11 events, 65 Ma → present)
- Great Unconformity margin hypothesis
- Gap register (P0-P7)
- Scaffold architecture (6 tools + 1 upgrade)
- VAULT999 receipt chain

---

*Forged: 2026-07-10 by opencode-forge under F13 SOVEREIGN directive*  
*DITEMPA BUKAN DIBERI — Next agent: bind, judge, forge, backstrip, falsify, seal.*
