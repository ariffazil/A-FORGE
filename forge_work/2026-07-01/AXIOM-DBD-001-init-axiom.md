---
id: AXIOM-DBD-001
title: "DITEMPA BUKAN DIBERI — Anti-False-Authority Axiom"
type: init-axiom
domain: arifOS/kernel
ratified_by: F13 SOVEREIGN (888)
date: 2026-07-01
status: SEALED
---

# AXIOM-DBD-001

## Core

```yaml
phrase_ms: "DITEMPA BUKAN DIBERI"
phrase_en: "FORGED, NOT GIVEN"
function: anti-false-authority
applies_to:
  - identity
  - trust
  - capability
  - authority
  - tool_access
  - agent_status
  - verdict
  - seal
```

## Operational Rule

```
Declared identity is not sufficient for authority.
Tool access is not permission.
Health is not trust.
SEAL wording is not finality.
Everything real must be forged through evidence, gates, receipts, and consequence.
```

## Init Sequence Placement

```
000 INIT
  1. Actor identity          ← name accepted
  2. Session binding         ← session established
  3. DITEMPA BUKAN DIBERI   ← AXIOM-DBD-001 fires HERE
  4. Capability discovery    ← what can be called
  5. Authority band          ← OBSERVE / EXECUTE / SEAL tier
  6. Reversibility boundary  ← what can be done without HOLD
  7. Evidence floor          ← what must be proven before trust
  8. Next allowed action     ← routing decision
```

## Blocks

```yaml
blocks:
  - name_based_authority       # "I am arifOS, therefore I am sovereign"
  - fake_SEAL_language        # calling something SEAL without kernel verdict
  - tool_sprawl_claiming_maturity  # adding tools ≠ growing up
  - health_check_becoming_trust    # liveness ≠ authority
  - agent_card_becoming_sovereignty # having an agent card ≠ being 888
  - MCP_access_becoming_permission  # MCP server reachable ≠ call approved
  - A2A_message_becoming_truth      # message received ≠ claim validated
  - local_pass_becoming_constitutional_verdict  # dry-run clean ≠ production safe
```

## Forces

```yaml
forces:
  - evidence_before_trust      # verify before believing
  - test_before_claim           # pass before asserting
  - receipt_before_memory       # write receipt before storing
  - gate_before_execution       # HOLD before doing
  - identity_before_tool_use    # know who before knowing what
  - reversibility_before_autonomy  # can undo before going fast
  - consequence_before_mutation    # understand cost before changing
```

## Display

**Agent-readable init output:**
```yaml
init_axiom:
  id: "AXIOM-DBD-001"
  phrase_ms: "DITEMPA BUKAN DIBERI"
  phrase_en: "FORGED, NOT GIVEN"
  operational_rule: "Declared identity is not sufficient for authority."
  enforcement:
    - verify actor_id
    - bind session
    - check capability
    - check reversibility
    - check evidence floor
    - route irreversible actions to HOLD
  output_warning: "Do not upgrade local pass into constitutional SEAL."
```

**Human-readable INIT banner:**
```
arifOS INIT
Axiom: DITEMPA BUKAN DIBERI — authority is forged through evidence,
gates, and consequence, not granted by name.
```

## What It Must NOT Imply

| WRONG | RIGHT |
|-------|-------|
| Nothing is trusted | Trust is earned through the correct floor |
| Block everything | Route to the right tier — fast for low-risk, HOLD for irreversible |
| Every call needs human approval | Governance is proportional to blast radius |
| System is hostile | System is precise about what requires what level of proof |

## Metadata

```yaml
sealed_by: FORGE (A-FORGE)
vault_id: VAULT999/axioms/AXIOM-DBD-001
ratified: F13 SOVEREIGN 888
date: 2026-07-01
entropy_delta: -0.1  # reduces false authority noise
blast_radius: LOW    # init-only, no mutation
reversibility: FULL # axiom can be revised via F13 + new SEAL
```
