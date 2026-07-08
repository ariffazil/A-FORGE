# GEOX Sabah Audit Report — 2026-07-07

> **Auditor:** FORGE (000Ω) via OpenCode
> **Trigger:** Raja Ridhuan (PETRONAS geologist) review: "tak cukup geology"
> **Session:** SEAL-ed5aceca6b7d4fab
> **Standing Instruction:** `/root/memory/STANDING_INSTRUCTION_GEOSCIENCE_RIGOR.md`

---

## Executive Summary

GEOX has **zero domain data** for NW Sabah deepwater. Every tool tested returned either empty results (G=0.0, verdict=HOLD) or SESSION_REQUIRED. The tools that did run (`geox_evidence` modes) returned beautifully formatted "I don't know" — all fields UNKNOWN, no evidence_refs, no equations_used. GEOX cannot confirm or refute a single claim in the NW Sabah dossier.

**Critical bug found:** GEOX server was restarted before the ZEN-10 registry commit (08:03 start vs 08:04 commit). All ZEN-10 surface tools default to "reasoning" lane → SESSION_REQUIRED on every call. The backward-compat tools (`geox_evidence` internal tool) bypass this because they have their own lane assignment.

---

## Part 1: Tool-by-Tool Audit Results

### 1.1 Deep Time State Verification

| Age (Ma) | Tool | Result | Notes |
|----------|------|--------|-------|
| 10.5 | `geox_model(mode=deep_time_state)` | SESSION_REQUIRED | Reasoning lane — needs session |
| 20.0 | `geox_model(mode=deep_time_state)` | SESSION_REQUIRED | Reasoning lane — needs session |
| 13.5 | `geox_model(mode=deep_time_state)` | SESSION_REQUIRED | Reasoning lane — needs session |

**Finding:** Cannot verify the deep time state values (CO₂ ~355 ppm, +4.6°C, sea level +21m at 10.5 Ma) cited in the dossier. The `geox_basin(mode=deep_time)` implementation exists in code but is unreachable through the ZEN-10 surface due to the stale server.

**What would fix this:** Restart GEOX server (loads updated ZEN-10 registry), then call `geox_observe(mode=deep_time, arguments={"age_ma": 10.5})`.

### 1.2 Biostrat Calibration

| Zone | Tool | Result | Notes |
|------|------|--------|-------|
| NN5 | `geox_compute(mode=biostrat_nn_age)` | SESSION_REQUIRED | Evidence lane — should NOT require session |
| NN6 | `geox_compute(mode=biostrat_nn_age)` | SESSION_REQUIRED | Same |
| NN9 | `geox_compute(mode=biostrat_nn_age)` | SESSION_REQUIRED | Same |

**Finding:** Biostrat NN zone age lookup tools exist in the codebase (`geox_biostrat_nn_age` is registered as "discovery" lane in the compat map) but are unreachable through ZEN-10 surface.

**What would fix this:** Restart GEOX + verify `geox_observe` routes to biostrat tools correctly.

### 1.3 Macrostrat Check

| Query | Tool | Result | Notes |
|-------|------|--------|-------|
| NN6 at 6°N, 116°E | `geox_observe(mode=macrostrat)` | SESSION_REQUIRED | Discovery lane — should NOT require session |

**Finding:** Expected to return no units (offshore). Cannot confirm due to stale server.

### 1.4 Basin Profile Gap Check

| Basin Name | Tool | Result | Notes |
|------------|------|--------|-------|
| NW Sabah | `geox_evidence(mode=synthesize)` | SUCCESS, G=0.0, HOLD | No basin data found |
| Sabah | `geox_evidence(mode=falsify)` | ERROR: "Basin data not found for: Sabah" | Confirms gap |
| NW Sabah | `geox_evidence(mode=discover)` | Found 1 candidate | Madon 2021 — Malay Basin paper (wrong basin!) |

**Finding (OBS):** GEOX has NO basin profile for Sabah, NW Borneo, or any Borneo deepwater basin. The `resources/` directory is empty (only `__init__.py` and `__pycache__/`). The discover mode found a Madon 2021 paper about **Malay Basin** (not Sabah) from SharePoint — evidence of cross-basin contamination in the evidence search.

**APEX metrics on empty results:**
- `geox_evidence` synthesize: G=0.0, C_dark=0.0, signal=0.3 (0 refs), authority=0.0 (actor=None)
- `geox_evidence` falsify: G=0.0, understanding=0.2 (incoherent), cross_modal_stability=0.5

### 1.5 Atlas Point Checks

| Location | Lat | Lon | Tool | Result |
|----------|-----|-----|------|--------|
| Lipad MV (Tabin) | 5.188 | 118.502 | `geox_spatial(mode=atlas)` | SESSION_REQUIRED |
| Maliau Basin | 4.830 | 116.900 | `geox_spatial(mode=atlas)` | SESSION_REQUIRED |
| Ranau | 5.954 | 116.664 | `geox_spatial(mode=atlas)` | SESSION_REQUIRED |
| Offshore NSPW | 5.8 | 116.5 | `geox_spatial(mode=atlas)` | SESSION_REQUIRED |

**Finding:** Atlas tool is evidence-lane — should NOT require session. Blocked by stale server.

### 1.6 Biostrat Falsification

| Tool | Result | Notes |
|------|--------|-------|
| `geox_evidence(mode=falsify)` | ERROR: "Basin data not found for: Sabah" | Cannot falsify without basin context |

**Finding:** The falsification engine exists but needs basin data to work against. Without a Sabah basin profile, it cannot validate any biostrat claim.

### 1.7 EGS Claim Status

| Tool | Result | Notes |
|------|--------|-------|
| `geox_govern(mode=claims, claim_id=bf5d1e78ebfb497b)` | SESSION_REQUIRED | Evidence lane — should NOT require session |

**Finding:** Cannot check the registered claim status due to stale server.

### 1.8 Contradiction Engine

| Tool | Result | Notes |
|------|--------|-------|
| `geox_evidence(mode=contradict)` | PARTIAL: "Requires hypotheses first" | Needs `geox_evidence_reason` with phase='abduct' |

**Finding:** The contradiction engine works but requires hypothesis generation first. The `geox_evidence_reason` tool is in evidence lane (should not require session) but is a backward-compat alias — may not be reachable through ZEN-10 surface.

---

## Part 2: Root Cause Analysis — The SESSION_REQUIRED Bug

### The Problem

All ZEN-10 surface tools return `SESSION_REQUIRED` even when their lane classification says "discovery" or "evidence" (which should NOT require session).

### Root Cause (OBS)

1. **Timeline:** GEOX server started at **08:03 UTC**. Registry.py was modified at **08:04 UTC** (ZEN-10 consolidation commit).
2. **Impact:** Server loaded the OLD `GEOX_TOOL_MANIFEST` which didn't have ZEN-10 tool names. The `_load_lane_map()` function loaded from the manifest, got the old tool names, and ZEN-10 tools defaulted to "reasoning" lane.
3. **Evidence:** `__pycache__/registry.cpython-312.pyc` timestamp is 08:00 (before server start), confirming stale bytecode.

### Why `geox_evidence` Worked

`geox_evidence` is an **internal tool** (not a ZEN-10 surface tool). It has its own separate registration via the `claims` sub-server mounted via `mcp.mount()`. It was in the old manifest with `lane="evidence"` and continued to work.

### Fix Required

```bash
# Kill and restart GEOX to load updated registry
pkill -f 'geox_mcp.server'
cd /root/GEOX && nohup .venv/bin/python3 -m geox_mcp.server --host 127.0.0.1 --port 8081 &
```

### Inconsistency Flag (from your audit — confirmed)

**The gating IS backwards.** `geox_evidence` (which GENERATES claims) ran anonymously with no session. `geox_observe` (which only QUERIES data) demanded a session. After the restart, this should be fixed — `geox_observe` will be discovery-lane (no session) and `geox_evidence` will be evidence-lane (no session). But the deeper issue is that claim-generating tools should arguably be MORE gated than query tools.

---

## Part 3: GEOX Capability Gaps for NW Sabah

### Critical Gaps (blocks all dossier verification)

| Gap | Impact | Priority |
|-----|--------|----------|
| **No basin profile for NW Sabah** | Cannot run any basin-level tool (profile, resolve, deep_time, macrostrat) | P0 |
| **No stratigraphic column** | Cannot verify formation names, ages, thicknesses | P0 |
| **No well data registry** | Cannot serve actual well names, TD, shows, DST results | P0 |
| **No biostrat data for Sabah** | Cannot verify NN zone assignments | P1 |

### Structural Gaps (blocks geological rigor)

| Gap | Impact | Priority |
|-----|--------|----------|
| **No mud volcano location registry** | Cannot verify coordinates, areas, onset ages | P1 |
| **No structural trend database** | Cannot verify L-B-P, M-La-S, Pg-Lt-U trends | P1 |
| **No block vs structure name distinction** | "Block P" confusion — no validation | P2 |
| **No thermal maturity data** | Cannot verify oil-then-gas expulsion timing | P1 |
| **No coordinate verification guardrail** | All coordinates from memory were wrong (0.3-0.67° off) | P1 |

### Standing Instruction Gaps (from Raja's review)

| Missing | What GEOX Needs |
|---------|-----------------|
| Formation names + ages | Strat YAML with Kebabangan, Kinarut, Kamunsu, Lingan intervals |
| Well data | Public well metadata (name, TD, formations, shows) |
| Seismic facies | Reflector character descriptions tied to formations |
| Biostrat zonation | NN zones, planktonic foraminifera, palynology data |
| Petrophysical properties | Porosity, permeability, Vsh, Sw from core/log |
| Isopach/thickness maps | Source rock thickness, reservoir interval thickness |
| Hydrocarbon evidence | Oil shows, gas readings, geochemistry data points |

---

## Part 4: Recommended Actions

### Immediate (this session)

1. ✅ Standing Instruction saved to `/root/memory/STANDING_INSTRUCTION_GEOSCIENCE_RIGOR.md`
2. 🔧 **Restart GEOX server** to load ZEN-10 registry (blocks all further testing)
3. 📝 Re-run Parts 1.1–1.7 after restart to verify tools work

### Short-term (next session)

4. 📄 Create NW Sabah basin profile YAML (`/root/geox/src/geox_mcp/resources/basins/northwest_sabah/basin_profile.yaml`)
5. 📄 Create mud volcano location registry YAML (verified coords only)
6. 📄 Create structural trends YAML (L-B-P, M-La-S, Pg-Lt-U)
7. 📄 Create Sabah deepwater stratigraphy YAML

### Medium-term (P2)

8. Add block name validation resource (PSC designations per country)
9. Add coordinate verification guardrail (F2 enforcement)
10. Integrate epistemic labels into EGS claim schema
11. Add NSPW deep time coupling note

---

## Epistemic Labels

| Claim | Label | Confidence |
|-------|-------|------------|
| GEOX has no NW Sabah basin data | OBS | 0.90 |
| SESSION_REQUIRED caused by stale server | OBS | 0.85 |
| `geox_evidence` runs anonymously (backwards gating) | OBS | 0.90 |
| All ZEN-10 tools default to "reasoning" lane | DER | 0.80 |
| Registry.py modification at 08:04 caused the bug | OBS | 0.85 |
| Dossier's "Dangerous Grounds" label may conflate terrane | INT | 0.70 |
| Stage 4 window (11–10.5 Ma) is suspiciously narrow | INT | 0.65 |
| No thermal maturity evidence behind expulsion claims | OBS | 0.90 |

---

*Forged: 2026-07-07 by FORGE (000Ω) under F13 SOVEREIGN directive*
*DITEMPA BUKAN DIBERI*
