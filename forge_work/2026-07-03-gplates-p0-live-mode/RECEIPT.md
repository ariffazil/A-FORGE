# GPlates P0 — Live Mode Forge Receipt

**Forged:** 2026-07-03T05:15 UTC  
**Agent:** FORGE (000Ω) / OpenCode  
**Arif signal:** "Jalan terus forge P0?" → YES  
**Blast radius:** LOW (read-only fetcher, no mutation)  
**Reversibility:** FULL (stub fallback preserved)

---

## Summary

Un-hardcoded `GEOX_GPLATES_OFFLINE=1` by implementing live GWS REST API mode in `gplates_fetcher.py`. The fetcher now supports three modes:

| Mode | Trigger | What It Does |
|------|---------|-------------|
| `offline` | `GEOX_GPLATES_OFFLINE=1` (default) | Stub responses — always available |
| `gws` | `GEOX_GPLATES_OFFLINE=0` | Live GWS REST API at gws.gplates.org |
| `pygplates` | pyGPlates installed + rot files | Local computation (future, stub present) |

## Files Changed

1. **`/root/geox/src/geox_core/io/gplates_fetcher.py`** — 115→482 lines
   - Added GWS REST API integration via `requests`
   - Added `_gws_reconstruct()`, `_gws_coastlines()` methods
   - Added `paleocoastlines()` public method
   - Added `velocity()` via finite-difference of two reconstructions
   - Added SHA-256 result caching with configurable TTL
   - Added model name mapping (GEOX→GWS)
   - Added `PlateVelocityResult` with velocity/azimuth (was generic dict)
   - Added `PaleoCoastlineRequest/Result` models
   - Added convenience functions: `reconstruct_point()`, `get_velocity()`
   - Preserved offline stub as fallback

2. **`/root/geox/src/geox_core/orchestration/basin_synthesis_pipeline.py`** — Stage 2 patch
   - Added `import os`
   - Added `_compute_model_spread()` helper (tectonic uncertainty band)
   - Rewrote Stage 2 GPlates section to use live GWS with multi-model ensemble
   - Models queried: Merdith2021, Muller2019, Seton2012
   - Reports model_spread (km) for STS contrast engine

## Evidence: Live GWS Results

### Sabah (6.0°N, 117.0°E) at 23 Ma (early Miocene)

| Model | Paleo-lat | Paleo-lon | Δ from present |
|-------|----------|----------|----------------|
| Merdith2021 | 6.22°N | 121.56°E | +4.6° east |
| Seton2012 | 6.26°N | 114.91°E | −2.1° west |
| Muller2019 | 3.21°N | 116.92°E | −2.8° south |

**Model spread: ~670 km** — tectonic uncertainty band. Three models give three different positions. Merdith2021: SCS opening moved Sabah east. Seton2012: moved Sabah west. Muller2019: moved Sabah south. This is exactly the kind of contrast that the STS model's `emit_contrast()` should fork on — never force convergence.

### Kinabalu Deep (5.8°N, 116.5°E) at 33 Ma (Oligocene)

| Model | Paleo-lat | Paleo-lon |
|-------|----------|----------|
| Merdith2021 | 7.14°N | 123.35°E |
| Muller2019 | 4.26°N | 117.07°E |
| Seton2012 | 8.58°N | 115.11°E |

### Present-day velocity (Muller2019)
- 1.27 cm/yr @ 301° (NW direction) — Sundaland rotation signature

## Test Results

```
Offline stub mode: ✅ 8/8 tests pass
GWS live mode:     ✅ reconstruction, velocity, caching all operational
Cache hit latency: 0.8ms
Existing tests:    ✅ no regressions (1 pre-existing unrelated failure)
```

## What P0 Unlocks

| P1 | McKenzie Subsidence + β | Now has paleo-positions to compute β from |
| P2 | Backstripping + Decompaction | Now has tectonic subsidence framework |
| P6 | Thermal Maturation | Now has paleo-latitudes for heat flow calibration |
| P7 | Paleogeography | Coastlines endpoint live (untested, API ready) |

---

## Remaining: Phase B (pyGPlates local)
- pyGPlates NOT installed (`ModuleNotFoundError`)
- Rotation files NOT downloaded (empty cache dir)
- When installed: GPlatesFetcher auto-detects pyGPlates and uses local mode
- Requires: `pip install pygplates` + download Merdith 2021 .rot files

**Phase B is deferred — GWS REST API provides sufficient live capability for P1-P2.**

---

*DITEMPA BUKAN DIBERI — Forged, not given.*
*Constitutional: F1 AMANAH (reversible), F2 TRUTH (live evidence), F11 AUDIT (this receipt)*
