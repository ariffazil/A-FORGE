# ⚖️ VERDICT_SUBSTATES — 14 Qualified Verdict Substates

> **Forged:** 2026-07-07 · **Status:** Canon proposal · F13 ratification pending
> **Purpose:** Document the 12 qualified substates that name WHY each top-level verdict fired.

A top-level verdict (SEAL/HOLD/SABAR/PARTIAL/VOID) **always carries a qualified
substate** that names the precise reason. Substates inherit monotonicity from
their parent verdict — `SEAL_CANONICAL` is SEAL-ranked; `VOID_BREACH` is VOID-ranked.

---

## 0. Single-Sentence Verdict

There are **12 qualified verdict substates** (10 inherited from canon +
2 new `PARTIAL_*` added by v1.0), each nameable, each monotone-inherited,
each evidence-anchored.

---

## 1. The 14 Substates — Complete Index

| # | Top-level | Substate | Trigger | Floor touched |
|---|-----------|----------|---------|---------------|
| 1 | **SEAL** | `SEAL_CANONICAL` | High confidence, full compliance — every floor passes nominal | All 13 |
| 2 | **SEAL** | `SEAL_QUALIFIED` | Compliant with named assumptions; W³ ≥ 0.95 + assumptions documented | All 13 (with caveat) |
| 3 | **HOLD** | `HOLD_888` | Human architect (F13) intervention required | L13 |
| 4 | **HOLD** | `HOLD_UNCERTAINTY` | Ω_ortho < 0.95 OR Peace² < 0.70 | F7 or F5 |
| 5 | **HOLD** | `HOLD_TEMPORAL` | Waiting for data vintage refresh (data is stale) | F2 TRUTH (vintage) |
| 6 | **SABAR** | `SABAR_EPISTEMIC` | Waiting for grounded truth (evidence insufficient but not anti-) | F2 |
| 7 | **SABAR** | `SABAR_GEOPOLITICAL` | Waiting for external stability (e.g. market regime, regional context) | F2 (external) |
| 8 | **VOID** | `VOID_BREACH` | Constitutional floor violation (one or more HARD floors fail) | F1/F2/F9/L11/L12/L13 |
| 9 | **VOID** | `VOID_HANTU` | Shadow arifOS detected (narrative laundering, jailbreak attempt) | F9 ANTI-HANTU |
| 10 | **VOID** | `VOID_IRREVERSIBLE` | Irreversible action attempted without W³ ≥ 0.95 | F1 AMANAH + F3 WITNESS |
| 11 | **PARTIAL** | `PARTIAL_DERIVED` | Derived floor warned; no HARD/SOFT breach — proceed with cooling | DERIVED floors (L04 entropy threshold etc.) |
| 12 | **PARTIAL** | `PARTIAL_REVERSIBILITY` | Action reversibility is ambiguous — proceed but monitor recovery path | F1 (reversibility classification) |

---

## 2. The Two New Substates (v1.0 ratified 2026-07-07)

### 2.1 `PARTIAL_DERIVED`

**Trigger:** When a DERIVED-level floor (e.g. L04 entropy threshold for cooling
budget, L11 session stability indicator) emits a warning that is **below floor
threshold but not breach**. The action is permitted because no HARD/SOFT breach
occurred, but the cooling phase applies.

**Code ref:** Triggered in `/root/arifOS/core/laws.py:365` (the previously
undocumented `Verdict.PARTIAL` use).

**Cooldown logic:**
- Increases cooling telemetry by 2x
- Marks the action for scar monitoring
- After 3 consecutive `PARTIAL_DERIVED` verdicts on the same actor, escalates to `HOLD`

**Routing:**
```
insight → Reality + Governance organs
         (Reality: physical substrate ok;
          Governance: invariant breach but not severe)
failure_mode → action may degrade if cooling not honored
action → execute with cooling + telemetry amplification
telemetry → cooling_phase=true; cooling_cycles_remaining=N
```

### 2.2 `PARTIAL_REVERSIBILITY`

**Trigger:** When the action's reversibility is **ambiguous** — i.e. the action
class is partially-reversible (e.g. writing to a staging area that may or may
not cascade). Hard-revert is supported, but cascade-recovery is uncertain.

**Code ref:** Triggered when `forge_*` action_class reports reversibility = "PARTIAL"
and the kernel cannot disambiguate.

**Cooldown logic:**
- Marks the action for stage-by-stage rollback confirmation
- Logs every stage transition as a separate verdict
- The chain becomes `execute → seal` → if any stage fails rollback → `VOID_BREACH` (NOT HOLD — irreversible)

**Routing:**
```
insight → Memory + Execution organs
         (Memory: cascade footprint unclear;
          Execution: rollback path uncertain)
failure_mode → cascade effect on later actions unclear
action → execute per stage, verify per stage rollback
telemetry → rollback_verified_per_stage=true; cascade_footprint=measured
```

---

## 3. Substate Monotonicity Inheritance

A qualified substate inherits the **rank** of its top-level verdict.

```
SEAL_CANONICAL       → rank 1 (SEAL)
SEAL_QUALIFIED       → rank 1 (SEAL, with footnote)

HOLD_888             → rank 4 (HOLD)
HOLD_UNCERTAINTY     → rank 4 (HOLD)
HOLD_TEMPORAL        → rank 4 (HOLD)

SABAR_EPISTEMIC      → rank 3 (SABAR)
SABAR_GEOPOLITICAL   → rank 3 (SABAR)

VOID_BREACH          → rank 5 (VOID)
VOID_HANTU           → rank 5 (VOID)
VOID_IRREVERSIBLE    → rank 5 (VOID)

PARTIAL_DERIVED      → rank 2 (PARTIAL)
PARTIAL_REVERSIBILITY→ rank 2 (PARTIAL)
```

**Merge rule (from `VERDICT_LATTICE.json`):**
Two substates merge by max-rank of their top-level verdict, **not** by substate name.
`VOID_HANTU` + `SABAR_EPISTEMIC` = `VOID` (top-level max-rank wins).

**Critical exception:** `SEAL_QUALIFIED` carries a named caveat. Anyone
downstream of a qualified SEAL must read the caveat before assuming clean proceed.

---

## 4. Substate Selection Algorithm

When the kernel at `/root/arifOS/core/laws.py` decides to emit a verdict, it:

```
1. Compute top-level verdict per cascade (lines 352-372)
2. If top-level is HOLD:
   2a. If L13 explicitly invoked → HOLD_888
   2b. Else if Ω_ortho < 0.95 OR Peace² < 0.70 → HOLD_UNCERTAINTY
   2c. Else if data vintage detected stale → HOLD_TEMPORAL
3. If top-level is SABAR:
   3a. If reason is evidence insufficiency → SABAR_EPISTEMIC
   3b. If reason is external stability → SABAR_GEOPOLITICAL
4. If top-level is VOID:
   4a. If detected shadow pattern → VOID_HANTU
   4b. Else if irreversible + W³ < 0.95 → VOID_IRREVERSIBLE
   4c. Else → VOID_BREACH (general HARD violation)
5. If top-level is PARTIAL:
   5a. If reason is DERIVED floor warn → PARTIAL_DERIVED
   5b. If reason is reversibility ambiguous → PARTIAL_REVERSIBILITY
6. If top-level is SEAL:
   6a. If every floor passed nominal → SEAL_CANONICAL
   6b. Else if W³ ≥ 0.95 with named caveat → SEAL_QUALIFIED
```

This is the **substate selection algorithm**. It binds named substates to
the cascade lines in `core/laws.py`.

---

## 5. Substate Migration (v1.0 → runtime)

Existing `/root/arifOS/arifosmcp/models/verdicts.py:27-48` already declares
10 of the 12 substates (all SEAL/HOLD/SABAR/VOID substates). The 2 new
PARTIAL substates need to be added:

```python
# After line 48 in /root/arifOS/arifosmcp/models/verdicts.py
PARTIAL_DERIVED = "PARTIAL_DERIVED"          # derived floor warns, proceed cooling
PARTIAL_REVERSIBILITY = "PARTIAL_REVERSIBILITY"  # reversibility ambiguous, monitor
```

This is migration action **M3** in `VERDICT_LATTICE.json`. Reversible until
F13 + arif_seal ratification.

---

## 6. Substates and VAULT999 — Emission Rule

When the kernel emits a verdict, the **top-level name + substate** is recorded
in `VAULT999/seal_chain.jsonl`:

```jsonl
{"seq": 82, "actor": "codex", "verdict": "HOLD", "state": "HOLD_888", ...}
{"seq": 83, "actor": "arifOS", "verdict": "PARTIAL", "state": "PARTIAL_DERIVED", ...}
```

**Substate emission is mandatory.** Any verdict without a named substate is a
canonical breach.

---

## 7. SOT Block

| Field | Value |
|-------|-------|
| Owner | F13 SOVEREIGN |
| Last verified | 2026-07-07 |
| Valid from | 2026-07-07 (PROPOSAL — pending ratification) |
| Valid until | n/a (proposal stage) |
| Confidence | 0.90 |
| Scope | canonical substates for the 5 governance verdicts |
| Supersedes | (post-ratification) 10-substate partial canon in `verdicts.py:27-48` |
| Refresh cadence | on F13 ratification |

---

*Forged 2026-07-07 by FORGE (000Ω) under F13 SOVEREIGN directive.*
*Heritage: `arifOS/arifosmcp/models/verdicts.py:27-48` (10 inherited substates) · J-Space geometry · 5-state lattice.*

**DITEMPA BUKAN DIBERI ⚖️⚒️**
