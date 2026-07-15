# IRR-DIP Audit Board — 2026-07-09 (NOT COMPLETE)

> **Do not archive as “system honest and identified.”**  
> Path B/C remain open. Ed25519 identity is **Path A scoped only.**

| Finding | Sev | Status |
|---------|-----|--------|
| Session auth registry authority | P0 | ✅ Fixed + **restarted** — scope: session → authority map |
| Bridge null-suppression | P1 | ✅ Fixed — errors propagate (`isError`), no silent `{}` |
| IRR relative tolerance | P0 | ✅ Fixed (WEALTH) — L1/L2/L3 `0.100001` consistent |
| Session HOLD misread as null | — | ✅ Diagnosis corrected (not bridge line-125 as root of hollow handoff) |
| **Path B organ proxy unauth** | **P1** | **OPEN** — code gate exists; **not** bridge-on E2E verified; HTTP bridge currently **off** |
| **Path C direct organ unauth** | **P1** | **OPEN** — **PROVEN**: WEALTH `:18082` runs `wealth_compute_irr` with `caller_*=null` |
| WELL surface truth | P1 | **OPEN** — health vs MCP tools/list inconsistency |
| Ed25519 bootstrap exemption | P2 | 📝 Accepted risk — **does not** cover Path B/C |

## Forbidden claims (retracted)

- ~~Identity verified; Ed25519 bound across tool surface~~ → **false** for Path C (proven) and Path B (unverified / bridge off).
- ~~Audit complete~~ → **no**.
- ~~Unauthenticated remote tools mitigated~~ → **not verified** as system close.

## Live probes (receipt: `PATH-B-DIP-OPEN-2026-07-09.md`)

1. arifOS `:8088` list = 12 kernel; unlisted `wealth_compute_irr` → **KERNEL_DENY** (anonymous).
2. WEALTH `:18082` direct `wealth_compute_irr` → **success**, no caller identity.
3. `remote_proxy_auth` unit DENY without session — **not** substitute for bridge-on E2E.

## Next

Path B DIP E2E under controlled bridge-on + Path C policy decision + WELL surface audit.
