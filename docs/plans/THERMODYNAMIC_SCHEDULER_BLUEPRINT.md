# Thermodynamic Scheduler Blueprint
## Entropy-Based Resource Allocation for Multi-Agent Swarms

> **Status:** IMPLEMENTATION BLUEPRINT v1.0  
> **Epoch:** 2026-04-19  
> **Priority:** P1 — Sprint After Code Mode  
> **ETA:** 3 weeks

---

## 1. Problem Statement

As personal intelligence systems expand from singular assistants into complex swarms of specialized local agents (architects, planners, auditors), traditional OS schedulers (FIFO, Round Robin) fail to properly allocate limited on-device GPU memory and compute. An agent stuck in a high-entropy hallucination loop can monopolize resources while high-clarity agents starve.

## 2. Solution: Thermodynamic Scheduling

Adapt the fundamental principles of APEX Theory to create specialized scheduling algorithms that allocate compute priority based on:
1. **Real-time informational entropy (ΔS)** of the agent's output stream
2. **Estimated Landauer energy cost** of the agent's current task
3. **Factual fidelity score** (convergence vs divergence)

### 2.1 Core Principle

```
If ΔS_agent > 0 (entropy rising) for > N turns:
  → Suspend agent to disk (cooling period)
  → Reallocate GPU resources to agents with ΔS < 0

If Landauer_cost > budget_remaining:
  → HOLD agent until next budget cycle
  → Log to VAULT999
```

## 3. Current State in A-FORGE

A-FORGE already has partial thermodynamic instrumentation:

| Component | What It Does | Gap |
|-----------|-------------|-----|
| `ThermodynamicCostEstimator` | Estimates `dS_predict`, `blastRadius`, `kappa_r` per tool call | No session-level entropy tracking |
| `BudgetManager` | Tracks token budgets and turn limits | No compute (GPU/CPU) scheduling |
| `AgentEngine` | Computes telemetry (`dS`, `peace2`, `psi_le`) at session end | No real-time scheduling decisions |
| `IntentRouter` | Routes to organs based on intent | No re-routing based on thermodynamic state |

## 4. Implementation Plan

### 4.1 New Components

#### `src/scheduler/ThermodynamicScheduler.ts`
The central scheduler that monitors all active agent sessions and reallocates compute.

```typescript
interface AgentProcess {
  sessionId: string;
  profileName: string;
  priority: number;           // Base priority from profile
  entropyDelta: number;       // Real-time ΔS (updated per turn)
  landauerCost: number;       // Cumulative energy cost
  convergenceScore: number;   // Factual fidelity (0-1)
  turnCount: number;
  lastOutputTokens: number;
  status: "running" | "cooling" | "suspended" | "terminated";
  allocatedCores: number;
  allocatedMemoryMb: number;
}

interface SchedulerDecision {
  sessionId: string;
  action: "continue" | "throttle" | "cool" | "kill";
  newCpuShare: number;
  newMemoryMb: number;
  reason: string;
  floorsTriggered: string[];
}

class ThermodynamicScheduler {
  private processes = new Map<string, AgentProcess>();
  private totalGpuMemoryMb: number;
  private totalComputeUnits: number;

  // Called every N seconds (e.g., 5s) by scheduler loop
  evaluateAndReallocate(): Promise<SchedulerDecision[]>;

  // Called per-turn by AgentEngine to update process state
  updateProcessTelemetry(
    sessionId: string,
    telemetry: { dS: number; peace2: number; turnCount: number; outputTokens: number }
  ): void;

  // Cooling protocol: suspend high-entropy process
  private coolProcess(sessionId: string, reason: string): Promise<void>;

  // Compute G-index for process (Genius score)
  private computeProcessGenius(process: AgentProcess): number;
}
```

#### `src/scheduler/CoolingProtocol.ts`
Implements the Phoenix-72 style cooling for suspended agents.

```typescript
interface CoolingRecord {
  sessionId: string;
  suspendedAt: string;
  coolingUntil: string;
  reason: string;
  entropyAtSuspend: number;
  processSnapshot: AgentProcess;
}

class CoolingProtocol {
  private coolingPeriodHours: number = 72; // Configurable

  suspend(sessionId: string, process: AgentProcess, reason: string): Promise<CoolingRecord>;
  
  // Check if a cooled process can be resumed
  canResume(sessionId: string): boolean;
  
  // Resume a cooled process (called by scheduler or human override)
  resume(sessionId: string): Promise<AgentProcess>;
  
  // List all cooled processes
  listCooled(): CoolingRecord[];
}
```

#### `src/scheduler/EntropyTracker.ts`
Real-time entropy calculation per process output stream.

```typescript
class EntropyTracker {
  // Compute Shannon entropy of text output
  computeTextEntropy(text: string): number;

  // Compare current output to previous outputs (divergence detection)
  computeDivergenceScore(current: string, history: string[]): number;

  // Detect hallucination loops (repetitive, non-convergent output)
  detectHallucinationLoop(history: string[]): { isLoop: boolean; loopSeverity: number };

  // Overall session entropy trend
  computeSessionDeltaS(turns: TurnRecord[]): number;
}
```

#### `src/scheduler/LandauerEstimator.ts`
Compute the physical energy cost of continuing a process.

```typescript
interface LandauerCost {
  erasureBits: number;      // Information theoretic cost
  energyJoules: number;     // E_min = k_B * T * ln(2) * erasureBits
  gpuCycles: number;        // Normalized GPU compute cost
  memoryAccesses: number;   // Memory bandwidth cost
}

class LandauerEstimator {
  // Estimate cost of one LLM turn
  estimateTurnCost(inputTokens: number, outputTokens: number, modelParams: number): LandauerCost;

  // Estimate cost of tool execution
  estimateToolCost(toolName: string, args: Record<string, unknown>): LandauerCost;

  // Aggregate cost for a session
  estimateSessionCost(process: AgentProcess): LandauerCost;
}
```

### 4.2 Engine Integration

Modify `src/engine/AgentEngine.ts`:

```typescript
// At the end of each turn, report telemetry to scheduler
if (this.dependencies.scheduler) {
  this.dependencies.scheduler.updateProcessTelemetry(sessionId, {
    dS: entropyTracker.computeSessionDeltaS(shortTermMemory.getMessages()),
    peace2: peace2Score,
    turnCount,
    outputTokens: turnResponse.usage.outputTokens,
  });
}

// Before each turn, check if scheduler has throttled us
if (this.dependencies.scheduler?.isThrottled(sessionId)) {
  finalResponse = `[SCHEDULER_HOLD] Process throttled due to high entropy (ΔS > 0). Cooling initiated.`;
  floorsTriggered.push("F4_SCHEDULER");
  break;
}
```

### 4.3 Files to Create

| File | Purpose |
|------|---------|
| `src/scheduler/ThermodynamicScheduler.ts` | Main scheduler engine |
| `src/scheduler/CoolingProtocol.ts` | Phoenix-72 style cooling |
| `src/scheduler/EntropyTracker.ts` | Real-time entropy computation |
| `src/scheduler/LandauerEstimator.ts` | Physical cost estimation |
| `src/scheduler/types.ts` | Shared scheduler types |
| `src/scheduler/__tests__/scheduler.test.ts` | Unit tests |
| `src/scheduler/__tests__/entropy.test.ts` | Entropy computation tests |

### 4.4 Files to Modify

| File | Change |
|------|--------|
| `src/engine/AgentEngine.ts` | Add scheduler hooks per turn |
| `src/engine/AgentEngineDependencies` | Add `scheduler?: ThermodynamicScheduler` |
| `src/types/agent.ts` | Add `SchedulerDecision`, `AgentProcess` types |
| `src/ops/ThermodynamicCostEstimator.ts` | Integrate with `LandauerEstimator` |
| `src/server.ts` | Start scheduler background loop |

## 5. Scheduling Algorithm

### 5.1 Priority Formula

```
priority_score = (base_priority × 0.3)
               + (convergence_score × 0.3)
               + ((1 - normalized_entropy) × 0.2)
               + (genius_G × 0.2)

If ΔS > 0 for 3 consecutive turns:
  priority_score *= 0.5

If ΔS > 0.3 (severe entropy injection):
  priority_score = 0
  → Trigger cooling

If Landauer_cost > remaining_budget × 0.5:
  → Trigger HOLD
```

### 5.2 Resource Allocation

```
Total GPU Memory = 24GB (example)
Total Compute Units = 100 (normalized)

For each running process:
  allocated_memory = (priority_score / sum_all_priorities) × total_memory
  allocated_compute = (priority_score / sum_all_priorities) × total_compute

Minimum guarantee: 1GB RAM, 5 compute units per process
Maximum cap: 8GB RAM, 40 compute units per process
```

## 6. Constitutional Mapping

| Floor | Scheduler Enforcement |
|-------|----------------------|
| F1 Amanah | Cooling preserves process state; can be resumed |
| F2 Truth | Low-convergence processes throttled; high-truth prioritized |
| F4 Clarity | ΔS > 0 → automatic throttle/cool |
| F5 Peace² | Resource monopolization prevented by max caps |
| F6 Empathy | Minimum resource guarantee prevents process starvation |
| F7 Humility | Overconfident (high certainty, low evidence) processes penalized |
| F8 Genius | G-index directly contributes to priority score |
| F9 Anti-Hantu | Repetitive/consciousness-claiming loops detected and cooled |
| F13 Sovereign | Human can override any scheduler decision via ticket |

## 7. Rollout Plan

1. **Week 1:** Implement `EntropyTracker` + `LandauerEstimator`, unit tests
2. **Week 2:** Implement `ThermodynamicScheduler` + `CoolingProtocol`, integrate with engine
3. **Week 3:** Load testing with multi-agent swarms, tune thresholds, staging deploy
4. **Week 4:** Production rollout with monitoring dashboard

## 8. Success Metrics

- Average session entropy (ΔS): **< 0** (net negative per session)
- Hallucination loop detection: **> 95%** accuracy
- Resource utilization efficiency: **↑ 30%** (less waste on divergent agents)
- Cooling protocol false positive rate: **< 5%**
- Constitutional floor pass rate under swarm load: **≥ 98%**

---

*DITEMPA BUKAN DIBERI — Forged, Not Given*
