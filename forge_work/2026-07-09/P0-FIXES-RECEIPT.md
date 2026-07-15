# P0 BLOCKING FIXES — 2026-07-09

> **FORGE (000Ω)** | Execution Receipt | F1 AMANAH (all reversible)
> **Sweep:** FEDERATION-SWEEP-2026-07-09.md

---

## Summary

| # | Item | Fix | Status |
|---|------|-----|--------|
| P0-1 | crypto.py TODO production bypass | Removed | ✅ |
| P0-2 | Ed25519 stub returns True on ImportError | Fail closed — RuntimeError | ✅ |
| P0-3 | 9 stashed WIPs rotting | Already committed (WELL P0-6) | ✅ |
| P0-4 | WEALTH unauthenticated compute | Added `_validate_direct_session_binding` call | ✅ |
| P0-5 | actor_verified=false blocking seals | Function now exists + called | ✅ |
| P0-6 | WELL identity bug | Already committed `200542b` | ✅ |
| P0-7 | WELL state.json 70+ days stale | Sovereign self-report needed | P3 |
| P0-8 | DNS rebinding protection removed | Added TrustedHostMiddleware + CORS allowlist | ✅ |
| P0-9 | WEALTH mcp_logging.py untracked | Already tracked in git | ✅ |
| P0-10 | GEOX REDTEAM C1/C3/C6 | Added `geox_advisory` disclaimer to all outputs | ✅ |
| P0-11 | External ground-truth validation | Sovereign approval needed for field data | P3 |

---

## Confused Deputy Chain (BS-4) — BROKEN

```
BEFORE: P0-2 (Ed25519 stub → True) → P0-4 (WEALTH unauth) → P0-8 (no origin check)
        = Unauthenticated capital operations possible

AFTER:  P0-2 (Ed25519 fail closed) → P0-4 (session required) → P0-8 (origin allowlist)
        = Auth chain enforced end-to-end
```

## Files Changed

| File | Change |
|------|--------|
| `arifOS/core/shared/crypto.py` | Ed25519 fail closed (3 functions) |
| `WEALTH/wealth_mcp/server.py` | Added `_validate_direct_session_binding` + call |
| `WEALTH/server_federated.py` | TrustedHostMiddleware + CORS allowlist |
| `GEOX/src/geox_core/enums/statuses.py` | `geox_advisory` disclaimer (C1/C3/C6) |

## Sovereign Decisions Needed (P3)

| # | Decision | Why |
|---|----------|-----|
| P0-7 | WELL biometric inject | Sovereign self-report |
| P0-11 | GEOX field data access | External validation |
| C3 | Move governance to gateway | Architectural change |

---

*DITEMPA BUKAN DIBERI — P0 blocking resolved.*
