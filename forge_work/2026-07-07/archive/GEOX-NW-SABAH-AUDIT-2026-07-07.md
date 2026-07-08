# NW Sabah GEOX Audit & Resource Build — Report

**Date:** 2026-07-07
**Actor:** FORGE (000Ω) under F13 SOVEREIGN
**Source:** Claude feedback + Raja Ridhuan ("tak cukup geology") + dossier audit
**Skill:** geological-artifact-rigor (8 hard rules loaded)

---

## Part 1: GEOX Tool Audit

### Tools Attempted

| Tool | Result | Note |
|------|--------|------|
| `geox_deep_time_state(10.5 Ma)` | SESSION_REQUIRED | F1 finding confirmed — GEOX blocks even read-only probes |
| `geox_deep_time_state(20 Ma)` | SESSION_REQUIRED | Same |
| `geox_basin("northwest_sabah")` | SESSION_REQUIRED | Same |
| `geox_atlas(5.188, 118.502)` | SESSION_REQUIRED | Same |

**Root cause:** GEOX MCP server requires transport-level `Mcp-Session-Id` for ALL tools. This is the asymmetry Claude identified as F1 — arifOS `arif_triage` works without a session, GEOX `surface_status` doesn't.

**Impact:** Cannot run live GEOX audit without first establishing a GEOX MCP session. The Part 1 audit tools are all blocked by the same issue.

**Fix needed:** GEOX server should exempt `geox_surface_status` and other L0_OBSERVE tools from the transport session requirement. This is a GEOX server change, not an arifOS change.

### Existing Sabah Data in GEOX

| Resource | Path | Status |
|----------|------|--------|
| Basin profile | `/root/geox/resources/basins/sabah_basin/basin_profile.yaml` | Exists but generic (50 lines) |
| Petroleum system | `/root/geox/resources/basins/sabah_basin/petroleum_system.yaml` | Exists, basic |
| NN zones | `/root/geox/resources/biostrat/nn_zones.json` | Good — 52 lines, Martini 1971 scheme |
| NW Sabah basin profile | `/root/geox/resources/basins/northwest_sabah/basin_profile.yaml` | **NEW** — created today |
| Stratigraphic column | `/root/geox/resources/stratigraphy/northwest_sabah_strat.yaml` | **NEW** — created today |
| Well registry | `/root/geox/resources/wells/northwest_sabah_wells.yaml` | **NEW** — created today |
| Mud volcano registry | `/root/geox/resources/features/sabah_mud_volcanoes.yaml` | **NEW** — created today |
| Structural trends | `/root/geox/resources/structural/northwest_sabah_trends.yaml` | **NEW** — created today |
| Block name registry | `/root/geox/resources/structural/northwest_sabah_naming.yaml` | **NEW** — created today |

---

## Part 2: Resources Created

### 2.1 NW Sabah Basin Profile (HIGH)
**File:** `/root/geox/resources/basins/northwest_sabah/basin_profile.yaml`
**Size:** ~200 lines
**Content:** Tectonic setting, 3 structural domains (L-B-P, M-La-S, Pg-Lt-U), NSPW mud canopy, petroleum system elements, key discoveries (Kikeh, Limbayong, Rotan), deep time context at 20 Ma and 10.5 Ma, data gaps, verified coordinates, naming convention.

### 2.7 Stratigraphic Column (HIGH — Raja's "tak cukup geology")
**File:** `/root/geox/resources/stratigraphy/northwest_sabah_strat.yaml`
**Size:** ~180 lines
**Content:** 7 formations with ages, NN zone calibration, lithology, thickness, wireline signatures, reservoir quality, biostrat markers, seismic character. 4 key seismic horizons (Yellow, Pink). Biostrat framework with NN5/NN6/NN9/NN10 zones. Data gaps explicitly listed.

### 2.8 Well Registry (HIGH)
**File:** `/root/geox/resources/wells/northwest_sabah_wells.yaml`
**Size:** ~80 lines
**Content:** 5 wells (Kikeh-1, Kikeh-2, Limbayong-1, Rotan-1, Bestari-1) with operator, field, shows, DST results. Data gaps: well tops, petrophysical logs, core data, biostrat reports — all not publicly available.

### 2.2 Mud Volcano Registry (MED)
**File:** `/root/geox/resources/features/sabah_mud_volcanoes.yaml`
**Size:** ~90 lines
**Content:** 4 verified locations (Lipad GPS, Tabin map, Maliau published, Ranau published). NSPW offshore canopy extent. Coordinate verification protocol with epistemic mapping (GPS→OBS, MAP→INT, PUBLISHED→OBS, ESTIMATE→SPEC).

### 2.3 Structural Trend Database (MED)
**File:** `/root/geox/resources/structural/northwest_sabah_trends.yaml`
**Size:** ~120 lines
**Content:** 3 named trends (L-B-P, M-La-S, Pg-Lt-U) with style, orientation, key horizons, detachment depth, trap type, discoveries. Structural evolution (constructive/destructive/post-kinematic). Naming convention warning.

### 2.9 Block Name Validation (MED)
**File:** `/root/geox/resources/structural/northwest_sabah_naming.yaml`
**Size:** ~100 lines
**Content:** PSC blocks (G, H, K, N, X, R, 2K, 2V, 2W), structural trends (L-B-P, M-La-S, Pg-Lt-U), field names (Kikeh, Limbayong, Bestari, Rotan). Invalid block "Block P" explicitly listed with correction. 6 validation rules.

### Skill Created
**File:** `/root/.agents/skills/geological-artifact-rigor/SKILL.md`
**Content:** 8 hard rules from Raja's feedback + coordinate verification + block vs structure names.

---

## Part 3: Raja's Feedback Integration

### "Tak cukup geology" — What Was Missing

| Missing Element | Status After Fix |
|----------------|-----------------|
| Formation names, ages, thicknesses | ✅ Stratigraphic YAML — 7 formations with full detail |
| Well data (names, TD, shows, DST) | ✅ Well registry — 5 wells with public data |
| Seismic facies | ✅ Seismic character per formation in strat YAML |
| Biostrat zonation | ✅ NN5/NN6/NN9/NN10 zones with age calibration |
| Petrophysical properties | ⚠️ Ranges from literature — no actual core/log data |
| Isopach/thickness maps | ❌ Not created — requires actual well penetrations |
| Hydrocarbon evidence | ✅ DST results and shows in well registry |
| Sedimentological detail | ⚠️ Basic — environment descriptions, no facies logs |

### What Would Upgrade Each Gap

| Gap | Upgrade Needed | Current Status |
|-----|---------------|----------------|
| Petrophysical properties | Core data from key wells | HYPOTHESIS — analogue ranges |
| Isopach maps | Well penetrations + seismic mapping | Not possible without data |
| Detailed sedimentology | Core descriptions, thin sections | Not publicly available |
| Biostrat calibration | Local biostrat reports from wells | Operator confidential |

---

## Deliverables Summary

| # | Deliverable | Path | Status |
|---|------------|------|--------|
| 1 | Audit report | This file | ✅ |
| 2 | Basin profile YAML | `/root/geox/resources/basins/northwest_sabah/basin_profile.yaml` | ✅ |
| 3 | Mud volcano YAML | `/root/geox/resources/features/sabah_mud_volcanoes.yaml` | ✅ |
| 4 | Structural trends YAML | `/root/geox/resources/structural/northwest_sabah_trends.yaml` | ✅ |
| 5 | Stratigraphic YAML | `/root/geox/resources/stratigraphy/northwest_sabah_strat.yaml` | ✅ |
| 6 | Well registry YAML | `/root/geox/resources/wells/northwest_sabah_wells.yaml` | ✅ |
| 7 | Block name registry | `/root/geox/resources/structural/northwest_sabah_naming.yaml` | ✅ |
| 8 | Skill: geological-artifact-rigor | `/root/.agents/skills/geological-artifact-rigor/SKILL.md` | ✅ |

---

## Lessons Learned

1. **F1 is real.** GEOX blocks even read-only probes without a session. The Part 1 audit couldn't run live.
2. **Raja was right.** The existing Sabah basin profile was 50 lines of generic tectonic framing. Working geologists need formation names, well data, wireline signatures, biostrat zonation.
3. **Coordinates from memory are always wrong.** Lipad was 0.5° off, Maliau was 0.67° off. Every coordinate needs a verified source.
4. **"Block P" doesn't exist.** Category errors between PSC blocks, structural trends, and field names are a real failure mode.
5. **Framework ≠ finding.** Tectono-stratigraphic panels are framework, not geology. The tagging system governs content; it doesn't generate it.

---

*DITEMPA BUKAN DIBERI*
