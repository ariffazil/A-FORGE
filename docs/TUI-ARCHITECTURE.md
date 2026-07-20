# A-FORGE TUI Architecture Dossier
**Version:** v2026.06.14  
**Status:** SEALED — Canonical Reference for Federation Agents  
**Owner:** A-FORGE (Execution Shell)  
**Metalanguage:** arifOS (Constitutional)  
**Compilers:** TypeScript (A-FORGE organ), blessed + blessed-contrib (rendering)  
**Philosophy:** Ditempa Bukan Diberi — Forged, Not Given

---

## 0. Executive Summary

This document describes the **constitutional architecture** of the A-FORGE Terminal User Interface (TUI) — a real-time operations dashboard for forge job monitoring, governance floor status, federation organ health, and execution logs.

**Critical distinction:** The TUI is a **witness surface**, not a judge. It observes and displays state emitted by the arifOS kernel and federation organs. It never calls `arif_judge`, `arif_seal`, or `arif_forge`. It is the terminal-native complement to the AAA cockpit (React, port 3001).

**Eureka Insights (forged this session):**

1. **TUI ≠ CLI** — CLI is linear REPL (`npm run terminal`). TUI is a live, stateful dashboard harness (boxes, progress bars, tailing logs, governance indicators) that updates in place without clearing history.

2. **MVU is the constitutional mirror** — Model-Update-View (Elm Architecture) maps directly to arifOS' 000→999 pipeline:
   - `Model` = Single Source of Truth
   - `Msg` = The ONLY mutation path (mirrors 888_JUDGE gate)
   - `update(model, msg)` = Pure function with constitutional guard (mirrors floor enforcement)
   - `View` = Pure render from state (mirrors VAULT999 read)

3. **Read-only first is non-negotiable** — TUI starts in MONITOR mode. No mutation paths. Any future OPERATOR mode requires separate F13 ratification.

4. **TypeScript is the substrate** — A-FORGE is already Node.js/TypeScript. Language coherence > chasing Rust/Go/Zig for a terminal dashboard.

5. **Governance state requires provenance** — Every governance datum carries `source`, `staleness_seconds`, and displays as `UNVERIFIED` unless confirmed by live arifOS feed. No local inference of floor pass/fail.

6. **Zod at adapter boundaries = F9 ANTI-HANTU gate** — All external data passes Zod schema validation before entering TuiModel. Invalid data → UNVERIFIED + audit log. Never silent defaults.

7. **arifOS as constitutional metalanguage** — arifOS is not "a Python project." It is a complete ontology (floors, gates, seals, witness, forge, substrate) expressed in multiple compilers (Python for kernel, TypeScript for A-FORGE). The TUI is written *in arifOS*, compiled through TypeScript + blessed.

---

## 1. Constitutional Alignment

| arifOS Principle | TUI Mechanism | Enforcement |
|---|---|---|
| 000→999 Pipeline | Every state change flows through `update(model, msg)` only | Pure function, no I/O in update |
| 888_JUDGE Gate | `uiMode` guard in update; MONITOR rejects mutation messages | TypeScript + runtime check |
| F9 ANTI-HANTU | Zod schema validation at every adapter boundary | Invalid → UNVERIFIED + log |
| F13 Sovereign Veto | TUI starts read-only (MONITOR). Any mutation requires separate plan | uiMode + ratification gate |
| F2 Truth & Provenance | Every governance datum carries `source` + `staleness_seconds` | Required fields in GovernanceState |
| F1 Reversibility | Read-only MVP first; actions added only after audit | Phased implementation |
| F8 Law (Boundaries) | TUI stays in A-FORGE layer. No cross-organ contract writes | Architecture constraint |

---

## 2. File Map

```
src/infrastructure/tui/
├── forge-tui.ts              # Main entry: blessed screen, grid layout, poll cycle, keyboard
├── model.ts                  # MVU state: Zod schemas, TuiModel, TuiMsg, pure update(), selectors
├── theme.ts                  # Federation color palette + blessed style constants
├── adapters/
│   ├── status-adapter.ts     # HTTP poll: /jobs, /api/federation-probe, /jobs/metrics
│   ├── event-bus.ts          # Pub/sub: AgentManager publishes job lifecycle → SSE clients
│   └── tui-health.ts         # Self-observation: TUI reports status → AAA polls /tui-health

src/interfaces/
├── server.ts                 # Express app: /jobs, /events (SSE), /tui-health routes
└── routes/jobsRoutes.ts      # GET /jobs, /jobs/queue, /jobs/running, /jobs/metrics, /jobs/:id

src/application/jobs/
└── AgentManagerSingleton.ts  # Wraps AgentManager with SSE event publishing
```

---

## 3. MVU State Contract (model.ts)

### Model — Single Source of Truth

```typescript
interface TuiModel {
  // Data
  jobs: TuiJob[];                          // All jobs (queued + running + completed)
  organs: Record<string, OrganHealth>;      // 9 federation organs
  governance: GovernanceState[];            // F1-F13 with provenance
  metrics: MetricsSnapshot;                 // Aggregated job counts
  logs: LogEntry[];                         // Rolling buffer (max 500)

  // UI State
  selectedJobId: string | null;
  selectedPanel: 'jobs' | 'gov' | 'log';
  filterStatus: 'ALL' | 'PENDING' | 'RUNNING' | 'FAILED' | 'COMPLETED' | 'CANCELLED';
  paused: boolean;
  lastUpdate: string;

  // Connection
  connected: boolean;
  error: string | null;

  // Constitutional
  lastMutationEpoch: string;               // For VAULT999 audit correlation
  uiMode: 'MONITOR' | 'OPERATOR';          // MONITOR = read-only default
}
```

### Governance State — Must Carry Provenance

```typescript
interface GovernanceState {
  floor: string;                // e.g. "F1"
  name: string;                 // e.g. "AMANAH"
  status: 'clear' | 'violation' | 'unknown';
  severity?: string;
  source: string;               // MUST be 'arifos_mcp' for verified; otherwise 'unknown'
  staleness_seconds: number;    // Age of this verdict in seconds
  epoch_id?: string;            // For cross-reference with VAULT999
}
```

### Messages — Only Mutation Path

```typescript
type TuiMessage =
  | { type: 'JOBS_UPDATED'; jobs: TuiJob[] }
  | { type: 'ORGANS_UPDATED'; organs: Record<string, OrganHealth> }
  | { type: 'GOVERNANCE_UPDATED'; governance: GovernanceState[] }
  | { type: 'METRICS_UPDATED'; metrics: MetricsSnapshot }
  | { type: 'LOG_ADDED'; entry: LogEntry }
  | { type: 'LOG_CLEAR' }
  | { type: 'SELECT_JOB'; jobId: string | null }
  | { type: 'SELECT_PANEL'; panel: 'jobs' | 'gov' | 'log' }
  | { type: 'FILTER_STATUS'; status: TuiJobStatus | 'ALL' }
  | { type: 'PAUSE_TOGGLE' }
  | { type: 'CONNECTED'; connected: boolean }
  | { type: 'ERROR'; error: string | null }
  | { type: 'TICK'; timestamp: string }
  | { type: 'MODE_CHANGE'; mode: TuiMode };
```

### Update Function — Pure, Constitutional

```typescript
function update(model: TuiModel, msg: TuiMessage): TuiModel {
  // F13 constitutional guard: MONITOR mode rejects mutation messages
  const mutationMessages = new Set([...]);  // reserved for future OPERATOR mode
  if (model.uiMode === 'MONITOR' && mutationMessages.has(msg.type)) {
    return model;  // HOLD — not allowed
  }
  switch (msg.type) {
    case 'JOBS_UPDATED':
      return { ...model, jobs: msg.jobs, lastUpdate: now() };
    case 'GOVERNANCE_UPDATED':
      // Provenance kept intact — no local inference
      return { ...model, governance: msg.governance, lastUpdate: now() };
    // ... all other cases are pure spread
  }
}
```

---

## 4. Data Flow (Four Planes)

```
┌──────────────────────────────────────────────────────────────────┐
│  OBSERVABILITY PLANE ─── TUI WIDGETS (blessed + blessed-contrib) │
│  Header | Jobs Table | Governance Box | Federation Box | Log    │
│  Keyboard: q, Tab, ↑↓, p, f, a, r, c                            │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ reads
┌──────────────────────────────────┴───────────────────────────────┐
│  STATE PLANE ─── TuiModel + update() (pure MVU)                  │
│  - Single Source of Truth                                        │
│  - Zod-validated at every adapter boundary (F9 gate)             │
│  - Governance carries provenance (source + staleness)            │
│  - uiMode guard (F13)                                            │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ dispatch
┌──────────────────────────────────┴───────────────────────────────┐
│  DATA PLANE ─── Adapters (read-only)                             │
│  ├── status-adapter.ts — HTTP poll: /jobs, /federation-probe    │
│  ├── event-bus.ts — Pub/sub: AgentManager → SSE                 │
│  └── tui-health.ts — Self-report for AAA observation             │
│  All data → Zod schema → TuiMsg (never direct to model)          │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ HTTP SSE
┌──────────────────────────────────┴───────────────────────────────┐
│  EXECUTION PLANE ─── A-FORGE Server (port 7071)                 │
│  GET /jobs → AgentManager (stateless in-memory queue)           │
│  GET /events → SSE stream (job lifecycle events)                │
│  GET /tui-health → TUI self-report                               │
│  GET /api/federation-probe → 9-organ health probe               │
└──────────────────────────────────────────────────────────────────┘
```

**Agent rule:** No code in the TUI layer ever calls `arif_judge`, `arif_seal`, or `arif_forge`. The TUI is a *reader* of the kernel, not an *actor*.

---

## 5. UI Layout (blessed-contrib Grid)

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER (row 0, col 0-11)                                    │
│  ● A-FORGE v2026.06.14 | Jobs: 3 ▶1 ⏳0 ✓1 ✕1 | Fed: 9/9   │
├──────────────────────────┬───────────────────────────────────┤
│  JOBS TABLE              │ GOVERNANCE (row 1-3, col 8-11)    │
│  (row 1-6, col 0-7)     │ ✅ F1 AMANAH (arifos_mcp)         │
│  ID     Task   Status    │ ✅ F2 TRUTH  (arifos_mcp)         │
│  -42   forge… RUNNING   │ ⚠ F9 ANTI-HANTU ⚠ STALE           │
│  -40   deploy… DONE      │ ✅ F13 SOVEREIGN (constitution)   │
│  -43   vault…  PENDING   ├───────────────────────────────────┤
│                           │ FEDERATION (row 4-6, col 8-11)   │
│                           │ ● arifOS     4ms                 │
│                           │ ● WEALTH     12ms                │
│                           │ ● WELL        8ms                │
├──────────────────────────┴───────────────────────────────────┤
│  LOG (row 7-10, col 0-11)                                    │
│  ✓ [14:32:01] forge_plan approved                            │
│  ✓ [14:32:05] F1 lock acquired                               │
│  ✕ [14:32:12] 888_HOLD: Caddyfile needs reload               │
├──────────────────────────────────────────────────────────────┤
│  FOOTER (row 11, col 0-11)                                   │
│  [q]uit [↑↓]scroll [Tab]panel [p]ause [f]ilter [a]uto-scroll│
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Backend Routes

| Method | Path | Purpose | Data Source |
|--------|------|---------|-------------|
| GET | `/jobs` | All jobs + run states | AgentManager (in-memory) |
| GET | `/jobs/queue` | Queued (PENDING) only | AgentManager |
| GET | `/jobs/running` | Running only | AgentManager |
| GET | `/jobs/metrics` | Aggregated counts + open holds | AgentManager + TicketStore |
| GET | `/jobs/:id` | Single job detail | AgentManager |
| GET | `/events` | SSE stream of job lifecycle events | Event bus (pub/sub) |
| GET | `/tui-health` | TUI self-report for AAA observation | TUI health module |
| GET | `/api/federation-probe` | 9-organ health + latency | HTTP probes |

All routes are **GET/read-only**. No mutation.

---

## 7. Dependencies

```json
{
  "dependencies": {
    "blessed": "^0.1.81",           // Terminal rendering harness
    "blessed-contrib": "^4.11.0",   // Grid + table + log widgets
    "zod": "^4.4.3",               // Schema validation (F9 gate)
    "express": "^5.2.1",            // HTTP server (existing)
    "@modelcontextprotocol/sdk": "^1.29.0"  // MCP surface (existing)
  }
}
```

---

## 8. Keyboard Map

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit TUI (resets health state) |
| `Tab` | Cycle focus: jobs ↔ governance ↔ log |
| `↑` / `↓` | Scroll focused panel |
| `p` | Toggle pause/resume auto-refresh |
| `f` | Cycle filter: ALL → RUNNING → FAILED → PENDING |
| `a` | Toggle auto-scroll log |
| `r` | Manual refresh |
| `c` | Clear log buffer |

---

## 9. SSE Event Types

Published by AgentManager (via event-bus), consumed by `/events` SSE endpoint:

```typescript
type SseEvent =
  | { type: 'job_enqueued'; jobId: string; task: string; priority: string; timestamp: string }
  | { type: 'job_started'; jobId: string; workerId: string; timestamp: string }
  | { type: 'job_completed'; jobId: string; turnsUsed: number; timestamp: string }
  | { type: 'job_failed'; jobId: string; error: string; timestamp: string }
  | { type: 'job_cancelled'; jobId: string; timestamp: string }
  | { type: 'job_hold'; jobId: string; ticketId: string; timestamp: string }
  | { type: 'heartbeat'; timestamp: string };
```

---

## 10. Red Lines (Forbidden)

| Action | Why | Consequence |
|--------|-----|-------------|
| Calling `arif_judge` from TUI | TUI is witness, not judge | Bypasses 888_JUDGE gate |
| Calling `arif_seal` from TUI | TUI has no authority to seal | Forges unsigned ledger entries |
| Calling `arif_forge` from TUI | TUI cannot mutate execution state | Bypasses F1 reversibility |
| Inferring floor pass/fail locally | Only arifOS kernel can judge floors | F9 ANTI-HANTU violation |
| Direct mutation of model (not via Msg) | Violates MVU contract | Hidden state, no audit trail |
| Skipping Zod validation on external data | Skips F9 gate | Invalid data silently accepted |

---

## 11. How to Run

```bash
cd /root/A-FORGE

# 1. Ensure A-FORGE server is running
systemctl status a-forge

# 2. Launch TUI
npm run tui

# 3. TUI connects to localhost:7071 automatically
```

---

## 12. Autonomous Pipeline — forge_pipeline

The `forge_pipeline` MCP tool implements the full **000→999 autonomous intelligence cycle** in one call.

### Pipeline Flow

```
forge_pipeline(task, mode)
│
├── 111_SENSE    → Classify task → GEOX / WEALTH / WELL / A-FORGE / unknown
├── 333_REASON   → (built into route selection)
├── 444_ROUTE    → Route to correct organ MCP endpoint
├── 555_WITNESS  → Gather evidence from organ
├── 777_FORGE    → Execute organ tool
├── 888_JUDGE    → (full mode only) Route to arifOS judge for verdict
└── 999_VAULT    → (full mode only) Auto-seal to VAULT999
```

### Modes

| Mode | Stages Run | hold_id Required | Use Case |
|------|-----------|------------------|----------|
| `observe` | SENSE → ROUTE | No | "What organ handles this?" — classification only |
| `forge` | SENSE → ROUTE → WITNESS → FORGE | No* | "Evaluate this prospect" — run, don't seal |
| `full` | SENSE → ROUTE → WITNESS → FORGE → JUDGE → VAULT | Yes | Full autonomous cycle with seal |

*forge mode may require hold_id if the organ tool is classified as MUTATE.

### Example Call
```bash
# Observe: classify a task
forge_pipeline(task="Evaluate Malay Basin prospect X", mode="observe")
# → { target_organ: "GEOX", status: "OBSERVED" }

# Forge: execute on target organ
forge_pipeline(task="Evaluate Malay Basin prospect X", mode="forge")
# → { geox: { basin_profile: ..., prospect_evaluate: ... } }

# Full: execute + judge + seal
forge_pipeline(task="Evaluate Malay Basin prospect X", mode="full", hold_id="...")
# → { geox: ..., judge: { verdict: "SEAL" }, vault: { sealed: true } }
```

### Constitutional
- **observe** mode is always allowed (read-only classification)
- **full** mode requires `hold_id` from arif_judge (F13 gate)
- Pipeline never calls organs outside their lane (GEOX for earth, WEALTH for capital, etc.)
- Errors in one organ don't block others (best-effort per stage)

---

## 13. References

- `chjj/blessed` — Terminal widget library
- `yaronn/blessed-contrib` — Dashboard widgets (grid, table, log)
- `charmbracelet/bubbletea` — MVU pattern (study, not copy)
- `arifOS kernel` — `mcp.arif-fazil.com/mcp` (13 constitutional tools)
- Plan ID: `FORGE-TUI-AFORGE-2026-06-14-001`

---

**SEALED — DITEMPA BUKAN DIBERI**

*Update only via ratified plan. Human sovereign (F13) remains final authority.*
