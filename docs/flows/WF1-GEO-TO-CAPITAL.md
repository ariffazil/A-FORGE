# 🌊 WORKFLOW 1: GEOX → arifOS → AAA → WEALTH
# Earth → Law → State → Capital
# The primary value chain: geological discovery → governed judgment → 
# state registration → capital evaluation.

```yaml
workflow_id: wf-geo-to-capital
canonical_name: "Earth → Law → State → Capital"
layers_traversed: [L3, L1, L1, L3]
organs_touched: [GEOX, arifOS, AAA, WEALTH]
metabolic_steps: [000, 111, 444, 888, 777, 999]
```

## Sequence

### Stage 1: OBSERVE — GEOX (L3)
```
Tool: geox_prospect(mode="screen", prospect_ref="prospect-x")
MCP:  https://geox.arif-fazil.com/mcp
→ Returns: GRV, POS, risk_matrix, evidence_refs
→ Epistemic: DERIVED (model output, not ground truth)
→ Receipt: geox_prospect_receipt → VAULT999
```

### Stage 2: JUDGE — arifOS (L1) 
```
Tool: arif_judge(
  actor="aforge-agent",
  intent="Evaluate prospect-x for capital allocation",
  domain="geox→wealth",
  reversibility_level="reversible",
  blast_radius="medium",
  evidence=[geox_prospect_receipt]
)
MCP: https://arifos.arif-fazil.com/mcp
→ Verdict: SEAL | HOLD | SABAR | VOID
→ Returns: constitutional_chain_id, judge_state_hash
```

### Stage 3: REGISTER — AAA (L1)
```
A2A: localhost:3001 — message type "state.register"
Payload: { workflow: "wf-geo-to-capital", prospect_ref, verdict, cc_id }
→ AAA records the event in state foundation
```

### Stage 4: COMPUTE — WEALTH (L3)
```
Tool: capital_primitive(mode="emv", outcomes=[p10,p50,p90], probabilities=[pos])
MCP: https://wealth.arif-fazil.com/mcp
→ Returns: EMV, risk_adjusted_value, kelly_fraction
```

## Verdict Chain
```
GEOX(OBS) → arifOS(SEAL) → AAA(register) → WEALTH(compute) → VAULT999(seal)
```

## Guard Conditions
- GEOX must NOT call WEALTH directly (organs don't talk to organs)
- arif_judge MUST return SEAL before WEALTH computes
- If arif_judge returns HOLD/SABAR/VOID → workflow terminates at stage 2
