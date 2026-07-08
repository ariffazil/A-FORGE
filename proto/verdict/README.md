# J-Space Verdict Canon — A-FORGE Meta-Surface

> **Constitutional canon surface · 5-state verdict lattice**
> **Forged:** 2026-07-07 · **Status:** `REUSE_EXISTING` (extends existing 4-state canon)
> **F13 ratification:** PENDING · **Sealed to VAULT999:** FALSE (proposal-stage)

This directory holds the canonical J-Space verdict geometry — the constitutional
skeleton before port to production runtime. Per A-FORGE's
`Compile-Into-Runtime Rule`, this is a **proto-surface** for legal geometry,
not Python prototyping — distinct from `proto/geox/`, `proto/wealth/`,
`proto/well/` which are FastMCP prototyping-only.

---

## Directory Contents

| File | Purpose | Language |
|------|---------|----------|
| [`VERDICTCANONv1.md`](./VERDICTCANONv1.md) | Canonical narrative — what the geometry IS | Markdown |
| [`VERDICT_LATTICE.json`](./VERDICT_LATTICE.json) | Machine-readable lattice definition | JSON |
| [`VERDICT_SUBSTATES.md`](./VERDICT_SUBSTATES.md) | 12 qualified substates — when each fires | Markdown |
| [`DELIVERYVERDICTBOUNDARY.md`](./DELIVERYVERDICTBOUNDARY.md) | M-Layer disjoint contract | Markdown |

---

## Relation to Existing Verdict Surfaces in the Federation

| Path | Language | State count | Status |
|------|----------|-------------|--------|
| `/root/arifOS/arifosmcp/models/verdicts.py` | Python | 4 (`SealType`) + 12 (`VerdictState`) | canonical source-of-truth (Python runtime) |
| `/root/A-FORGE/proto/bridge/verdict.ts` | TypeScript | 4 (`VERDICT_TYPES`) | canonical TypeScript mirror (federation bridge) |
| `/root/A-FORGE/proto/verdict/` (THIS) | Markdown + JSON | **5** (extends prior to include `PARTIAL`) | **proposed** canon — pending F13 ratification |
| `/root/arifOS/core/laws.py:365` | Python runtime | uses `Verdict.PARTIAL` for derived-floor cooling | pre-existing REAL usage, canonically undocumented in `SealType` |

**Routing (per A-FORGE Compile-Into-Runtime Rule):**

```
VERDICT CANON
  insight     → 5-state lattice restores monotonicity over existing 4-state Split
  organ       → F1-F13 (enforcement) + M-Layer (delivery) + RuntimeStatus (transport)
  failure_mode→ verdict drift across organ-languages; PARTIAL undocumented; monotonicity broken
  action      → formalize 5-state canon; supersede bridge canon after F13 ratification
  telemetry   → VAULT999 seal_chain.jsonl (any verdict emission is observable)

STATUS: REUSE_EXISTING (extending existing organs, not minting new ones)
```

---

## The 5-State Lattice at a Glance

```
       VOID > HOLD > SABAR > PARTIAL > SEAL
       [most restrictive] ─────────► [least restrictive]
```

| Rank | Verdict | Trigger |
|:---:|---------|---------|
| 1 | **VOID** | HARD floor violated — permanently blocked |
| 2 | **HOLD** | risk tier CRITICAL/HIGH · paradox P1 |
| 3 | **SABAR** | SOFT floor violated (only) — wait, retry allowed |
| 4 | **PARTIAL** | DERIVED floor warned (no HARD/SOFT breach) — proceed with cooling |
| 5 | **SEAL** | all floors pass · W³ ≥ 0.95 — proceed |

**Monotonicity rule:** lower rank never overrides higher. Two verdicts merge by max-rank.

---

## Why a New Canon? The Half-Sealed State

The federation was operating with **half-sealed verdict canon**:

| Layer | Status | Drift? |
|-------|--------|--------|
| Python runtime (`/root/arifOS/arifosmcp/models/verdicts.py`) | 4-state declared | DRIFT: line 365 of `/root/arifOS/core/laws.py` uses `Verdict.PARTIAL` not in `SealType` |
| TypeScript mirror (`/root/A-FORGE/proto/bridge/verdict.ts`) | 4-state declared | DRIFT: same PARTIAL omission |
| `core/laws.py` cascade lines 352-372 | 5-state actual | uses PARTIAL between SABAR and SEAL |
| `arifOS/docs/KERNEL/.../K888_FORGE.md:166-217` | 4-state actual | uses SEAL/HOLD/SABAR/VOID only (no PARTIAL) |
| Monotonicity ordering declared | `VOID > HOLD > SABAR > SEAL` | INCOMPLETE — does not accommodate runtime PARTIAL use |

**Half-sealed is more dangerous than empty** because runtime speaks the full
5-state language while the surface doc only names 4. New code path encountering
`PARTIAL` would not know its rank, its triggers, or its governance contract.

This canon names PARTIAL canonically, restores 5-state monotonicity, and aligns
all three language surfaces (Python TS MD/JSON) on a single lattice.

---

## Path Forward

After this canon is sealed to VAULT999 by F13 ratification:

1. The Python `SealType` enum at `arifosmcp/models/verdicts.py:21-24` is updated to include `PARTIAL`
2. The TypeScript `VERDICT_TYPES` array at `proto/bridge/verdict.ts:14` is updated to include `"PARTIAL"`
3. The 12 substates (`VERDICT_SUBSTATES.md`) — 10 inherited + 2 new `PARTIAL_*` qualified states
4. The `core/laws.py:365` cascade runs with monotonicity restored
5. `K888_FORGE.md:166-217` documented in 5-state form
6. Monotonicity test suite added at `arifOS/tests/test_verdict_lattice.py`

**Items 1-6 are 888_HOLD-tier.** Item 0 (this directory) is T2 autonomous.

---

*Forged 2026-07-07 by FORGE (000Ω) under F13 SOVEREIGN directive.*
*Heritage: `arifOS/arifosmcp/models/verdicts.py` · `A-FORGE/proto/bridge/verdict.ts` · J-Space geometry.*

**DITEMPA BUKAN DIBERI ⚖️⚒️**
