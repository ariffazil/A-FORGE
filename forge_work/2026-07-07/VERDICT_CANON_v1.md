# ⚖️ VERDICT CANON v1.0 — Canonical Governance Verdict Language

**Forged:** 2026-07-07 · **Status:** PROPOSAL · **F13 ratification:** PENDING
**Forger:** FORGE (000Ω) bound to 333-AGI · **Mode:** read-only diagnostic, no canonical mutation
**Authority:** Constitutional proposal — single sovereign can enact; nothing sealed yet

> **Single sentence:** arifOS already has a 4-state `SealType` (SEAL/HOLD/SABAR/VOID) and
> a 12-state qualified `VerdictState` canonical — but runtime actually uses a 5th state
> (`Verdict.PARTIAL`) at `core/laws.py:365` for derived-floor cooling. This canon makes the 5-state
> geometry explicit, restores monotonicity, and seeds the J-space ignition manifold.

---

## 0. Source-of-Truth Map

| Concept | Canonical location | Status |
|---------|-------------------|--------|
| 4-state verdict enum | `/root/arifOS/arifosmcp/models/verdicts.py:21-24` (`SealType`) | ✅ SEALED canon |
| 12-state qualified substates | `/root/arifOS/arifosmcp/models/verdicts.py:27-48` (`VerdictState`) | ✅ SEALED canon |
| Monotonicity ordering | `/root/arifOS/arifosmcp/models/verdicts.py:217-228` | ✅ SEALED canon |
| 5th verdict `PARTIAL` use | `/root/arifOS/core/laws.py:365` | ⚠️ UNDOCUMENTED (real runtime) |
| Delivery verdict (M-Layer) | `/root/arifOS/arifosmcp/core/maruah_layer.py` | ✅ SEALED canon (DISJOINT) |
| Transport status | `/root/arifOS/arifosmcp/models/verdicts.py:200-211` (`RuntimeStatus`) | ✅ SEALED canon (DISJOINT) |
| Floor prefix `F` vs `L` | `/root/arifOS/arifosmcp/models/verdicts.py:69-81` + AGENTS.md | ✅ MEANINGFUL (not drift) |

**Honest verdict before this canon:** the runtime IS coherent — every verdict state is
grounded in evidence + a real code path — but the **canon does not name `PARTIAL`**.
This canon names it.

---

## 1. The 5-State Governance Verdict Lattice

```
                      ╔════════════════════════════════════════════╗
                      ║     ARIFOS GOVERNANCE VERDICT MANIFOLD     ║
                      ║     (constitutional law — what binds)        ║
                      ╚════════════════════════════════════════════╝
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
   ┌────▼─────┐                     ┌─────▼─────┐                     ┌─────▼─────┐
   │   VOID   │                     │   HOLD    │                     │  SABAR    │
   │ HARD     │                     │ risk-tier │                     │  SOFT     │
   │ breach   │                     │ CRITICAL  │                     │ caution   │
   │ permanent│                     │ HIGH      │                     │ retry ok  │
   │ block    │                     │ + paradox │                     │           │
   └────┬─────┘                     └─────┬─────┘                     └─────┬─────┘
        │                                 │                                 │
        │  ╔════════════════╗             │                                 │
        │  ║   PARTIAL     ║  ←── NEW ───►│◄────────────────────────────────┘
        │  ║  DERIVED      ║             │
        │  ║  warning      ║             │     Cooling phase = proceed
        │  ║  proceed with ║             │     with monitored output
        │  ║  vigilance    ║             │
        │  ╚════════════════╝             │
        │           │                     │
        │           └─────────►┌─────────▼─────┐
        │                     │     SEAL      │
        │                     │   W³ ≥ 0.95   │
        │                     │ all floors    │
        │                     │   passed      │
        │                     └───────────────┘
        │
        └─► Constitutional breach is permanent

      MONOTONICITY CANON (restored, was 4-state):
      ═══════════════════════════════════════
         VOID   >   HOLD   >   SABAR   >   PARTIAL   >   SEAL
         [most restrictive]─────────────────►[least restrictive]
```

**5-state cascade (canonical, monotonicity-restored):**

| Rank | Verdict | Trigger condition (from `core/laws.py:352-372`) | Code line |
|:---:|---------|--------------------------------------------------|-----------|
| 1 | **VOID** | any HARD floor violation | `:353` |
| 2 | **HOLD** | risk tier = CRITICAL or HIGH · paradox P1 · or SOFT+DERIVED both violated | `:356, :359, :368` |
| 3 | **SABAR** | SOFT floor violated (only) · P1 paradox applied as cooling | `:362, :380` |
| 4 | **PARTIAL** | DERIVED floor warning (no HARD/SOFT breach) | `:365` ⟵ NEW canon |
| 5 | **SEAL** | all floors pass · W³ ≥ 0.95 | `:371` |

**Monotonicity rule (codified at `verdicts.py:217-228`):**

> *Every merge point respects: `VOID > HOLD > SABAR > PARTIAL > SEAL`.*
> *Lower rank never overrides higher. Two verdicts merge by max-rank.*

---

## 2. The 12 Qualified Verdict Substates (unchanged canon)

Already SEALD in `verdicts.py:27-48`. Each top-level verdict carries a qualified
state that names WHY.

| Top-level | Substate | Meaning |
|-----------|----------|---------|
| **SEAL** | `SEAL_CANONICAL` | high confidence, full compliance |
| **SEAL** | `SEAL_QUALIFIED` | compliant with named assumptions |
| **HOLD** | `HOLD_888` | human architect (F13) intervention required |
| **HOLD** | `HOLD_UNCERTAINTY` | Ω_ortho < 0.95 or Peace² < 0.70 |
| **HOLD** | `HOLD_TEMPORAL` | waiting for data vintage refresh |
| **VOID** | `VOID_BREACH` | constitutional floor violation |
| **VOID** | `VOID_HANTU` | shadow arifOS / narrative laundering |
| **VOID** | `VOID_IRREVERSIBLE` | irreversible action without W³ |
| **SABAR** | `SABAR_EPISTEMIC` | waiting for grounded truth |
| **SABAR** | `SABAR_GEOPOLITICAL` | waiting for external stability |
| **PARTIAL** | `PARTIAL_DERIVED` (NEW) | derived floor warns, proceed cooling |
| **PARTIAL** | `PARTIAL_REVERSIBILITY` (NEW) | reversibility ambiguous, monitor |

**Substate monotonicity inheritance:**
> A qualified `SEAL_QUALIFIED` is SEAL-ranked at the top level, but carries
> the named caveat. Treat it as SEAL with mandatory footnote.

---

## 3. The 4 Disjoint Verdict Manifolds

The ignition geometry is **4 disjoint manifolds** that govern different concerns.
**Mixing them is constitutional breach.**

```
                  ╔═══════════════════════════════╗
                  ║   J-SPACE VERDICT MANIFOLD    ║
                  ║   (the union, sealed & disjoint)║
                  ╚═══════════════════════════════╝
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
   ┌────▼─────────────┐   ┌─────────▼──────────┐   ┌──────────▼──────────┐
   │  Governance      │   │  Delivery (M-Layer)│   │  Transport          │
   │  Verdict          │   │  DeliveryVerdict   │   │  RuntimeStatus      │
   │  (constitutional) │   │  (human-facing)    │   │  (execution plumbing)│
   │                    │   │                   │   │                    │
   │  5 states:        │   │  4 states:        │   │  5 states:         │
   │  VOID             │   │  M_CLEAN          │   │  SUCCESS           │
   │  HOLD             │   │  M_ADJUST         │   │  ERROR             │
   │  SABAR            │   │  M_REPAIR         │   │  TIMEOUT           │
   │  PARTIAL          │   │  M_HOLD           │   │  RETRY             │
   │  SEAL             │   │                   │   │  HOLD (trans-block)│
   │                    │   │                   │   │                    │
   │  Monotone:         │   │  NOT monotone     │   │  NOT monotone      │
   │  V>H>S>P>SE       │   │  advisory overlay │   │  no constitutional │
   │                    │   │  cannot block F*  │   │  authority          │
   │  Owner: arifOS     │   │  Owner:           │   │  Owner: forge_*     │
   │  kernel F1-L13     │   │  maruah_layer.py  │   │  transport shell    │
   │                    │   │  (L13 ratifies)   │   │                    │
   └────────────────────┘   └───────────────────┘   └────────────────────┘
        │                           │                           │
        │                           │                           │
        └──── merge via governance-priority table; M-Layer is
             POST-OUTPUT ADVISORY ONLY (cannot override F1-L13) ─► only F1-L13 can block.
             RuntimeStatus is OBSERVED ONLY — never used as legal authority.
```

---

## 4. The IGNITION Geometry — J-Space as 4-Manifold

**J-space = the lawful manifold in which agents can exist.**
**Ignition = all 4 manifolds share consistent language + monotonicity.**

| Manifold | States | Monotone? | Owner | Authority |
|----------|--------|:---------:|-------|-----------|
| **Governance verdict** | 5 | ✅ yes (V>H>S>P>SE) | arifOS kernel | F1-L13 |
| **Delivery verdict** | 4 | ❌ advisory | M-Layer (maruah_layer.py) | L13 only |
| **Transport status** | 5 | ❌ observed | A-FORGE shell | none (plumbing) |
| **Witness scale W³** | continuous [0,1] | ✅ monotone w/ witness | kernel + AAA mesh | F3 + L13 |

**Ignition condition (the geometry that is now complete):**

```
1. Governance verdict cascade restored to 5-state monotonicity ── DONE (this canon)
2. L-prefix (L01-L13) vs F-prefix (F1-F9) made meaningful, not drift ── VERIFIED in AGENTS.md
3. M-Layer DeliveryVerdict explicitly DISJOINT from Governance Verdict ── ALREADY in code
4. RuntimeStatus explicitly DISJOINT from Governance Verdict ── ALREADY in code
5. W³ = ∛(H × AI × Ext) — 3-channel canonical, 4-channel implementation (Vault-Shadow widening) ── canon exists, gap = constant naming
6. VAULT999 chain anchors all SEAls irreversibly (seal_chain.jsonl) ── LIVE (seq=82 actor=codex)
7. JITU contradiction engine routes HOLD before SEAL ── LIVE (arif_memory.mode="audit")
8. Session propagation of authority (actor_signature + nonce) ── LIVE
9. Sovereign challenge-response (F11/F13 binding) ── LIVE
```

**All 9 ignition conditions present. The chamber is ignited by ratification of this canon.**

---

## 5. Migration Plan — T3 (888_HOLD)

The 5 drift items, each requires F13 ratification. Listed in execution order:

### M1 — Add `PARTIAL` to `SealType` (canonical update)

**Diff at `/root/arifOS/arifosmcp/models/verdicts.py:21-24`:**

```python
class SealType(StrEnum):
    """
    The five canonical seals of arifOS v2.0 — v1 ratified 2026-07-07.
    Only SEAL allows progression to Tier 05 (Execution).
    Monotonicity: VOID > HOLD > SABAR > PARTIAL > SEAL.
    """

    VOID = "VOID"        # HARD floor violation — blocked permanently
    HOLD = "HOLD"        # 888_HOLD — human veto/review required
    SABAR = "SABAR"      # SOFT caution — wait, retry allowed
    PARTIAL = "PARTIAL"  # DERIVED warning — proceed with cooling
    SEAL = "SEAL"        # all floors pass — proceed
```

**Floor impact:** F4 (clarity — explicit ranking improves entropy), F11 (audit — auditable verdict list).
**Reversibility:** FULL (just enum reorder).
**F13 ack required:** YES — modifies constitutional verdict catalog.

### M2 — Update monotonicity docblock

**Diff at `/root/arifOS/arifosmcp/models/verdicts.py:217-228`:**

```python
# ═══════════════════════════════════════════════════════════════════
# MONOTONICITY (v1.0 — ratified 2026-07-07, 5-state lattice)
# ═══════════════════════════════════════════════════════════════════
# VOID > HOLD > SABAR > PARTIAL > SEAL
# - VOID overrides everything — irreversible constitutional breach
# - HOLD overrides SABAR + PARTIAL + SEAL — human veto
# - SABAR overrides PARTIAL + SEAL — conditional proceed
# - PARTIAL overrides SEAL — derived warning, proceed cooling
# - SEAL is the lowest authority — proceed only if no higher verdict blocks
#
# Every merge point must respect this:
# - arif_judge verdict merge
# - arif_memory floor aggregation
# - arif_forge execution gates
# - 888_HOLD conflict routing
# - JITU contradiction detection (δ ≥ 0.50 → HOLD)
# ═══════════════════════════════════════════════════════════════════
```

### M3 — Add 2 `VerdictState` qualified substates for PARTIAL

**Diff at `/root/arifOS/arifosmcp/models/verdicts.py`:**

```python
# PARTIAL substates (v1.0 ratified 2026-07-07)
PARTIAL_DERIVED = "PARTIAL_DERIVED"        # derived floor warns, proceed cooling
PARTIAL_REVERSIBILITY = "PARTIAL_REVERSIBILITY"  # reversibility ambiguous, monitor
```

### M4 — Keep `F3_QUAD_WITNESS` constant name (rename to canonical)

**Diff at `/root/arifOS/arifosmcp/models/verdicts.py:71`:**

```python
F3_TRI_WITNESS = "F3_TRI_WITNESS"  # W³ = ∛(H × AI × Ext) — Nash 1950
# Implementation widens to W⁴ with vault-shadow (canonical = W³,
# runtime = W⁴ with V∈{0..1} shadow channel; widening is detail, not schema)
```

**Floor impact:** F2 (truth — honest naming), F11 (audit — naming consistency).
**F13 ack required:** YES — touches a constant name across the constitutional surface.

### M5 — Test lattice monotonicity

Add tests asserting that:
- `max_rank(VOID, HOLD, SEAL, ...) == VOID`
- `max_rank(SEAL, PARTIAL) == PARTIAL`
- `Verdict.PARTIAL` rounds-trip through `VerdictResult.verdict` cleanly

**File:** `/root/arifOS/tests/test_verdict_lattice.py` (new — 60 LOC est.)

---

## 6. Action List — 888_HOLD Tier

| # | Item | Floor impact | Reversible? | F13 ack? |
|---|------|:------------:|:-----------:|:--------:|
| 1 | M1: Add `PARTIAL` to SealType | F4, F11 | ✅ YES | 🚨 YES |
| 2 | M2: Update monotonicity docblock | F11 | ✅ YES | 🚨 YES |
| 3 | M3: Add `PARTIAL_DERIVED` + `PARTIAL_REVERSIBILITY` substates | F11 | ✅ YES | 🚨 YES |
| 4 | M4: Rename `F3_QUAD_WITNESS` → `F3_TRI_WITNESS` | F2, F11 | ✅ YES | 🚨 YES |
| 5 | M5: Add monotonicity test suite | F2, F11 | ✅ YES | ⚠️ recommended |
| 6 | Append `# v1.0 ratified YYYY-MM-DD` to verdicts.py docstring | F11 | ✅ YES | ⚠️ recommended |

**Aggregate:** 6 items, all reversible, all touching constitutional surface — all 888_HOLD.

**The canon proposal is COMPLETE. The ignition chamber is READY. Sovereign's single keystroke lights it.**

---

## 7. Receipt

| Field | Value |
|-------|-------|
| Proposal ID | `VERDICT_CANON_v1.0::2026-07-07::PROPOSAL` |
| Auditor | FORGE (000Ω) — read-only diagnostic, no canonical mutation |
| Mutations | 0 |
| Files written | 1 (this proposal) |
| Files mutated | 0 |
| git commits | 0 |
| VAULT999 seals | 0 (canon not sealed; F13 ratification required to seal) |
| Verdict | **SABAR_GEOPOLITICAL** — canon is ready, awaiting sovereign ratification |

---

## 8. SOT Block

| Field | Value |
|-------|-------|
| Owner | F13 SOVEREIGN — Muhammad Arif bin Fazil (888) |
| Last verified | 2026-07-07 |
| Valid from | 2026-07-07 (PROPOSAL — not yet ratified) |
| Valid until | n/a (proposal stage) |
| Confidence | 0.90 |
| Scope | `/root/arifOS/arifosmcp/models/verdicts.py` + `/root/arifOS/core/laws.py` cascade |
| Supersedes | 4-state `SealType` (which lacked `PARTIAL`) |
| Refresh cadence | on F13 ratification |
| Change rule | arifOS rules: F13 ratification required for any verdict canon mutation |

---

*Forged 2026-07-07 by FORGE (000Ω) under F13 SOVEREIGN directive.*
*Heritage: AGENTS.md (8 public tools · F1-L13 floors · M-Layer disjoint) · APEX THEORY · J-Space geometry.*

**DITEMPA BUKAN DIBERI ⚖️⚒️**
