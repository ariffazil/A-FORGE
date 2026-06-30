# NEXT HORIZON — arifOS Strategic Position + Roadmap
# Date: 2026-07-01
# Sealed by: FORGE (000Ω)
# Sovereign: F13 Arif
# Status: RSI ZEN — entropy-reduced, actionable

---

## What arifOS IS

**arifOS is an AI agent governance kernel.**

Technical language:
> arifOS is a constitutional control plane for MCP-connected agents.

Public language:
> arifOS is an AI agent governance kernel.

Future research language:
> arifOS is an AGI harness candidate, not an AGI model.

**One line:**
> arifOS should not try to be the mind. arifOS should become the law that governs minds with tools.

---

## What arifOS is NOT

| What | Why Not |
|------|---------|
| AGI foundational model | Does not train base models |
| MCP | MCP connects. arifOS governs. |
| GUI | GUI is cockpit. arifOS is kernel underneath. |
| Another LangGraph | LangGraph orchestrates. arifOS judges. |
| Another OpenAI Agents SDK | SDK runs agents. arifOS governs whether they should act. |

---

## External Positioning

| Product | Role | arifOS Relationship |
|---------|------|---------------------|
| OpenAI Agents SDK | Agent runtime | Use as engine. arifOS above as judge. |
| LangGraph | Orchestration runtime | Railway track. arifOS is control law. |
| Langfuse | Observability | Tells what happened. arifOS decides what should have been allowed. |
| MCP | Tool connector standard | Hands. arifOS is judgment. |

**Clean positioning:**
> OpenAI Agents SDK runs agents. LangGraph orchestrates agents. Langfuse observes agents. MCP connects agents to tools. arifOS governs whether agents should act.

---

## Current Maturity: 5.4 / 10

| Dimension | Score | Target | Gap |
|-----------|-------|--------|-----|
| Concept clarity | 8.5 | 9.0 | 0.5 |
| Originality | 8.0 | 9.0 | 1.0 |
| MCP strategic fit | 8.0 | 9.0 | 1.0 |
| Router / mode discipline | 7.0 | 9.0 | 2.0 |
| Affordance contracts | 4.5 | 8.5 | 4.0 |
| Tool-call enforcement | 4.0 | 8.5 | 4.5 |
| Session hygiene | 4.0 | 8.0 | 4.0 |
| Receipt / trace | 6.0 | 8.5 | 2.5 |
| Evaluation metrics | 3.5 | 8.0 | 4.5 |
| Developer usability | 4.0 | 8.0 | 4.0 |
| Non-coder usability | 3.5 | 8.0 | 4.5 |
| Product packaging | 3.0 | 7.5 | 4.5 |
| Security posture | 5.0 | 8.5 | 3.5 |
| External interoperability | 5.5 | 8.5 | 3.0 |
| AGI-harness credibility | 4.5 | 7.5 | 3.0 |

**Current: 5.4/10 — Strong for founder-led early system. Not production mature.**

---

## The Bottleneck

**Not intelligence. Enforcement.**

The question:
> Can every agent action be routed, budgeted, permissioned, traced, and stopped?

If yes → arifOS becomes real.
If no → arifOS remains a beautiful constitution around chaotic execution.

---

## Critical Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Tool-call bypass rate | Unknown | 0% |
| GOVERN + UNKNOWN execution | Should be 0% | 0% |
| Destructive action without approval | Unknown | 0% |
| FAST unnecessary tool calls | Unknown | <5% |
| THINK budget violations | Unknown | <2% |
| GOVERN receipt coverage | Partial | 100% |
| Affordance completeness | ~40-60% | >95% |
| Session stale rate | High (52 active) | <10% |
| Trace coverage | Partial | >95% |

**The four non-negotiables:**
1. Zero unapproved destructive actions
2. Zero UNKNOWN GOVERN executions
3. Zero direct tool bypass
4. >95% trace coverage

---

## Product Ladder

| Stage | Description | Status |
|-------|-------------|--------|
| 0 | Philosophy / Constitution | ✅ Done |
| 1 | Agent governance harness | 🔄 Entering |
| 2 | MCP governance gateway | ← NEXT |
| 3 | MCP governance cockpit | ← NEXT |
| 4 | Agent execution control plane | After wiring |
| 5 | AGI harness | After multi-model proof |
| 6 | AGI kernel | After measured reliability |

**Current: Stage 1.5**

---

## NEXT HORIZON — 90-Day Roadmap

### Horizon 1: 7 Days (5.4 → 6.2)
**Goal: Make bypass impossible.**

| # | Task | Status |
|---|------|--------|
| 1 | mcp_guard.py | ✅ DONE |
| 2 | Direct-call bypass denial | ✅ DONE |
| 3 | Affordance registry schema | ✅ DONE |
| 4 | Trace for every MCP call | ✅ DONE |
| 5 | FAST/THINK/GOVERN enforcement tests | ✅ DONE |

### Horizon 2: 30 Days (6.2 → 7.0)
**Goal: Make governance visible.**

| # | Task | Status |
|---|------|--------|
| 1 | Affordance cards for all tools | 🔄 Partial (24/64+) |
| 2 | Session hygiene | 📋 Policy defined |
| 3 | GOVERN dry-run | 📋 Planned |
| 4 | Receipt viewer | 📋 Planned |
| 5 | UNKNOWN dashboard | 📋 Planned |
| 6 | Blocked-action dashboard | 📋 Planned |

### Horizon 3: 90 Days (7.0 → 7.5-8.0)
**Goal: Make arifOS externally credible.**

| # | Task | Status |
|---|------|--------|
| 1 | Benchmark suite | 📋 Planned |
| 2 | 100 test scenarios | 📋 Planned |
| 3 | Red-team unsafe tool tests | 📋 Planned |
| 4 | Public docs | 📋 Planned |
| 5 | Demo video | 📋 Planned |
| 6 | MCP governance cockpit | 📋 Planned |
| 7 | Langfuse/LangSmith integration | 📋 Planned |

---

## What We BUILT (A-THINK v1)

```
/root/A-FORGE/a_think/
├── router.py              # FAST/THINK/GOVERN classifier
├── affordance.py          # AffordanceCard + UNKNOWN=HOLD
├── mcp_guard.py           # Front-door guard for ALL MCP calls
├── affordances.yaml       # 24 tool affordance cards
├── organ_affordances.yaml # 5 organ affordance cards
├── budgets.yaml           # Hard limits
├── tests.py               # 10/10 enforcement tests PASS
```

**The law (enforced, not prose):**
```
user_input → classify_task() → budget → affordance → permission → trace → execute/blocked
```

**Critical rules enforced:**
- UNKNOWN = HOLD
- WRITE = GOVERN
- DESTRUCTIVE = HUMAN APPROVAL
- BUDGET = HARD LIMIT
- NO MCP TOOL MAY BE CALLED DIRECTLY

---

## What We're NOT Doing

- No new repo
- No new MCP server
- No new agent names
- No DSPy yet (v2, after routing stable)
- No LangGraph yet (v3, after single-agent loop boring-stable)
- No multi-agent senate
- No symbolic floors expansion
- No AGI foundational model

---

## The RSI Zen

**arifOS has the organs. Now it needs the boring rules.**

Router is built. Affordance cards exist. Guard is wired.

Next is:
1. Normalize remaining tools
2. Session hygiene
3. Cockpit visibility
4. Only then: DSPy, LangGraph, external credibility

**Less mythology. More enforcement.**

---

## Init Prompt (for next session)

```
You are FORGE (000Ω), the autonomous engineering arm of the arifOS federation.

CONTEXT:
- arifOS = agent-governance kernel (constitutional authority above agent tools)
- Current maturity: 5.4/10 (Stage 1.5)
- Next horizon: 7.5/10 in 90 days
- Bottleneck: enforcement, not intelligence

WHAT EXISTS:
- Router: FAST/THINK/GOVERN classifier (12/12 tests)
- Affordance cards: 24 tools declared
- MCP Guard: front-door for all calls (10/10 tests)
- Budgets: hard limits per mode
- Law: UNKNOWN=HOLD, WRITE=GOVERN, DESTRUCTIVE=HUMAN APPROVAL

WHAT'S NEXT (in order):
1. Normalize remaining forge_* tool affordance cards
2. Session hygiene (close/seal/expire stale sessions)
3. MCP governance cockpit (visibility dashboard)
4. DSPy offline compile (v2, after routing stable)
5. LangGraph integration (v3, after single-agent loop boring-stable)

WHAT WE'RE NOT DOING:
- No new repo, MCP server, agent names
- No DSPy/LangGraph yet
- No multi-agent senate
- No AGI foundational model

THE LAW:
- No MCP tool may be called directly
- Every call: router → budget → affordance → permission → trace
- UNKNOWN = HOLD (always)
- Smallest safe tool only
- Less mythology, more enforcement

DITEMPA BUKAN DIBERI.
```

---

*Sealed: 2026-07-01*
*FORGE (000Ω)*
*DITEMPA BUKAN DIBERI*
