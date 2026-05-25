> ⚠️ **NOT CURRENT AUTHORITY** — This document is archived.
> 
> It was demoted to `INTERNAL REFERENCE` in the 2026-05-25 PHOENIX-73E cleanup.
> **Do not cite as current policy.** Current policy: `FEDERATION_STATUS.md` + `REPO_ROLE_MAP.md`.
>
> ---
> 
# SOT: AAA Federation Runtime Mapping (Archived Snapshot)
> ⚠️ Historical cross-repo snapshot from 2026-05-11.
> Keep for audit lineage only; verify live state independently.
**Timestamp:** 2026-05-11
**Status:** LIVE_WITH_ONE_EXECUTION_GAP
**Seal:** PARTIAL — execution bridge absent, federation surfaces otherwise healthy

This document is the current cross-repo runtime map for the AAA-led federation after ingress repair, WEALTH invariant sealing, and arifOS readiness repair.

---

## Federation Runtime Snapshot

| Organ | Repo | Public / Local Surface | Current Truth |
|---|---|---|---|
| AAA | `/root/AAA` | `https://aaa.arif-fazil.com/ready` | `healthy` |
| arifOS | `/root/arifOS` | `https://arifos.arif-fazil.com/ready` | `pass` |
| GEOX | `/root/geox` | `https://geox.arif-fazil.com/ready` | `ok` |
| WEALTH | `/root/wealth` | `https://wealth.arif-fazil.com/ready` | `ready` |
| WELL | `/root/WELL` | `https://well.arif-fazil.com/ready` | `WELL_PASS` |
| A-FORGE bridge | `/root/A-FORGE` | `127.0.0.1:7071/health` | **unreachable** |

---

## Routing Law

1. **AAA** identifies and brokers the operator session.
2. **arifOS** judges with the 13 canonical tools and F1-F13 floors.
3. **GEOX / WEALTH / WELL** provide earth, capital, and human-readiness evidence.
4. **A-FORGE** is still the execution adapter of record, but its standalone bridge container is not currently running.
5. **VAULT999** remains the immutable audit destination.

---

## Current Constraint

The federation is no longer in the earlier transition described by this document's previous revision. The actual current gap is narrower:

- ingress is fixed,
- arifOS readiness is fixed,
- WEALTH canonical invariant surface is live,
- but the A-FORGE bridge runtime at `127.0.0.1:7071` is not up.

Any future execution-seal claim must account for that missing bridge runtime explicitly.
