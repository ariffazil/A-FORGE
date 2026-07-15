# GEOX Castagna Fallback Fix — 2026-07-09

> **FORGE (000Ω)** | T1 AUTO-DO | Law 5 enforcement

## Issue

`petrophysics_unified.py` had `castagna_fallback: bool = True` parameter.
Underlying `geox_subsurface_generate_candidates` already removed Castagna (Law 5).
Unified wrapper would pass unknown parameter → TypeError at runtime.

## Fix

| File | Line | Change |
|------|------|--------|
| `petrophysics_unified.py` | 47 | Removed `castagna_fallback: bool = True` |
| `petrophysics_unified.py` | 148 | Removed `castagna_fallback=castagna_fallback` |

## Verification

- Syntax: ✅
- No remaining `castagna_fallback=True` in codebase: ✅
- Law 5 (Convergence Over Choice): ✅ enforced

## Impact

- Before: Call to `geox_petrophysics(mode="generate", ...)` with missing Vs → TypeError
- After: Call fails explicitly with "Vs required" — no silent estimation

---

*DITEMPA BUKAN DIBERI — Law 5 enforced.*

## Verification

```
Test: geox_petrophysics(mode="generate", target_class="lmr_map", ...) without Vs
Result: EVIDENCE_REF_NOT_FOUND, governance_status=HOLD, artifact_status=REJECTED
Silent Castagna estimation: NONE ✅
```
