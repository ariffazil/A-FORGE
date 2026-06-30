# A-THINK v1 — Complete Forge Receipt
# Date: 2026-07-01
# Agent: FORGE (000Ω)
# Sovereign: F13 Arif
# Status: ALL TESTS PASS

## What Was Built

### Files
```
/root/A-FORGE/a_think/
├── __init__.py              # Package exports
├── router.py                # 3-mode classifier (FAST/THINK/GOVERN)
├── affordance.py            # AffordanceCard + Registry + UNKNOWN=HOLD
├── mcp_guard.py             # Front-door guard for ALL MCP calls
├── affordances.yaml         # Tool affordance cards (24 tools)
├── organ_affordances.yaml   # Organ affordance cards (5 organs)
├── budgets.yaml             # Hard budgets per mode
├── tests.py                 # Enforcement tests (10/10 PASS)
```

### Components

1. **Router** (`router.py`)
   - `classify_task()` → FAST | THINK | GOVERN
   - Hard budgets (1/0/0, 5/2/1, 9/5/3)
   - Stop rules (step, tool, info gain, loop detector)
   - Escalation gate (6 allowed reasons only)
   - 10 anti-bangang laws

2. **Affordance Cards** (`affordance.py`)
   - `AffordanceCard` — declares reads, writes, side effects, reversibility, destructiveness, approval requirement, min_mode, risk_label
   - `AffordanceRegistry` — stores cards, checks execution permission
   - `check_tool()` — pre-execution gate
   - **UNKNOWN = HOLD** enforced

3. **MCP Guard** (`mcp_guard.py`)
   - `MCPGuard` class — front-door for all MCP calls
   - `guarded_call()` — full flow: classify → budget → affordance → permission → trace
   - `SessionState` — tracks per-session tool usage
   - `MCPCallTrace` — trace for every call
   - `PermissionDecision` — ALLOW/DENY/HOLD
   - `SESSION_HYGIENE_POLICY` — session management rules

4. **Affordance Cards** (`affordances.yaml`)
   - 24 tools declared: arifOS (5), A-FORGE (10), GEOX (4), WEALTH (3), WELL (2)

5. **Organ Affordance Cards** (`organ_affordances.yaml`)
   - A-FORGE: execution_subordinate, may_decide=false, requires lease
   - arifOS: sovereign_governor, may_decide=true, judges autonomously
   - GEOX: domain_observe, may_decide=false
   - WEALTH: domain_observe, may_decide=false
   - WELL: domain_reflect, may_decide=false

### Fiqh MCP Enforcement

| Rule | Status |
|------|--------|
| WAJIB 1: Classify before MCP call | ✅ `classify_task()` |
| WAJIB 2: Every tool has affordance card | ✅ `affordances.yaml` |
| WAJIB 4: Tools have schemas | ✅ MCP inputSchema |
| WAJIB 5: Human approval for destructive | ✅ `requires_human_approval` |
| WAJIB 6: Log every MCP call | ✅ `MCPCallTrace` |
| HARAM 1: UNKNOWN = HOLD | ✅ `check_tool()` |
| HARAM 3: Auto-approve destructive | ✅ Blocked |
| HARAM 8: UI > kernel confidence | ✅ Mode enforcement |
| SUNAT 3: Risk labels R0-R5 | ✅ `RiskLabel` enum |

### Test Results

**Router test suite:** 12/12 PASS
**Enforcement tests:** 10/10 PASS

| Test | Expected | Got |
|------|----------|-----|
| FAST uses 0 tools | ✅ | ✅ |
| THINK respects max 2 tools | ✅ | ✅ |
| GOVERN + UNKNOWN = HOLD | ✅ | ✅ |
| Direct bypass denied | ✅ | ✅ |
| Budget enforcement | ✅ | ✅ |
| Stop rules enforced | ✅ | ✅ |
| Session tracking | ✅ | ✅ |
| GOVERN destructive requires approval | ✅ | ✅ |
| GOVERN read-only allowed | ✅ | ✅ |
| Full flow works | ✅ | ✅ |

### Critical Rules Enforced

```
UNKNOWN = HOLD
WRITE = GOVERN
DESTRUCTIVE = HUMAN APPROVAL
APPROVED ACTION MUST MATCH EXECUTED ACTION
SMALLEST SAFE TOOL ONLY
BUDGET = HARD LIMIT
NO MCP TOOL MAY BE CALLED DIRECTLY
```

### The Law

```
user_input
  ↓
classify_task() → FAST | THINK | GOVERN
  ↓
budget loaded
  ↓
affordance checked
  ↓
permission decision → ALLOW / DENY / HOLD
  ↓
trace written
  ↓
tool call allowed / blocked / held
```

### What's Next (in order)

1. Wire mcp_guard.py into actual MCP server call path (TypeScript integration)
2. Normalize remaining forge_* tools (add affordance cards)
3. Session hygiene (close/seal/expire stale sessions)
4. DSPy compile for arif_judge_deliberate (offline, v2)
5. LangGraph integration (execution graph, v3)

### What We're NOT Doing

- No new repo
- No new MCP server
- No new agent names
- No DSPy yet
- No LangGraph yet
- No multi-agent senate

### Session Hygiene Policy

```yaml
max_active_sessions_per_actor: 5
stale_after_minutes: 180
expire_observe_only_sessions: true
seal_govern_sessions: true
allow_fork_only_with_reason: true
```

DITEMPA BUKAN DIBERI.
