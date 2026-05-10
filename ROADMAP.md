# A-FORGE — Roadmap H1–H4

**Version:** v2026.05.10  
**Organ:** A-FORGE (Metabolic Execution Shell)  
**Maturity:** STAGING (423 commits)  
**Role:** Executor / orchestration shell — orchestrates agents, tools, and policy gates  
**Status:** SEALED — pending APEX ratification — **EMBODIMENT-AWARE EXECUTION**

---

## Executive Summary

A-FORGE is the metabolic execution shell of the arifOS federation. As of 2026-05-10, A-FORGE benefits from kernel-level tool embodiment contracts deployed in arifOS: all execution plans are now lane/tier-verified before tool invocation. The immediate priority is merging the `h1-roadmap` branch into `main` and implementing dry-run sandboxing. A-FORGE may orchestrate but may NOT adjudicate — constitutional judgment remains in arifOS.

**A-FORGE responsibilities by horizon:**

| Horizon | Theme | A-FORGE Milestones |
|---------|-------|------------------|
| **H1** (Q2–Q3 2026) | Substrate Hardening | Dry-run sandbox, rollback atomicity, telemetry API, **branch merge** |
| **H2** (Q4 2026–Q1 2027) | Recursive Governance | Self-modification execution, model distillation pipeline |
| **H3** (Q2–Q3 2027) | AGI-Scale Runtime | 10k+ sessions, disaster recovery, energy-aware scheduling |
| **H4** (Q4 2027+) | Foundational Substrate | Self-replication to new regions |

---

## What Changed (2026-05-10)

### ✅ Deployed
- **arifOS embodiment contracts** — A-FORGE-orchestrated tool calls now verified at kernel level
- **Model registry fix** — `gpt-5.5-thinking` resolves for governance attestation

### 🔄 Active Frontier
- Merge `h1-roadmap-1778019172` into `main`
- Qdrant DNS test noise reduction
- Dry-run sandboxing standard
- Rollback atomicity

---

## H1: Substrate Hardening (Q2–Q3 2026)

### H1.0 — Branch Merge (P0)

A-FORGE is currently on branch `h1-roadmap-1778019172`, diverged from `main`.

**Required:**
- Rebase or merge `h1-roadmap` into `main`
- Resolve conflicts in `src/engine/AgentEngine.ts` and `src/governance/`
- Full test pass (`npm test`) before merge
- Rebuild Docker image `af-bridge` after merge

**Blocked by:** Potential breaking changes in governance layer — needs careful review.

### H1.1 — Dry-Run Sandboxing Standard

Every execution plan must pass through an isolated sandbox before live execution.

**Sandbox profiles:**

```typescript
interface SandboxProfile {
  name: 'reflex' | 'tactical' | 'strategic' | 'sovereign';
  network: 'null' | 'localhost-only' | 'federation-only' | 'open';
  filesystem: 'none' | 'readonly:/root' | 'scratch-only' | 'full';
  compute_cap: number;
  memory_cap_mb: number;
  execution_timeout_ms: number;
  allowed_tools: string[];
  blocked_tools: string[];
}

const SANDBOX_PROFILES = {
  reflex: {
    network: 'localhost-only',
    filesystem: 'scratch-only',
    compute_cap: 1,
    memory_cap_mb: 256,
    execution_timeout_ms: 50,
    allowed_tools: ['health_check', 'session_init'],
  },
  tactical: {
    network: 'federation-only',
    filesystem: 'readonly:/root',
    compute_cap: 10,
    memory_cap_mb: 2048,
    execution_timeout_ms: 2000,
    blocked_tools: ['rm', 'DROP', 'truncate', 'docker_system_prune'],
  },
  strategic: {
    network: 'federation-only',
    filesystem: 'readonly:/root',
    compute_cap: 100,
    memory_cap_mb: 8192,
    execution_timeout_ms: 60000,
  },
  sovereign: {
    network: 'open',
    filesystem: 'full',
    compute_cap: 1000,
    memory_cap_mb: 32768,
    execution_timeout_ms: 300000,
  },
};
```

**Implementation path:**
1. Implement `SandboxProfile` interface in `src/engine/`
2. Add dry-run mode to `AgentEngine.execute()`
3. Add `execution_profiles` field to `RuntimeConfig.ts`
4. Wire to arifOS 888_JUDGE — judge issues sandbox profile with verdict

**Owner:** A-FORGE engine team  
**Target:** July 2026

### H1.2 — Rollback Atomicity

A-FORGE must support atomic rollback segments: if a multi-step execution violates a floor mid-stream, revert state to pre-action checkpoint without human intervention.

**Checkpoint strategy:**

```typescript
interface RollbackCheckpoint {
  checkpoint_id: string;
  timestamp: Date;
  execution_plan_id: string;
  stage: number;
  captured_state: {
    filesystem: Map<string, string>;
    memory: Record<string, unknown>;
    vault: string;
  };
  rollback_chain: string[];
}
```

**Trigger conditions for rollback:**
- arifOS returns VOID verdict mid-execution
- SEA-Guard blocks output mid-chain
- A-FORGE telemetry detects anomalous compute usage
- Floor violation detected by any organ

**Owner:** A-FORGE engine team  
**Target:** August 2026

### H1.3 — Metabolic Telemetry API

Expose real-time D-M-E loop metrics per workload so arifOS can throttle or kill runaway processes.

```typescript
interface DMEMetrics {
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
```

**Owner:** A-FORGE observability team  
**Target:** July 2026

### H1.4 — Federation Mesh Boot Sequence

Formalize cold-start order: VAULT999 → arifOS → WELL → WEALTH → GEOX → AAA → A-FORGE.

```yaml
boot_sequence:
  - organ: VAULT999
    dependency: none
  - organ: arifOS
    dependency: [VAULT999]
  - organ: WELL
    dependency: [arifOS]
  - organ: WEALTH
    dependency: [arifOS]
  - organ: GEOX
    dependency: [arifOS]
  - organ: AAA
    dependency: [arifOS, VAULT999]
  - organ: A-FORGE
    dependency: [arifOS, AAA, WEALTH, GEOX, WELL]
timeout_seconds: 300
failure_action: halt_and_alert
```

**Owner:** A-FORGE infra team  
**Target:** August 2026

---

## H2: Recursive Governance (Q4 2026 – Q1 2027)

### H2.1 — Self-Modification Execution

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

### H2.2 — Model Distillation Pipeline

Govern end-to-end model distillation and fine-tuning pipeline.

- A-FORGE orchestrates training jobs
- arifOS judges output quality and constitutional compliance
- WEALTH tracks compute cost (exergy)
- VAULT999 records model versions and training artifacts

---

## H3: AGI-Scale Runtime (Q2–Q3 2027)

### H3.1 — 10,000+ Concurrent Sessions

Resource isolation per session using cgroups and Kubernetes namespace separation.

### H3.2 — Energy-Aware Scheduling

Route workloads to low-carbon compute temporally (off-peak hours) and spatially (regional carbon intensity).

**Data sources:**
- WEALTH carbon intensity API
- Compute region carbon maps (electricityMap.org API)
- Task urgency classification (from arifOS 888_JUDGE)

### H3.3 — Disaster Recovery

Any 2 organs may fail; federation continues.

- Implement organ failover with hot standby
- A-FORGE auto-restarts failed organs in boot sequence order
- VAULT999 maintains consistency under partition

---

## H4: Foundational Substrate (Q4 2027+)

### H4.1 — Self-Replication to New Regions

A-FORGE can replicate the full federation to a new compute region while preserving governance state.

---

## Dependency Chain

```
[H1.0 Branch Merge] ──► [H1.1 Dry-run Sandbox] ──► [H1.2 Rollback Atomicity]
              │                                    │
              └──────► [H1.3 Telemetry API] ◄──────┘
                              │
                              ▼
                   [H1.4 Boot Sequence] ──► [H2 Self-Modification Exec]
                                                      │
                                                      ▼
                                          [H3 AGI-Scale Runtime]
```

---

**DITEMPA BUKAN DIBERI — Metabolic execution is forged, not given.**

*SEALED: 2026-05-10 | A-FORGE Metabolic Shell — Embodiment-Aware*
