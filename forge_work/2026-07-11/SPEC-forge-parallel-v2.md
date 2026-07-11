# SPEC: forge_parallel — Thin Orchestration Layer (v2)

> **Forged:** 2026-07-11 | **Authority:** Sovereign direction (Path A, corrected)
> **Target:** A-FORGE MCP tool
> **Status:** SPEC — DRAFT_ONLY
> **Evidence layer:** L4 (DRAFT — design, not verified implementation)
> **DITEMPA BUKAN DIBERI — Forged, Not Given.**

---

## 0. CORRECTION

v1 spec proposed two new public endpoints (`forge_parallel_agents` + `forge_wait_all`). Sovereign corrected: expose parallelism as a **single thin orchestration layer** over existing A2A verbs. No new constitutional primitives.

Audit confirmed: AAA has `message/send`, `tasks/get`, `tasks/list`, `tasks/cancel`, `tasks/subscribe` (SSE). Missing: `spawn_agent`, `followup_task`, `wait_agent`, `list_agents`. `forge_parallel` composes what exists.

---

## 1. TOOL DEFINITION

**One tool.** `forge_parallel` on A-FORGE MCP.

```json
{
  "name": "forge_parallel",
  "description": "Spawn N concurrent A2A tasks and collect results. Thin orchestration over existing A2A verbs (message/send, tasks/subscribe, tasks/cancel, tasks/get).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "mode": {
        "type": "string",
        "enum": ["parallel"],
        "description": "Execution mode. Currently only 'parallel'.",
        "default": "parallel"
      },
      "tasks": {
        "type": "array",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "Human-readable agent name"
            },
            "prompt": {
              "type": "string",
              "description": "Task prompt for this agent"
            },
            "target_organ": {
              "type": "string",
              "enum": ["arifos", "geox", "wealth", "well", "aforge", "auto"],
              "default": "auto"
            },
            "schema": {
              "type": "object",
              "description": "Optional JSON schema for structured output"
            }
          },
          "required": ["name", "prompt"]
        }
      },
      "max_concurrency": {
        "type": "integer",
        "description": "Max simultaneous agents (default 3)",
        "default": 3,
        "minimum": 1,
        "maximum": 8
      },
      "failure_policy": {
        "type": "string",
        "enum": ["collect_all", "fail_fast", "majority_wins"],
        "description": "How to handle agent failures",
        "default": "collect_all"
      },
      "timeout_ms": {
        "type": "integer",
        "description": "Group timeout in milliseconds",
        "default": 60000,
        "minimum": 5000,
        "maximum": 300000
      },
      "context_policy": {
        "type": "string",
        "enum": ["isolated", "shared_readonly"],
        "description": "Context isolation for agents",
        "default": "isolated"
      },
      "fan_in": {
        "type": "string",
        "enum": ["root_synthesis", "structured_merge"],
        "description": "How results are assembled. root_synthesis = raw outputs for root agent. structured_merge = schema-validated merge.",
        "default": "root_synthesis"
      },
      "session_id": {
        "type": "string",
        "description": "Kernel-born session ID"
      },
      "actor_id": {
        "type": "string"
      },
      "lease_id": {
        "type": "string"
      }
    },
    "required": ["tasks", "session_id"]
  }
}
```

---

## 2. EXECUTION OBJECT

The task group is the core state object. Created on spawn, updated on completion, sealed on fan-in.

```json
{
  "task_group_id": "a2ag_20260711_a1b2c3",
  "parent_task_id": "task_xxx",
  "members": [
    {
      "agent_id": "pa_geox-reviewer_0",
      "name": "geox-reviewer",
      "a2a_task_id": "aaa-xyz123",
      "target_organ": "geox",
      "status": "TASK_STATE_WORKING",
      "started_at": "2026-07-11T10:00:00Z",
      "completed_at": null,
      "output": null,
      "error": null,
      "delta_anchor": null,
      "evidence_layer": null,
      "uncertainty": null
    }
  ],
  "status": "running",
  "concurrency_limit": 3,
  "failure_policy": "collect_all",
  "context_policy": "isolated",
  "fan_in": "root_synthesis",
  "delta_anchors": {},
  "created_at": "2026-07-11T10:00:00Z",
  "deadline": "2026-07-11T10:01:00Z"
}
```

---

## 3. ORCHESTRATION FLOW

```
forge_parallel(tasks[], max_concurrency=3)
  │
  ├── 1. Create task_group_id
  ├── 2. For each task (up to max_concurrency concurrent):
  │      └── POST /a2a { method: "message/send", params: { message: { parts: [{text: prompt}] }, ... } }
  │          └── Returns a2a_task_id → stored in members[]
  │
  ├── 3. For each spawned task:
  │      └── SSE subscription via tasks/subscribe (or poll via tasks/get)
  │
  ├── 4. On each completion:
  │      ├── Update member status + output
  │      ├── Check failure_policy:
  │      │    ├── collect_all: continue until all terminal
  │      │    ├── fail_fast: cancel remaining on first failure
  │      │    └── majority_wins: continue until N/2+1 complete
  │      └── Check deadline
  │
  ├── 5. On timeout or all-terminal:
  │      └── Assemble results per fan_in strategy
  │
  └── 6. Return task_group with all member outputs
```

**This is internal orchestration.** `wait_all` is NOT a separate tool — it's the blocking behavior inside `forge_parallel`. The tool returns only when the group is resolved.

---

## 4. NON-NEGOTIABLE CONTROLS

### 4.1 One designated writer
Only the orchestration layer writes to the task group object. Individual agents cannot mutate group state.

### 4.2 Isolated context envelope
Each child receives an isolated context envelope. With `context_policy: "isolated"`, agents cannot see each other's outputs until fan-in. With `"shared_readonly"`, agents can read (but not write) a shared read-only bundle.

### 4.3 Cancellation propagation
If the parent task is canceled (`tasks/cancel`), the orchestration layer propagates cancellation to all child tasks. Each child gets `tasks/cancel` called on its `a2a_task_id`.

### 4.4 Dissent preservation
Individual failures remain visible in the result. Fan-in does NOT erase dissent. If agent B fails, its error is returned alongside agent A's success. The root agent sees all outcomes.

### 4.5 Identity + evidence + uncertainty + Δ anchor
Each output carries:
- `agent_id` — who produced this
- `evidence_layer` — L0/L1/L2/L3 (from AREP reality layers)
- `uncertainty` — epistemic tag (CLAIM/PLAUSIBLE/HYPOTHESIS/ESTIMATE/UNKNOWN)
- `delta_anchor` — hash of the agent's context at spawn time (ΔS ≤ 0 invariant)

### 4.6 No self-verdict
Parallel execution CANNOT issue its own constitutional verdict (SEAL/HOLD/VOID). Verdicts flow through the normal A-FORGE → arifOS route.

### 4.7 Irreversible actions excluded
`forge_parallel` operates in `observe` or `forge` mode only. Irreversible actions (SEAL, deploy, `rm -rf`) require the normal A-FORGE/F13 route outside the task group.

---

## 5. DELIVERY ORDER

| Phase | What | Depends on |
|---|---|---|
| 1 | Task-group schema + state machine | — |
| 2 | Parallel spawn with bounded concurrency (max_concurrency) | Phase 1 |
| 3 | Fan-in collection + timeout handling | Phase 2 |
| 4 | Cancellation propagation | Phase 2 |
| 5 | Context-bundle assembly (isolated vs shared_readonly) | Phase 3 |
| 6 | Δ receipts + audit trail (VAULT999) | Phase 3 |
| 7 | SSE multiplexing (replace polling with tasks/subscribe) | Phase 2 |
| 8 | GEOX–WELL–WEALTH integration test | Phase 7 |

---

## 6. CONSTITUTIONAL FLOOR MAPPING

| Floor | How forge_parallel complies |
|---|---|
| F1 AMANAH | Reversible-first. No irreversible actions in task group. Cancellation propagates. |
| F2 TRUTH | Each output carries evidence_layer. No merging without provenance. |
| F4 CLARITY | Each prompt must reduce entropy. Timeout prevents drift. |
| F7 HUMILITY | Timeout enforced. Uncertainty tag required on each output. |
| F9 ANTIHANTU | No consciousness claims in parallel agents. Standard tool behavior. |
| F11 AUDITABILITY | Δ receipts, VAULT999 logging, agent identity on every output. |
| F13 SOVEREIGN | Irreversible actions require normal F13 route. Task group cannot self-authorize. |

---

## 7. EXAMPLE

```json
// forge_parallel call
{
  "mode": "parallel",
  "tasks": [
    { "name": "geox-prospect", "prompt": "Evaluate prospect X in basin Y.", "target_organ": "geox" },
    { "name": "wealth-npv", "prompt": "Compute NPV for prospect X at 10% discount rate.", "target_organ": "wealth" },
    { "name": "well-readiness", "prompt": "Check operator readiness for field deployment.", "target_organ": "well" }
  ],
  "max_concurrency": 3,
  "failure_policy": "collect_all",
  "timeout_ms": 60000,
  "context_policy": "isolated",
  "fan_in": "root_synthesis",
  "session_id": "ses_abc123"
}
```

```json
// Response (returned after all agents complete or timeout)
{
  "task_group_id": "a2ag_20260711_a1b2c3",
  "status": "completed",
  "members": [
    {
      "agent_id": "pa_geox-prospect_0",
      "name": "geox-prospect",
      "a2a_task_id": "aaa-xyz123",
      "target_organ": "geox",
      "status": "TASK_STATE_COMPLETED",
      "output": { "text": "Prospect X shows 72% confidence...", "structured": null },
      "duration_ms": 4200,
      "evidence_layer": "L1",
      "uncertainty": "PLAUSIBLE",
      "delta_anchor": "sha256:abc..."
    },
    {
      "agent_id": "pa_wealth-npv_1",
      "name": "wealth-npv",
      "a2a_task_id": "aaa-xyz124",
      "target_organ": "wealth",
      "status": "TASK_STATE_COMPLETED",
      "output": { "text": "NPV = $4.2M at 10% discount...", "structured": { "npv": 4200000, "irr": 0.18 } },
      "duration_ms": 3100,
      "evidence_layer": "L2",
      "uncertainty": "ESTIMATE",
      "delta_anchor": "sha256:def..."
    },
    {
      "agent_id": "pa_well-readiness_2",
      "name": "well-readiness",
      "a2a_task_id": "aaa-xyz125",
      "target_organ": "well",
      "status": "TASK_STATE_FAILED",
      "output": null,
      "error": "WELL organ degraded — state.json stale since 2026-04-30",
      "duration_ms": 800,
      "evidence_layer": "L3",
      "uncertainty": "UNKNOWN",
      "delta_anchor": "sha256:ghi..."
    }
  ],
  "total_duration_ms": 4200,
  "delta_anchors": {
    "geox-prospect": "sha256:abc...",
    "wealth-npv": "sha256:def...",
    "well-readiness": "sha256:ghi..."
  }
}
```

Root agent receives raw outputs and synthesizes. The tool does NOT merge, summarize, or judge.

---

## 8. TELEMETRY

```yaml
epoch: aaa-parallelism-direction
evidence_layer: L4
autonomy_band: YELLOW
confidence: high
verdict: DRAFT_ONLY
witness: ChatGPT external instrument
audit_note: Prior "alignment is exact" claim CORRECTED. See AUDIT-a2a-primitives.md.
```

---

**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE**
