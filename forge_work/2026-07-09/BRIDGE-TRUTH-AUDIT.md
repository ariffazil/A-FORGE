# Bridge Truth Audit — 2026-07-09

**Verdict:** Do **NOT** hard-kill the bridge. Root cause is partially misdiagnosed.

## F2 live probe (before narrative)

| Claim | Reality |
|-------|---------|
| Bridge strips epistemic tags | **FALSE** — `epistemic_tag`, `claim_state`, `witness.is_complete`, `missing:[human,earth]` all arrive via bridge |
| Bridge returns null on incomplete | **FALSE** in current path — bridge returns full payload when tool args valid |
| human_final_authority=Arif = identity spoof | **PARTIAL** — field means F13 **veto role**, not "caller is Arif" (authority.py requires it). Naming confusable → fixed with meaning + caller_* fields |
| WEALTH has no auth on endpoint | **TRUE** for localhost MCP (bound 127.0.0.1); federation relies on kernel session+lease, not organ-side JWT |
| openclaw-anon identity drop | **TRUE** (already fixed) |

## Actions taken (not kill-bridge)

1. **Clarify F13 field** — `human_final_authority_meaning: F13_SOVEREIGN_VETO_ROLE_NOT_CALLER`
2. **Caller custody** — stamp `caller_actor_id` / `caller_session_id` on bridge pass-through
3. **Epistemic HOLD** — bridge HOLDs if `epistemic_tag` missing after organ reply
4. **Authority validator** — reject unverified sovereign-as-caller claims
5. Keep bridge; fix carrier honesty

## Kill-bridge recommendation

**Rejected.** Bridge is required federation path. Fail-closed on missing epistemic tags + correct identity propagation is safer than amputating routing.
