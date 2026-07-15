# IRR-DIP Audit — Single Source of Truth (CLOSED)

**Status:** CLOSED · **Band:** GREEN for solver integrity · YELLOW residual for organ-side auth surface  
**Date:** 2026-07-09  
**Actor:** grok-build under F13 directive  

## Verdict (one line)

**Solver honest. Bridge was misdiagnosed as “stripping”; real gaps were identity drop (fixed), attestation memory (fixed), and confusable F13 field naming (clarified + caller stamp).**

## Live evidence (T₁)

| Check | Result |
|-------|--------|
| WEALTH `/health` | ALIVE |
| Via `arif_route` + signed hermes session | actor=`hermes`, session bound, verdict SEAL |
| `epistemic_tag` | **DERIVED** (present — not stripped) |
| `claim_state` | **DRAFT** (present — not stripped) |
| `witness.is_complete` | **false**, missing `[human, earth]` (present — not stripped) |
| `human_final_authority` | `Arif` = **F13 veto ROLE** (`meaning: F13_SOVEREIGN_VETO_ROLE_NOT_CALLER`) |
| `caller_actor_id` | **hermes** (stamped; not defaulted to Arif) |
| IRR sample | **0.218622** (solver path intact) |

## Claim adjudication

| External claim | F2 ruling |
|----------------|-----------|
| Bridge strips epistemic metadata | **FALSE** (live counterexample above) |
| Bridge returns null on incomplete honesty | **FALSE** on current path |
| `human_final_authority: Arif` = backdoor impersonation | **FALSE as designed** — F13 sovereign veto role required by `wealth_contracts/authority.py`; confusable → fixed with meaning + `caller_*` |
| openclaw-anon identity drop | **TRUE** → fixed (bind identity + RESPONSE_CONTEXT) |
| WEALTH no organ-side JWT | **TRUE** — localhost 127.0.0.1; trust is kernel session/lease (document, don’t cosplay public auth) |

## Fixes landed (this session)

1. Identity propagation (no openclaw-anon overwrite of real session actor)  
2. Lazy organ re-attest after kernel restart  
3. Strip `_envelope` before organ MCP call (schema reject)  
4. Bridge stamps `caller_actor_id` / `caller_session_id` / F13 meaning  
5. Bridge HOLD if `epistemic_tag` missing  
6. DRAFT/incomplete witness → `governance_ceiling=ADVISORY_ONLY` (no nulling solver)  
7. WEALTH envelope + authority docs clarify F13 vs caller  

## Explicit non-actions

- **Did not hard-kill `arif_bridge_connect`** — would amputate federation; fail-closed + tunnel is correct  
- **Did not remove `human_final_authority=Arif`** — that would violate F13 contract; clarified semantics instead  
- **Did not add public JWT on WEALTH** — organ binds localhost; kernel is the auth gate  

## Residual risks (honest)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Localhost WEALTH reachable to any process on host | MEDIUM | UFW/localhost doctrine; kernel session for federation callers |
| Incomplete tri-witness on compute | EXPECTED | ADVISORY_ONLY ceiling; 888 for SEAL |
| Dual code trees `/root/wealth` vs `/root/WEALTH` | LOW | Live unit is WEALTH (`wealth-organ.service`) |

## Close

**IRR-DIP audit CLOSED.** Solver v2026.06.15 validated. Bridge is **governed tunnel**, not CRITICAL liar, after identity+custody patches.  

Further work (optional, separate): organ-side Ed25519 verify for non-localhost; promote agents OBSERVED→TRUSTED after more pulses.
