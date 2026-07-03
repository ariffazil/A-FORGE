# AUTOMATION GOVERNANCE INTELLIGENCE — MCP Federation Trust Substrate

> **FORGED: 2026-07-03**
> **Verdict: PROCEED_TO_SURFACE_GUARD_BUILD**
> **Confidence: HIGH**

---

## What This Is

Three modules that answer three questions about MCP federation trust:

| # | Question | Module | File |
|---|----------|--------|------|
| Q1 | Can errors tell an agent whether it made a bad call or the server broke? | **Error Classifier** | `src/domain/governance/error-classifier.ts` |
| Q2 | Can we track progress and cancel long chains, gated by human readiness? | **Chain Orchestrator** | `src/domain/orchestration/chain-orchestrator.ts` |
| Q3 | Can we detect tool surface drift before it breaks the federation? | **MCP Surface Guard** | `src/domain/governance/mcp-surface-guard.ts` |

**Supporting files:**
- `src/domain/orchestration/geox-error-envelope.ts` — GEOX reference implementation
- `config/mcp-surface-guard.json` — Surface Guard config with required tools per organ

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ARIF (F13 SOVEREIGN)                  │
│                    AAA Cockpit (:3001)                   │
│                    Progress Display + Cancel             │
└────────────┬───────────────────────────────┬────────────┘
             │                               │
    ┌────────▼────────┐           ┌──────────▼──────────┐
    │  WELL Readiness │           │  Chain Orchestrator  │
    │  (Step 0 Gate)  │           │  (Q2: Progress +     │
    │  GREEN/YELLOW/  │           │   Cancellation)      │
    │  RED → HOLD     │           │                      │
    └────────┬────────┘           └──────────┬───────────┘
             │                               │
    ┌────────▼────────────────────────────────▼───────────┐
    │              MCP Surface Guard (Q3)                  │
    │              Schema Fingerprinting + Drift Detection │
    │              TTL: 60s / Snapshot: 5min               │
    │              On Drift: HOLD + 888_HOLD               │
    └────────┬────────────────────────────────┬───────────┘
             │                                │
    ┌────────▼────────┐           ┌──────────▼──────────┐
    │  MCP Tool Calls │           │   Error Classifier   │
    │  (per organ)    │           │   (Q1: 5 error       │
    │                 │           │    classes + recovery │
    │                 │           │    strategy)          │
    └────────┬────────┘           └──────────┬───────────┘
             │                               │
    ┌────────▼────────────────────────────────▼───────────┐
    │               Federation Organs                      │
    │  arifOS :8088 │ GEOX :8081 │ WEALTH :18082         │
    │  A-FORGE :7072│ WELL :18083│ AAA :3001             │
    └─────────────────────────────────────────────────────┘
```

---

## Q1: Error Classifier

### The Problem
MCP has two error channels: protocol errors (JSON-RPC codes) and tool execution errors (`isError: true`). But there's no sub-classification within execution errors. Agents can't distinguish "I sent bad input" from "the server's database is down."

### The Solution
Five error classes with explicit recovery strategies:

| Error Class | Recoverability | Agent Action |
|-------------|---------------|--------------|
| `BAD_INPUT_SHAPE` | `AGENT_CAN_RETRY` | Fix params, retry |
| `BAD_INPUT_VALUE` | `AGENT_CAN_RETRY` | Fix values, retry |
| `DOWNSTREAM_FAILURE` | `AGENT_CAN_ROUTE` or `ESCALATE` | Try different organ, or escalate |
| `RESOURCE_EXHAUSTED` | `RETRY_SAME_LATER` | Backoff, retry |
| `INTERNAL_ERROR` | `ESCALATE_TO_888_HOLD` | Log + hold + human |

### Usage (every organ)

```typescript
import { badInputShape, classifyUnknown } from '../governance/error-classifier';

// In your tool handler:
try {
  if (!args.well_name) {
    return badInputShape('well_name is required', {
      missing_fields: ['well_name'],
      source_tool: 'geox_well_ingest',
      source_organ: 'geox',
    });
  }
  // ... actual logic
} catch (err) {
  return classifyUnknown(err, { source_tool: 'geox_well_ingest', source_organ: 'geox' });
}
```

### MCP Wire Format

```json
{
  "isError": true,
  "structuredContent": {
    "error_class": "BAD_INPUT_SHAPE",
    "recoverability": "AGENT_CAN_RETRY",
    "message": "well_name is required for well log operations",
    "suspected_layer": "input_validation",
    "severity": "RECOVERABLE",
    "missing_fields": ["well_name"],
    "next_action": "Fix input shape and retry",
    "source_tool": "geox_well_ingest",
    "source_organ": "geox",
    "epistemic_label": "OBS",
    "timestamp": "2026-07-03T05:30:00Z"
  }
}
```

---

## Q2: Chain Orchestrator

### The Problem
MCP Tasks (SEP-2663) give per-tool-call async primitives. But federation workflows span multiple tools across multiple organs. No one tracks aggregate progress or provides a cancel button for the whole chain. And no one checks if the human is ready before starting.

### The Solution
An application-layer orchestrator that wraps MCP tool calls into governed chains:

```
Chain: "Audit GEOX and fix what you find"
  Step 0: WELL readiness check → GREEN (proceed)
  Step 1: arif_organ_attest(geox) → completed
  Step 2: geox_surface_status() → completed  
  Step 3: geox_health_check() → running (progress: 67%)
  Step 4: arif_judge(SEAL) → pending
  
  [Cancel] button available at every step
```

### Features

| Feature | Mechanism |
|---------|-----------|
| **WELL pre-gate** | `wellChecker()` runs before step 1. HOLD/BLOCK stops chain. |
| **Progress tracking** | `progress_percent` + `progress_message` updated per step. |
| **Cancellation** | `chain.cancel(reason)` — cooperative, takes effect at next step boundary. |
| **MCP progress tokens** | Each step gets a `progressToken` in `_meta` for MCP-level progress. |
| **Error recovery** | Failed steps classified via ErrorClassifier. `AGENT_CAN_RETRY` retries; `ESCALATE` stops chain. |
| **Pre-built chains** | `auditChain()` and `buildChain()` for common patterns. |

### Usage

```typescript
import { ChainOrchestrator, auditChain } from './chain-orchestrator';

const chain = auditChain({
  requested_by: 'opencode',
  target_organ: 'geox',
});

const orchestrator = new ChainOrchestrator(
  chain,
  async (step) => {
    // Execute MCP tool call
    return await mcpClient.callTool(step.tool, step.arguments);
  },
  async () => {
    // WELL readiness check
    const result = await wellReadiness();
    return { verdict: result.action, score: result.score, ... };
  },
  (state) => {
    // Progress callback — sends to AAA cockpit
    console.log(`${state.progress_percent}%: ${state.progress_message}`);
  }
);

// Run
const finalState = await orchestrator.run();

// Cancel from cockpit
orchestrator.cancel('User pressed cancel');
```

---

## Q3: MCP Surface Guard

### The Problem
MCP's `listChanged` notification tells you "something changed" but not WHAT changed. Schema-level drift (inputSchema mutation) doesn't trigger notifications at all. A server can silently change a tool's schema — the "rug pull" attack — and the client won't know until a tool call fails unexpectedly.

### The Solution
Client-side schema fingerprinting with TTL-based monitoring:

| Component | What It Does |
|-----------|-------------|
| `fingerprintSchema()` | SHA-256 of canonical JSON schema. Stable, deterministic. |
| `fingerprintTool()` | Hash of schema + description. Pinned at session init. |
| `SurfaceGuardStore` | In-memory store of pinned snapshots per organ. |
| `detectDrift()` | Compares pinned vs current. Returns typed drift events. |
| `checkOrgan()` | Per-organ drift check against pinned snapshot. |
| `checkAll()` | Federation-wide check → PASS / DRIFT_DETECTED / HOLD. |

### Drift Event Types

| Drift Type | Severity | Action |
|-----------|----------|--------|
| `TOOL_REMOVED` | CRITICAL | 888_HOLD — tool disappeared |
| `SCHEMA_CHANGE` | HIGH | 888_HOLD — inputSchema mutated |
| `TOOL_ADDED` | MEDIUM | Info — new tool appeared |
| `DESCRIPTION_CHANGE` | LOW | Warning — description changed |

### Config

```json
{
  "check_interval_ms": 60000,
  "snapshot_ttl_ms": 300000,
  "enforce_hold": true,
  "organs": [
    { "id": "arifos", "url": "http://localhost:8088", "required_tools": ["arif_init", "arif_observe", ...] },
    { "id": "geox", "url": "http://localhost:8081", "required_tools": ["geox_well_ingest", ...] },
    ...
  ]
}
```

### How It Works

```
Session Init:
  1. Fetch tools/list from each organ
  2. Fingerprint every tool
  3. Pin snapshots in SurfaceGuardStore
  
Every 60s:
  4. Re-fetch tools/list
  5. Compare against pinned
  6. Any drift → HOLD + log to VAULT999
  
Every tool call:
  7. Quick hash check of target tool's schema
  8. If delta → HOLD before execution
```

---

## Integration Roadmap

| Phase | What | Where | Status |
|-------|------|-------|--------|
| **P0** | Error Classifier module | `A-FORGE/src/domain/governance/` | ✅ BUILT |
| **P0** | Surface Guard module | `A-FORGE/src/domain/governance/` | ✅ BUILT |
| **P0** | Chain Orchestrator | `A-FORGE/src/domain/orchestration/` | ✅ BUILT |
| **P0** | GEOX reference impl | `A-FORGE/src/domain/orchestration/` | ✅ BUILT |
| **P0** | Surface Guard config | `A-FORGE/config/` | ✅ BUILT |
| **P1** | Wire GEOX tools to use ErrorClassifier | GEOX repo | TODO |
| **P1** | Wire Surface Guard into arifOS heartbeat | arifOS runtime | TODO |
| **P1** | Wire Chain Orchestrator into AAA cockpit | AAA control plane | TODO |
| **P2** | MCP progress token propagation | A-FORGE MCP tools | TODO |
| **P2** | Drift events → VAULT999 seal chain | arifOS kernel | TODO |
| **P3** | Per-call schema fingerprint check | A-FORGE MCP ingress | TODO |

---

## Constitutional Alignment

| Floor | How These Modules Hold It |
|-------|--------------------------|
| F1 AMANAH | Every chain step is reversible or gated. Surface snapshots are pinned before drift. |
| F2 TRUTH | Errors carry epistemic labels (OBS/DER). Drift is measured, not assumed. |
| F4 CLARITY | Structured errors reduce entropy. Progress is visible. |
| F6 MARUAH | WELL readiness checks human state before chain starts. |
| F8 LAW | Schema boundaries are constitutional. Drift = HOLD. |
| F11 AUDIT | Every error, drift event, and chain step leaves a trace. |
| F13 SOVEREIGN | Irreversible drift = 888_HOLD. Arif decides. |

---

## What This Enables (A2A)

When all three modules are live:

1. **Trustworthy Agent Cards** — Agents know their own tool schemas (Q3). Self-knowledge is honest.
2. **Intelligent Delegation Recovery** — Agents distinguish "my fault" from "server's fault" (Q1). Self-correction works.
3. **Human-Gated Chains** — Long workflows start only when the human is ready, and can be cancelled (Q2). Safe autonomy.
4. **Federation Self-Healing** — Drift is caught before it breaks, errors are classified before they cascade, chains are gated before they run.

**This is the governance intelligence substrate. Not just tools that talk — agents that trust, correct, and regulate each other under a shared constitution.**

---

*DITEMPA BUKAN DIBERI*
