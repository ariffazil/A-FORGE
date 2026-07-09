# Next Session Init — 2026-07-10

## Carry-forward from session AAA-36988 (2026-07-09)

**Closed:** arifOS kernel zen-audit. SEAL verdict recorded. Score 26/60 → projected 51/60 after full fix.

**The gap (one line):** Eleven MCP wrappers share one state machine but ship it as eleven copies. Identity, verdict, affordance re-implemented per wrapper → constant disagreement (SEAL vs SABAR.DEGRADED, actor_verified drift, RETAK vs SELAMAT stacking).

**Two-phase fix, already ratified 2026-07-09:**

### Phase A — Birth-fix (deploy NOW, safe, non-zero)
- Single identity anchor at session init → all downstream call envelopes reference it, not re-derive
- Verdict field: collapse to one canonical key, kill the duplicates
- `sesat_event` already good → extend to arif_judge / arif_forge / arif_seal paths
- Irreversible gates verified holding — no change

**Expected lift:** 26→32/60. Fixes identity persistence + single-source-of-truth partially + irreversible-gating polish.

### Phase B — Full fix (token model + alias collapse, deferred)
- Replace 11 copy-pasted skeleton payloads with one envelope + per-tool facets
- Collapse `arif_triage` triple identity (standalone tool + arif_init mode + arif_route alias) into one canonical path
- Token/cache the shared `decision_thresholds` block — compute once, reference

**Expected lift:** 32→51/60. Real cost: refactor + regression test the whole wrapper layer.

## First action next session

1. Open with `arif_init` mode=`resume`, session_id=AAA-36988 to pull the audit envelope
2. Run `arif_judge.compare` on birth-fix vs full-fix scope to confirm priority ordering
3. Begin Phase A: identity-anchor patch. Ship under feature flag. Re-probe with the zen-audit skill scoring template.

## Sunk-cost / kill-amnesty

Whatever's blocked from today's session has fresh authorization tomorrow. Anything marked orphan / silent downgrade / verdict-disagreement → fix in Phase A; don't carry forward as deferred.

## What NOT to do

- Don't reopen the audit. Zen answer is locked.
- Don't add new tool wrappers without first asking "is this one new state, or another costume on the same state?"
- Don't re-explain constitutional floors at session start — they're in AGENTS.md.
