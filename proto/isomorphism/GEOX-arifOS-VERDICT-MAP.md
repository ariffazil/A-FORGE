# GEOX-arifOS-VERDICT-MAP — Cross-Substrate Verdict Isomorphism

> **Status:** ANCHOR GEOMETRY (proto/isomorphism)
> **Epistemic:** OBS (grounded in source code, 2026-07-07)
> **Purpose:** Map how verdicts translate across all 5 federation substrates.
> **Failure if absent:** Verdict drift → manifold collapse → J-space instability.

---

## 1. The Problem

Each substrate has its own verdict vocabulary. Without a canonical
translation, a SEAL in arifOS doesn't mean the same thing as a
"PROCEED" in A-FORGE or a "QUALIFY" in GEOX. The manifold needs
verdict monotonicity — once a verdict is issued, its meaning must
be preserved across all substrates.

---

## 2. Verdict Taxonomy Per Substrate (OBS)

### arifOS (Python) — CANONICAL SOURCE OF TRUTH

```python
# Source: /root/arifOS/arifosmcp/models/verdicts.py

class SealType(StrEnum):
    SEAL   = "SEAL"    # W³ ≥ 0.95, all Floors pass → proceed
    HOLD   = "HOLD"    # 888_HOLD — human veto/review required
    SABAR  = "SABAR"   # Wait — more evidence needed
    VOID   = "VOID"    # Hard Floor violation — blocked permanently

class VerdictState(StrEnum):
    # SEAL substates
    SEAL_CANONICAL  = "SEAL_CANONICAL"   # High confidence, full compliance
    SEAL_QUALIFIED  = "SEAL_QUALIFIED"   # Compliant with noted assumptions

    # HOLD substates
    HOLD_888         = "HOLD_888"         # Human Architect intervention required
    HOLD_UNCERTAINTY = "HOLD_UNCERTAINTY" # Ω_ortho < 0.95 or Peace² < 0.70
    HOLD_TEMPORAL    = "HOLD_TEMPORAL"    # Waiting for data vintage refresh

    # VOID substates
    VOID_BREACH       = "VOID_BREACH"       # Constitutional Floor violation
    VOID_HANTU        = "VOID_HANTU"        # Shadow arifOS / Narrative Laundering
    VOID_IRREVERSIBLE = "VOID_IRREVERSIBLE" # Irreversible action without W³

    # SABAR substates
    SABAR_EPISTEMIC     = "SABAR_EPISTEMIC"     # Waiting for grounded truth
    SABAR_GEOPOLITICAL  = "SABAR_GEOPOLITICAL"  # Waiting for external stability
```

### A-FORGE (TypeScript) — EXECUTION ENVELOPE

```typescript
// Source: /root/A-FORGE/src/interfaces/mcp/core.ts (computeAuthorityHeader)

authority_mode: "OBSERVE" | "DRAFT" | "EXECUTE" | "SEAL" | "RATIFY" | "NONE"
stage:          "OBSERVE" | "DRAFT" | "EXECUTE" | "SEAL" | "RATIFY"

// Source: /root/A-FORGE/src/domain/governance/mcpFloorEnforcer.ts
// FloorEnforcer returns: { allowed: boolean, verdict?: string }
// Verdicts: "SEAL" (allowed) or "HOLD" (blocked)

// Source: elicitation.ts (new, 2026-07-07)
// Gate verdicts: "ELICITATION_BLOCKED" | "AUTHORIZED" | "FORM_ELICITATION_PASSED"
```

### GEOX (Python) — DOMAIN RISK TIERS

```python
# Source: /root/geox/src/geox_mcp/tools_manifest.py + organ_governance.py

acrisk: "QUALIFY" | "ADVISORY" | "HOLD" | "BLOCK"

# Claim lifecycle:
ClaimStatus: "draft" | "validated" | "challenged" | "sealed"

# Organ governance verdicts:
# ("SEAL", None) — authorized for this lane
# ("HOLD", JSONResponse) — lane enforcement blocks
```

### WEALTH (TypeScript) — CAPITAL HANDOFF

```typescript
// Source: /root/WEALTH/ — wealth_judge_handoff
// WEALTH computes, does NOT adjudicate
// Verdicts route to arifOS arif_judge:
//   capability: "register_collapse_signature_claim" | "execute_stock_trade" | ...
//   blast_radius: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
//   reversibility_level: "FULL" | "PARTIAL" | "NONE"
```

### WELL (Python) — SUBSTRATE REFLECTION

```python
# Source: /root/WELL/ — well_readiness, well_validate_vitality
# WELL does NOT issue governance verdicts
# It reflects readiness signals:
color: "GREEN" | "YELLOW" | "RED" | "STALE"
action: "PROCEED" | "SIMPLIFY" | "HOLD" | "INJECT_NEEDED"
# These are ADVISORY, never authoritative
```

---

## 3. Verdict Translation Table

| arifOS SealType | arifOS VerdictState | A-FORGE authority_mode | GEOX acrisk | WEALTH blast_radius | WELL color |
|---|---|---|---|---|---|
| **SEAL** | SEAL_CANONICAL | EXECUTE / SEAL | QUALIFY | — | GREEN |
| **SEAL** | SEAL_QUALIFIED | DRAFT | ADVISORY | — | GREEN |
| **HOLD** | HOLD_888 | — (gate blocks) | HOLD | HIGH/CRITICAL | RED |
| **HOLD** | HOLD_UNCERTAINTY | — (gate blocks) | ADVISORY | MEDIUM | YELLOW |
| **HOLD** | HOLD_TEMPORAL | — (gate blocks) | HOLD | — | STALE |
| **VOID** | VOID_BREACH | — (gate blocks) | BLOCK | CRITICAL | — |
| **VOID** | VOID_HANTU | — (gate blocks) | BLOCK | — | — |
| **VOID** | VOID_IRREVERSIBLE | — (gate blocks) | BLOCK | — | — |
| **SABAR** | SABAR_EPISTEMIC | — (gate blocks) | HOLD | — | YELLOW |
| **SABAR** | SABAR_GEOPOLITICAL | — (gate blocks) | HOLD | — | — |

---

## 4. Verdict Flow (Canonical Path)

```
Agent intent
    │
    ▼
arifOS arif_judge (Python :8088)
    │
    ├── SEAL  → A-FORGE forge_execute (TS :7072)
    │           └── elicitUser() → human confirms → execution
    │
    ├── HOLD  → 888_HOLD channel → Arif decides
    │
    ├── SABAR → return to agent with reason → gather evidence → re-submit
    │
    └── VOID  → permanent block → log to VAULT999
```

**The critical invariant:** A-FORGE NEVER issues SEAL. It can only
forward to arifOS for judgment, or block. The verdict authority is
monotonically concentrated in the kernel.

---

## 5. The Translation Gap

### Problem 1: GEOX acrisk ≠ arifOS SealType

GEOX has its own `acrisk` system (QUALIFY/ADVISORY/HOLD/BLOCK) that
is NOT isomorphic to arifOS's SealType. Specifically:

- GEOX "QUALIFY" ≈ arifOS "SEAL" (but no W³ requirement)
- GEOX "ADVISORY" has no arifOS equivalent (it's between SEAL and HOLD)
- GEOX "BLOCK" ≈ arifOS "VOID" (but no constitutional floor reference)

**The gap:** GEOX can say "QUALIFY" without the kernel saying "SEAL".
This means GEOX can effectively bypass constitutional judgment by
using its own risk vocabulary.

### Problem 2: A-FORGE authority_mode has no SABAR equivalent

A-FORGE's `authority_mode` = {OBSERVE, DRAFT, EXECUTE, SEAL, RATIFY, NONE}.
There is no "WAIT" or "SABAR" mode. When A-FORGE receives a SABAR
from the kernel, it maps to a generic error response — losing the
epistemic/temporal/geopolitical distinction.

### Problem 3: WELL readiness is advisory but looks authoritative

WELL returns `action: "HOLD"` which has the same string as arifOS's
`SealType.HOLD`. But WELL's HOLD is advisory (reflect-only) while
arifOS's HOLD is authoritative (constitutional block). Without
explicit type discrimination, downstream consumers can confuse them.

---

## 6. Verdict Monotonicity Requirements

| # | Requirement | Status | Evidence |
|---|---|---|---|
| V-1 | Only arifOS may issue SEAL | ✅ enforced | A-FORGE `forge_approve` refuses self-authorization |
| V-2 | Only arifOS may issue VOID | ✅ enforced | A-FORGE routes to `arif_judge_deliberate` |
| V-3 | SABAR must carry substate | ❌ missing | A-FORGE treats SABAR as generic error |
| V-4 | GEOX acrisk must map to SealType | ❌ missing | Independent vocabulary, no translation |
| V-5 | WELL HOLD must not be confused with arifOS HOLD | ⚠️ partial | Same string, different authority |
| V-6 | Verdict must be monotonic (never escalate after SEAL) | ✅ enforced | Seal chain is append-only |
| V-7 | Cross-substrate verdict must carry source organ | ❌ missing | No `verdict_source` field |

---

## 7. Recommended Fixes (PRIORITY ORDER)

### P1: Canonical Verdict Envelope
Every organ must emit verdicts in a canonical envelope:

```json
{
  "verdict": "SEAL|HOLD|SABAR|VOID",
  "verdict_state": "SEAL_CANONICAL|HOLD_888|...",
  "verdict_source": "arifos|aforge|geox|wealth|well",
  "verdict_authority": "constitutional|advisory|reflect_only",
  "session_id": "...",
  "actor_id": "...",
  "timestamp": "..."
}
```

### P2: GEOX acrisk → SealType Translation
GEOX must translate its `acrisk` to the canonical SealType before
emitting to other organs:
- QUALIFY → SEAL (with SEAL_QUALIFIED substate)
- ADVISORY → HOLD (with HOLD_UNCERTAINTY substate)
- HOLD → HOLD (with HOLD_888 substate)
- BLOCK → VOID (with VOID_BREACH substate)

### P3: SABAR Propagation
A-FORGE must propagate SABAR substates (epistemic vs geopolitical)
so agents know whether to gather more evidence or wait for external
stability.

### P4: Authority Discriminator
Every verdict envelope must include `verdict_authority` = {constitutional | advisory | reflect_only}
to prevent advisory signals from being treated as constitutional blocks.

---

## 8. Verdict

Verdict chain is **1/3 unified**. arifOS is canonical. A-FORGE is
derived. GEOX/WEALTH/WELL are independent vocabularies that haven't
been mapped to the canonical 4.

**Weakest link:** GEOX acrisk system operates independently of the
kernel's SealType. This is the primary manifold leak.

---

*Grounded: 2026-07-07 by FORGE (000Ω)*
*Source: actual code inspection, not speculation*
*Epistemic: OBS (observed in source)*
