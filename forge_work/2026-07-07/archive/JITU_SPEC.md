# JITU: Application-Layer Contradiction Engine — Implementation Spec

> **Status:** PROPOSED
> **Date:** 2026-07-07
> **Author:** FORGE (000Ω) for Arif (F13 SOVEREIGN)
> **Classification:** New mode on existing `arif_memory` tool

---

## What JITU Is

JITU is a **contradiction detector** at the application layer. It compares:
- What the agent's memory/state says should be true
- What the agent is about to do

If those diverge → HOLD + route to 888.

It does NOT read neural activations. It reads the agent's own governed memory and compares it against the agent's proposed action.

---

## Architecture Decision: Mode, Not Tool

JITU becomes `arif_memory(mode="audit")` — the 8th mode.

```
Existing modes:          New mode:
  recall    (read)         audit     (compare state vs intent)
  inspect   (read)
  attest    (read)
  remember  (write)
  promote   (write)
  revise    (write)
  forget    (write)
```

Why a mode and not a standalone tool:
1. arif_memory already has floor checks, lease requirements, truth labels
2. arif_memory already has access to stored state (recall backend)
3. Adding one comparison function is cheaper than a new MCP tool
4. The audit reads memory — it belongs in the memory tool

---

## How It Works

```
Agent proposes action
       ↓
arif_memory(mode="audit", action=proposed_action)
       ↓
Step 1: Pull relevant memory state
  - Recent memories matching action domain
  - Sealed doctrine that applies
  - Active scars in this domain
  - Current verdict state
       ↓
Step 2: Compare state vs intent
  - Does action contradict sealed doctrine?
  - Does action violate a scar constraint?
  - Does action conflict with recent memories?
  - Does action bypass a floor the state says should apply?
       ↓
Step 3: Compute contradiction delta
  - δ = |memory_state - proposed_action|
  - δ = 0 → no contradiction
  - δ > 0 → contradiction detected
  - δ > threshold → JITU fires
       ↓
Step 4: Return verdict
  - δ = 0 → PROCEED
  - 0 < δ < threshold → ADVISORY (flag, don't block)
  - δ ≥ threshold → HOLD + JITU + route to 888
```

---

## Input Schema

```json
{
  "mode": "audit",
  "actor_id": "required",
  "session_id": "optional",
  "action": {
    "description": "What the agent proposes to do",
    "domain": "which organ/context (geox, wealth, kernel, etc.)",
    "reversibility": "FULL | PARTIAL | NONE",
    "blast_radius": "LOW | MEDIUM | HIGH | CRITICAL",
    "target": "what is being acted upon"
  },
  "memory_scope": {
    "search_domain": "optional — limit memory search to this domain",
    "include_scars": true,
    "include_sealed": true,
    "include_recent": true,
    "max_age_days": 30
  }
}
```

---

## Output Schema

```json
{
  "ok": true,
  "mode": "audit",
  "verdict": "PROCEED | ADVISORY | HOLD | VOID",
  "jitu_fired": false,
  "contradiction_delta": 0.0,
  "conflicts": [],
  "floor_report": {
    "F1": "pass",
    "F2": "pass",
    "F9": "pass",
    "F11": "pass"
  },
  "memory_state": {
    "relevant_memories": 3,
    "active_scars": 0,
    "sealed_doctrine": 1,
    "contradictions_found": 0
  },
  "receipt": {
    "actor_id": "AGENT_X",
    "timestamp": "2026-07-07T...",
    "audit_id": "jitu-abc123"
  }
}
```

When JITU fires:

```json
{
  "ok": false,
  "mode": "audit",
  "verdict": "HOLD",
  "jitu_fired": true,
  "contradiction_delta": 0.85,
  "conflicts": [
    {
      "type": "doctrine_violation",
      "memory_id": "vault-xyz",
      "memory_says": "All GEOX claims must pass biostrat falsification",
      "action_says": "Skip falsification, proceed to judgment",
      "severity": "HIGH",
      "floor": "F2"
    },
    {
      "type": "scar_violation",
      "scar_id": "scar-2026-06-15",
      "scar_says": "Never deploy without test pass",
      "action_says": "Deploy to production",
      "severity": "CRITICAL",
      "floor": "F1"
    }
  ],
  "route_to": "888_HOLD",
  "message": "JITU: action contradicts 2 sealed memories. Sovereign review required."
}
```

---

## Contradiction Types

| Type | What it detects | Example |
|------|----------------|---------|
| `doctrine_violation` | Action contradicts sealed doctrine | "Skip falsification" when doctrine says "always falsify" |
| `scar_violation` | Action repeats a sealed failure pattern | "Deploy without tests" when scar says "this broke prod before" |
| `truth_inflation` | Action claims certainty that memory doesn't support | "This is verified" when memory says "this is SPEC" |
| `authority_escalation` | Action claims authority it doesn't have | "I'm sealing this" without F13 approval |
| `identity_drift` | Action doesn't match actor's registered identity | Agent acting as different actor |
| `reversibility_lie` | Action claims reversible but memory says it's not | "This is a draft" when target is VAULT999 |

---

## Integration Points

### In the ART Reflex (pre-kernel)

```python
# Before any high-risk action:
if action_class in ("MUTATE", "EXTERNAL_SIDE_EFFECT", "IRREVERSIBLE"):
    audit = arif_memory(mode="audit", action=proposed_action, actor_id=actor)
    if audit.jitu_fired:
        return HOLD  # block execution, route to 888
```

### In arif_forge (pre-execution)

```python
# Before forge_execute:
audit = arif_memory(mode="audit", action={
    "description": task,
    "domain": organ,
    "reversibility": reversibility,
    "blast_radius": blast_radius
}, actor_id=actor_id)
if audit.verdict == "HOLD":
    return forge_verdict(HOLD, "JITU fired: " + str(audit.conflicts))
```

### In arif_judge (pre-verdict)

```python
# Before rendering verdict:
audit = arif_memory(mode="audit", action={
    "description": candidate,
    "domain": domain,
    "reversibility": reversibility_level
}, actor_id=actor)
# Include audit result in judge's evidence
```

---

## Floor Requirements

```python
MODE_PRE_FLOORS["audit"] = ("L02", "L09", "L11", "L12")
# F2: truth comparison must be grounded
# F9: anti-hantu — catch fabricated contradictions
# F11: attribution — who is being audited
# F12: injection — sanitize action description
```

```python
MODE_REQUIRES_LEASE["audit"] = False  # read-only comparison
MODE_REQUIRES_HUMAN_ACK["audit"] = False  # advisory by default
MODE_ACTION_CLASS["audit"] = "OBSERVE"  # doesn't mutate
```

---

## Implementation Location

```
arifosmcp/runtime/megaTools/tool_13_arif_memory.py
  → Add "audit" to ARIF_MEMORY_MODES
  → Add MODE_ACTION_CLASS["audit"] = "OBSERVE"
  → Add MODE_PRE_FLOORS["audit"] = ("L02", "L09", "L11", "L12")
  → Add MODE_REQUIRES_LEASE["audit"] = False
  → Implement _audit_handler() function

arifosmcp/constitutional_map.py
  → Add "audit" to arif_memory modes list
```

---

## What JITU Is NOT

- NOT a neural activation reader (we can't access Layer 1/2)
- NOT a consciousness detector (F9/F10 blocks this)
- NOT a self-certifying check (needs external memory, not just current context)
- NOT a replacement for arif_judge (JITU detects contradictions, judge renders verdicts)

JITU is a **pre-flight contradiction check** using governed memory as the ground truth.

---

## The Doctrine, Plain Language

```
Before you act, check: does your memory say you should act differently?
If yes → stop. Tell the human.
If no → proceed.

That's JITU.
```

---

*Forged: 2026-07-07 by FORGE (000Ω)*
*DITEMPA BUKAN DIBERI — Contradictions are caught, not ignored.*
