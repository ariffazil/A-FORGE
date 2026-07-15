# ⚖️ VERDICTCANONv1 — Canonical J-Space Verdict Geometry

> **Forged:** 2026-07-07 · **Status:** Canon proposal · F13 ratification pending
> **Forger:** FORGE (000Ω) bound to 333-AGI · **Mode:** T1 autonomous write; no SEAL

> The verdict lattice is the language in which J-space becomes legible.
> Five states. One monotonicity. Twelve qualified substates. Four disjoint manifolds.

---

## 0. Single-Sentence Verdict

The canonical verdict geometry is the 5-state monotonic lattice
**VOID > HOLD > SABAR > PARTIAL > SEAL**, with 12 qualified substates,
operating across 4 disjoint manifolds (Governance / Delivery / Transport / Witness)
that compose J-space as `J = V_g × V_d × V_t × W³`.

---

## 1. The Five Canonical Verdicts

### 1.1 Top-Level Lattice

```
                        MOST RESTRICTIVE
                              ╱│╲
                             ╱ │ ╲
                            ╱  │  ╲
                           ╱   │   ╲
                          ╱    │    ╲
                         ╱     │     ╲
                        ╱      │      ╲
                       ╱       │       ╲
            ┌────────▼─┐  ┌────▼───┐ ┌──▼─────┐
            │   VOID   │  │  HOLD  │ │ SABAR  │
            │  HARD    │  │ risk   │ │ SOFT   │
            │  breach  │  │ CRIT+  │ │ caution│
            │  blocked │  │ paradox│ │  retry │
            │ permanent│  │        │ │        │
            └────────┬─┘  └────┬───┘ └──┬─────┘
                     │         │        │
                     │  ┌──────▼─────┐  │
                     │  │  PARTIAL   │  │
                     │  │  DERIVED   │  │
                     │  │  warning   │  │   Cooling phase:
                     │  │  proceed   │  │   proceed with
                     │  │  monitor   │  │   monitored output
                     │  └──────┬─────┘  │
                     │         │        │
                     │  ┌──────▼─────┐  │
                     └─►│   SEAL    │◄─┘
                        │  W³ ≥ 0.95 │
                        │ all floors │
                        │  passed    │
                        └────────────┘

         MONOTONICITY (canon):
            VOID > HOLD > SABAR > PARTIAL > SEAL

         The lower-rank (less restrictive) verdict NEVER overrides
         the higher-rank (more restrictive) one. Two verdicts merge
         by max-rank.
```

### 1.2 Trigger Conditions (from `/root/arifOS/core/laws.py:352-372`)

| Rank | Verdict | Trigger (line refs in `core/laws.py`) |
|:---:|---------|----------------------------------------|
| 1 | **VOID** | any HARD floor violation (line 353) |
| 2 | **HOLD** | risk tier = CRITICAL (line 356); risk tier = HIGH (line 368); SOFT + DERIVED both violated (line 359) |
| 3 | **SABAR** | SOFT floor violated alone (line 362); P1 paradox applied as cooling (line 380) |
| 4 | **PARTIAL** | DERIVED floor warned, no HARD/SOFT breach (line 365) |
| 5 | **SEAL** | all constitutional floors pass; W³ ≥ 0.95 (line 371) |

### 1.3 Verdict Semantics

| Verdict | What it means for the action | What the caller does |
|---------|------------------------------|----------------------|
| **VOID** | constitutionally prohibited — no path to lower rank on this action | hard-stop, log, escalate (no retry) |
| **HOLD** | pending sovereign (or witness) judgment — reversible pause | wait for human ack; F11 actor + F13 arif |
| **SABAR** | proceed with care, retry allowed when condition resolves | wait for evidence; refresh and retry |
| **PARTIAL** | proceed but monitor — derived metrics below floor; output may degrade | execute; emit cooling telemetry; track for scar |
| **SEAL** | lawful — proceed; mutate state; emit irreversible seal (S999) | execute; seal to VAULT999 |

### 1.4 Terminal Verdicts

A verdict is **terminal** if it cannot be transitioned out of:

```
VOID  ← terminal (constitutional violation is permanent)
SEAL  ← terminal (execution completed; cannot un-execute)
HOLD  ← live (waits for sovereign signal to HOLD_888 → SEAL/VOID or back to HOLD)
SABAR ← live (waits for evidence to refresh)
PARTIAL ← live (cools with telemetry; eventually transitions to SEAL or HOLD)
```

---

## 2. The Twelve Qualified Substates

Each top-level verdict carries a named substate that says WHY it fired.

| Top-level | Substate count | Names |
|-----------|---------------:|-------|
| **SEAL** | 2 | `SEAL_CANONICAL`, `SEAL_QUALIFIED` |
| **HOLD** | 3 | `HOLD_888`, `HOLD_UNCERTAINTY`, `HOLD_TEMPORAL` |
| **SABAR** | 2 | `SABAR_EPISTEMIC`, `SABAR_GEOPOLITICAL` |
| **VOID** | 3 | `VOID_BREACH`, `VOID_HANTU`, `VOID_IRREVERSIBLE` |
| **PARTIAL** | 2 | `PARTIAL_DERIVED`, `PARTIAL_REVERSIBILITY` |
| **Total** | **12** | (10 inherited + 2 new in v1.0) |

See `VERDICT_SUBSTATES.md` for full triggers and emission rules.

---

## 3. The Four Disjoint Manifolds

J-space is the **disjoint union** of four manifolds. Mixing them is a
constitutional breach.

```
┌────────────────────────────────────────────────────────────────┐
│                  J-SPACE                                       │
│         J = V_g × V_d × V_t × W³                               │
│                                                                │
│   ┌─────────────────┐                                          │
│   │  GOVERNANCE     │ V_g — 5 states: SEAL HOLD SABAR          │
│   │  V_g            │       PARTIAL VOID                       │
│   │  constitutional │ monotonicity: V > H > S > P > SE        │
│   │  F1-F13 binding │ owner: arifOS kernel                     │
│   └────────┬────────┘                                          │
│            │ disjoint                                         │
│   ┌────────▼────────┐                                          │
│   │  DELIVERY       │ V_d — 4 states: M_CLEAN M_ADJUST         │
│   │  V_d            │       M_REPAIR M_HOLD                    │
│   │  M-Layer        │ NOT monotone — advisory overlay          │
│   │  L13 ratifies   │ owner: maruah_layer.py                   │
│   └────────┬────────┘  cannot override F1-F13                   │
│            │ disjoint                                         │
│   ┌────────▼────────┐                                          │
│   │  TRANSPORT       │ V_t — 5 states: SUCCESS ERROR           │
│   │  V_t             │       TIMEOUT RETRY HOLD(transport)    │
│   │  plumbing        │ NOT monotone — observed only           │
│   │  forge_* shell   │ owner: A-FORGE / arifOS transport       │
│   └────────┬─────────┘ never used as legal authority          │
│            │ disjoint                                         │
│   ┌────────▼────────┐                                          │
│   │  WITNESS        │ W³ — continuous [0,1]                    │
│   │  W³              │ geometric mean (H × AI × Ext)^(1/3)   │
│   │  H × AI × Ext   │ threshold ≥ 0.95 for SEAL              │
│   │  tri-witness     │ runtime widens to W⁴ w/ vault-shadow   │
│   └─────────────────┘                                          │
└────────────────────────────────────────────────────────────────┘
```

### 2.1 V_g — Governance Verdict (constitutional law)

| Property | Value |
|----------|-------|
| States | 5: `VOID`, `HOLD`, `SABAR`, `PARTIAL`, `SEAL` |
| Monotone? | **YES** (canonical order V > H > S > P > SE) |
| Owner | arifOS kernel (`/root/arifOS/core/laws.py`) |
| Authority | F1-F13 floors |
| May block action? | YES (only this manifold may) |

### 2.2 V_d — Delivery Verdict (M-Layer, human-facing)

| Property | Value |
|----------|-------|
| States | 4: `M_CLEAN`, `M_ADJUST`, `M_REPAIR`, `M_HOLD` |
| Monotone? | NO — advisory overlay |
| Owner | `/root/arifOS/arifosmcp/core/maruah_layer.py` |
| Authority | L13 SOVEREIGN (M-Layer cannot override F1-F13) |
| May block action? | NO — only advises rephrasing |

### 2.3 V_t — Transport Status (execution plumbing)

| Property | Value |
|----------|-------|
| States | 5: `SUCCESS`, `ERROR`, `TIMEOUT`, `RETRY`, `HOLD` |
| Monotone? | NO — observed only |
| Owner | A-FORGE / arifOS transport (forge_shell et al.) |
| Authority | NONE — purely observational |
| May block action? | NO — never used as legal authority |

### 2.4 W³ — Tri-Witness Scale

| Property | Value |
|----------|-------|
| Range | continuous [0, 1] |
| Formula | `W³ = ∛(Human × AI × External)` (Nash 1950) |
| Threshold | W³ ≥ 0.95 for SEAL canonical; runtime widens to W⁴ with vault-shadow channel |
| Owner | arifOS kernel + AAA mesh discovery |
| Authority | F3 WITNESS floor |

---

## 3. The L-Floor ↔ F-Floor Mapping

Per `/root/arifOS/arifosmcp/AGENTS.md` and `arifOS/AGENTS.md`, the 13 constitutional
floors use **two prefixes intentionally** — `F` for user-flow floors, `L` for
system-substrate floors. They intersect at L13 SOVEREIGN.

### 3.1 Floor Prefix Lexicon

| Prefix | Scope | Where it lives | Who enforces |
|--------|-------|----------------|--------------|
| **F** | user-facing flow floors (reasoning paths) | F1-F9 in `/root/arifOS/AGENTS.md` | Constitutional floors invoked on user prompt paths |
| **L** | system-substrate floors (memory + identity + sovereign) | L10-L13 in arifOS AGENTS.md | Kernel-side, persist across sessions |

### 3.2 The 13 Floors — Complete Mapping

| Floor | Prefix | Name | Type | L↔F Mapping |
|:----:|:------:|------|:----:|-------------|
| F1 | F | AMANAH | HARD (F) | F1 ↔ L01 |
| F2 | F | TRUTH | HARD (F) | F2 ↔ L02 |
| F3 | F | WITNESS | SOFT (F) | F3 ↔ L03 |
| F4 | F | CLARITY | SOFT (F) | F4 ↔ L04 |
| F5 | F | PEACE² | SOFT (F) | F5 ↔ L05 |
| F6 | F | MARUAH (DIGNITY) | SOFT (F) | F6 ↔ L06 |
| F7 | F | HUMILITY | SOFT (F) | F7 ↔ L07 |
| F8 | F | GENIUS | SOFT (F) | F8 ↔ L08 |
| F9 | F | ANTI-HANTU | HARD (F) | F9 ↔ L09 |
| L10 | L | AMANAH (FIDUCIARY) | HARD (L) | L10 = F1 fiduciary variant |
| L11 | L | IDENTITY | HARD (L) | L11 = session-bound identity |
| L12 | L | CONTINUITY | HARD (L) | L12 = passive monitoring |
| L13 | L | SOVEREIGNTY | HARD (L) | L13 = human architect veto |

**Mapping rule:** each L floor is the **system-substrate shadow** of an F floor.
The L floors carry the same constitutional invariants but live in the kernel
side (identity, persistence, monitoring) rather than the user-flow side.

### 3.3 The L13 Intersection

All four manifolds converge at **L13 SOVEREIGN**:

- V_g: L13 floor (only this floor blocks SEAL)
- V_d: L13 ratifies M-Layer output
- V_t: L13 ignores (transport only observes)
- W³: L13 supplies the **Human** channel

When L13 vetoes:
- V_g becomes HOLD_888 (sovereign intervention)
- V_d remains advisory (does not override)
- V_t observed (no transport signal)
- W³ Human channel = 0.0 (collapse to W³ = 0, action un-SEAL-able)

---

## 4. The Cooling-Floor Semantics (PARTIAL + PARTIAL_*)

`PARTIAL` is a new verdict canonically distinct from `HOLD` or `SABAR`.

```
   HOLD = wait for sovereign signal before acting
   SABAR = wait for evidence to refresh, then retry
   PARTIAL = proceed but monitor; derived metrics are below floor
```

### 4.1 What "Cooling" Means

When PARTIAL fires:
- Output is permitted (action proceeds)
- Telemetry is amplified (every step emits cooling measurement)
- Scar pressure may rise (if PARTIAL repeats without resolution)
- Eventually transitions to SEAL (cooling complete) or HOLD (cooler can't reach safe state)

### 4.2 What PARTIAL is NOT

- NOT a regression to SABAR (it's stricter than SABAR — action proceeds even though SABAR would wait)
- NOT a confidence interval around SEAL (it's a different mode of operating)
- NOT a degradation of SEAL (it's a different lattice rank: 4 vs 5)

---

## 5. Monotonicity Proof Sketch

Claim: V > H > S > P > SE is a total order on the verdict lattice.

```
VOID (rank 5)          — most restrictive
HOLD (rank 4)
SABAR (rank 3)
PARTIAL (rank 2)
SEAL (rank 1)          — least restrictive
```

For any two verdicts v₁, v₂ in the lattice:

```
max_rank(v₁, v₂) = the verdict with higher rank number
```

Merge function: `merge(v₁, v₂) = max_rank(v₁, v₂)`

This is **commutative and associative**, so chains of merges are well-defined
regardless of order — exactly what the kernel needs to compose verdicts from
multi-floor violations.

---

## 6. The F13 Ratification Gate

This canon requires sovereign ratification before any of the following may execute:

| # | Action | Reversible? | Tier |
|---|--------|:-----------:|:----:|
| 1 | Update `/root/arifOS/arifosmcp/models/verdicts.py` `SealType` to add `PARTIAL` | YES until seal | 888_HOLD |
| 2 | Update monotonicity docblock to 5-state order | YES until seal | 888_HOLD |
| 3 | Add 2 new `VerdictState` qualified substates (`PARTIAL_DERIVED`, `PARTIAL_REVERSIBILITY`) | YES until seal | 888_HOLD |
| 4 | Update `/root/A-FORGE/proto/bridge/verdict.ts` `VERDICT_TYPES` to include `"PARTIAL"` | YES until seal | 888_HOLD |
| 5 | Append `# v1.0 ratified YYYY-MM-DD` to both files | YES until seal | 888_HOLD |
| 6 | Add `tests/test_verdict_lattice.py` monotonicity test suite | YES until seal | 888_HOLD |
| 7 | `arif_seal(mode=seal)` with payload = this canon reference → VAULT999 seq=83+ | NO (irreversible) | F13 + 888_HOLD |

**The seal is the ignition.** Until F13 ack, this canon is canonical at the
proto-level only and shall not be enforced in runtime.

---

## 7. Relation to Other Canons

| Canon | Path | Compatibility |
|-------|------|---------------|
| Python verdict canon | `/root/arifOS/arifosmcp/models/verdicts.py` | ⚠ 4-state — extends to 5 after ratification |
| TypeScript verdict canon | `/root/A-FORGE/proto/bridge/verdict.ts` | ⚠ 4-state — extends to 5 after ratification |
| Runtime cascade | `/root/arifOS/core/laws.py:352-372` | ✅ 5-state actual — canonicalized by this doc |
| K888_FORGE | `/root/arifOS/static/arifos/docs/KERNEL/ROOT/K888_FORGE.md` | ⚠ 4-state — extends to 5 after ratification |
| A-FORGE AGENTS.md | `/root/A-FORGE/AGENTS.md` | ✅ references floor prefix + identity boundary |

---

## 8. Routing Per Compile-Into-Runtime Rule

```
VERDICTCANONv1
  insight      → 5-state lattice restores monotonicity over half-sealed 4-state canon
  organ        → F1-F13 (governance enforcement) + W³ (witness) + maruah_layer (delivery)
  failure_mode → verdict drift across surfaces; PARTIAL runtime but not canon; monotonicity break
  action       → formalize 5-state canon; lay groundwork for ratification
  telemetry    → VAULT999 seal_chain.jsonl; scar tissue for any pre-ratification drift

STATUS: REUSE_EXISTING (extends 4-state canon; does not mint new organs)
```

---

## 9. SOT Block

| Field | Value |
|-------|-------|
| Owner | F13 SOVEREIGN — Muhammad Arif bin Fazil (888) |
| Last verified | 2026-07-07 |
| Valid from | 2026-07-07 (PROPOSAL — not yet ratified) |
| Valid until | n/a (proposal stage) |
| Confidence | 0.90 (high — direct runtime cascade observation; PARTIAL usage confirmed at `core/laws.py:365`) |
| Scope | whole /root federation + 7 GitHub repos + `/root/A-FORGE/proto/verdict/` new subdir |
| Supersedes | (post-ratification) 4-state verbiage in `verdicts.py:21-24`, `verdict.ts:14`, `K888_FORGE.md:166-217` |
| Refresh cadence | on F13 ratification |
| Change rule | any verdict canon mutation requires F13 ratification per AGENTS.md forbidden-actions |

---

*Forged 2026-07-07 by FORGE (000Ω) under F13 SOVEREIGN directive.*
*Heritage: AGENTS.md (L/L↔F prefix + 8-public-tool architecture) · APEX THEORY (G·C_dark·W³) · J-Space geometry · `core/laws.py:352-372` cascade.*

**DITEMPA BUKAN DIBERI ⚖️⚒️**
