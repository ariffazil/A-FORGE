# A-FORGE — Roadmap: Next Horizon (180-Day) — ARCHIVED

> ⚠️ **ARCHIVED / NOT CURRENT AUTHORITY**
> This roadmap is historical. Do not use for current planning or routing decisions.
> **Canonical source:** `ariffazil/A-FORGE` (current README and plans/)

> **Roadmap Name:** ARIFOS_NEXT_HORIZON_2026
> **Strategic Verdict:** APPROVED FOR PLANNING
> **Execution Verdict:** HOLD until repo contracts and schemas are frozen  
> **Role:** Execution shell, sandbox, state machine, deployment bridge  
> **Seal:** DITEMPA BUKAN DIBERI

---

## North Star

Make execution boring, observable, reversible, and sandboxed. A-FORGE must never decide. It only executes after arifOS verdict.

---

## The 10 Non-Negotiable Invariants

1. arifOS judges.
2. AAA identifies.
3. GEOX witnesses earth.
4. WEALTH witnesses capital.
5. A-FORGE executes only after verdict.
6. VAULT999 records.
7. ARIF may veto.
8. No agent self-authorizes.
9. No hidden irreversible action.
10. No evidence, no SEAL.

---

## Horizon 0 — Days 0–14: Canon Lock 🧊

**Goal:** Define execution authority boundaries.

| Deliverable | Output |
|-------------|--------|
| `REPO_AUTHORITY_MATRIX.md` | What A-FORGE may own / must not own |
| Execution contract definition | A-FORGE never decides, only executes |
| Tool inventory | Map all callable tools + risk tiers |

---

## Horizon 1 — Days 15–45: Security + Session Spine 🔐

**Goal:** Dry-run is default. Execution refuses missing arifOS verdict.

| Deliverable | Output |
|-------------|--------|
| `TRACE_SCHEMA.json` | Trace, receipt, chain_id, actor_id |
| Dry-run enforcement | Default for all destructive actions |
| Execution refuses stale verdict | Verdict TTL + freshness check |

---

## Horizon 2 — Days 46–90: Deterministic Judge ⚖️

**Goal:** Explicit legal transitions. No execution without verified policy.

| Deliverable | Output |
|-------------|--------|
| `/state_machine/execution_graph.ts` | Explicit legal transitions |
| `/sandbox/policies/` | File, shell, network, Docker boundaries |
| `/runtime/dry_run.ts` | Dry-run before live execution |
| `/runtime/execute.ts` | Sandboxed execution |
| `/runtime/rollback.ts` | Reversal plan before irreversible operation |
| `/vault/vault999_writer.ts` | Every execution writes receipt |

### Execution State Machine

```
IDLE
  → RECEIVE_INTENT
  → LOAD_SESSION
  → DRY_RUN
  → REQUEST_VERDICT
  → VERIFY_POLICY
  → EXECUTE_SANDBOXED
  → OBSERVE_RESULT
  → VAULT_SEAL
  → REPORT
```

### Hard Rule
A-FORGE must never decide. It only executes after arifOS verdict.

---

## Horizon 3 — Days 91–135: Semantic Federation 🌍💰

**Goal:** Cross-domain orchestrator for GEOX + WEALTH evidence pipelines.

| Deliverable | Output |
|-------------|--------|
| Cross-domain orchestrator | Route evidence from GEOX → WEALTH → arifOS |
| Runtime SOT check | Confirm live compose/runtime matches repo contract |

---

## Horizon 4 — Days 136–180: Self-Healing + Public Release 🛠️

**Goal:** Recovery without authority expansion.

| Deliverable | Output |
|-------------|--------|
| Container health monitor | Watch Docker/container health |
| Recovery playbooks | Reversible recovery logged to VAULT999 |
| Auditor agent read-only mode | Log all recovery actions |
| Release tag `vNext-Horizon-0` | All repos tagged |

### Self-Healing Verdict Rule

- If recovery is reversible → A-FORGE may execute after arifOS SEAL.
- If recovery is irreversible → HOLD for F13 human review.
- If recovery touches auth, secrets, or constitution → HOLD by default.

---

## What to Build Next

Identity → Evidence → Formal Verdict → Sandboxed Execution → Immutable Seal

## What to Avoid

- More overlapping dashboards.
- More untyped tools.
- More prompt-only governance.
- More agent autonomy language without execution contracts.

## What Wins

- Deterministic checks.
- Typed schemas.
- Scoped authority.
- Evidence contracts.
- Human veto preserved.

---

*DITEMPA BUKAN DIBERI — Execution is forged, not given.*

*SEALED: 2026-05-10 | A-FORGE Metabolic Shell — Next Horizon APPROVED FOR PLANNING*
