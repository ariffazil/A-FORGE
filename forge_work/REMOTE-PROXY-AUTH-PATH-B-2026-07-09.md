# Path B Remote Proxy Auth — Fix Receipt

**Date:** 2026-07-09  
**Severity closed:** P1 (unauthenticated organ proxy surface)  
**Related:** IRR-DIP hollow handoff (session auth vs bridge)

---

## Problem

Two paths to WEALTH/WELL/GEOX via arifOS:

| Path | Flow | Gate |
|------|------|------|
| **A** | MCP → `arif_route` → constitutional gate → bridge → organ | Full L11 + floors |
| **B** | MCP → `wealth_*` / `well_*` proxy → organ | **Was none** |

Path B existed for performance. 62 discovered organ tools (50 WEALTH + 12 WELL) could be called without `session_id` when the federated surface was active (stdio always; HTTP when `ARIFOS_EXPOSE_ORGAN_BRIDGE=true`).

Bounded (`execution_authorized=False`) but not mitigated: free compute, recon, DoS.

---

## Fix

Lightweight **session-only** gate at proxy layer (not full constitutional mediation):

| File | Change |
|------|--------|
| `arifosmcp/runtime/remote_proxy_auth.py` | **NEW** — `require_remote_proxy_session`, schema inject, deny payload |
| `arifosmcp/runtime/__main__.py` | Stdio Path B tools/call DENY without valid session |
| `arifosmcp/server.py` | HTTP organ-bridge proxies use same gate + schema |
| `tests/test_remote_proxy_auth.py` | Unit coverage |

**Rules:**
1. `validate_session(session_id, actor_id)` must return valid
2. Auth keys stripped before organ forward (`session_id`, `actor_id`, `_envelope`, …)
3. Kill-switch: `ARIFOS_REMOTE_PROXY_AUTH=false` (default **true**)
4. Env bootstrap still works (`ARIFOS_SESSION_ID` + actor) via existing L11 validator

**Not in scope:** Direct organ MCP ports (18082/18083/8081) remain organ-native surfaces. This gates **arifOS proxy** only.

---

## Live note (T₁)

Production `ARIFOS_EXPOSE_ORGAN_BRIDGE=false` → HTTP tools/list shows 12 kernel verbs only.  
Path B hole still closed for stdio federated surface and for future bridge enable.

---

## Tests

```bash
cd /root/arifOS && python3 -m pytest tests/test_remote_proxy_auth.py -q
```
