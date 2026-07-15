# Identity Propagation + WEALTH Attestation Fix

**Date:** 2026-07-09  
**Verdict:** FIXED (live verified)  
**Not a retry storm — root-cause patch**

## Diagnosis (both axes probed)

| Layer | Finding |
|-------|---------|
| WEALTH organ | **ALIVE** on `:18082` — not offline |
| "no live attestation" | In-memory `_ORGAN_REGISTRY` empty after arifos restart; fail-closed correct, recovery missing |
| openclaw-anon | `wrap_legacy_call` + RESPONSE_CONTEXT when actor/session null; **inner** `source_of_truth` already had hermes |
| SYUBHAH floor | Working as designed (psi doubt dominates aggregate) |

## Fixes deployed

1. **`_assert_organ_attested`** — lazy re-attest once if missing/stale (health still ALIVE)  
2. **`_bind_identity`** on `arif_route` / `arif_bridge_connect` — recover actor from session; force `_envelope`  
3. **`_route_ok`** — top-level `actor_id` + `session_id` on every route response  
4. **`_actor_for_response`** — treat `openclaw-anon` as placeholder, prefer session actor  
5. **ingress_middleware** — prefer tool-arg identity over envelope coercion  

Deployed to `/opt/arifos/app` · arifos restarted.

## Live retest (hermes signed session)

```
TOP actor hermes  session SEAL-e6ba975f5d264f7d  verdict SEAL
bridge status OK  (no attestation HOLD)
PASS_ID True  PASS_BRIDGE True
```

IRR solver itself returned `MISSING_REQUIRED_FIELD` (`cashflows` vs `cash_flows`) — **downstream schema**, not identity/attestation. DIP-01 can proceed with correct arg name.

## Do not

- Blind-retry arif_route without identity (noise)  
- Treat openclaw-anon as "random bug" — it was fail-closed + lost identity  

## Do

- Pass `session_id` + verified `actor_id` on every route/bridge call  
- Use correct organ tool schemas after bridge is open  
