# ⚡ WORKFLOW 4: A-FORGE Agent Orchestration
# Governed Multi-Agent Execution under SEAL/HOLD/SABAR/VOID
# A-FORGE spawns agents → each calls domain organs → arifOS judges → A-FORGE executes.
# This is the operational heart of the federation.

```yaml
workflow_id: wf-forge-orchestration
canonical_name: "Agentic Forge Orchestration"
layers_traversed: [L2, L3, L1, L2]
organs_touched: [A-FORGE, GEOX|WEALTH|WELL, arifOS, AAA]
metabolic_steps: [000, 111, 444, 333, 888, 777, 999]
```

## The Orchestration Loop

```
┌─────────────────────────────────────────┐
│ A-FORGE (L2)                            │
│   forge_session_init → lease acquired    │
│       ↓                                 │
│   spawn agent(geo)  ──→ GEOX (L3)      │
│   spawn agent(capital) → WEALTH (L3)    │
│   spawn agent(health)  → WELL (L3)      │
│       ↓                                 │
│   collect evidence package               │
│       ↓                                 │
│   forge_judge_proxy ──→ arifOS (L1)     │
│       ↓                                 │
│   on SEAL: forge_execute                │
│   on HOLD: queue for human review        │
│   on SABAR: pause, await conditions      │
│   on VOID: abort, log scar               │
│       ↓                                 │
│   forge_vault ──→ VAULT999              │
│       ↓                                 │
│   forge_seal ──→ AAA register            │
└─────────────────────────────────────────┘
```

## Parallel Agent Pattern

```
Task: "Evaluate Basin X for drilling"

A-FORGE spawns 3 agents in parallel:
  1. geo_agent    → geox_basin(mode="profile") + geox_prospect(mode="screen")
  2. capital_agent → capital_primitive(mode="emv") + capital_wisdom(mode="omni")
  3. risk_agent    → geox_falsify(claim_text="drill here") + capital_diagnose(mode="stress_index")

fan_in → forge_judge_proxy → SEAL → forge_execute(drill_plan)
```

## Verdict → Action Mapping

| Verdict | A-FORGE Action | AAA Register | VAULT999 |
|---------|---------------|-------------|----------|
| SEAL | `forge_execute` | state.executed | sealed |
| HOLD | queue pending | state.held | cooling |
| SABAR | pause + retry | state.paused | cooling |
| VOID | abort + scar | state.blocked | scar_recorded |

## Guard Conditions
- A-FORGE NEVER executes without prior arif_judge SEAL
- Parallel agents are ISOLATED (no cross-talk between domain organs)
- fan_in collects all evidence before judge
- On VOID: scar is recorded for future pattern detection
