# Prediction → Judge → Execute Pipeline (forge_predict)

**Date:** 2026-07-07  
**Status:** Implemented (prediction bridge first, then formalize)  
**Owners:** A-FORGE (execution) + arifOS (judgment)  
**Related:** F1 AMANAH, F3 WITNESS, F4 CLARITY, F7 HUMILITY, F8 GENIUS, F11 AUDIT  
**Canon update:** VERDICT-CANON.md (prediction enters as evidence)

## One Sentence
Build the prediction bridge first. Then formalize the whole.

## Architecture

```
proposed action (domain geox/wealth)
          │
          ▼
forge_predict (pre-action simulation layer)
  ├─ domain=geox → geox_mcp.geox_bridge (mode=prospect_evaluate) | geox_model
  └─ domain=wealth → wealth_mcp.wealth_* (monte_carlo_simulate | compute_emv | compute_npv | wisdom_evaluate)
          │
          │ returns { prediction_id, result, epistemic: "DERIVED/SIMULATED", ... }
          ▼
    attach as prediction_context + evidence_receipt.prediction
          │
          ▼
forge_judge_proxy (or internal in forge_execute)
  └─ forwards prediction_context to arifos.arif_judge
          │
          ▼
arif_judge (888_JUDGE)
  • prediction result = evidence (tri-witness input)
  • decide SEAL / HOLD / SABAR / VOID
          │
          ▼ (only on SEAL)
forge_execute
  • runs the action (after all gates)
```

## Flow in forge_execute (wired)

1. Elicitation gate (human consent for high impact)
2. **Auto prediction step** (if auto_predict && geox/wealth domain detected in task) — calls bridge directly, attaches result.
3. Build judgeBody with candidate + prediction_context + evidence_receipt
4. callMCP arif_judge
5. If not SEAL → HOLD, no execute
6. Landauer + Mesa gates
7. AgentEngine execute

Explicit: caller can pre-call `forge_predict`, pass `prediction_context` to forge_execute or forge_judge_proxy.

## Update to forge_judge_proxy

Schema now accepts:
- `prediction_context`: record

Handler injects into forwarded args + evidence_receipt.

## Tools

- **forge_predict** (new, SIMULATE class)
  - params: domain, proposed_action, params, mode, actor_id, session_id
  - output: {status, prediction: {...}, ready_for_judge: true }

- Updated: forge_execute (auto_predict default true for domains)
- Updated: forge_judge_proxy

## Tests (to run)

See task checklist:
- Test forge_execute with prediction step for GEOX + WEALTH domains
- Use MCP: after build, call via aforge MCP or tsx

Example invocation (MCP):
forge_predict({domain:"wealth", proposed_action:"drill prospect with $50M capex", params:{initial_value:50e6, growth_rate:0.08, volatility:0.3}})

Then pass result to judge/execute.

## Canon Ratification Note

VERDICT-CANON.md §2 updated:
"Canon now governs prediction + action."

Prediction is not optional decoration — it is evidence that changes the G (APEX) and W³ (tri-witness) inputs to judge.

## Deployment

- TS source: A-FORGE/src/interfaces/mcp/{core.ts,forgeTools.ts}
- Register: auto via core.ts
- Rebuild: `npm run build` in A-FORGE (or make)
- Restart: a-forge-mcp or a-forge
- No arifOS change required (prediction rides as opaque evidence payload)

## Future

- Prediction result can carry full envelope (G, C_dark, primitives) for direct APEX consumption.
- GEOX/WEALTH may grow dedicated `*_predict` aliases.
- Store prediction in reality_loop as OBSERVE step.

**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE (prediction now canon)**