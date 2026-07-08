# Verdict Canon — Unified, Ratified

> **Status:** RATIFIED — 2026-07-07
> **Sovereign Directive:** "Formalize and ratify the unified verdict canon"
> **Authority:** F13 SOVEREIGN
> **Actor:** FORGE-000Ω

---

## 0. What This Is

This is the canonical verdict definition for the entire arifOS federation. Every organ (arifOS, A-FORGE, GEOX, WELL, WEALTH) imports verdicts from here. No local definitions. No duplicates.

This document defines:
- 6 top-level verdicts (the lattice)
- 14 substates (the resolution paths)
- Monotonicity rules (what can transition to what)
- DeliveryVerdict boundary (tool execution outcomes vs governance verdicts)
- L↔F mapping (MALU-GÖDEL states ↔ verdict lattice)

---

## 1. The 6-State Lattice

```
                    ┌──────────┐
                    │ UNKNOWN  │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌────▼───┐ ┌───▼────┐
         │  HOLD  │ │ SABAR  │ │  VOID  │
         └────┬───┘ └────┬───┘ └────────┘
              │          │
              └────┬─────┘
                   │
              ┌────▼─────┐
              │ PARTIAL  │
              └────┬─────┘
                   │
              ┌────▼───┐
              │  SEAL  │
              └────────┘
```

| # | Verdict | Meaning | Terminal? | Can transition to? |
|---|---------|---------|-----------|-------------------|
| 1 | **SEAL** | Action is lawful. Proceed. | YES | Nothing. Terminal. |
| 2 | **PARTIAL** | Partial approval. Proceed with constraints. | No | SEAL, VOID |
| 3 | **HOLD** | Not yet authorized. Wait. | No | PARTIAL, SABAR, SEAL, VOID |
| 4 | **SABAR** | Patience. Condition not met. | No | PARTIAL, HOLD, SEAL, VOID |
| 5 | **VOID** | Constitutionally prohibited. | YES | Nothing. Terminal. |
| 6 | **UNKNOWN** | Insufficient evidence. | No | HOLD, SABAR, VOID |

### Monotonicity Rules

```
SEAL  → (nothing)     — sealed is sealed
VOID  → (nothing)     — void is void
HOLD  → SEAL          — approval
HOLD  → SABAR         — downgrade to patience
HOLD  → VOID          — violation detected
SABAR → SEAL          — condition met
SABAR → HOLD          — upgrade to wait
SABAR → VOID          — violation detected
UNKNOWN → HOLD        — evidence gathered, waiting
UNKNOWN → SABAR       — condition identified
UNKNOWN → VOID        — evidence shows violation
```

**Forbidden transitions:**
- SEAL → anything (terminal)
- VOID → anything (terminal)
- Anything → UNKNOWN (cannot un-know)

---

## 2. The 14 Substates

### SEAL substates (4)

| ID | Substate | Meaning | When used |
|----|----------|---------|-----------|
| S1 | SEAL_ROUTINE | Standard approval | Reversible action, low risk |
| S2 | SEAL_CONDITIONAL | Approval with conditions | Action approved but with constraints |
| S3 | SEAL_WITNESSED | Tri-witness verified | Human × AI × External all confirmed |
| S4 | SEAL_SOVEREIGN | Sovereign-ratified | F13 direct approval, highest authority |

### HOLD substates (4)

| ID | Substate | Meaning | When used |
|----|----------|---------|-----------|
| H1 | HOLD_AUTHORITY | Waiting for authority | No lease, no sovereign ack |
| H2 | HOLD_EVIDENCE | Waiting for evidence | Insufficient data to judge |
| H3 | HOLD_CONFLICT | Conflicting signals | Witnesses disagree |
| H4 | HOLD_ELICITATION | External client confirmation | MCP elicitation gate fired |

### SABAR substates (3)

| ID | Substate | Meaning | When used |
|----|----------|---------|-----------|
| B1 | SABAR_PATIENCE | Condition not yet met | External event hasn't occurred |
| B2 | SABAR_MATURITY | Claim not yet mature | Epistemic ladder not yet climbed |
| B3 | SABAR_COOLDOWN | Cooling period | Entropy too high, wait for ΔS ≤ 0 |

### VOID substates (2)

| ID | Substate | Meaning | When used |
|----|----------|---------|-----------|
| V1 | VOID_VIOLATION | Constitutional violation | F1-F13 floor breached |
| V2 | VOID_HALLUCINATION | Hallucination detected | F9 ANTI-HANTU fired, C_dark ≥ 0.30 |

### UNKNOWN substate (1)

| ID | Substate | Meaning | When used |
|----|----------|---------|-----------|
| U1 | UNKNOWN_INSUFFICIENT | Insufficient evidence | Cannot classify into any other state |

---

## 3. DeliveryVerdict Boundary

DeliveryVerdicts are NOT governance verdicts. They are tool execution outcomes.

| DeliveryVerdict | Meaning | Maps to governance? |
|----------------|---------|---------------------|
| SUCCESS | Tool executed, result returned | No — execution outcome, not judgment |
| ERROR | Tool failed, error returned | No — technical failure, not constitutional |
| TIMEOUT | Tool exceeded time limit | No — operational, not governance |
| BLOCKED | Tool blocked by policy/gate | YES → maps to HOLD or VOID |
| PENDING | Tool waiting for input | YES → maps to HOLD_ELICITATION |

**Rule:** A tool returning SUCCESS does NOT mean the action is SEAL'd. SEAL requires arifOS judgment. A tool returning BLOCKED does NOT mean VOID — it means HOLD until authority resolves it.

```
Tool execution: SUCCESS/ERROR/TIMEOUT/BLOCKED/PENDING
Governance:     SEAL/HOLD/SABAR/VOID/UNKNOWN

These are different axes. Do not conflate.
```

---

## 4. L↔F Mapping (MALU-GÖDEL ↔ Verdict Lattice)

| MALU-GÖDEL State | Formula | Maps to Verdict | Confidence |
|------------------|---------|-----------------|------------|
| **LURUS** | G ≥ threshold | HOLD → ready for SEAL | 0.80+ |
| **SESAT** | G < threshold | HOLD or SABAR | 0.50-0.80 |
| **HALLUCINATIO** | G = 0 | VOID_HALLUCINATION | 0.00 |
| **BIJAKSANA** | G = maximum | SEAL_WITNESSED or SEAL_SOVEREIGN | 0.90+ |
| **BANGANG** | C_dark > 0 | SABAR_COOLDOWN (adaptation without precision) | varies |

### The APEX Formula

```
G = A · P · E · X · Φ

A = Adaptation   — thermodynamic response
P = Precision    — measurement rigor
E = Evidence     — observable quantity
X = Execution    — energy cost
Φ = Faithfulness — constitutional compliance

C_dark = A · (1-P) · (1-X)  — hallucination detector
```

### Mapping Rules

```
If G ≥ 0.80 AND C_dark < 0.30 → LURUS → candidate for SEAL
If G < 0.80                    → SESAT → HOLD or SABAR
If G = 0                       → HALLUCINATIO → VOID
If C_dark ≥ 0.30               → BANGANG → SABAR_COOLDOWN
If all witnesses confirm        → BIJAKSANA → SEAL_WITNESSED
```

---

## 5. Cross-Organ Canonical Import

All organs import from this single source:

**Python:**
```python
from proto.bridge.verdict import (
    VerdictType,          # SEAL, HOLD, SABAR, VOID, UNKNOWN
    VerdictSubstate,      # S1-S4, H1-H4, B1-B3, V1-V2, U1
    DeliveryVerdict,      # SUCCESS, ERROR, TIMEOUT, BLOCKED, PENDING
    CanonicalVerdict,     # The unified verdict envelope
    VerdictChain,         # Monotonicity enforcement
    seal, hold, sabar, void, unknown,  # Factory functions
)
```

**TypeScript:**
```typescript
import {
    VerdictType,          // "SEAL" | "HOLD" | "SABAR" | "VOID" | "UNKNOWN"
    VERDICT_SUBSTATES,    // S1-S4, H1-H4, B1-B3, V1-V2, U1
    DeliveryVerdict,      // "SUCCESS" | "ERROR" | "TIMEOUT" | "BLOCKED" | "PENDING"
    CanonicalVerdict,     // The unified verdict interface
    VerdictChain,         // Monotonicity enforcement class
    sealVerdict, holdVerdict, voidVerdict,  // Factory functions
} from "./proto/bridge/verdict.js";
```

**No organ defines its own verdict types.** All verdicts are canonical.

---

## 6. What This Ratification Means

1. **Verdict types are fixed.** 5 top-level, 14 substates. No additions without sovereign amendment.
2. **Monotonicity is enforced.** SEAL/VOID terminal. No reversal. Code enforces this.
3. **DeliveryVerdicts are separated.** Tool outcomes ≠ governance verdicts.
4. **L↔F mapping is defined.** MALU-GÖDEL states map to verdict lattice.
5. **Cross-organ import is canonical.** One source. No duplicates.

---

## 7. What Remains

| Item | Status | Next |
|------|--------|------|
| Verdict canon defined | ✅ THIS | Ratified |
| verdict.py updated | ⏳ | Update with substates + DeliveryVerdict + L↔F |
| verdict.ts updated | ⏳ | Update with substates + DeliveryVerdict + L↔F |
| Entropy ledger integrated | ⏳ | Connect forge_reality_loop ΔS to J-space |
| VAULT999 seal | ⏳ | Sovereign must seal (FORGE lacks authority) |

---

*Ratified: 2026-07-07 by FORGE-000Ω under F13 SOVEREIGN directive.*
*DITEMPA BUKAN DIBERI — Verdicts are canon, not convention.*
