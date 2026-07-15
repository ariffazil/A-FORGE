# WEALTH MCP — Reorganization Proposal

**Date:** 2026-07-07  
**Session:** `SEAL-442d21f3215f43d8`  
**Actor:** FORGE-000  
**Inputs:** Claude's backtest findings + MCP spec (2025-11-25) + FastMCP docs + WEALTH server.py analysis

---

## What We Have Now

**~40 tools, 15 function-based "resources" (masquerading as tools), 0 actual MCP Resources, 0 actual MCP Prompts, 5 legacy aliases.** The preload mechanism (lines 97-120 of server.py) is a workaround: function-call resources that must be "read" before tools can be called. This is fragile — every preload URI tested in the backtest returned "Failed to read MCP resource."

### Current Architecture (server.py line numbers)

| Category | Tools | Problem |
|----------|-------|---------|
| Deductive primitives | 16 (npv, irr, emv, evoi, mc, kelly, markowitz, etc.) | 2 have arithmetic bugs (P0); flat namespace |
| Diagnostics | 12 (stress_index, cascade, collapse, beautiful_mouse, etc.) | 4 are phantom; 3 have false negatives; silent field-dropping |
| Governance/boundary | 4 (boundary_governance, survival_engine, judge_handoff, vault) | Emits GO/HOLD/SEAL — arifOS's job; inconsistent verdict fields |
| Meta/registry | 4 (registry_status, agent_path + 2 aliases) | Legacy alias duplication |
| Function resources | 15 (schema, glossary, thresholds, etc.) | Not MCP Resources — tools masquerading as data |
| Legacy aliases | 5 (emv_compute, evoi_compute, monte_carlo, reason_agent, system_registry_status) | Already mapped in ALIAS_FLOORS — just need removal |

---

## What MCP Protocol Actually Provides

From the 2025-11-25 spec:

| Primitive | Purpose | What belongs here |
|-----------|---------|-------------------|
| **Tools** | Executable functions with typed input/output schemas | Computation, analysis, queries |
| **Resources** | Data sources and content generators (URI-addressable) | Schemas, thresholds, calibration data, market sources, vault queries |
| **Prompts** | Reusable, parameterized prompt templates | backtest_case, capture_audit, judge_packet |

**FastMCP supports all three natively:**
- `@mcp.tool()` — decorated async functions
- `@mcp.resource("wealth://path")` — URI-addressable data
- `@mcp.prompt()` — parameterized templates

WEALTH only uses `@mcp.tool()`. The preload mechanism is essentially a reimplementation of Resources inside Tools, with all the fragility that implies.

---

## Proposed Architecture

### 7 Canonical Tools (from ~40)

```
capital_primitive(mode, ...)       — 10 pure-math modes
capital_health(mode, ...)          — 7 financial-health modes  
capital_diagnose(mode, domain_scope, ...) — 10 diagnostic modes
capital_wisdom(mode, ...)          — 4 synthesis modes
capital_market(mode, ...)          — 4 market-data modes
capital_ledger(mode, ...)          — 2 vault modes
capital_registry(mode)             — meta/status
```

### Tool Contracts

#### 1. `capital_primitive(mode: str, ...)`
> **Deductive.** Pure computation. Every mode unit-testable against hand-checked cases.

| mode | Parameters | Contract |
|------|-----------|----------|
| npv | cash_flows: list[float], discount_rate: float | Standard formula: CF[0] at t=0, CF[i] at t=i |
| irr | cash_flows: list[float] | Returns float or explicit error with diagnostic |
| emv | outcomes: list[float], probabilities: list[float] | Sum of outcome × probability |
| evoi | prior_pos: float, posterior_pos: float, well_cost: float, p50_value: float, discount_rate: float | Standard VOI |
| mc | initial_value: float, growth_rate: float, volatility: float, periods: int, simulations: int | Monte Carlo with seed for reproducibility |
| kelly | win_prob: float, odds: float | Kelly fraction |
| markowitz | returns: list[float], covariances: list[list[float]], risk_aversion: float | Mean-variance optimal weights |
| robust | returns: list[float], uncertainty_radius: float, robust_type: str | Robust optimization |
| chance_constrained | returns: list[float], covariances: list[list[float]], confidence: float, threshold: float | VaR/CVaR |
| two_stage | first_stage_costs: dict, scenario_data: list[dict] | Stochastic recourse |

**Golden test suite:** Every mode has ≥2 hand-checked test cases in CI.

#### 2. `capital_health(mode: str, ...)`
> **Deductive.** Financial health and risk metrics.

| mode | Parameters |
|------|-----------|
| conservation | assets: list[dict], liabilities: list[dict] |
| flow | income: list[dict], expenses: list[dict] |
| runway | liquid_assets: float, monthly_burn: float, conservative_factor: float |
| survival | mode: cashflow\|runway\|burn\|liquidity\|personal_finance, ... |
| fiscal_breakeven | (Malaysia fiscal parameters) |
| confluence | indicators: list[dict] |
| asymmetry | upside: list[float], downside: list[float] |

#### 3. `capital_diagnose(mode: str, domain_scope: str, ...)`
> **Abductive.** Inference from partial evidence. **Required `domain_scope`** declaring calibration domain. Output includes alternative hypotheses ruled out.

| mode | Calibration domain |
|------|-------------------|
| stress_index | P&L + governance churn (NOT solvency — see calibration_corpus for limits) |
| governance_capacity | Board/committee structure analysis |
| cascade_model | Feedback loop detection |
| exploitation_detect | "Simulative neutral" counterparty patterns |
| collapse_signature | **LEGACY — EXTRACTION FRAUD ONLY** (Enron, PDVSA, Pemex, 1MDB, WorldCom) |
| beautiful_mouse | Calhoun Phase C detection |
| capture_scan | Incentive asymmetry in financial advice |
| power_audit | Institutional power dynamics |
| bid_surface | Competitive bid scoring |
| optimize_mwc | Minimum Winning Coalition |

**Key discipline:** `domain_scope` is mandatory. Unknown fields are rejected (not silently dropped). If a risk dimension cannot be modeled, emit UNKNOWN for that component.

#### 4. `capital_wisdom(mode: str, ...)`
> **Abductive.** Synthesis and meta-analysis.

| mode | Parameters |
|------|-----------|
| wisdom | proposal: str, capital_type: str, context: dict |
| power | scenario: str, actors: list[str] |
| omni | mode: synthesize\|deal\|hysteresis\|counterfactual, ... |
| epistemic | target: str, ... |

#### 5. `capital_market(mode: str, ...)`
> **Deductive/observational.** Live and cached market data.

| mode | Parameters |
|------|-----------|
| fx | base: str, targets: str |
| commodity | commodity: str |
| indicator | indicator: str, country: str |
| stock | mode: verify_math\|pre_trade\|fundamentals\|kelly\|nash_multi_factor\|..., ticker: str, ... |

#### 6. `capital_ledger(mode: str, ...)`
> **Mutating (write requires explicit human ack).**

| mode | Contract |
|------|----------|
| query | Read-only. query: str, limit: int, asset_id: str |
| write | Requires `ack_irreversible=true`. tx_type: str, amount: float, ... |

#### 7. `capital_registry(mode: str)`
> **Observational.** Meta and introspection.

| mode | Returns |
|------|---------|
| status | Tool registry with callable/blocked/degraded/drift status |
| schema | Full tool schema for all modes |
| domains | Domain index |
| health | Server health |

---

### MCP Resources (8 — using `@mcp.resource()`)

These are the 15 function-based resources from server.py, consolidated and properly exposed:

| URI | Content | Source (server.py line) |
|-----|---------|------------------------|
| `wealth://calibration/corpus` | Per-tool calibration cases, pattern classes, known limits | **NEW** |
| `wealth://risk/thresholds` | Risk threshold configuration | line 3441 |
| `wealth://federation/contract` | Federation contract | line 3242 |
| `wealth://reality/context` | Reality grounding context | line 3317 |
| `wealth://market/sources` | Market data source registry | line 3366 |
| `wealth://affordance/contracts` | Tool affordance contracts | line 3484 |
| `wealth://handoff/arifos-schema` | Judge handoff schema | line 3702 |
| `wealth://replay/receipt-schema` | Receipt schema for audit | line 3768 |

**Other function resources consolidated or moved:**
- `wealth_schema()` → `capital_registry(mode="schema")`
- `wealth_tools_registry()` → `capital_registry(mode="status")`
- `wealth_prompts_index()` → MCP prompts list (auto-generated by FastMCP)
- `wealth_domains_index()` → `capital_registry(mode="domains")`
- `wealth_runtime_policy()` → `capital_registry(mode="policy")`
- `wealth_canon_002_human_law()` → Resource or inline in server instructions
- `wealth_glossary()` → Resource `wealth://glossary`
- `wealth_health()` → `capital_registry(mode="health")`

### MCP Prompts (3 — using `@mcp.prompt()`)

| Name | Description | Parameters |
|------|-------------|------------|
| `backtest_case` | Run a historical case through WEALTH primitives + diagnostics | `case_name: str`, `historical_date: str`, `organ_domains: list[str]` |
| `capture_audit` | Audit text for capture signals in financial advice | `text: str`, `source_model: str`, `context: str` |
| `judge_packet` | Package WEALTH findings as evidence for arifOS judge | `tool_results: dict`, `intent: str`, `domain: str`, `blast_radius: str` |

---

## What Gets Removed

| Removed | Reason |
|---------|--------|
| `wealth_emv_compute` | Legacy alias → `capital_primitive(mode="emv")` |
| `wealth_evoi_compute` | Legacy alias → `capital_primitive(mode="evoi")` |
| `wealth_monte_carlo` | Legacy alias → `capital_primitive(mode="mc")` |
| `wealth_reason_agent` | Legacy alias → `capital_registry(mode="status")` |
| `wealth_system_registry_status` | Legacy alias → `capital_registry(mode="status")` |
| `wealth_arifos_judge_handoff_alias` | Legacy alias → `capital_judge_handoff` |
| Preload mechanism (lines 89-120) | Replaced by actual MCP Resources |
| 15 function-based resources | Consolidated into 8 MCP Resources + `capital_registry` modes |
| Verdict emission (GO/HOLD/SEAL) from WEALTH tools | Moves to `capital_judge_handoff` → arifOS only |

---

## Migration Path

### Phase 1: Resources (unblocks 3 tools immediately)
1. Wire 8 function resources as actual `@mcp.resource()` decorators
2. Remove preload mechanism — tools read resources directly via `mcp.read_resource()`
3. Verify: `wealth_collapse_signature_scan` and `wealth_compute_emv` now work

### Phase 2: Prompts
1. Add 3 `@mcp.prompt()` templates
2. Remove `wealth_prompts_index()` function-tool

### Phase 3: Tool Consolidation
1. Create the 7 canonical tools with mode-based routing
2. Each mode preserves existing implementation (import from `wealth_core/`)
3. Remove legacy aliases from tool surface (ALIAS_FLOORS stays for backward compat)
4. Add golden test suite for `capital_primitive` modes (fixes P0 NPV/IRR bugs)

### Phase 4: Governance Cleanup
1. Strip GO/HOLD/SEAL verdict language from WEALTH tools
2. Route all verdicts through `capital_judge_handoff` → arifOS
3. Unify verdict fields in all tool responses

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking existing callers | HIGH | Keep legacy tool names as thin wrappers for one release cycle |
| Mode-based routing complexity | MEDIUM | Each mode has strict typed schema; reject unknown mode values |
| Large PR scope | MEDIUM | Four phases, each independently deployable |
| Losing functionality in consolidation | LOW | Every mode preserves existing import from `wealth_core/` |
| FastMCP resource decorator bugs | LOW | FastMCP resources are well-tested; we just need to wire existing code |

---

## Contract with Claude's Findings

| Claude Finding | Addressed By |
|---------------|-------------|
| P0.1: NPV off-by-one | Phase 3 golden test suite + `capital_primitive` contract specifies exact formula |
| P0.2: IRR null | Same — golden tests fix this |
| P0.3: Field-dropping → false negative | `capital_diagnose` contract: reject unknown fields, emit UNKNOWN not 0.0 |
| P1: Phantom tools | `capital_registry(mode="status")` cross-checks callable vs registered |
| P1: Preloads broken | Phase 1: actual MCP Resources, no preload mechanism |
| P1: Serialization bug | Separate FastMCP fix; not scope of this reorganization |
| P1: Inconsistent verdicts | Phase 4: strip verdict language from WEALTH |
| P2: Signal sensitivity | Phase 3: expand phrase pools; `domain_scope` surfaces calibration limits |

---

*Forged: 2026-07-07 by FORGE-000 under session SEAL-442d21f3215f43d8*  
*DITEMPA BUKAN DIBERI*
