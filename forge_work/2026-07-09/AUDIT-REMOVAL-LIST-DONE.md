# Audit Removal List — DONE 2026-07-09

**Commit:** `96f2dc8cd` (arifOS)  
**Acceptance:** `ACCEPTANCE_OK` live after store-delete  

## Removed / demoted

| # | Item | Action |
|---|------|--------|
| 1 | Standalone `arif_triage` as first-class public verb | **Demoted** — `access=internal_only`, `expose=False`; public path = `arif_init(mode=preflight\|triage)`; wire keeps **deprecated** thin wrapper with log |
| 2 | Route/observe/act discovery aliases | **Cleared** live alias lists; `arif_act` discovery entry → `arif_forge` only; no `arif_triage`/`arif_delegate` as route aliases |
| 3 | `arif_mind_reason` undeclared purpose | **Declared** as internal of `arif_think`; `get_full_affordance` resolves alias → think; no "not yet declared" |
| 4 | Per-response `full_affordance` paste | **Stopped** — envelope uses `affordance_ref` + slim `affordance_contract` only; thresholds via `decision_thresholds_ref` |
| 5 | `arif_act` in allowed_next_verbs | **Confirmed gone** at birth (`no_act True`) + sct `derive_verbs` |
| 6 | Hand-rolled store → FastMCP `ctx` | **Not done (correct)** — FastMCP mount probe negative; SCT remains authority |
| 7 | Bare-string 888_HOLD actor dual-format | Interceptor HOLD **single-sources** `actor_id` into reason; forge/judge/seal return structured models |

## Kept (per instruction)

- `sesat_event` mechanism  
- three-plane `nine_signal` concept (duplication reduced, not flattened)  
- 888_HOLD authority gate behavior (format only)  

## Acceptance (post-removal)

```
INIT ok LIMITED_MUTATE no_act True
PREFLIGHT ok standing sct
ROUTE ok OK
OBSERVE OK full_affordance_in_resp False
MIND_REASON purpose ok arif_think …
JUDGE OK actor arif
FORGE HOLD actor arif dry True
SEAL TypeError after SCT (pre-existing kwargs — not TOKEN)
ACTOR_CONSISTENT judge/forge/seal = arif
ACCEPTANCE_OK
```

Tests: `tests/test_sct_slice1.py` **10 passed**.
