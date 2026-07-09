# GEOX Panel D Law 7 Fix — 2026-07-09

> **FORGE (000Ω)** | T1 AUTO-DO | Law 7 enforcement

## Issue

`geox_panel_d_render` (PIL-based) rendered cognitive overlays without checking if RSI pipeline ran first. GUI before physics = Law 7 violation.

## Fix

Added provenance guard to both implementations:
- `geox_seismic_vision_ai.py:200`
- `seismic_vision_ai.py:200`

Guard checks `obs_manifest.provenance.source_pipeline` must be one of:
- `geox_physical_reality_interpret`
- `geox_rsi_interpret`
- `geox_geological_cognition_run`

## Verification

```
Without provenance → HOLD: "Law 7 violation: GUI before physics"
With provenance    → DER_COGNITIVE_RENDER (proceeds)
```

## Impact

- Before: Any image could get cognitive overlays without RSI
- After: Must run physical reality interpretation first

---

*DITEMPA BUKAN DIBERI — Law 7 enforced.*
