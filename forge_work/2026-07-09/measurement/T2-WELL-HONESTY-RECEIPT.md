# T2 WELL STALE/MOCK Honesty — Receipt

**Date:** 2026-07-09  
**Actor:** grok-build  
**Task:** Refresh WELL biometrics or formalize permanent mock banner in cockpit

## Decision

No wearable sensor available → **formalize honesty**, do not fake GREEN body truth.

## Root cause (F2)

`biometric_inject.sh` wrote `truth_status=VERIFIED` for sovereign self-report scores. Health then advertised GREEN + `truth_status_verified` while data was inject-only.

## Fixes

| Surface | Change |
|---------|--------|
| `WELL/server.py` | `_normalize_truth_status`, `_honesty_block`, inject→OPERATOR_REPORTED coerce; cognitive-only inject ≠ sensor telemetry |
| `/health` | `honesty` + `honesty_banner` always published |
| `biometric_inject.sh` | writes OPERATOR_REPORTED + SELF-REPORT banner |
| `state.json` | live rewrite to OPERATOR_REPORTED |
| `AAA/src/Cockpit.tsx` | permanent WELL honesty banner |
| telegram WellPage | honesty banner card |
| tests | 9/9 `test_well_state_honesty.py` |

## Live T1 probe

```
truth_status=OPERATOR_REPORTED
well_signal=WELL_OPERATOR_PRESENT
owner_summary.color=YELLOW
honesty.code=SELF_REPORT
has_verified_telemetry=false
cockpit_banner_required=true
```

## Next

T3 — F13 seal DRAFT doxes if desired.
