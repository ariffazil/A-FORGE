# 🛡️ WORKFLOW 2: WELL → AAA → arifOS
# Vitality → Oversight → Kernel
# Human readiness monitoring → cockpit alert → constitutional HOLD.
# This is the sovereignty guard — it can block all other workflows.

```yaml
workflow_id: wf-well-oversight
canonical_name: "Vitality → Oversight → Kernel"
layers_traversed: [L3, L1, L1]
organs_touched: [WELL, AAA, arifOS]
metabolic_steps: [000, 111, 444, 888]
```

## Sequence

### Stage 1: SENSE — WELL (L3)
```
Tool: well_validate_vitality(mode="readiness", decision_class="C3")
MCP: https://well.arif-fazil.com/mcp
→ Returns: vitality_score, fatigue_level, cognitive_load, chronic_flags
→ REFLECT_ONLY — never diagnostic
```

### Stage 2: ALERT — AAA (L1)
```
A2A: localhost:3001 — message type "cockpit.alert"
Payload: { source: "well", severity, recommendation, evidence }
→ AAA cockpit displays alert
→ If severity >= threshold → triggers arifOS HOLD
```

### Stage 3: HOLD — arifOS (L1)
```
Tool: arif_judge(mode="intercept", actor="well-guardian",
  intent="Human vitality below threshold for high-blast operation")
→ Verdict: HOLD (if vitality < threshold) | PROCEED
→ This HOLD can block A-FORGE execution pipeline
```

## Threshold Matrix

| Vitality | AAA | arifOS | Effect |
|----------|-----|--------|--------|
| ≥ 0.80 | 🟢 OPTIMAL | PROCEED | All workflows allowed |
| 0.60–0.79 | 🟡 DEGRADED | SABAR | Non-critical only |
| 0.40–0.59 | 🟠 FATIGUED | HOLD | Pause all high-blast |
| < 0.40 | 🔴 CRITICAL | VOID | Block everything |

## Guard Conditions
- F13 SOVEREIGN: Arif can override any HOLD (but the system flags it)
- WELL reflects; AAA displays; arifOS judges — NEVER self-adjudicate
