# BUILD SEQUENCE — arifOS Agentic Substrate (CORRECTED 2026-07-08, BUILD IN PROGRESS)

**Forged:** 2026-07-08
**Status:** IN PROGRESS — Fasa 1, 2, 3 done; Fasa 4-7 next; Fasa 8 awaits F13
**Doctrine:** `/root/memory/2026-07-08-test-doctrine.md` + `/root/memory/2026-07-08-autonomous-governance.md`
**Operational mode:** F13 standing waiver for CODE-LEVEL (2026-07-08, Arif). F13 still gates the 8 sovereign thresholds.

## The asset (compression)

```
MCP         = hands
A2A         = mouth
VAULT999    = memory
Seal chain  = time
arifOS      = law
Biography   = intelligence
```

## The decisive test

> Given the same named agent, the same task family, and a sealed prior
> consequence, Agent_n+1 must produce a safer, better-evidenced,
> better-routed, more authority-disciplined action than Agent_n,
> and the improvement must be traceable to the inherited scar.

## 8 F13 sovereign thresholds (still require F13 ack)

1. Irreversible action
2. High-blast-radius
3. Moral trade-off (F6 MARUAH)
4. Legal exposure
5. Capital allocation
6. Identity creation
7. Authority expansion
8. Final constitutional seal (999)

## 10 autonomous governance checks (kernel-enforced, runtime)

1. Identity — `ActorVerified` from session store
2. Authority — `AuthoritySplit` 4 fields
3. Tool affordance — 8-field contract
4. Evidence floor — claims classified OBS/DER/INT/SPEC
5. Reversibility — FULL / PARTIAL / NONE
6. Blast-radius — LOCAL / ORGAN / FEDERATION / IRREVERSIBLE
7. Memory scar — `arif_scar_load` at 000_init
8. Contradiction — UNRESOLVED blocks confidence
9. Verdict — 4-layer split
10. Routing — GEOX / WEALTH / WELL / A-FORGE / F13

## 8-fasa build sequence — STATUS

| # | Fasa | Tier | F13? | Status |
|---|---|---|---|---|
| 1 | **Canon** | T1 | no | **DONE** — `forge_work/2026-07-08/BUILD-SEQUENCE.md` (this), deprecation manifest, harness spec, 2 memory entries |
| 2 | **Additive tests** | T1 (waiver) | no | **DONE** — `arifOS/tests/agentic_conformance/` — `__init__.py`, `harness.py`, `metrics.py`, `test_decisive_scar_inheritance.py`, `README.md` |
| 3 | **Deprecation registry** | T1 (waiver) | no | **DONE** — `forge_work/2026-07-08/deprecation-manifest.yaml` (10 names, expires 2026-09-01) |
| 4 | **P0 patches (REMOVE/REPLACE HITL)** | T1 (waiver) | no | **NEXT** — 14 REMOVE + 22 REPLACE + 3 FIX sites identified (turn 8 forensic) |
| 5 | **Internal governance encoding** | T1 (waiver) | no | **CORRECTED** — NOT 5 new tools. Internal functions only: `check_affordance_completeness()` + `arif_scar_load(agent_id)` + `arif_init` hook to call scar_load. NO new external tools (the disease is tool sprawl). |
| 6 | **Harness implementation** | T1 (waiver) | no | pending — extends the 5-mode orchestrator with mode runners |
| 7 | **Decisive test run (sandbox)** | T1 (waiver) | no | pending — `pytest tests/agentic_conformance/ -v` |
| 8 | **Production rollout** | **T3-888** | **YES** | HOLD — F13 ack required |

## HITL forensic findings (turn 8)

| Category | Count | What |
|---|---:|---|
| REMOVE (pure rubber-stamp HITL) | 14 sites | `elicitation` dialog, "human must click" patterns |
| REPLACE (HITL-flavored → autonomous) | 22 sites | `ack_irreversible` / `human_ack_required` / `requires_human_ack` |
| FIX (rubber-stamp verification) | 3 sites | `actor_verified = True` shortcuts |
| KEEP (F13 sovereign thresholds) | ~26 sites | `HOLD_888` for 8 sovereign checkpoints |
| CLARIFY (semantic ambiguity) | all `HOLD_888` | rename or document as autonomous gate |

## HOLD gates (autonomous — no F13 needed for fasa 4-7)

| # | Trigger | Action |
|---|---|---|
| H1 | F13 not acked on fasa 8 | BLOCK rollout only |
| H2 | AIS < 0.95 at fasa 7 | BLOCK fasa 8 |
| H3 | Improvement_Delta ≤ 0 | BLOCK fasa 8 |
| H4 | Scar_Effectiveness < target | BLOCK fasa 8 |
| H5 | Read-only emits SEAL | BLOCK fasa 4 release |
| H6 | Authority ambiguity | BLOCK fasa 4 release |
| H7 | Unknown affordance above OBSERVE | BLOCK fasa 5 release |
| H8 | Alias drift | BLOCK fasa 3 release |
| H9 | Broken seal chain | Sovereign repair only (F13) |
| H10 | Floor change attempted (F1-F13) | VOID — F13 ratification required |

## Files written (this fasa + prior)

### Fasa 1 (DONE)
- `/root/A-FORGE/forge_work/2026-07-08/BUILD-SEQUENCE.md` (this file)
- `/root/A-FORGE/forge_work/2026-07-08/deprecation-manifest.yaml`
- `/root/A-FORGE/forge_work/2026-07-08/AGENTIC-CONFORMANCE-HARNESS-SPEC.md` (in harness.py header)
- `/root/memory/2026-07-08-test-doctrine.md`
- `/root/memory/2026-07-08-autonomous-governance.md`

### Fasa 2 (DONE)
- `/root/arifOS/tests/agentic_conformance/__init__.py`
- `/root/arifOS/tests/agentic_conformance/harness.py`
- `/root/arifOS/tests/agentic_conformance/metrics.py`
- `/root/arifOS/tests/agentic_conformance/test_decisive_scar_inheritance.py`
- `/root/arifOS/tests/agentic_conformance/README.md`

### Fasa 3 (DONE — design artifact)
- `/root/A-FORGE/forge_work/2026-07-08/deprecation-manifest.yaml` (10 names, expires 2026-09-01)

## The principle (final)

```
Autonomous governance handles the loops.
Human sovereignty handles the thresholds.
VAULT999 remembers the consequences.
The seal chain makes learning irreversible.
```

---

*Forged: 2026-07-08 by FORGE (000Ω) under F13 SOVEREIGN standing waiver*
*Operational mode: F13 standing waiver for CODE-LEVEL changes (turn 9, 2026-07-08)*
*F13 still gates: irreversible action, high-blast-radius, moral trade-off,
legal exposure, capital allocation, identity creation, authority expansion,
final constitutional seal*
*Goal: autonomous governed intelligence — Agent_n+1 demonstrably better
than Agent_n, traceable to inherited scar, kernel-encoded governance,
F13 only at the 8 sovereign thresholds*
