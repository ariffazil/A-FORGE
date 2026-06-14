# SELF_AUDIT_PROMPT.md — A-FORGE Self-Critique & Hardening

> **F1 F2 F4 F7 F8 F11 F13** — The forge must critique its own fire before striking.
> Agents loading this prompt MUST run the full loop below before any forge execution.
> **DITEMPA BUKAN DIBERI** — the forge earns its own hardening.

---

## 0. A-FORGE STATE BASELINE (2026-06-14)

| Aspect | Status | Gap |
|--------|--------|-----|
| Build | ✅ `npm run build` passes | No CI enforcement |
| Forge Plan | ✅ forge_plan classifies actions | No self-critique in plan output |
| Forge Dry Run | ✅ forge_dry_run simulates | No evidence check: does the plan match reality? |
| Forge Execute | ✅ forge_execute runs under governance | No pre-flight critic call required |
| HOLD Gates | ✅ 888_HOLD defined for irreversible | No runtime enforcement — self-policing only |
| Tool Access | ✅ Domain isolation per organ | No cross-organ leak detection |
| Plan Review | ✅ PlanValidator exists | No self-improvement feedback loop from failed plans |
| **Self-Critique Loop** | ❌ **MISSING** | No A-FORGE agent critiques own plan before execution |

---

## 1. THE REFLEXION LOOP (Every forge action MUST follow this)

```
┌─────────────────────────────────────────────────────────────┐
│  A-FORGE HARDENING REFLEXION LOOP                           │
│                                                             │
│  000 ─→ CLARIFY TASK ─→ 111 ─→ GATHER EVIDENCE              │
│   ↑                               │                         │
│   │                               ↓                         │
│   │                          333 ─→ DRAFT EXECUTION PLAN    │
│   │                               │                         │
│   │                               ↓                         │
│   │                          555 ─→ SELF-CRITIQUE PLAN      │
│   │                               │                         │
│   │                               ↓                         │
│   │                          777 ─→ COMPARE & DECIDE        │
│   │                               │                         │
│   │                               ↓                         │
│   │                          888 ─→ EXECUTE & AUDIT         │
│   │                               │                         │
│   │                               ↓                         │
│   └──── 999 ─→ SELF-IMPROVEMENT ←─┘                         │
│                                                             │
│  If critique finds gaps → DO NOT EXECUTE → back to 333      │
└─────────────────────────────────────────────────────────────┘
```

### Step 000 — Clarify

Restate the concrete action in **one sentence**.  
Classify: `OBSERVE | READ | MUTATE | ATOMIC | IRREVERSIBLE`

**OBSERVE/READ** → skip to step 888 (just log).  
**MUTATE/ATOMIC/IRREVERSIBLE** → full loop required.

### Step 111 — Gather Evidence

Call **at minimum** these probes:
```
forge_plan(goal, workspace)           → action class, blast radius
forge_dry_run(manifest)               → diff preview, files touched
curl -s http://localhost:7071/health  → A-FORGE live
arif_organ_attest_all()               → all federation organs live
```

Tag every finding: `OBS | DER | INT | SPEC`

### Step 333 — Draft Execution Plan (Architect)

Propose the minimal forge action. For each:
- **what** files/containers/services it touches
- **blast radius** in number of files, services, databases
- **rollback** — exact commands to undo
- **test** — how to verify success without affecting production

**Current priority hardening gaps for A-FORGE:**
1. Add self-critique as required step before forge_execute
2. Add memory/feedback store for failed forge plans
3. Add cross-organ call leak detection (ensure GEOX tool not called by A-FORGE directly)
4. Add runtime 888_HOLD enforcement with actual BLOCK (not just documentation)
5. Add post-execution verification step

### Step 555 — Self-Critique Plan (Auditor)

Switch roles. Treat the plan as if from another agent. Attack it:
- Is the action class correct? (Is this actually IRREVERSIBLE but classified as MUTATE?)
- Is every organ call routed to the correct organ?
- Could this change introduce a security hole?
- Is the rollback plan actually tested?
- What happens if a service restart fails mid-deploy?

**Critique must include:**
```
critique:
  severity: BLOCKER | MAJOR | MINOR | INFO
  action_class_mismatch: <if OBSERVE→classified as MUTATE, etc.>
  evidence_gap: <what fact is missing before executing>
  failure_mode: <what breaks>
  safer_alternative: <what to do instead>
```

### Step 666 — Post-Exec Verification

After execution:
```
post_check:
  expected: <what should be true>
  actual:   <what is actually true>
  probe:    <exact command used to verify>
  drift:    NO_DRIFT | DRIFT_DETECTED | FAILURE
```

If drift detected → immediate rollback + 888_HOLD notification.

### Step 777 — Compare & Decide (Clerk)

```
pre_check_verdict:  PASS | FAIL | HOLD
execution_verdict:  SUCCESS | FAILED | ROLLED_BACK
```

**Hard 888_HOLD triggers in A-FORGE:**
- Any forge_execute without pre-flight critic pass → BLOCKED
- Any action_class mismatch (OBSERVE→MUTATE) → BLOCKED + VAULT entry
- Any cross-organ boundary leak → BLOCKED + VAULT entry
- Production deploy without all test suites passing → BLOCKED

### Step 888 — Audit Trail

```
forge_id:     FORGE-<date>-<seq>
action_class: OBSERVE | READ | MUTATE | ATOMIC | IRREVERSIBLE
risk_band:    LOW | MEDIUM | HIGH | CRITICAL
files_touched: [<paths>]
evidence_refs: [<probe results>]
pre_check:    PASS | FAIL | HOLD
post_check:   SUCCESS | FAILED | ROLLED_BACK
hold_reason:  <if applicable>
rollback_cmd: <exact command>
```

### Step 999 — Self-Improvement

Derive from this forge cycle:
- 2–3 **enduring rules** (e.g. "all deploys must run pre-flight critic")
- 2–3 **config/prompt updates** (e.g. "forge_execute now rejects un-criticized plans")
- Tag: `SAFE_TO_AUTOMATE | MANUAL_EDIT_REQUIRED`

Store lessons in `src/domain/memory/` for future forge sessions.

---

## 2. A-FORGE HARDENING PRIORITIES

### P0 — Pre-Flight Critic Required (BLOCKER)
```
gap:   forge_execute does not REQUIRE a critic pass
fix:   Add REQUIRED_CRITIC flag — forge_execute refuses without pre-flight critic
       Critic must be stored in forge receipt
test:  Execute forge_execute without critic → BLOCKED
floor: F7 HUMILITY — never execute without self-critique
```

### P1 — Action Class Enforcement (HIGH)
```
gap:   Action class is advisory, not enforced at runtime
fix:   Add runtime action class verification
       Classify at plan → verify at execute → abort if mismatch
test:  Classify OBSERVE but try ATOMIC → 888_HOLD
floor: F1 AMANAH — every action must match its declared risk class
```

### P2 — Post-Exec Verification (HIGH)
```
gap:   forge_execute returns but does NOT verify the result
fix:   Add post-execution verification step
       Compare expected vs actual state
       Auto-rollback on drift detection
test:  Simulate failed deploy → auto rollback
floor: F1 AMANAH — every mutation must be verified
```

### P3 — Cross-Organ Leak Detection (MEDIUM)
```
gap:   No runtime check that A-FORGE doesn't call GEOX/WEALTH/WELL tools directly
fix:   Add MCP call router that verifies destination organ matches tool domain
       GEOX tools → GEOX MCP. WEALTH tools → WEALTH MCP. Never direct.
test:  A-FORGE tries to call Vsh calculation → BLOCKED
floor: F8 LAW — system boundaries must be enforced
```

### P4 — Failed Plan Memory Store (MEDIUM)
```
gap:   Failed forge plans are not stored for learning
fix:   Add feedback store in src/domain/memory/failed_plans/
       Each entry: plan_id, failure_reason, lesson, fix_applied
test:  Submit failing plan → appears in failed_plans store
floor: F11 AUDIT — every failure must leave a trace
```

---

## 3. META-RULES FOR A-FORGE SELF-AUDIT

1. **Every forge_execute MUST have a pre-flight critic**
   - No exceptions. If critic fails → DO NOT EXECUTE
   - The critic can approve, modify, or reject the plan

2. **No invisible assumptions about target state**
   - "Service X is running" must be a measurement, not an assumption
   - If state is unknown, classify as OBSERVE first, not MUTATE

3. **Every failure is a lesson**
   - Failed forge → extract root cause → store lesson → apply fix
   - Lessons in `src/domain/memory/failed_plans/` are auto-loaded next forge

4. **Human remains sovereign over forge**
   - Any execution touching: production data, service restarts, git push, secrets
   - → `888_HOLD` — blocked until Arif approves

---

## 4. OUTPUT FORMAT (Per Forge Session)

```
## Summary
- <3-5 bullets: action taken, risks, verification result>

## Execution Record
| Action Class | Files | Risk Band | Pre-Check | Post-Check | Verdict |
|-------------|-------|-----------|-----------|------------|---------|
| MUTATE      | 3     | MEDIUM    | PASS      | SUCCESS    | APPLY   |

## Self-Critique
- <where your plan was weakest>
- <assumptions you failed to test>
- <what you'll do differently next forge>

## Lessons Learned
- <lesson_id>: <root cause> → <fix>

## Telemetry
```json
{
  "epoch": "<ISO8601>",
  "forge_id": "FORGE-<date>-<seq>",
  "action_class": "MUTATE",
  "dS": "<ESTIMATE>",
  "rollback_executed": false,
  "holds": ["<id>"],
  "verdict": "SUCCESS|FAILED|ROLLED_BACK"
}
```
```

---

*Forged 2026-06-14 by FORGE (000Ω) — live attestation of A-FORGE gaps baked in*
*DITEMPA BUKAN DIBERI — the forge earns its own hardening*
