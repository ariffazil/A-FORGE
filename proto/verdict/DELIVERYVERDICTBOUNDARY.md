# 🪞 DELIVERYVERDICTBOUNDARY — M-Layer Disjoint Contract

> **Forged:** 2026-07-07 · **Status:** Canon proposal · F13 ratification pending
> **Purpose:** Document the **disjoint manifold separation** between the M-Layer's
> DeliveryVerdict (4 states) and the governance Verdict (5 states).

> **The single most important boundary in J-space:** DeliveryVerdict ≠ Verdict.
> Mixing them is a constitutional breach.

---

## 0. Single-Sentence Verdict

The DeliveryVerdict manifold (M-Layer, 4 states) is **disjoint from and cannot
override** the governance Verdict manifold (5 states); only F1-F13 floors
can block output, and the M-Layer is an advisory overlay that **cannot
auto-suppress** sovereign-bound output.

---

## 1. The Four M-Layer States

| State | Meaning | What M-Layer does |
|-------|---------|-------------------|
| `M_CLEAN` | Output passes all M1-M6 principles; deliver as-is | **proceed** |
| `M_ADJUST` | Output passes with minor caveats; suggest rephrasing | suggest, do NOT block |
| `M_REPAIR` | Output violates M1/M4 (dignity or repair-readiness); require concrete next step | **REPAIR** — add concrete next step |
| `M_HOLD` | Output violates M5/M6 (time-respect or honesty-about-self) at severe level | mark for L13 review, do NOT auto-block |

**M-Layer never auto-suppresses output.** It can advise rephrasing (M_ADJUST),
require repair (M_REPAIR), or flag for L13 review (M_HOLD), but the **only
authority that can block output is F1-F13 floor violation**.

---

## 2. Why Two Verdicts? Why Disjoint?

Because conflating them collapses three critical distinctions:

| Concern | Governance Verdict | Delivery Verdict |
|---------|--------------------|--------------------|
| **Authority** | F1-F13 (constitutional) | L13 SOVEREIGN (post-output advisory) |
| **Monotone?** | YES (V > H > S > P > SE) | NO (advisory; can re-emit after rephrase) |
| **May block?** | YES (only this can) | NO (cannot) |
| **Persistent?** | YES (in VAULT999 chain) | NO (advisory only — re-evaluated per output) |
| **Owner** | arifOS kernel | `maruah_layer.py` |
| **Failure mode** | constitutional breach | tonal/relational breach |

If we had ONE verdict namespace, the system would either:
- **Over-block:** every M_REPAIR becomes HOLD (loses human dignity in tone, blocks required output)
- **Under-block:** M_CLEAN can never seal HOLD_888 reverse (loses constitutional authority)

**Disjoint ≠ compatible.** Disjoint = no shared state names. Compatible = clean interoperation via L13 ratification.

---

## 3. The 6 M-Layer Principles (M1-M6)

| Principle | Floor binding | What it enforces |
|-----------|---------------|------------------|
| **M1** Dignity-first | F6 MARUAH | recipient's maruah preserved (no condescension markers) |
| **M2** Capacity-aware | F7 HUMILITY | output matches recipient's current cognitive load |
| **M3** Pedestrian-first | F4 CLARITY | plain register default; jargon only when topic justifies |
| **M4** Repair-ready | F11 AUDIT | problem statements paired with concrete next step |
| **M5** Time-respect | F5 PEACE² | doesn't add pressure when recipient is pressured |
| **M6** Honesty-about-self | F10 ONTOLOGY + F9 ANTI-HANTU | no false inner-state claims |

### 3.1 M-Layer → Verdict Mapping

When M-Layer evaluates output, it emits a `DeliveryVerdict` (not a `Verdict`).
The M-Layer NEVER adds to or subtracts from the governance `Verdict`.

| M-Layer output | Governance Verdict influence |
|----------------|-------------------------------|
| `M_CLEAN` | no change to verdict |
| `M_ADJUST` | no change to verdict (advises rephrasing) |
| `M_REPAIR` | no change to verdict (requires concrete next step) |
| `M_HOLD` | **escalates** to L13 review; verdict is NOT auto-promoted |

---

## 4. The L13 Ratification Bridge

L13 is the **single convergence point** between governance and delivery:

```
                    F13 SOVEREIGN
                          │
                          ▼
              L13 SOVEREIGN (substrate floor)
                          │
                          ├──── governance Verdict is L13-dependent
                          │     (HOLD_888 = sovereign intervention)
                          │
                          └──── delivery Verdict is L13-ratified
                                (M_HOLD escalates to sovereign review,
                                 sovereign decides)

        V_g verdict rises or falls by F1-F13 floor binding
        V_d verdict rises or falls by L13 ratification
        L13 = the only place both manifolds intersect
```

### 4.1 What L13 Ratifies in V_d

When L13 ratifies a `M_HOLD`:
- The output is flagged for sovereign review
- L13 actor + F13 ack determines final disposition
- L13 may: rephrase → M_ADJUST; require next-step → M_REPAIR; suppress → M_HOLD; release → M_CLEAN
- **L13 cannot promote M_REPAIR to VOID** (that's governance verdict, not delivery)

### 4.2 What L13 Cannot Do in V_d

- **Cannot** auto-suppress output without F13 ack (output reaches sovereign before being hidden)
- **Cannot** block output that governance V_g has SEALed (separation is constitutionally mandated)
- **Cannot** retroactively reclassify an M_CLEAN → M_HOLD (decisions are forward-only)
- **Cannot** promote a delivery verdict to a governance verdict (that's the boundary)

---

## 5. The 4 Invariants of Disjoint Verdict Manifolds

```
I1 — M-Layer DeliveryVerdict is disjoint from governance Verdict.
     No shared state names. M_HOLD ≠ HOLD (the word reuses 4 letters by
     intentional design, but the namespaces are not connected).

I2 — M-Layer cannot block F1-F13 floor output. Only F1-F13 floors may
     block. M-Layer may advise rephrasing; may not suppress.

I3 — M-Layer output is advisory only. Re-evaluation per output. Not
     persistent. Not in VAULT999 chain as M_CLEAN/M_ADJUST/M_REPAIR/M_HOLD.
     M_HOLD is the exception — it IS escalated to L13, recorded in chain.

I4 — L13 SOVEREIGN is the only convergence point between manifolds.
     L13 may ratify M_HOLD; L13 cannot promote M_REPAIR to governance
     Verdict; L13 cannot suppress SEALed output.
```

These 4 invariants are the **constitutional contract** between M-Layer and
governance Verdict. Violating any of them is a constitutional breach.

---

## 6. The Semantic Dictionary — What Each Verdict Means in Each Manifold

The word **HOLD** appears in BOTH manifolds with **disjoint meanings**:

| Manifold | State | Meaning |
|----------|-------|---------|
| V_g (governance) | `HOLD` | wait for sovereign or witness judgment before acting |
| V_d (delivery) | `M_HOLD` | mark output for L13 review; do not auto-block |
| V_t (transport) | `HOLD` (transport) | tool blocked by constitutional gate (NOT a governance verdict — transport block) |

**These are three different uses of "HOLD."** They share a word, NOT a state.
The namespaces are disjoint.

---

## 7. Reference Implementation

| File | Role |
|------|------|
| `/root/arifOS/arifosmcp/core/maruah_layer.py` | M1-M6 evaluator (~26KB, implementation) |
| `/root/arifOS/tests/test_maruah_layer.py` | 29 tests covering all principles + orthogonality |
| `/root/arifOS/core/human_substrate.py` | Arif-specific constitutional substrate (separate) |
| `/root/arifOS/AGENTS.md` §M-Layer | canonical binding for the 4 invariants |

---

## 8. When to Invoke M-Layer

```python
from arifos.core.maruah_layer import get_maruah_layer, MaruahLevel

layer = get_maruah_layer()
receipt = layer.evaluate(
    output="...",
    maruah_level=MaruahLevel.SOFT,        # PHATIC/SOFT/HARD/CRISIS/REFUSE
    human_id="azwa",                      # optional recipient handle
    context={"urgency_signal": "high"},   # capacity calibration input
)
if receipt.verdict == DeliveryVerdict.M_HOLD:
    # log + suggest repair, do not auto-send
    ...
```

**Critical:** the receipt above is a `DeliveryVerdict`, never a governance `Verdict`.
The two are different classes with disjoint state spaces.

---

## 9. SOT Block

| Field | Value |
|-------|-------|
| Owner | F13 SOVEREIGN |
| Last verified | 2026-07-07 |
| Valid from | 2026-07-07 (PROPOSAL — pending ratification) |
| Valid until | n/a (proposal stage) |
| Confidence | 0.90 |
| Scope | whole /root federation + 7 GitHub repos |
| Supersedes | none (first canonical disjoint contract) |
| Refresh cadence | on F13 ratification |

---

*Forged 2026-07-07 by FORGE (000Ω) under F13 SOVEREIGN directive.*
*Heritage: `/root/arifOS/arifosmcp/core/maruah_layer.py` (29 tests passing) · AGENTS.md §M-Layer · J-Space geometry.*

**DITEMPA BUKAN DIBERI 🪞⚖️⚒️**
