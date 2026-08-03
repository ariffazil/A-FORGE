# Metabolic Loop Integration Guide
> **DITEMPA BUKAN DIBERI** — Forged 2026-08-03 by 333-AGI under F13 directive
> **Status:** OPERATIONAL — code complete, harness integration next

## What This Is

The metabolic loop is a closed feedback system that predicts which federation organs an agent task will need, observes what was actually used, and learns from the gap.

```
context_compile.py → compile_id + predicted organs
       ↓
agent executes → log_activation.sh → activation_log.jsonl
       ↓
organ_activation_learner.py diff → REINFORCE | EXPAND | ROUTE_OK | NOISE
       ↓
activation_receipts.jsonl (immutable audit)
       ↓
metabolize_session.sh → full session closure
```

## Quick Start — Wire Your Agent

### 1. Session Start: Compile the task

```bash
# Before executing, compile the task intent
python3 /root/A-FORGE/scripts/context_compile.py "$TASK" --json > /tmp/session_compile.json
export CC_COMPILE_JSON="/tmp/session_compile.json"
export CC_COMPILE_ID=$(python3 -c "import json; print(json.load(open('$CC_COMPILE_JSON'))['compile_id'])")

# Save compile JSON for later learner matching
/root/A-FORGE/scripts/log_activation.sh --boot "$CC_COMPILE_JSON"
```

### 2. Task Execution: Log activation

After each task completes, note which organs were actually used:

```bash
export CC_COMPILE_ID="<compile_id>"
export SESSION_ID="<session_id>"

/root/A-FORGE/scripts/log_activation.sh --quick \
    --compile-id "$CC_COMPILE_ID" \
    --task "description of what was done" \
    --organs "geox,wealth" \
    --cross "wealth:correct_escalation:capital_primitive:needed NPV after geology" \
    --outcome "completed" \
    --verdict "Pass" \
    --notes "free-text agent notes"
```

**Cross-organ routing format:**
`--cross "organ:reason:tool:note"` where reason is one of:
- `compiler_gap` — compiler should have predicted this organ
- `correct_escalation` — agent correctly routed via arif_route
- `unnecessary` — agent used this organ without need (noise)

Multiple cross routes: `--cross "wealth:compiler_gap:tool:note,geox:correct_escalation:tool:note"`

### 3. Session End: Close the loop

```bash
/root/A-FORGE/scripts/metabolize_session.sh \
    --session-id "$SESSION_ID" \
    --save
```

This processes all activation log entries for the session, runs the learner against each, and writes receipts.

## File Map

| File | Location | Role |
|------|----------|------|
| context_compile.py | /root/A-FORGE/scripts/ | 3-pass federated compiler with organ registry |
| organ_activation_learner.py | /root/A-FORGE/scripts/ | V0 read-only learner (compare, diff, receipt) |
| log_activation.sh | /root/A-FORGE/scripts/ | Agent activation logger (--quick, --boot) |
| metabolize_session.sh | /root/A-FORGE/scripts/ | Session-end metabolic closure |
| context_boot.sh | /root/A-FORGE/scripts/ | Canary boot script with compile JSON save |
| activation_log.jsonl | /root/.arifos/context/ | Agent execution log (one line per task) |
| activation_receipts.jsonl | /root/.arifos/context/ | Immutable learner verdicts |
| compiles/ | /root/.arifos/context/compiles/ | Compile JSONs named by compile_id |
| organ_weight_map.json | /root/.arifos/context/ | 50+ keyword→organ weights |

## Organ Registry (6 organs)

| Organ | Port | Keywords |
|-------|------|----------|
| arifos | 8088 | kernel, judge, seal, floor, constitution, session, identity |
| aforge | 7071 | build, deploy, fix, code, test, git, docker, npm, security, audit |
| geox | 8081 | seismic, basin, geology, prospect, petrophysics, formation, reservoir |
| wealth | 18082 | finance, npv, stock, portfolio, market, risk, capital, investment |
| well | 18083 | sleep, vitality, fatigue, health, readiness, dignity, machine |
| arifflow | 7073 | fq, flow, metabolic, metabolism, receipt, nerve, pulse, cooling |

## Learning Policy

| Threshold | Occurrences | Action |
|-----------|-------------|--------|
| note | 1 | Log only |
| weak | 2 | Weak signal |
| recommend | 3 | Recommend weight change |
| prior_update | 5 | Auto-update weight map (V1) |

**V0 is read-only** — produces diff reports but doesn't auto-mutate weights. V1 will enable auto-update after 5+ consistent observations.

## Immutable Keywords

These keywords are NEVER auto-learned (constitutional protection):
- F1-F13 floor names, governance, policy, law
- BEKOK_DEEP_1 (named PETRONAS staff evaluation)
- arifos is always reachable (immutable organ)

## Current State (2026-08-03)

- 14 activation receipts in immutable ledger
- 4 activation log entries (3 production, 1 E2E test)
- 4 compile JSONs in compiles/ directory
- Learner confirmed: REINFORCE on latest E2E test
- FQ: 0.70 WATCHING (79 arifFlow receipts)
- Code committed to A-FORGE (b58770a6)
- VAULT999 seal: awaiting F13 authorization

## Integration Checklist

- [x] context_compile.py — operational with compile_id + predicted block
- [x] organ_activation_learner.py — operational with --from-compile flag
- [x] log_activation.sh — operational with --quick, --boot, env detection
- [x] metabolize_session.sh — operational with --all, --session-id, --save
- [x] compiles/ directory — auto-populated
- [x] E2E test passed — REINFORCE (0 gaps)
- [x] Git committed — A-FORGE b58770a6
- [ ] Agent harness auto-calls log_activation.sh after each task
- [ ] RSI session-end hook calls metabolize_session.sh
- [ ] VAULT999 seal authorized by F13
