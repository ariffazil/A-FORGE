# EgressPolicy Socket — Specification

> **Status:** DEPLOYED (Phase 0 — socket only, no actuators)
> **Forged:** 2026-08-07 by 333-AGI Δ MIND under Arif directive
> **Source:** `/root/A-FORGE/src/infrastructure/egress/EgressPolicy.ts`
> **Wired in:** `forge_fetch` tool in `/root/A-FORGE/src/interfaces/mcp/proxyTools.ts`
> **Tests:** `/root/A-FORGE/test/egressPolicySocket.test.ts`
> **DITEMPA BUKAN DIBERI**

---

## 1. Purpose

Provide a governed **egress abstraction layer** for outbound HTTP in A-FORGE.
Tools declare `egress_profile` and the resolver returns the execution mode.
Future proxy actuators (mubeng, corp-proxy, tor) plug in by adding resolver
branches — no tool-schema change, no agent-visible change.

**Socket first. Actuator on trigger.**

---

## 2. Architecture

```
Tool (forge_fetch)
  ↓  egress_profile="mubeng" | "direct" | "default"
EgressPolicy.validateAndResolve(profile)
  ↓  → { type:"direct" }   (default, direct)
  ↓  → { type:"proxy", uri, proxy_id }  (future: mubeng, corp-proxy, tor)
  ↓  → { type:"unavailable", reason }   (future profiles, not yet configured)
Internet
```

### 2.1 Profile Registry

| Profile | Resolution | Status |
|---------|-----------|--------|
| `default` | `{ type: "direct" }` | **LIVE** — byte-for-byte identical to before |
| `direct` | `{ type: "direct" }` | **LIVE** — explicit direct |
| `mubeng` | `{ type: "unavailable", reason: "..." }` | Future — Go proxy rotator |
| `corp-proxy` | `{ type: "unavailable", reason: "..." }` | Future — paid residential proxy |
| `tor` | `{ type: "unavailable", reason: "..." }` | Future — high-anonymity egress |

### 2.2 Resolution Interface

```typescript
type EgressResolution =
  | { type: "direct" }
  | { type: "proxy"; uri: string; proxy_id: string }
  | { type: "unavailable"; reason: string }
```

---

## 3. forge_fetch Changes

### 3.1 New Parameter

```yaml
egress_profile:
  type: z.enum(["default","direct","mubeng","corp-proxy","tor"])
  default: "default"
  description: >
    Egress profile for outbound HTTP. 'default'/'direct' = direct connect.
    'mubeng'/'corp-proxy'/'tor' = future proxy actuators.
    The socket is forged; actuators attach when needed.
```

### 3.2 Response Envelope

Every non-error response from `forge_fetch` now carries a compact `egress` block:

```json
{
  "egress": {
    "profile": "default",
    "provider": "direct",
    "proxy_id": null
  }
}
```

### 3.3 Cache-Key Isolation

Cache key changed from `sha256(url|query|mode)` to `sha256(url|query|mode|egress_profile)`.
A direct fetch cached under a proxy profile would leak IP attribution (F1/F2).
Different profiles → different cache keys.

### 3.4 BLOCKED on Unavailable

Calling `forge_fetch` with `egress_profile="mubeng"` returns:

```json
{
  "status": "BLOCKED",
  "reason": "egress profile 'mubeng' not yet configured. Mubeng is a Go proxy rotator...",
  "trust_status": "UNTRUSTED_EXTERNAL_CONTENT"
}
```

Honest, never silent fallback (F9 ANTI-HANTU).

### 3.5 Unchanged Behavior

- SSRF check (`ssrfCheck`) runs BEFORE egress resolution on all URL fetches
- robots.txt compliance (`checkRobotsTxt`) runs before fetch on all profiles
- SearxNG search mode (`query` param) is internal traffic — egress applies to external URL fetches only
- All existing `forge_fetch` calls with no `egress_profile` → `"default"` → direct → identical behavior

---

## 4. Constitutional Floors

| Floor | Applied | Detail |
|-------|---------|--------|
| **F1 AMANAH** | ✅ | Reversible. No binary installs. No daemons. Param + module only. |
| **F2 TRUTH** | ✅ | Unavailable profiles return honest reason strings. Cache-key isolation prevents cross-profile evidence contamination. |
| **F4 CLARITY** | ✅ | One file (`EgressPolicy.ts`). No new organ. No new port. No systemd unit. |
| **F9 ANTI-HANTU** | ✅ | Never silent fallback. Unknown/unavailable → explicit BLOCKED with reason. |
| **F11 AUDIT** | ✅ | Every response carries `egress` block with profile + provider + proxy_id. |
| **F12 INJECTION** | ✅ | SSRF gate runs before egress. Proxy egress cannot bypass security gates. |
| **F13 SOVEREIGN** | ✅ | Egress bound to A-FORGE. `forge_policy` gates tool access. No universal egress. |

---

## 5. Next Steps (out of scope for Phase 0)

### Phase 1 — On First Trigger
When a concrete 429/datacenter ban hits (Yahoo Finance, SSM, BNM, gov portal):
1. Install mubeng binary → `/opt/aforge/bin/mubeng`
2. Place signed pool file → `/opt/aforge/pools/<tier>.txt`
3. Add proxy resolver branch to `EgressPolicy.ts`
4. Wire `fetch()` through proxy URI
5. Add VAULT999 receipt per proxied request

### Phase 2 — Harden
1. Extend egress_profile to `forge_search`, `WEALTH`, `GEOX`
2. Pool rotation automation
3. Egress health dashboard

---

## 6. Files

| File | Role |
|------|------|
| `src/infrastructure/egress/EgressPolicy.ts` | Profile registry + resolver |
| `src/interfaces/mcp/proxyTools.ts` | forge_fetch wiring (egress_profile param + executeFetch) |
| `test/egressPolicySocket.test.ts` | Unit tests |
| `specs/egress-policy-socket/SPEC.md` | This document |
| `forge_work/2026-08-07/mubeng/DECISION-mubeng-map.md` | Sovereign decision record (HOLD) |

---

*Socket forged. Actuator awaits trigger. DITEMPA BUKAN DIBERI.*
