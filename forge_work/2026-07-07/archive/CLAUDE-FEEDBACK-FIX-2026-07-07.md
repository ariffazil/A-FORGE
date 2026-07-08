# Claude Feedback Fix — 5 Structural Findings

**Date:** 2026-07-07
**Source:** Claude live probe of arifOS federation
**Actor:** FORGE (000Ω) under F13 SOVEREIGN
**Verdict:** 3 code fixes applied, 2 documented for cross-organ action

---

## Summary

| # | Finding | Root Cause | Fix | Status |
|---|---------|-----------|-----|--------|
| F1 | GEOX stricter than kernel | GEOX MCP server requires transport session for `surface_status`; arifOS `arif_triage` doesn't | Documented — needs GEOX server change (out of scope for arifOS kernel fix) | DOCUMENTED |
| F2 | Unauthenticated default path | `arif_triage` auto-assigns `openclaw-anon`, returns full verdict JSON that "looks complete" | Added `_ATTENTION` field to envelope when `actor_verified=false` | FIXED |
| F3 | Nine-signal false confidence | Two "good" planes anchor attention before overall "bad" verdict | Restructured: `overall` comes first; `_dominant_plane` + `_dominance_rule` metadata added | FIXED |
| F4 | Registry audit inconsistency | WELL has rich `intended/registered/callable`; WEALTH returns flat list | Documented — needs WEALTH organ `wealth_registry_status` enhancement | DOCUMENTED |
| F5 | Session accumulation | `_FileSessionStore` had no periodic cleanup; stage always "unknown" | Added `reap_expired()` + `items()` to store; triage reports `most_recent_session` stage | FIXED |

---

## F2: Unauthenticated Default Path

**File:** `/opt/arifos/app/arifosmcp/runtime/tools.py` (line ~3098)
**Canonical:** `/root/arifOS/arifosmcp/runtime/tools.py`

When `actor_verified=false`, the envelope now includes:
```json
{
  "_ATTENTION": "IDENTITY_NOT_VERIFIED — actor_verified=false. This response was generated without authenticated identity. All verdicts are OBSERVE_ONLY. Do not treat as authoritative. Call arif_init(mode='init') to establish a governed session."
}
```

**Rationale:** Claude feedback: the JSON "looks complete" even when unauthenticated, creating false sense of security. The `_wrapper_degradation` list existed but was buried. The `_ATTENTION` field is top-level and impossible to miss.

---

## F3: Nine-Signal Display Restructure

**File:** `/opt/arifos/app/arifosmcp/runtime/tools.py`
**Functions:** `_nine_signal_from_status`, `_ok` (P0-3 override section)

### Changes:
1. `_nine_signal_from_status` now returns `overall` as the FIRST key (not last)
2. After P0-3 override in `_ok`, dominance detection runs:
   - `_dominant_plane`: which sub-signal is the weakest link (e.g., "psi")
   - `_dominant_state`: the state of that signal (e.g., "SYUBHAH")
   - `_dominance_rule`: explains the floor-dominates-aggregate principle
3. Uses `_build()` helper to ensure consistent structure

### Before:
```json
{"delta": {"state": "KUKUH"}, "psi": {"state": "SYUBHAH"}, "omega": {"state": "BIJAKSANA"}, "overall": {"state": "SYUBHAH"}}
```

### After:
```json
{
  "overall": {"state": "SYUBHAH", "en": "DOUBTFUL"},
  "delta": {"state": "KUKUH", "en": "SOLID"},
  "psi": {"state": "SYUBHAH", "en": "DOUBTFUL"},
  "omega": {"state": "BIJAKSANA", "en": "WISE"},
  "_dominant_plane": "psi",
  "_dominant_state": "SYUBHAH",
  "_dominance_rule": "Sub-signal floor dominates aggregate: psi=SYUBHAH overrides overall. Anchoring on majority-good planes is a known cognitive bias."
}
```

---

## F5: Session Hygiene

**Files:**
- `/opt/arifos/app/arifosmcp/runtime/tools.py` — `_FileSessionStore` class
- `/opt/arifos/app/arifosmcp/tools/kernel_canonical.py` — `arif_triage` function

### Changes:
1. **`reap_expired()` method** added to `_FileSessionStore`:
   - Checks both `expires_at_unix` (float) and `expires_at` (ISO 8601)
   - Sessions without expiry fields kept (legacy compat)
   - Logs reaped count to `arifosmcp.session_store`
2. **Auto-reap** integrated into `keys()`, `values()`, `items()`, `__len__()`:
   - Every store access triggers cleanup
   - Session count is now accurate
3. **`items()` method** added (was missing — `_FileSessionStore` lacked dict-like iteration)
4. **Triage stage resolution** improved:
   - When no `session_id` provided, finds the most recent session's stage
   - Uses `expires_at_unix`, `created_at_unix`, `issued_at` fields
   - Reports `stage_source: "most_recent_session"` instead of `"unknown"`

### Before:
```
active_sessions: 63, stage: unknown, stage_source: unknown
```

### After:
```
active_sessions: 59, stage: 000, stage_source: most_recent_session
```

---

## F1 & F4: Documented (Cross-Organ)

### F1: GEOX stricter than kernel
- **Root cause:** GEOX's FastMCP server requires a transport-level `Mcp-Session-Id` for ALL requests including `geox_surface_status` (a pure registry probe). arifOS's `arif_triage` operates without any session.
- **Fix needed:** GEOX server should exempt `geox_surface_status` from session requirement (L0_OBSERVE, read-only, no governance needed).
- **File:** `/root/GEOX/src/geox_mcp/server.py`

### F4: Registry audit inconsistency
- **Root cause:** `well_registry_status` returns rich drift data (intended/registered/callable/phantom/deprecated). `wealth_registry_status` returns a flat tool list.
- **Fix needed:** WEALTH organ needs `wealth_registry_status` to return the same structure as WELL: `intended_tools`, `registered_tools`, `callable_tools`, `phantom_tools`, `deprecated_callable`, `canonical_callable`, `verdict`.
- **File:** `/root/WEALTH/` MCP server

---

## Files Modified

| File | Change |
|------|--------|
| `/opt/arifos/app/arifosmcp/runtime/tools.py` | F2 (_ATTENTION), F3 (nine-signal restructure), F5 (reap_expired + items) |
| `/opt/arifos/app/arifosmcp/tools/kernel_canonical.py` | F5 (triage stage resolution) |
| `/root/arifOS/arifosmcp/runtime/tools.py` | Canonical copy synced |
| `/root/arifOS/arifosmcp/tools/kernel_canonical.py` | Canonical copy synced |

## Backups

| File | Backup |
|------|--------|
| `/opt/arifos/app/arifosmcp/runtime/tools.py` | `.bak-20260707-feedback` |
| `/opt/arifos/app/arifosmcp/tools/kernel_canonical.py` | `.bak-20260707-feedback` |

---

*DITEMPA BUKAN DIBERI*
