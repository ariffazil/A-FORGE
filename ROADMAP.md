# A-FORGE — Roadmap H1–H4

**Version:** v2026.05.06  
**Organ:** A-FORGE (Metabolic Execution Shell)  
**Maturity:** STAGING (423 commits)  
**Role:** Executor / orchestration shell — orchestrates agents, tools, and policy gates  
**Status:** SEALED — pending APEX ratification

---

## Executive Summary

A-FORGE is the metabolic execution shell of the arifOS federation. It orchestrates agents, tools, and policy gates. For H1–H4, A-FORGE's primary responsibilities are: autonomous D-M-E loop operation, dry-run sandboxing, atomic rollback, and federation boot sequencing.

**A-FORGE responsibilities by horizon:**

| Horizon | Theme | A-FORGE Milestones |
|---------|-------|------------------|
| **H1** (Q2–Q3 2026) | Substrate Hardening | Dry-run sandbox, rollback atomicity, telemetry API, boot sequence |
| **H2** (Q4 2026–Q1 2027) | Recursive Governance | Self-modification execution, model distillation pipeline |
| **H3** (Q2–Q3 2027) | AGI-Scale Runtime | 10k+ sessions, disaster recovery, energy-aware scheduling |
| **H4** (Q4 2027+) | Foundational Substrate | Self-replication to new regions |

---

## H1: Substrate Hardening (Q2–Q3 2026)

### H1.1 Dry-Run Sandboxing Standard

Every execution plan must pass through an isolated sandbox before live execution.

**Sandbox profiles:**

```typescript
// SandboxProfile — execution_plan_sandbox.ts
interface SandboxProfile {
  name: 'reflex' | 'tactical' | 'strategic' | 'sovereign';
  network: 'null' | 'localhost-only' | 'federation-only' | 'open';
  filesystem: 'none' | 'readonly:/root' | 'scratch-only' | 'full';
  compute_cap: number;         // CPU credits (relative units)
  memory_cap_mb: number;
  execution_timeout_ms: number;
  allowed_tools: string[];      // Whitelist of tool names
  blocked_tools: string[];      // Blacklist override
}

// Default profiles
const SANDBOX_PROFILES: Record<SandboxProfile['name'], SandboxProfile> = {
  reflex: {
    name: 'reflex',
    network: 'localhost-only',
    filesystem: 'scratch-only',
    compute_cap: 1,
    memory_cap_mb: 256,
    execution_timeout_ms: 50,
    allowed_tools: ['health_check', 'session_init'],
    blocked_tools: [],
  },
  tactical: {
    name: 'tactical',
    network: 'federation-only',
    filesystem: 'readonly:/root',
    compute_cap: 10,
    memory_cap_mb: 2048,
    execution_timeout_ms: 2000,
    allowed_tools: [],  // All federation MCP tools
    blocked_tools: ['rm', 'DROP', 'truncate', 'docker_system_prune'],
  },
  strategic: {
    name: 'strategic',
    network: 'federation-only',
    filesystem: 'readonly:/root',
    compute_cap: 100,
    memory_cap_mb: 8192,
    execution_timeout_ms: 60000,
    allowed_tools: [],  // All + explicit approval required
    blocked_tools: [],
  },
  sovereign: {
    name: 'sovereign',
    network: 'open',  // F13 veto path — operator override
    filesystem: 'full',
    compute_cap: 1000,
    memory_cap_mb: 32768,
    execution_timeout_ms: 300000,
    allowed_tools: [],  // All tools — sovereign override
    blocked_tools: [],
  },
};
```

**Implementation path:**
1. Implement `SandboxProfile` interface in `src/engine/`
2. Add dry-run mode to `AgentEngine.execute()` — runs plan in sandbox first
3. Add `execution_profiles` field to `RuntimeConfig.ts`
4. Wire to arifOS 888_JUDGE — judge issues sandbox profile with verdict

**Owner:** A-FORGE engine team  
**Target:** July 2026

### H1.2 Rollback Atomicity

A-FORGE must support atomic rollback segments: if a multi-step execution violates a floor mid-stream, revert state to pre-action checkpoint without human intervention.

**Checkpoint strategy:**

```typescript
// RollbackCheckpoint — state_manager.ts
interface RollbackCheckpoint {
  checkpoint_id: string;         // UUID
  timestamp: Date;
  execution_plan_id: string;
  stage: number;                 // Which step we're at
  captured_state: {
    filesystem: Map<string, string>;  // path → hash of file contents
    memory: Record<string, unknown>;  // Agent memory snapshot
    vault: string;                    // VAULT999 last hash
  };
  rollback_chain: string[];     // Previous checkpoint_ids
}

interface ExecutionSegment {
  steps: ExecutionStep[];
  checkpoint_frequency: 'every-step' | 'every-n-steps' | 'manual';
  rollback_on_violation: boolean;
}
```

**Trigger conditions for rollback:**
- arifOS returns VOID verdict mid-execution
- SEA-Guard blocks output mid-chain
- A-FORGE telemetry detects anomalous compute usage
- Floor violation detected by any organ

**Implementation path:**
1. Add `CheckpointManager` class in `src/engine/`
2. Implement `createCheckpoint()`, `restoreCheckpoint()`, `listCheckpoints()`
3. Add rollback trigger to `GovernanceBridge`
4. Add to CI: test rollback with simulated floor violations

**Owner:** A-FORGE engine team  
**Target:** August 2026

### H1.3 Metabolic Telemetry API

Expose real-time D-M-E loop metrics per workload so arifOS can throttle or kill runaway processes.

**Metrics to expose:**

```typescript
// D-M-E Telemetry — dme_telemetry.ts
interface D MEMetrics {
  workload_id: string;
  phase: 'DETECT' | 'METABOLIZE' | 'EXECUTE' | 'IDLE';
  detect_latency_ms: number;
  metabolize_latency_ms: number;
  execute_latency_ms: number;
  total_cycle_ms: number;
  throughput_tokens_per_sec: number;
  memory_usage_mb: number;
  compute_units: number;
  error_count: number;
  error_rate: number;
  floor_violations_detected: number;
  rollback_count: number;
}

interface TelemetryAPI {
  // GET /api/v1/telemetry/dme — all workloads
  // GET /api/v1/telemetry/dme/:workload_id — specific workload
  // POST /api/v1/telemetry/throttle — arifOS sends throttle/kill signal
}
```

**Owner:** A-FORGE observability team  
**Target:** July 2026

### H1.4 Federation Mesh Boot Sequence

Formalize cold-start order: VAULT999 → arifOS → WELL → WEALTH → GEOX → AAA → A-FORGE.

**Boot order specification:**

```yaml
# federation_boot_order.yaml
boot_sequence:
  - organ: VAULT999
    health_endpoint: /health
    dependency: none
    wait_for: startup_complete
  
  - organ: arifOS
    health_endpoint: /health
    dependency: [VAULT999]
    wait_for: vault_seal_reachable
  
  - organ: WELL
    health_endpoint: /health
    dependency: [arifOS]
    wait_for: constitutional_kernel_ready
  
  - organ: WEALTH
    health_endpoint: /health
    dependency: [arifOS]
    wait_for: constitutional_kernel_ready
  
  - organ: GEOX
    health_endpoint: /health
    dependency: [arifOS]
    wait_for: constitutional_kernel_ready
  
  - organ: AAA
    health_endpoint: /health
    dependency: [arifOS, VAULT999]
    wait_for: governance_ready
  
  - organ: A-FORGE
    health_endpoint: /health
    dependency: [arifOS, AAA, WEALTH, GEOX, WELL]
    wait_for: all_organs_healthy

timeout_seconds: 300  # 5 minutes total
failure_action: halt_and_alert
```

**Owner:** A-FORGE infra team  
**Target:** August 2026

---

## H2: Recursive Governance (Q4 2026 – Q1 2027)

### H2.1 Self-Modification Execution

Execute self-modification proposals generated by AAA, judged by arifOS, recorded by VAULT999.

```
Pipeline:
AAA proposes (via arif_forge_execute) →
  arifOS F14 judgment →
  A-FORGE executes modification →
  VAULT999 records full diff →
  Health check →
  Continue or rollback
```

### H2.2 Model Distillation Pipeline

Govern end-to-end model distillation and fine-tuning pipeline.

- A-FORGE orchestrates training jobs
- arifOS judges output quality and constitutional compliance
- WEALTH tracks compute cost (exergy)
- VAULT999 records model versions and training artifacts

---

## H3: AGI-Scale Runtime (Q2–Q3 2027)

### H3.1 10,000+ Concurrent Sessions

Resource isolation per session using cgroups and Kubernetes namespace separation.

### H3.2 Energy-Aware Scheduling

Route workloads to low-carbon compute temporally (off-peak hours) and spatially (regional carbon intensity).

**Data sources:**
- WEALTH carbon intensity API
- Compute region carbon maps ( electricityMap.org API)
- Task urgency classification (from arifOS 888_JUDGE)

### H3.3 Disaster Recovery

Any 2 organs may fail; federation continues.

- Implement organ failover with hot standby
- A-FORGE auto-restarts failed organs in boot sequence order
- VAULT999 maintains consistency under partition

---

## H4: Foundational Substrate (Q4 2027+)

### H4.1 Self-Replication to New Regions

A-FORGE can replicate the full federation to a new compute region while preserving governance state.

---

## Immediate Actions (This Week)

- [ ] **Sandbox profile design** — Draft `SandboxProfile` interface
- [ ] **Checkpoint manager** — Design `RollbackCheckpoint` schema
- [ ] **Boot sequence YAML** — Draft `federation_boot_order.yaml`

---

## Dependency Chain

```
[H1.1 Dry-run Sandbox] ──► [H1.2 Rollback Atomicity]
         │                            │
         └──────► [H1.3 Telemetry API]
                              │
         ┌────────────────────┘
         ▼
[H1.4 Boot Sequence] ──► [H2 Self-Modification Exec]
                                    │
                                    ▼
                           [H3 AGI-Scale Runtime]
```

---

**DITEMPA BUKAN DIBERI — Metabolic execution is forged, not given.**

*SEALED: 2026-05-06 | A-FORGE Metabolic Shell*
