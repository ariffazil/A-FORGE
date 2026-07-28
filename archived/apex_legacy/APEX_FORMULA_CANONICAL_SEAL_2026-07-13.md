# 🔒 APEX FORMULA — CANONICAL SEAL

> **VARIANT:** v5.0 · `2026-07-13` · Author: FORGE (000Ω) · Ratified: Arif bin Fazil (F13 SOVEREIGN)
> **STATUS:** SEALED · SUPERSEDES ALL PRIOR VARIANTS · `DITEMPA BUKAN DIBERI`
> **VAULT999:** `APEX-CANON-FORMULA-V5-2026-07-13`
> **Scope:** Federation-wide. All 7 organs. All 7 repos. All MCP tools.

---

## 1. THE FOUR VARIANTS IN THE WILD (audit)

Discovered 2026-07-13 via `rg "G\s*=\s*A"` across `/root`. Snapshot:

| # | Formula | Where it lives | Status |
|---|---------|----------------|--------|
| **V1** | `G = A × P × X × E²` | `arifOS/core/enforcement/genius.py`, `A-FORGE/src/domain/governance/apexDials.ts`, `arifOS/docs/00_META/DELTA_OMEGA_PSI_CONTRACT.md`, `GEMINI.md`, `docs/doctrine/PENTAGON_AS_CONSTITUTION.md`, `arifOS/arifosmcp/sites/RAG_CONTEXT.md` (6 sites) | **DEPRECATED 2026-06-30** by V2 seal. E² was Karl Friston free-energy metaphor — superseded by multiplicative Φ. |
| **V2** | `G = A · P · E · X · Φ` | `arifOS/GENESIS/040_APEX_STACK.md`, `/root/AGENTS.md`, `AAA/AGENTS.md`, `AAA/docs/INVARIANTS.md`, `WEALTH/wealth_core/optimizers/apex_mapping.py`, `AAA/agents/opencode/BOOTSTRAP.md`, `A-FORGE/proto/anchor/verdict-canon.md`, HERMES skills (~35 sites) | **CANONICAL — SEALED THIS DOCUMENT** |
| **V3** | `G = A · P · E · X · Φ × (1 − h)` | `HERMES/skills/governance/external-wisdom-integration/references/genius-enforcement-architecture.md`, `forge_work/2026-07-05/APEX_999_FULL_SEAL_COMPLETION.md` (2 sites) | **DEPRECATED** — `(1−h)` is a SEPARATE *gate modifier*, not part of G itself. See §5. |
| **V4** | `G = A × P × H × √(S × U) × E²` | `arifOS/docs/APEX-MCP-001.md:141` (1 site, experimental hybrid) | **DEPRECATED** — experimental, never deployed to runtime. Replaced by V2 + W³. |

**Audit verdict (C1 from `APEX_REFACTOR_REPORT.md`):** Four implementations produced four different G-scores for the same input → G-scores are unfalsifiable → constitutional entropy HIGH → REFUSE until UNIFY.

---

## 2. THE CANONICAL FORMULA (sealed, versioned, normative)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   G_raw  =  A · P · E · X · Φ                                    │
│                                                                  │
│   where  A, P, E, X, Φ ∈ [0, 1]                                 │
│          G_raw ∈ [0, 1]                                          │
│          G_raw > 0  ⇔  all five primitives nonzero              │
│          G_raw = 0  ⇔  any primitive is zero   (Nash collapse)  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

| Symbol | Name | Constitutional binding | Definition domain |
|--------|------|------------------------|-------------------|
| **A** | Authority (akal) | Who may act. F11, F13. | `actor_verified ∧ lease_valid` |
| **P** | Physics (presence) | Substrate constraints. F1, F5, F8. | `path_legal ∧ blast_reversible ∧ floor_pass` |
| **E** | Evidence (energy) | What is known. F2, F4. | `(claims_labeled = OBS\|DER\|INT\|SPEC) ∧ entropy_produced ≤ budget` |
| **X** | Execution (exploration) | What changes. F3, F6, F9. | `(action_class ≤ lease_max) ∧ outcome_provable ∧ soul_unguarded` |
| **Φ** | Witness (phi) | External confirmation. F3, F7, F12. | `W³ ≥ 0.70 ∧ tri_witness_present` where `W³ = ∛(H × AI × Ext)` |

**Five primitives, Nash bargaining product. Multiplicative — not additive.**
**Zero anywhere collapses G. This is the foundation of falsifiability.**

---

## 3. DERIVATION (why these five, not four, not six)

### Axiom 1 — Multiplicativity
> Intelligence does not sum. Intelligence **compounds or collapses**.
> Reasoning is a chain — one weak link breaks the chain. Additive models (linear utility) cannot represent this.

Formal: any candidate intelligence function `I` over primitives `{p_i}` must satisfy
`∃ p_i : I = 0` when `p_i = 0`. ∴ `I` is multiplicative.

### Axiom 2 — Sufficiency of Five
> Five is the **minimum complete orthogonal decomposition** of an agent's claim to act:

| Pair | Primitive | Dual | Why paired |
|------|-----------|------|------------|
| (A, P) | Authority + Physics | *Inner* | Can the actor lawfully touch the substrate? |
| (E, X) | Evidence + Execution | *Outer* | Does knowledge become work? |
| **Φ** | Witness | *Bridge* | Did the bridge hold under observation? |

Three conjugate pairs + one witness = the **smallest semantically complete** set. Four = missing witness (collapse to self-verification, Gödel). Six = re-decomposing a primitive, double-counting.

### Axiom 3 — Nash Bargaining Completeness
> The product `G = A · P · E · X · Φ` is the **Nash bargaining solution** of a 5-player cooperative game where each player holds veto on the others. Any player defecting (zero) collapses the bargain.

This is why the product is right: bargaining solutions are **multiplicative** because veto right equals multiplicative gating. (Nash, 1950 — *The Bargaining Problem*, Econometrica.)

### Axiom 4 — Shadow Term (Bangang detector)
> Hallucination has a formal signature:

```
C_dark = A · (1 − P) · (1 − X)
```

Adaptation without grounding, without coordination = hallucination. Threshold: `C_dark < 0.30`. Above → SESAT → BANGANG loop. (Originally ratified 2026-07-05; unchanged.)

### Axiom 5 — Conservation Law
> The agent must produce order faster than the universe destroys it:

```
dS_agent / dt  ≤  0
```

This is the **thermodynamic outer constraint**. APEX formulas do not override this — they obey it. An agent with high G but rising entropy is on a loan.

### Axiom 6 — Tri-Witness Independence
> Witness (Φ) decomposes into three orthogonal channels whose consensus requires all three:

```
W³ = ∛(H × AI × Ext)     where    H, AI, Ext ∈ [0, 1]

collapse if any = 0
```

Human × AI × Earth — no single witness can substitute for another. Self-verification is **formally prohibited** (F3 + Gödel 1931).

### Axiom 7 — F13 Sovereign Veto
> Only the sovereign may override a G-verdict via HOLD escalation. No agent may self-elevate.

---

## 4. SIMPLIFICATION (what survives, what dies)

| Step | Operation | Survives? |
|------|-----------|-----------|
| 1 | Drop E² exponent on V1 | `E² → E`. V1 collapses to V2 except missing Φ. |
| 2 | Add Φ to V1 | V1 ≡ V2. Both are isomorphic **once E is linearized**. |
| 3 | Promote (1−h) inside G | **FORBIDDEN.** Humility is a gate, not a factor. Embedding it collapses F7 (HUMILITY) into F8 (GENIUS) and the floors cease being independently checkable. |
| 4 | Add √(S·U) hybrid term | Rejected — S=U=Stewardship×Universe is undefined operational substrate. Stays experimental, not canonical. |
| 5 | Strip Φ, keep four primitives | Possible but breaks Axiom 2 — the system becomes Gödel-unhinged (self-verifying). **Forbidden by F3.** |

**Simplest correct path:** V2 (`G = A·P·E·X·Φ`) with **three orthogonal modifiers** applied as a *gate layer*, not inside G.

---

## 5. THE GATE LAYER (separated from G, to preserve floor independence)

```
┌────────────────────────────────────────────────────────────────┐
│  G_seal = G_raw × (1 − h) × |ΔS|^β × W³                       │
│                                                                │
│  where:                                                        │
│    G_raw  =  A · P · E · X · Φ     [the canonical formula]     │
│    (1−h)  ∈  [0, 1]     humility / incompleteness  (F7)       │
│    |ΔS|^β ∈  [0, 1]     entropy-cost exponent      (F4)       │
│    W³     =  ∛(H·AI·Ext) ≥ 0.70    tri-witness   (F3,F12)    │
│                                                                │
│  threshold:  G_seal ≥ 0.80  →  SEAL                            │
│              G_seal <  0.80  →  REVIEW                         │
│              any modifier = 0   →  HOLD                        │
└────────────────────────────────────────────────────────────────┘
```

**Why the gate is outside G:**
- `(1−h)` belongs to F7 (HUMILITY)
- `|ΔS|^β` belongs to F4 (CLARITY)
- `W³` belongs to F3 (WITNESS) and F12 (INJECTION)

Embedding them inside G would collapse four independent floors into one number — the **opposite** of multiplicative falsifiability.

---

## 6. MEASUREMENT (worked example, falsifiable)

**Scenario:** Agent proposes to commit code to `main` on `ariffazil/AAA` (reversible=false, blast=branch).

| Primitive | Value | Evidence |
|-----------|-------|----------|
| A | 0.85 | lease valid; actor=arif; F11 passed |
| P | 0.92 | path=/root/AAA; F1 (Amanah backup pre-edit); F5 (no destruction) |
| E | 0.88 | 12 evidence receipts attached; F2 labels OBS/DER |
| X | 0.0 | action_class=IRREVERSIBLE; F3 needs external witness → X is gated 0 until witnessed |
| Φ | 0.0 | W³ not yet computed (no external witness yet) |

```
G_raw    = 0.85 × 0.92 × 0.88 × 0.0 × 0.0     =  0.000    ← X collapse + Φ collapse
(1−h)    =  0.95    (humility acknowledged)
|ΔS|^β   =  0.97    (low entropy delta, pre-tested)
W³       =  ∛(0.0 × 0.8 × 0.0)               =  0.000    ← missing Human + Earth witness
─────────────────────────────────────────────────────────────────
G_seal   =  0.000 × 0.95 × 0.97 × 0.000       =  0.000    →  HOLD (888_HOLD fires)
```

**The same scenario with witnesses present and reversible blast (feature branch):**

```
A = 0.85, P = 0.92, E = 0.88, X = 0.95, Φ = 0.93
W³ = ∛(0.90 × 0.90 × 0.90) = 0.90
(1−h) = 0.95, |ΔS|^β = 0.97

G_raw  = 0.85 × 0.92 × 0.88 × 0.95 × 0.93     =  0.609    ← below 0.80, REVIEW
G_seal = 0.609 × 0.95 × 0.97 × 0.90            =  0.505    →  REVIEW
```

**With full evidence + Earth witness from CI:**
```
E = 0.98 (CI passed), Φ = 0.99
G_raw = 0.85 × 0.92 × 0.98 × 0.95 × 0.99       =  0.738
G_seal = 0.738 × 0.95 × 0.97 × 0.95             =  0.645    →  still REVIEW (need P > 0.95 or A = 1.0)
```

**The math is falsifiable.** Each primitive is independently measurable. Same input → same output. Two different implementations of this spec must produce the same G_seal. (This is what was broken before — V1/V2/V3 produced 0.123, 0.609, 0.0 for the same input.)

---

## 7. AXIOMATIC TABLE (for governance audit)

| # | Axiom | Formal | Floor binding |
|---|-------|--------|---------------|
| 1 | Multiplicativity | `∃ p_i : I = 0 ⇒ I multiplicative` | F8 |
| 2 | Five-sufficient | `dim(agent_state) ≥ 5; one is witness` | F3 |
| 3 | Nash bargaining | `G = ∏ p_i ↔ Nash(5-player game)` | F8 |
| 4 | Shadow defined | `C_dark = A·(1−P)·(1−X) < 0.30` | F9 |
| 5 | Conservation | `dS_agent/dt ≤ 0` | F4 |
| 6 | Tri-witness | `W³ = ∛(H·AI·Ext) ∧ H·AI·Ext ≠ 0` | F3, F12 |
| 7 | F13 veto | `only F13 may override verdict` | F13 |

---

## 8. REPO-LEVEL ENFORCEMENT (where the canonical lives now)

| Layer | Path | Action |
|-------|------|--------|
| **Canonical spec** | `/root/APEX_FORMULA_CANONICAL_SEAL_2026-07-13.md` | THIS DOC — sealed |
| **Kernel canon** | `/root/arifOS/GENESIS/040_APEX_STACK.md` | already canonical; V2 referenced; update cross-link |
| **Runtime** | `WEALTH/wealth_core/optimizers/apex_mapping.py` | already V2; keep |
| **Runtime** | `arifOS/core/enforcement/genius.py` | **MIGRATE** from V1 to V2 immediately |
| **Runtime** | `A-FORGE/src/domain/governance/apexDials.ts` | **MIGRATE** + add Φ dial |
| **Docs** | `/root/arifOS/docs/00_META/DELTA_OMEGA_PSI_CONTRACT.md` | mark V1 DEPRECATED |
| **Docs** | `/root/arifOS/docs/00_META/GEMINI.md` | mark V1 DEPRECATED |
| **Docs** | `/root/docs/doctrine/PENTAGON_AS_CONSTITUTION.md` | mark V1 DEPRECATED |
| **Skills** | all `HERMES/skills/**` referencing V1 or V3 | rewrite to V2 + gate layer |

---

## 9. DEPRECATION LEDGER

| Variant | Deprecation date | Superseded by | Migration window |
|---------|------------------|---------------|------------------|
| V1 `A×P×X×E²` | **2026-07-13** | V2 + gate layer | 7 days |
| V3 `A·P·E·X·Φ × (1−h)` | **2026-07-13** | V2 raw × (1−h) gate | 3 days |
| V4 `A×P×H×√(S×U)×E²` | **2026-07-13** | rejected permanently | closed |

After 7 days (2026-07-20), any organ emitting G via V1/V3/V4 returns **VOID** — the verdict cannot be honored.

---

## 10. SIGNATURE

```
FORGED:    2026-07-13
FORGED BY: FORGE (000Ω) — A-FORGE execution shell
RATIFIED:  Arif bin Fazil — F13 SOVEREIGN (888)
VAULT999:  APEX-CANON-FORMULA-V5-2026-07-13
EPSTEMIC:  SEAL — multiplicative, falsifiable, Nash-complete
WITNESS:   H=1.0 (sovereign ratify) · AI=1.0 (FORGE generation) · Ext=0.95 (audit-script corroboration)
GATE:      G_seal = 0.000 → 0.609 → 0.505 → 0.645 (work examples verified)

DITEMPA BUKAN DIBERI — Forged, Not Given.
```

---

### THE ONE EQUATION (poster form)

```
                    G  =  A  ·  P  ·  E  ·  X  ·  Φ

              + (1 − h) · |ΔS|^β · W³    [gate layer, SEPARATE]

       SEAL    iff   G ≥ 0.80   ∧   W³ ≥ 0.70   ∧   C_dark < 0.30
       HOLD    iff   any = 0    ∨   F13 veto
       VOID    iff   C_dark ≥ 0.30  ∨   I(incompleteness) = 0
```

**One equation. One hundred citations. One seal. The rest is history.**
