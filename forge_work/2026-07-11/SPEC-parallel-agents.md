# SPEC: forge_parallel_agents + forge_wait_all

> **Forged:** 2026-07-11 | **Authority:** Session — Path A alignment
> **Target:** A-FORGE MCP tools
> **Status:** SPEC — awaiting sovereign approval before implementation
> **DITEMPA BUKAN DIBERI — Forged, Not Given.**

---

## 1. PURPOSE

Add two MCP tools to A-FORGE that give AAA OpenAI-style parallel agent execution with constitutional guarantees. These are **execution accelerators**, not governance primitives — they operate under the existing floor system.

```
forge_parallel_agents  →  spawn N agents concurrently, return group_id
forge_wait_all         →  block until all agents in group complete, return results
```

---

## 2. TOOL DEFINITIONS

### 2a. `forge_parallel_agents`

**Purpose:** Fan out N independent tasks to concurrent agents. Each agent gets its own context, runs in isolation, and reports back through the A2A task lifecycle.

**Input Schema:**
- `tasks` (array, 1-8 items): Each item has `name` (string), `prompt` (string), `target_organ` (enum: arifos|geox|wealth|well|aforge|auto, default: auto), `schema` (optional JSON schema for structured output), `timeout_ms` (default: 60000)
- `mode` (enum: observe|forge|full, default: observe)
- `fan_in_strategy` (enum: wait_all|wait_any|wait_majority, default: wait_all)
- `session_id` (required), `actor_id`, `lease_id`

**Returns:**
```json
{
  "group_id": "pg_20260711_a1b2c3",
  "agent_count": 3,
  "agents": [
    { "agent_id": "pa_geox-reviewer_0", "name": "geox-reviewer", "status": "submitted", "target_organ": "geox" },
    { "agent_id": "pa_security-audit_1", "name": "security-audit", "status": "submitted", "target_organ": "auto" },
    { "agent_id": "pa_well-check_2", "name": "well-check", "status": "submitted", "target_organ": "well" }
  ],
  "fan_in_strategy": "wait_all",
  "timeout_ms": 60000
}
```

**Behavior:**
1. Validates tasks array (max 8, each has name + prompt)
2. Creates a ParallelGroup in memory with unique group_id
3. For each task, spawns an A2A task via the existing task manager
4. Routes to target organ via federation gateway (or root agent if auto)
5. Each agent runs in its own context, independent of others
6. Returns immediately with group_id — caller uses forge_wait_all to collect results

**Constitutional gates:**
- F1 AMANAH: Each agent's task is reversible (observe/forge mode). full mode requires existing SEAL authority.
- F4 CLARITY: Each prompt must reduce entropy (no "explore vaguely" tasks).
- F7 HUMILITY: Timeout enforced — agents can't run forever claiming certainty.
- F11 AUDITABILITY: Every spawn logged to VAULT999 with group_id, task prompt, target organ.

---

### 2b. `forge_wait_all`

**Purpose:** Fan in — block until all (or N/2+1, or first) agents in a parallel group complete. Returns aggregated results.

**Input Schema:**
- `group_id` (required): Parallel group ID from forge_parallel_agents
- `timeout_ms` (optional): Override timeout for the wait
- `session_id` (required), `actor_id`, `lease_id`

**Returns:**
```json
{
  "group_id": "pg_20260711_a1b2c3",
  "status": "completed",
  "strategy": "wait_all",
  "agents_completed": 3,
  "agents_failed": 0,
  "agents_total": 3,
  "results": [
    {
      "agent_id": "pa_geox-reviewer_0",
      "name": "geox-reviewer",
      "status": "completed",
      "output": { "text": "...", "structured": null },
      "duration_ms": 4200,
      "organ": "geox"
    }
  ],
  "total_duration_ms": 8100,
  "sealed": false
}
```

**Behavior:**
1. Looks up ParallelGroup by group_id
2. Blocks until fan_in_strategy is satisfied:
   - wait_all: all agents reach terminal state (completed/failed/canceled)
   - wait_any: first agent completes
   - wait_majority: N/2+1 agents complete
3. Returns aggregated results with per-agent status, output, duration
4. If any agent failed, includes failure reason in its result (doesn't fail the group)
5. Logs aggregate to VAULT999

**Constitutional gates:**
- F2 TRUTH: Each agent's output is returned as-is — no merging or summarization. Root agent synthesizes.
- F11 AUDITABILITY: Group completion logged with all agent outcomes.

---

## 3. INTERNAL STATE MODEL

### ParallelGroup
```javascript
{
  group_id: "pg_20260711_a1b2c3",
  created_at: 1752240000000,
  created_by: "session_id_here",
  fan_in_strategy: "wait_all",
  mode: "observe",
  timeout_ms: 60000,
  status: "running",  // running | completed | timed_out | canceled
  agents: [
    {
      agent_id: "pa_geox-reviewer_0",
      name: "geox-reviewer",
      task_id: "a2a_task_xxx",
      target_organ: "geox",
      status: "working",
      started_at: 1752240000100,
      completed_at: null,
      output: null,
      error: null
    }
  ]
}
```

### State Machine
```
forge_parallel_agents() creates ParallelGroup, spawns N A2A tasks
         │
    GROUP_RUNNING (agents: working|submitted)
         │
    ┌────┼────────────────┐
    │    │                │
  completed  failed   timed_out
    │    │                │
    └────┼────────────────┘
         │
    fan_in_strategy check
    (wait_all: all terminal? / wait_any: ≥1 completed? / wait_majority: ≥N/2+1?)
         │ satisfied
    GROUP_COMPLETED → forge_wait_all returns
```

---

## 4. ORGAN ROUTING

| target_organ | Route to | Port | Why |
|---|---|---|---|
| geox | GEOX MCP | 8081 | Earth intelligence tasks |
| wealth | WEALTH MCP | 18082 | Capital analysis tasks |
| well | WELL MCP | 18083 | Vitality/readiness checks |
| arifos | arifOS MCP | 8088 | Governance, floor checks |
| aforge | A-FORGE MCP | 7072 | Engineering tasks |
| auto | Root agent decides | — | Default; root agent picks organ or handles directly |

When auto is selected, the spawned agent has access to all MCP tools and can route itself.

---

## 5. INTEGRATION WITH EXISTING AAA LAYER

### A2A Task Lifecycle
Each spawned agent IS an A2A task:
```
TASK_STATE_SUBPLETED → TASK_STATE_WORKING → TASK_STATE_COMPLETED | TASK_STATE_FAILED | TASK_STATE_CANCELED
```

### Agent Lifecycle (agent_lifecycle.js)
Each spawned agent goes through:
```
REGISTERED → PROVISIONED → AUTHORIZED → EXECUTING → AUDITING → STOPPED
```

### VAULT999 Sealing
- On spawn: Log group_id, task count, prompts, target organs
- On completion: Log per-agent outcomes, durations, failures
- On seal (mode=full): If all agents complete and mode is full, aggregated result can be sealed

### NATS Events
Publish to arifos.parallel.group.{group_id}:
- group.created — when forge_parallel_agents returns
- agent.completed — when each agent finishes
- group.completed — when forge_wait_all resolves

---

## 6. EXAMPLE USAGE

### Parallel organ analysis
```json
// forge_parallel_agents
{
  "tasks": [
    { "name": "geox-prospect", "prompt": "Evaluate prospect X in basin Y.", "target_organ": "geox" },
    { "name": "wealth-npv", "prompt": "Compute NPV for prospect X at 10% discount rate.", "target_organ": "wealth" },
    { "name": "well-readiness", "prompt": "Check operator readiness for field deployment.", "target_organ": "well" }
  ],
  "mode": "observe",
  "fan_in_strategy": "wait_all",
  "session_id": "ses_abc123"
}
```

```json
// forge_wait_all
{ "group_id": "pg_20260711_a1b2c3", "session_id": "ses_abc123" }
```

### Parallel code review (auto-routing)
```json
{
  "tasks": [
    { "name": "correctness", "prompt": "Review diff for correctness bugs...", "target_organ": "auto" },
    { "name": "security", "prompt": "Review diff for security vulnerabilities...", "target_organ": "auto" },
    { "name": "performance", "prompt": "Review diff for performance regressions...", "target_organ": "auto" }
  ],
  "mode": "observe",
  "session_id": "ses_abc123"
}
```

---

## 7. CONSTRAINTS

| Constraint | Value | Why |
|---|---|---|
| Max agents per group | 8 | Prevent resource exhaustion |
| Max group lifetime | 300s | Constitutional timeout (F7) |
| Max concurrent groups per session | 3 | Prevent session flooding |
| Agent context isolation | Yes | Each agent gets own context (F4) |
| Cross-agent communication | No | Agents only report to root |
| Result synthesis | Root agent's job | Wait tool returns raw outputs |

---

## 8. IMPLEMENTATION PLAN

### Phase 1: Core (A-FORGE)
1. Add ParallelGroup state management to A-FORGE
2. Implement forge_parallel_agents — spawn A2A tasks via federation gateway
3. Implement forge_wait_all — poll/subscribe to A2A task completions
4. Register both tools in A-FORGE's MCP tool registry

### Phase 2: Integration
5. Add NATS publishing for group events
6. Add mesh coordinator subscription for parallel group monitoring
7. Add VAULT999 logging for group lifecycle

### Phase 3: Constitutional
8. Wire F1/F4/F7 gates into spawn validation
9. Add group-level SEAL/HOLD for mode=full
10. Add F13 veto propagation (cancel all agents in group)

---

## 9. OPEN QUESTIONS

1. **Should agents share root's MCP tool access?** auto = full access, specific organ = organ-only tools.
2. **Should failed agents fail the group?** No. wait_all returns all results including failures. Root decides.
3. **Inter-agent messaging?** Not in Phase 1. Violates "independent tasks" principle.
4. **Budget governance?** Yes, via existing budget system. Add max_tokens_per_group optional param.

---

**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE**
