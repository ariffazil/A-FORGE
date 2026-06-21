# 040_ACT_PLAYBOOK.md — Execution Craft Patterns

**Version:** SEAL-1.0.0
**Sealed:** 2026-06-21 05:15 UTC
**Role:** Canonical ACT patterns — safe execution rituals for A-FORGE

---

## Doctrine

ACT answers: "Even if this is wise and lawful, *how* do we do it without breaking things?"

ACT patterns are templated rituals. They encode:
- staging vs all-at-once
- dry-run vs live
- canary vs full rollout
- compensation / rollback
- human checkpoints

**SKILL.md = ACT HOW only.** WHEN belongs to kernel routing. WHAT IS WISE belongs to ART. WHO belongs to AAA.

---

## Pattern 1: `default_deploy`

**When to use:** Routine tool changes, config updates, non-destructive system modifications where the blast radius is contained.

**Trigger:** ART verdict = PROCEED | SABAR | Kernel = SEAL

### Ritual

```
PHASE 1 ── DRY RUN (read-only simulation)
─────────────────────────────────────────
1. Execute against staging/target env in dry-run mode
2. Capture: output diff, side effects, error messages
3. ART Library record: verdict=dry_run, tool=<name>, ts=<now>
4. If dry-run fails → REJECT, do not proceed

PHASE 2 ── STAGE (single unit)
────────────────────────────────
1. Apply change to ONE unit (one file, one config, one endpoint)
2. Verify: does the system state match expected?
3. ART Library record: verdict=stage, tool=<name>, ts=<now>
4. If verify fails → COMPENSATE (revert), then HOLD

PHASE 3 ── SEAL (log the action)
───────────────────────────────────
1. Write VAULT999 record: action, before/after state, actor, timestamp
2. Notify AAA cockpit: deployment complete, change logged
3. ART Library record: verdict=seal, tool=<name>, ts=<now>

PHASE 4 ── MONITOR (60 min)
───────────────────────────────────
1. Watch: error rate, latency, user-facing indicators
2. If degradation detected → COMPENSATE immediately
3. If stable → DONE
```

**Compensation:** Revert the single unit change. Log the revert to VAULT999.

**Human checkpoint:** None required for PROCEED. Required before COMPENSATE if it affects a production user-facing system.

---

## Pattern 2: `dangerous_migration`

**When to use:** Cross-system data moves, schema changes, multi-step refactors, anything that touches WEALTH or GEOX domain data, or changes tool interfaces that other systems depend on.

**Trigger:** ART verdict = HOLD | Kernel = SEAL but blast = HIGH | Any WEALTH/GEOX data mutation

### Ritual

```
PHASE 0 ── PRE-MORTEM (before anything else)
─────────────────────────────────────────────
1. Run the ART blast-radius simulation: what breaks if this goes wrong?
2. Identify: single points of failure, rollback checkpoints, blast radius
3. Document: compensation plan (how to revert each step)
4. Get AAA sign-off on compensation plan before proceeding

PHASE 1 ── CANARY (1% of traffic/data)
───────────────────────────────────────
1. Apply migration to 1% of target (one user, one record, one endpoint)
2. Isolate: canary must not affect the remaining 99%
3. Monitor: 30-minute observation window
   - error rate, data integrity, downstream consistency
4. ART Library record: verdict=canary_start, tool=<name>, ts=<now>
5. If canary degrades → VOID canary, ABANDON migration

PHASE 2 ── EXPAND (25% of traffic/data)
─────────────────────────────────────────
1. Apply to 25% if canary is stable
2. Monitor: 30-minute window
3. ART Library record: verdict=canary_expand, tool=<name>, ts=<now>
4. If degradation → COMPENSATE 25%, HOLD, notify Arif

PHASE 3 ── FULL ROLLOUT (remainder)
─────────────────────────────────────
1. Only if 25% phase is stable
2. Apply to remaining traffic/data
3. Monitor: 60-minute window
4. ART Library record: verdict=migration_complete, tool=<name>, ts=<now>
5. Write VAULT999: full migration record with before/after schema

PHASE 4 ── VERIFY + SEAL
───────────────────────────────────
1. Cross-verify: all downstream systems consistent
2. WEALTH: confirm capital records accurate
3. GEOX: confirm earth evidence intact
4. VAULT999 seal: migration_id, timestamp, actor, checksum
5. If verify fails → ROLLBACK (full compensation from Phase 0 plan)
```

**Compensation:** Execute the pre-mortem compensation plan in reverse order. Each phase has its own revert step documented in Phase 0.

**Human checkpoint:** Required before Phase 1. Required before Phase 4 if WEALTH or GEOX data is involved.

---

## Pattern 3: `human_in_the_loop`

**When to use:** Irreversible actions — deleting data, revoking access, terminating processes, sending external communications, any action where ART or Kernel flags irreversible = TRUE or blast = EXTREME.

**Trigger:** ART verdict = HOLD | Kernel = SEAL but irreversible flag = TRUE | External-facing (email, API publish, payment)

### Ritual

```
PHASE 1 ── HOLD (do not execute)
───────────────────────────────────
1. ART returns HOLD or Kernel returns VOID → STOP
2. Generate: human checkpoint request
   - What is being proposed
   - What ART verdict and reasoning is
   - What the blast radius is
   - What the compensation plan is
3. Do NOT execute the action

PHASE 2 ── CHECKPOINT (Arif review)
───────────────────────────────────────
1. Send checkpoint to Arif: what, why, blast, options
2. Wait for Arif's explicit approval or rejection
3. If rejected → log to ART Library as rejected, ABANDON
4. If approved → get approval timestamp and store

PHASE 3 ── EXECUTE (after approval)
───────────────────────────────────────
1. Execute the action only after approval timestamp is stored
2. Log to VAULT999: action, approval_source, approval_timestamp, actor
3. ART Library record: verdict=human_approved, tool=<name>, ts=<now>
4. Execute compensation plan in parallel (ready to fire if needed)

PHASE 4 ── CONFIRM (post-execution)
───────────────────────────────────────
1. Verify: did the action complete as intended?
2. If yes → SEAL to VAULT999
3. If no → FIRE COMPENSATION immediately, log incident
```

**Compensation:** Pre-defined for every human_in_the_loop action. Compensation must be ready before Phase 3 begins.

**Human checkpoint:** Mandatory. No bypass. Arif is the sole approver for irreversible actions.

---

## Pattern 4: `probe_only`

**When to use:** Exploration, evidence gathering, reading data, checking system state — any action where the goal is observation, not mutation. This is the SABAR mode.

**Trigger:** ART verdict = SABAR | intent = explore | evidence_only = TRUE

### Ritual

```
PHASE 1 ── OBSERVE (no commit)
───────────────────────────────────
1. Execute read-only tool calls only
2. Do NOT write, update, delete, or send anything
3. Collect all observations in a probe report
4. ART Library record: verdict=probe_only, tool=<name>, intent=observe, ts=<now>

PHASE 2 ── SYNTHESIZE (after observation)
─────────────────────────────────────────────
1. Compile observations into a probe report
2. Identify: what the evidence says, what is uncertain, what needs more evidence
3. Do NOT draw conclusions beyond what the evidence supports
4. Present probe report to Arif for next decision

PHASE 3 ── ARCHIVE (seal the evidence)
─────────────────────────────────────────
1. Save probe report to /root/forge_work/
2. Write VAULT999: probe_id, tools_used, findings_summary, ts=<now>
3. ART Library record: verdict=probe_complete, ts=<now>
4. If Arif requests action based on probe → route to appropriate pattern (default_deploy, dangerous_migration, or human_in_the_loop)
```

**Compensation:** None needed — probe_only is read-only by definition. If a tool call accidentally mutates, immediately fire the appropriate pattern from the mutation point.

**Human checkpoint:** None required. Probe report presented to Arif for decision.

---

## Quick Reference

| Pattern | Trigger | Phases | Human checkpoint | Compensation |
|---|---|---|---|---|
| `default_deploy` | PROCEED/SABAR, routine | dry-run → stage → seal → monitor | No | Revert single unit |
| `dangerous_migration` | HOLD or blast=HIGH | canary → expand → full → seal | Before Phase 1 | Full rollback plan |
| `human_in_the_loop` | irreversible=TRUE or blast=EXTREME | hold → checkpoint → execute → confirm | Mandatory (Arif only) | Pre-defined pre-mortem |
| `probe_only` | SABAR or intent=explore | observe → synthesize → archive | No | N/A (read-only) |

---

## Anti-Patterns (Constitutionally Banned)

- ❌ **No all-at-once deployment** — always stage or canary
- ❌ **No execution without ART verdict** — every action must have a verdict before Phase 1
- ❌ **No skipping human checkpoint on irreversible actions** — no exceptions
- ❌ **No compensation plan missing** — every dangerous_migration and human_in_the_loop must have one before Phase 1
- ❌ **No SKILL.md as law** — SKILL = ACT HOW only; WHEN = kernel; WHAT IS WISE = ART; WHO = AAA

---

*DITEMPA BUKAN DIBERI — Intelligence is forged through disciplined execution rituals.*
*SEALED: 040_ACT_PLAYBOOK.md | 2026-06-21*
