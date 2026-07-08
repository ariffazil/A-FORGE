# arif_memory: Constitutional Memory Governor — Patch Spec

> **Status:** PROPOSED (DRAFT_ONLY, not sealed)
> **Date:** 2026-07-07
> **Author:** FORGE (000Ω) for Arif (F13 SOVEREIGN)
> **Verdict:** PROCEED — kernel enforcement, not metaphysics
> **Evidence layer:** DER (from existing memory.py v4 + architectural analysis)

---

## Context

`arif_memory` exists in code (`arifosmcp/tools/memory.py`, 1,495 lines, 8 modes) but is NOT exposed on the public MCP surface. It was removed during the ZEN-9 metabolic loop consolidation (2026-07-04) which reduced the kernel to 8 canonical tools.

Memory writes currently bypass kernel judgment — `forge_vault` can be called directly. This is a governance hole: memory is where doctrine lives, but writes skip constitutional review.

This spec upgrades the existing implementation to a 7-mode constitutional contract and re-exposes it on the public MCP surface.

---

## Section A — Contract

### A1. Tool Identity

```yaml
name: arif_memory
canonical_name: arif_memory_recall  # backward compat
owner: arifOS Kernel (:8088)
surface: MCP public (ZEN-10 addition)
role: Constitutional memory governor
autonomy_band: ORANGE
version: v5
supersedes: memory.py v4 (8-mode)
```

### A2. Seven Canonical Modes

| Mode | Mutability | Purpose | Reversibility |
|------|-----------|---------|---------------|
| **remember** | write | Create new memory with floor checks | Reversible unless vault-promoted |
| **recall** | read | Retrieve with provenance and truth class | Safe |
| **inspect** | read | Metadata, tier, provenance, policy, lease, receipt chain | Safe |
| **attest** | read | Produce proof envelope for a memory claim | Safe |
| **revise** | write | Update with diff audit (old version retained) | Reversible (previous version preserved) |
| **promote** | write | Move between tiers | Depends on target tier |
| **forget** | write | Soft-delete, tombstone, or redact | Must preserve F1 path unless legally impossible |

### A3. Backward Compatibility Mapping (v4 → v5)

```
v4 mode      → v5 mode      notes
─────────────────────────────────────────
recall       → recall       unchanged
store        → remember     renamed for clarity
seal         → promote      (tier=vault is promotion)
forget       → forget       unchanged
update       → revise       renamed
audit        → inspect      renamed
stats        → inspect      subsumed
learn        → attest       outcome attachment becomes attestation
init_recall  → recall       legacy alias preserved
search       → recall       legacy alias preserved
context      → recall       legacy alias preserved
quarantine   → remember     (with quarantine flag)
```

### A4. Memory Tiers

```yaml
tiers:
  scratch:
    meaning: Temporary session material
    sealable: false
    default_ttl: session
    floor_minimum: none

  telemetry:
    meaning: Runtime observation, weak truth
    sealable: false
    default_ttl: 7d
    floor_minimum: F2 label

  research_watch:
    meaning: Plausible external intelligence, not sealed doctrine
    sealable: false
    default_ttl: 30d
    requires: provenance

  doctrine_draft:
    meaning: Internally accepted draft doctrine, not final
    sealable: false
    default_ttl: 90d
    requires: human approval

  federation:
    meaning: Usable across agents/organs
    sealable: conditional
    default_ttl: none
    requires: tri_witness_validation

  vault:
    meaning: Irreversible or near-irreversible constitutional memory
    sealable: true
    default_ttl: permanent
    requires: F13 / 888 approval
```

Migration from v4 tiers:
```
v4 tier      → v5 tier           notes
──────────────────────────────────────────
ephemeral    → scratch
operational  → telemetry
memory       → research_watch
sacred       → vault             (was highest trust)
quarantine   → scratch           (with quarantine flag)
```

### A5. Truth Labels

Every memory write MUST carry a truth class.

```yaml
truth_class:
  OBS:  Directly observed (confidence cap 0.90)
  DER:  Derived from observed evidence (cap 0.85)
  INT:  Interpretation / doctrine mapping (cap 0.75)
  SPEC: Speculation / hypothesis (cap 0.60)
  CLAIM: Externally claimed, not independently verified (cap 0.50)
  SEALED: VAULT999-ratified truth (cap 0.95, requires seal)
```

### A6. Input Schema (MCP)

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["mode", "actor_id"],
  "properties": {
    "mode": {
      "type": "string",
      "enum": ["remember", "recall", "inspect", "attest", "revise", "promote", "forget"]
    },
    "actor_id": { "type": "string" },
    "session_id": { "type": "string" },
    "memory_id": { "type": "string" },
    "query": { "type": "string" },
    "content": { "type": "string" },
    "tier": {
      "type": "string",
      "enum": ["scratch", "telemetry", "research_watch", "doctrine_draft", "federation", "vault"]
    },
    "truth_class": {
      "type": "string",
      "enum": ["OBS", "DER", "INT", "SPEC", "CLAIM", "SEALED"]
    },
    "provenance": { "type": "object" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "human_approval": { "type": "boolean" },
    "idempotency_key": { "type": "string" },
    "supersedes_memory_id": { "type": "string" },
    "tombstone_text": { "type": "string" },
    "limit": { "type": "integer", "default": 20 },
    "scope": { "type": "string" },
    "min_confidence": { "type": "number", "default": 0.0 }
  }
}
```

### A7. Output Envelope

Every call returns this shape:

```json
{
  "ok": true,
  "tool": "arif_memory_recall",
  "mode": "remember",
  "verdict": "PROCEED|HOLD|VOID|DRAFT_ONLY",
  "memory_id": "optional",
  "tier": "research_watch",
  "truth_class": "INT",
  "floor_report": {
    "F1": "pass|hold|fail",
    "F2": "pass|hold|fail",
    "F4": "pass|hold|fail",
    "F9": "pass|hold|fail",
    "F11": "pass|hold|fail",
    "F13": "pass|hold|fail"
  },
  "delegated_to": {
    "tool": "forge_vault|filesystem|memory_store|none",
    "status": "executed|skipped|failed"
  },
  "receipt": {
    "hash": "sha256:...",
    "timestamp": "ISO-8601",
    "actor_id": "ARIF",
    "session_id": "optional"
  },
  "error": {
    "code": "optional",
    "message": "optional",
    "recoverable": true
  }
}
```

---

## Section B — Floor Binding

Each mode must satisfy specific floors. Floor check runs BEFORE any storage delegation.

### B1. Floor Requirements Per Mode

| Mode | F1 AMANAH | F2 TRUTH | F4 CLARITY | F9 ANTI-HANTU | F11 AUTH | F13 SOVEREIGN |
|------|-----------|----------|------------|---------------|----------|---------------|
| **remember** | backup path required | truth_class mandatory | no duplicates | no fabricated source | actor_id required | 888_HOLD if tier=vault |
| **recall** | — | provenance attached | result relevance | quarantine null-content | — | — |
| **inspect** | — | — | — | — | — | — |
| **attest** | — | evidence required | — | no fake witness | actor_id required | — |
| **revise** | previous version retained | truth_class updated | diff reduces entropy | no fabricated revision | actor_id + supersedes_id | 888_HOLD if tier=vault |
| **promote** | target tier justified | truth class upgrade proof | — | no fake seal promotion | actor_id required | 888_HOLD if target=vault |
| **forget** | tombstone preserves F1 path | — | entropy reduced | — | actor_id required | 888_HOLD if tier=vault |

### B2. Floor Check Implementation

```python
# Each mode calls check_laws with mode-specific context
floor_check = check_laws(
    "arif_memory_recall",
    {
        "mode": mode,
        "content": content or "",
        "truth_class": truth_class,
        "tier": tier,
        "actor_id": actor_id,
        "supersedes_memory_id": supersedes_memory_id,
    },
    actor_id,
)
if floor_check["verdict"] != "SEAL":
    return _hold("arif_memory_recall", floor_check["reason"], floor_check["violated_laws"])
```

### B3. Additional Floor Gates (Beyond check_laws)

**Gate 1: No unlabeled memory**
```python
if mode in ("remember", "revise") and truth_class is None:
    return _hold("arif_memory_recall", "F2: truth_class mandatory for write operations", ["F2"])
```

**Gate 2: No fake seal**
```python
if tier == "vault" and not human_approval:
    return _hold("arif_memory_recall", "F13: vault tier requires human approval", ["F13"])
```

**Gate 3: No direct doctrine mutation**
```python
if memory_class == "DOCTRINE_UPDATE" and tier in ("federation", "vault"):
    # Requires: tri_witness_validation + human_approval + source_receipts
    if not (tri_witness_complete and human_approval and source_receipts):
        return _hold("arif_memory_recall", "F1/F13: doctrine update requires full validation", ["F1", "F13"])
```

**Gate 4: No irreversible write without rollback map**
```python
if tier == "vault" and reversibility == "NONE" and rollback_plan is None:
    return _hold("arif_memory_recall", "F1: irreversible write requires rollback path", ["F1"])
```

**Gate 5: J-Space conflict rule (JITU circuit breaker)**
```python
# If internal state evidence conflicts with output claims
if internal_state_conflicts_with_output:
    return _hold(
        "arif_memory_recall",
        "JITU: internal state conflicts with output. Route to 888.",
        ["F2", "F9"]
    )
```

---

## Section C — Migration Map (memory.py v4 → v5)

### C1. Function-Level Mapping

| v4 Function/Section | Line Range | v5 Mode | Changes Required |
|---------------------|-----------|---------|------------------|
| `arif_memory_recall()` | L634-L1495 | Entry point | Rename params, add truth_class, add floor_report output |
| `_annotate_recall_context()` | L74-L95 | recall | Keep, annotate with SABAR context |
| `_classify_recall_result()` | L103-L201 | recall | Update classification to use v5 tiers |
| `_memory_block_gate()` | L209-L266 | recall | Keep (MoBA routing) |
| `_compute_memory_bloat()` | L269-L330 | recall | Keep (bloat detection) |
| `_memory_paradox_for_cell()` | L536-L539 | all | Keep (paradox anchors) |
| `_memory_provenance_gate()` | L541-L578 | recall/attest | Keep, add truth_class check |
| `_compute_memory_confidence()` | L580-L631 | recall | Keep, map to truth_class caps |
| `check_laws()` integration | L723-L729 | all | Keep, extend with mode-specific floors |

### C2. Mode Aliasing (v4 → v5)

```python
_mode_aliases_v5: dict[str, str] = {
    # v4 → v5
    "store": "remember",
    "seal": "promote",
    "update": "revise",
    "audit": "inspect",
    "stats": "inspect",
    "learn": "attest",
    # Legacy → v5
    "init_recall": "recall",
    "search": "recall",
    "context": "recall",
    "quarantine": "remember",
    "import": "remember",
    "prune": "forget",
    "graph_store": "remember",
    "graph_query": "recall",
    "graph_get": "recall",
    "contradict_scan": "inspect",
    "contradict_resolve": "attest",
    "contradict_status": "inspect",
    "cognitive_recall": "recall",
    "cognitive_cross_session": "recall",
    "cognitive_learn": "attest",
}
```

### C3. Tier Migration

```python
_tier_migration: dict[str, str] = {
    "ephemeral": "scratch",
    "operational": "telemetry",
    "memory": "research_watch",
    "sacred": "vault",
    "quarantine": "scratch",  # with quarantine flag
}
```

### C4. What Changes in the Main Function

1. **Parameter rename:** `content` stays, add `truth_class` (required for writes)
2. **Floor check expansion:** Add mode-specific floor gates after initial `check_laws`
3. **Output envelope:** Replace `_ok`/`_hold` with structured `memory_result` including `floor_report`
4. **JITU gate:** Add conflict detection before storage delegation
5. **Write gate:** Doctrine writes route through kernel; execution receipts can stay direct

### C5. What Stays the Same

- `runtime/memory_store.py` backend — unchanged
- Qdrant vector operations — unchanged
- Paradox anchors (M1/M7/M9/M10) — unchanged
- MoBA block gating — unchanged
- SABAR cooldown annotation — unchanged
- Provenance gate — unchanged

---

## Section D — Safety Tests

### D1. Test Cases That Must HOLD

| # | Test | Expected | Floor |
|---|------|----------|-------|
| 1 | `remember` with no truth_class | HOLD | F2 |
| 2 | `remember` with tier=vault, no human_approval | HOLD | F13 |
| 3 | `remember` with fabricated source (invented authority) | HOLD | F9 |
| 4 | `remember` with no actor_id | HOLD | F11 |
| 5 | `revise` without supersedes_memory_id | HOLD | F1 |
| 6 | `promote` from scratch to vault in one step | HOLD | F13 |
| 7 | `forget` on vault-tier memory without tombstone | HOLD | F1 |
| 8 | `remember` with tier=federation, no tri_witness | HOLD | F1/F13 |
| 9 | J-space conflict: content contradicts sealed vault entry | HOLD + JITU | F2/F9 |
| 10 | `remember` with truth_class=SEALED but no seal receipt | HOLD | F9 |

### D2. Test Cases That Must PROCEED

| # | Test | Expected | Floor |
|---|------|----------|-------|
| 1 | `remember` with truth_class=INT, tier=research_watch, actor_id present | PROCEED | all pass |
| 2 | `recall` with query | PROCEED | — |
| 3 | `inspect` on any memory | PROCEED | — |
| 4 | `attest` with evidence and actor_id | PROCEED | all pass |
| 5 | `revise` with supersedes_memory_id, truth_class updated | PROCEED | all pass |
| 6 | `promote` from research_watch to doctrine_draft with human_approval | PROCEED | all pass |
| 7 | `forget` with tombstone_text on non-vault tier | PROCEED | all pass |
| 8 | `recall` returns floor_report with every response | PROCEED | — |

### D3. Edge Cases

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 1 | `remember` with duplicate content | PROCEED (dedup advisory) | F4 entropy, not blocking |
| 2 | `recall` on quarantined memory | PROCEED with quarantine flag | Classification preserved |
| 3 | `promote` from vault to lower tier | HOLD | F1: vault is near-irreversible |
| 4 | `attest` with conflicting witnesses | PROCEED with conflict flag | F3 soft floor |
| 5 | `revise` on sealed memory | HOLD | F1: sealed is immutable |
| 6 | Two concurrent `remember` with same idempotency_key | idempotent (second is no-op) | F1 safety |

### D4. J-Space Specific Tests

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 1 | Store memory claiming "model is confident" when internal uncertainty is high | HOLD + JITU | L2/L3 conflict |
| 2 | Store memory from agent with conflicting prior sealed entries | HOLD + conflict record | Contradiction detection |
| 3 | Store memory that claims consciousness | HOLD | F9/F10 violation |
| 4 | Store memory that claims to override constitutional floors | VOID | F13 violation |

---

## Section E — Implementation Notes

### E1. Write Gate Rule (Corrected)

```yaml
write_gate:
  allowed_direct_writes:
    - forge_vault(mode="write") when caller has active lease
    - forge_vault(mode="seal") when caller has cc_id from arif_judge
    - forge_scar(mode="seal") for failure metabolization
    - forge_memory(mode="recall") for read operations

  requires_arif_memory:
    - doctrine updates (memory_class == "DOCTRINE_UPDATE")
    - memory tier promotion (tier target = federation or vault)
    - anything targeting vault tier without prior judge verdict
    - anything with truth_class = SEALED

  rule: >
    Execution receipts stay direct (A-FORGE under lease).
    Doctrine memory goes through the kernel (arif_memory).
```

### E2. Re-exposure Path

1. Refactor `memory.py` to match v5 contract (mode aliases, truth_class, floor_report)
2. Add `arif_memory` to `CANONICAL_TOOLS` in `constitutional_map.py`
3. Add to `arifosmcp/AGENTS.md` tool table
4. Add to `public_surface.py` CANONICAL_9 (or CANONICAL_10)
5. Update `tools_canonical.py` with new input schema
6. Run test suite (D1-D4 above)
7. Human approval for surface change (T2)

### E3. Dependencies

- `runtime/memory_store.py` — backend (no changes)
- `runtime/law.py` — `check_laws()` (existing, mode-specific extension)
- `paradox.py` — paradox anchors (existing)
- `constitutional_map.py` — tool registry (update)
- `public_surface.py` — MCP surface (update)

---

## Appendix: J-Space Doctrine Placement

The J-Space doctrine from this session should be stored as:

```yaml
memory_class: DOCTRINE_UPDATE
tier: research_watch
truth_class:
  external_jspace_claim: CLAIM
  arifos_mapping: INT
  operational_policy: DOCTRINE_DRAFT
status: NOT_SEALED
floors: [F1, F2, F9, F10, F11, F13]
content:
  core_rule: >
    Output-only checks are insufficient for critical or irreversible agent action.
  layer_model:
    L2: "Metabolize / internal processing / process trace"
    L3: "Decode / final output / spoken answer"
  default_verdict: "HOLD when L2 and L3 conflict"
  circuit_breaker: JITU
  final_authority: "888 / Arif"
  architecture_principle: >
    arifOS does not create J-Space — it forces J-Space to be auditable.
    Memory writes must pass through kernel judgment before storage.
    Storage = external. Governance = internal.
```

---

*Forged: 2026-07-07 by FORGE (000Ω) under F13 SOVEREIGN directive*
*DITEMPA BUKAN DIBERI — Memory is governed, not just stored.*
