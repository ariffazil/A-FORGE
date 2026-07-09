# GEOX Resources Dead Code Cleanup — 2026-07-09

> **FORGE (000Ω)** | T1 AUTO-DO | F4 CLARITY (entropy reduction)

## Issue

29 functions in `resources/__init__.py` had unreachable `mcp.resource()` decorator code after `return` statements. Pattern:

```python
def geox_earthquake_usgs_summary():
    return "geox://earthquake/usgs_summary"  # Returns here
    
    mcp.resource(...)  # DEAD CODE — never reached
```

Resources ARE properly registered in `register_resources()`. The individual function bodies were dead code.

## Fix

Removed 408 dead code lines from `resources/__init__.py`.

| Before | After |
|--------|-------|
| 1771 lines | 1363 lines |
| 29 dead code blocks | 0 |
| 29 mcp.resource in register_resources | 29 (unchanged) |

## Verification

- Syntax: ✅
- Module imports: ✅
- Resource registration count: ✅ (29 in register_resources)

## Impact

- No functional change — resources were already registered
- Reduced file size by 23%
- Removed confusion about where resources are actually registered

---

*DITEMPA BUKAN DIBERI — F4 CLARITY enforced.*
