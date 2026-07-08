# P0+P1 Task Map Fixes — 2026-07-07

> **Actor:** FORGE-000Ω | **Session:** INIT-anchored | **F1-F13:** accepted

## Summary

| # | Priority | Item | Status | Evidence |
|---|----------|------|--------|----------|
| 1 | P0 | Ed25519 verification stub → real | ✅ DONE | `governance_identity.py` + `identities.py` now call `verify_sovereign_signature()` |
| 3 | P0 | architect.py floor checks | ✅ DONE | F1, F4, F11, F13 implemented; F2, F7, F9 return ERROR (fail closed) |
| 5 | P1 | APEX hardcoded G stub | ✅ ALREADY RESOLVED | APEX Phase 3 commit (df79e0b) replaced it. `tools.py` genius mode returns live telemetry. |
| 7 | P1 | memory_store floor check log-only | ✅ DONE | `enforce_memory_routing()` now raises on: invalid band, anonymous actor on sacred/canon, sacred without SOVEREIGN/JUDGE |

## Files Modified

| File | Change |
|------|--------|
| `arifosmcp/runtime/governance_identity.py` | Added `_verify_ed25519_proof()`, `_verify_hmac_proof()`. Imports `sovereign_verify` + `sovereign_signer`. |
| `arifosmcp/apps/command_center/identities.py` | Same Ed25519/HMAC wiring (parallel copy). |
| `arifosmcp/tools/architect.py` | `_constitutional_checklist()` now does real checks for F1, F4, F11, F13. F2/F7/F9 return `status: "ERROR"`. |
| `arifosmcp/runtime/memory_store.py` | `enforce_memory_routing()` validates band, actor, sacred tier. Raises `RuntimeError` on violation. |

## Files Created

| File | Purpose |
|------|---------|
| `tests/runtime/test_governance_identity_ed25519.py` | 13 tests: Ed25519/HMAC proof verification, stale nonce rejection, tampered sig rejection, integration (skips if key unavailable). |

## Test Results

- `test_governance_identity_ed25519.py`: **11 passed, 2 skipped** (key not in this env)
- `test_sovereign_identity_pem.py`: **1 skipped** (no regression)
- `test_memory_tier_action_fix.py`: **11 passed** (no regression)
- `architect.py` floor checks: manual verification, all 3 scenarios correct

## Key Decision: P1-#5

The hardcoded `G=0.12348` stub was NOT found in the current codebase. The APEX Phase 3 commit (`df79e0b1a`, 2026-07-06) already replaced the `tools.py` genius mode with live system_health telemetry. Real APEX G = A·P·E·X·Φ computation lives in:
- `apex_primitives.py:104` — `compute_apex_from_metrics()` (from tool call metrics)
- `apex_c_dark.py:147` — `compute_apex()` (from explicit parameters)

**DER:** Task map was likely written before the Phase 3 commit landed.

## Remaining Task Map Items

- P0-#2: Sigstore verification stub (still TODO)
- P0-#4: WELL public surface 404
- P1-#6, #8, #9, #10: Various wiring gaps
- P2: 6 missing data / dead references
- P3: 4 deferred items

---

*DITEMPA BUKAN DIBERI*
