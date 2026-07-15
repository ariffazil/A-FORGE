# GEOX Gap Scaffold Status — 2026-07-09

> Session response to 6-item gap scaffold + init priority stack.
> Band: **YELLOW** · Receipt: **DRAFT_ONLY** (not VAULT999 sealed)

## Status matrix

| # | Severity | Gap | Status | Evidence |
|---|----------|-----|--------|----------|
| 1 | CRITICAL | No real LAS/SEG-Y/checkshot | **PARTIAL** | Real LAS staged: `geox/data/real_wells/q15_15_9_19/` (North Sea Q15 15/9-19). **Petronas proprietary ABSENT on host.** SEG-Y + checkshot still missing. `run_geox_001_real_las()` wired. |
| 2 | HIGH | 3 GEOX core skills archived | **CLOSED** | Restored from `.archive-2026-07-08/`: `geox-epistemic-ladder`, `geox-contradiction-engine`, `geox-earth-evidence`, `geox-claim-grammar`, `geox-petrophysics-bounds` → active `.agents/skills/`. |
| 3 | HIGH | `geox_claim` capability graph | **CLOSED** | Registered unified `geox_claim` in `arifOS/federation/GEOX.yaml` judgment lane + `tool_lane_map` + `kernel_envelope.py` judgment set. Capability surface GEOX tools 31→69. |
| 4 | MEDIUM | 1D only / no 3D structural | **CLOSED (skill)** | Prospect-maturation Phase 5b routes to `geox_3d_model_build`. Runtime still needs structural picks JSON to execute. |
| 5 | MEDIUM | ASCII-only maps | **CLOSED (skill)** | Phase 6 now prefers `geox_map_layers_list` → `scene_plan` → `render_preview`. |
| 6 | LOW | Semantic layer / Graphiti offline | **ALREADY GREEN** | `graphiti-mcp` Up 4 days healthy; FalkorDB + Qdrant up; `GRAPHITI_L5_ENABLED` defaults `true`. No config change required. |

## Gap 1 honesty (F2)

```text
Petronas well data on disk: NOT FOUND
Best real LAS: Q15 15/9-19 (Danish North Sea) — usable for well-tie PHYSICS tests
Not a Malay Basin / Petronas well — do not claim Petronas calibration
Need sovereign data drop: LAS + tops + checkshot + seismic extract for Petronas path
```

## Commands

```bash
# Skills restored — load works
ls /root/.agents/skills/geox-epistemic-ladder/SKILL.md

# Real LAS GEOX-001
cd /root/geox && PYTHONPATH=src python -m geox_core.benchmarks.geox_001_well_seismic_truth --real-las --scenario mistie_hold

# Synthetic regression still default
PYTHONPATH=src pytest tests/benchmarks/test_geox_001_well_seismic_truth.py -q
```

## Still blocked on human / data

1. **Petronas LAS + checkshot + SEG-Y** — not forgeable from public cache.
2. POS arithmetic fix on PARAM-PADANG proposal (0.50 vs 0.39) — separate DRAFT edit.
3. VAULT999 seal of any prospect — needs F13 word.

## Init stack residual

| Priority | Task | Residual |
|----------|------|----------|
| 1 CRITICAL | Petronas well-tie | Awaiting data drop |
| 2 HIGH | Restore skills | Done |
| 3 HIGH | geox_claim register | Done |
| 4 MEDIUM | Map pipeline | Skill wired; run live when bbox known |
| 5 MEDIUM | 3D structural | Skill wired; needs model JSON |

---
*Forged 2026-07-09 · DRAFT_ONLY · DITEMPA BUKAN DIBERI*
