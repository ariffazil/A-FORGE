# Path B / Organ Surface Auth — DIP OPEN (not closed)

**Date:** 2026-07-09  
**Status:** **OPEN** — audit not complete  
**Severity:** P1 blast radius (multi-organ free compute on reachable surfaces)  
**Authority:** F13 review pending; no victory claim

---

## Retraction

Prior framing that “identity is Ed25519-bound” and “Path B is mitigated / audit complete” is **wrong as a system-level claim**.

- Ed25519 / registry authority applies to **Path A** (session → gate → bridge).
- Path B and **direct organ MCP** are different routes.
- A recommended fix (`remote_proxy_auth`) and unit-level DENY are **not** the same as a verified close of unauthenticated organ access.

**Restart of session_auth:** OK / already done.  
**Close audit:** **NO.**

---

## Framing correction (do not archive the wrong gate)

| Claim | Truth |
|-------|--------|
| “HTTP Path B blocked by `remote_proxy_auth`” | **Misleading.** Live HTTP has `ARIFOS_EXPOSE_ORGAN_BRIDGE=false`. Organ proxies are **not** on `tools/list`. Unauthenticated `wealth_*` hits **`kernel_interceptor` → KERNEL_DENY (LOW < MEDIUM)** — a **different** gate. |
| “62 tools: gate active on primary surface” | Primary HTTP surface is **12 kernel verbs**, not 62 organ proxies. |
| “stdio same code so blocked” | **Insufficient** without probe. Stdio E2E **timed out** on startup (discovery/server loop); not independently proven. |
| In-process Path B gate | **Proven:** remote map discovers **62** tools; no session → `REMOTE_PROXY_AUTH` / `SESSION_REQUIRED`; fake session → `SESSION_INVALID`. |

---

## Probe evidence (T₁ — this machine, 2026-07-09)

### 1. arifOS public MCP (`:8088`)

| Fact | Observation |
|------|-------------|
| `ARIFOS_EXPOSE_ORGAN_BRIDGE` | **false** |
| `tools/list` | **12** kernel verbs only (`arif_*`) — **0** `wealth_*` / organ proxies listed |
| `tools/call wealth_compute_irr` (no session/actor) | **200** body: `KERNEL_DENY` — Authority LOW (anonymous) insufficient for `organ.wealth.*` (needs MEDIUM). Gate: `kernel_interceptor` → **VOID** |
| Conclusion | Live **HTTP** arifOS is **not** currently advertising the 62-tool Path B surface. Unlisted `wealth_compute_irr` still hits a **kernel deny**, not free compute. |

This **does not** prove Path B is gone in all transports (stdio discovery still exists in `__main__.py`). It only proves the live HTTP list does not expose organ proxies right now.

### 2. Direct WEALTH organ (`:18082`) — **reproduced free compute**

| Call | Result |
|------|--------|
| `tools/list` | **50** WEALTH tools |
| `tools/call wealth_compute_irr` with **no** arifOS session / actor | **200** success: `irr ≈ 0.153222`, `caller_actor_id: null`, `caller_session_id: null`, `caller_verified: false`, `execution_authorized: false` |

**Claim (OBS):** Anyone who can reach `127.0.0.1:18082` can run capital tools without federation identity.  
**Mitigation today:** localhost bind + UFW (doctrine “localhost is password”) — **not** cryptographic identity, **not** session gate.

This is the real high-blast free-compute surface for WEALTH, independent of arifOS Path A/B framing.

### 3. WELL (`:18083`)

| Fact | Observation |
|------|-------------|
| `/health` | `identity: WELL`, `tool_count: 22`, `authority: REFLECT_ONLY`, status **degraded** |
| `tools/list` (MCP initialize) | Returned **12 kernel-shaped `arif_*` names** — **not** a clear WELL vitality catalog |

**Claim (OBS):** Surface is **inconsistent** (health 22 vs list 12 kernel names). Do **not** archive “12 WELL somatic tools on Path B” without a clean tools/list of actual WELL verbs. Needs a dedicated WELL surface DIP before blast-radius claims about health data.

### 4. Path B gate — what is actually proven

| Layer | Result |
|-------|--------|
| Discovery (same functions as `__main__` remote map) | WEALTH **50** + WELL **12** = **62** in map; `wealth_compute_irr` present |
| `require_remote_proxy_session` no session | `ok=false`, `SESSION_REQUIRED`, deny path=`B`, gate=`remote_proxy_auth` |
| Fake `session_id` | `SESSION_INVALID` (not found/expired) |
| Kill-switch off | `ok=true`, `DISABLED` (control: gate is what blocks) |
| Raw stdio E2E (subprocess MCP) | **INCOMPLETE** — init/`tools/call` hang/timeout under probe harness; **not** a pass |
| Live HTTP 62-tool proxy list | **Not active** (bridge false) |
| Bridge-on E2E | **Not run** |

### 5. Path C control (still open)

Direct `call_wealth_tool` / `:18082` still returns organ body without arifOS session — **unchanged**.

---

## Correct architecture picture

```
Path A (gated):     client → arif_route / kernel → gate → bridge → organ
Path B (proxy):     client → arifOS remote tool name → organ   [only if bridge/stdio map on]
Path C (direct):    client → organ:18082/18083      → organ   [no arifOS identity]
```

Ed25519 registry fix ⊆ Path A session authority.  
**Does not** bind Path C. **Does not** fully bind Path B until bridge-on E2E proves it.

---

## Severity (honest)

| Surface | Unauthenticated compute? | Evidence |
|---------|--------------------------|----------|
| WEALTH direct `:18082` | **Yes** (50 tools) | Live probe success |
| WELL direct `:18083` | **Unknown / inconsistent surface** | health vs tools/list mismatch |
| arifOS HTTP organ proxies | **Not listed** (bridge off); unlisted wealth call **DENY** | Live probe |
| arifOS Path B code path | Gate **written**, **not** E2E verified under bridge-on | Code + unit only |

Bigger than single-tool null-suppression: **multi-tool capital surface without caller identity** (Path C proven). Path B remains an open DIP for when proxies are enabled.

---

## What is closed vs open

| Item | Status |
|------|--------|
| IRR precision / L1–L3 consistency | Closed as diagnosis (session HOLD misread ≠ solver bug) — keep L1–L3 evidence |
| session_auth registry authority | Fixed + restarted — **do not** overclaim as whole-surface identity |
| Bridge null-suppression DIP-03 | Fixed for error propagation — orthogonal |
| “Audit complete / system honest and identified” | **REJECTED** |
| Path B DIP | **OPEN** |
| Path C (direct organ) identity | **OPEN** (localhost doctrine only) |
| WELL surface truth | **OPEN** |

---

## Next DIP steps (methodology that worked twice)

1. **Path B E2E (controlled):** temporary `ARIFOS_EXPOSE_ORGAN_BRIDGE=true` on non-prod or short window → `tools/list` must show organ tools → call without `session_id` → expect DENY; with valid session → expect organ response. Document both.
2. **Path C decision:** either accept localhost-as-password explicitly for organs, or add organ-side session/token gate for WEALTH/WELL.
3. **WELL surface audit:** reconcile `tool_count: 22` vs kernel-shaped list; list real WELL verbs and data classes before health-data blast claims.
4. **Archive rule:** no summary table may say “identity verified / Ed25519” without **route scope** (Path A only).

---

## Recommended wording for any human summary

> Session-auth and bridge error-propagation fixes are real and restarted. IRR L1–L3 is consistent.  
> **Unauthenticated access is not closed system-wide.** Direct WEALTH still runs free compute without caller identity. Path B proxy auth is code-present, not bridge-on verified. Audit remains **open** on Path B/C and WELL surface truth.

*Probe receipt — not a SEAL. Not complete.*
