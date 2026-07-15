# PREFLIGHT MODE GAP — Queue 2026-07-10

**Source:** Final zen check 2026-07-09 (post identity-persistence fix)
**Severity:** Minor · non-blocking · carry-forward only

## Gap

`arif_init(mode='preflight')` no longer accepted after this morning's dual-collapse fold-in.

**New allowed list:** `init, light, resume, validate, epoch_open, epoch_seal, opt_out, opt_out_profiling`

**Missing:** `preflight`, `triage`, `canary` (canary listed in tool schema but may also be impacted — verify)

## Confirmation that the fold-in was correct overall

- `arif_act` removed from `allowed_next_verbs` (replaced by `arif_forge`) ✅
- Standalone `arif_triage` tool collapsed (errors "tool not found") ✅
- Actor identity persists across calls ✅
- `apex_scalars` surfaced in payload (UNMEURED OK — field exists) ✅
- Graduated gate: invalid mode → `LIMITED_MUTATE` (not anonymous, not FULL) ✅

## Fold-in overshot by N

The collapse removed `preflight`/`triage` as *modes* not just as a standalone tool. These were distinct verbs the routing layer used to pre-classify intent before INIT. Removing them without replacement means:

- Routing preflight now has no formal verb — agents jump to `init` and pay the full session cost
- No place to declare `requested_authority` + dry-run intent without minting a session

## Proposed fix (queue, not tonight)

Re-add `preflight` and `triage` to `arif_init` mode enum. Keep `arif_triage` tool collapsed. Modes ≠ tools.

**Effort:** 1-line enum + 1 test · **Risk:** None · **Authority:** 888_HOLD? No — kernel schema change, sovereign-ack-side via standard PR.

---

*DITEMPA BUKAN DIBERI · carries the morning fix into tomorrow*
