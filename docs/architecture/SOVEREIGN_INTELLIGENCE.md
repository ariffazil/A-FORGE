# The Architecture of Sovereign Intelligence
## Mechanisms, Governance, and the Post-LLM Paradigm

> **Status:** CANONICAL ARCHITECTURE v2.1  
> **Epoch:** 2026-04-19  
> **Author:** Human Architect, Seri Kembangan, MY  
> **Scope:** A-FORGE Runtime + arifOS Constitutional Kernel  
> **Seal:** 999_SEAL_ALIVE

---

## 1. Introduction: The Shift from Statistical Inference to Sovereign Systems

The dominant paradigm of artificial intelligence has historically centered on the scale, parameter count, and generative fluency of Large Language Models (LLMs). For years, the industry operated under the assumption that enhancing the probabilistic reasoning capabilities of raw neural networks would naturally yield safe, reliable, and autonomous systems. However, as these architectures transition from conversational interfaces into autonomous entities capable of executing complex, multi-step workflows, a profound structural inadequacy has become apparent.

A raw LLM is fundamentally an **isolated, stateless prediction engine**. It lacks persistent memory, possesses no native interface to external environments, and operates entirely on probabilistic mathematics rather than deterministic logic. When unconstrained, these models hallucinate facts with confidence, fabricate citations, and execute operations based on flawed statistical inferences rather than grounded reality.

Recognizing the LLM not as a comprehensive intelligence, but merely as a **computational component—analogous to a central processing unit (ALU/CPU) in traditional computing**—marks the beginning of the true agentic era.

Sovereign intelligence systems represent the architectural evolution beyond the raw model. True sovereignty is not achieved through heuristic prompt engineering, superficial safety filters, or generic fine-tuning. It is established through deliberate, system-level design choices that govern how data is captured, how intent is validated, and how execution is mathematically constrained.

The concept of sovereign intelligence scales across multiple dimensions:
- **For nations:** Operating AI infrastructure free from external geopolitical influence or foreign cloud dependency
- **For enterprises:** Retention of proprietary intellectual property through Zero Data Retention (ZDR) protocols
- **For individuals:** Reclamation of digital autonomy, shifting users from "cognitive tenants" whose interactions train proprietary corporate models, into owners of their own verifiable, cryptographic intelligence substrates

**A-FORGE is the runtime execution layer of this sovereign stack.** It is the Agentic OS that schedules tasks, enforces constitutional constraints, and transforms probabilistic text generation into testable, reproducible software systems.

---

## 2. The Agentic Operating System (AIOS) Paradigm

Traditional operating systems act as intermediaries between software applications and physical hardware, managing resource allocation, scheduling, and process isolation. The Agentic OS applies this exact paradigm to cognitive resources, mediating between autonomous AI agents and the underlying language models, memory stores, and external tools.

When multiple autonomous agents operate concurrently—such as a planner agent mapping a workflow, a coding agent writing logic, and an auditor agent validating security—they compete for the same cognitive resources. Unrestricted access to the underlying LLM leads to context window overflow, rate-limit exhaustion, and catastrophic attention degradation.

The A-FORGE architecture resolves these bottlenecks by abstracting the LLM into a centralized, governed kernel, completely separating agent applications from resource management.

### 2.1 Traditional OS → Agentic AIOS Mapping

| Traditional OS Component | A-FORGE Equivalent | Functional Responsibility |
|--------------------------|-------------------|---------------------------|
| **CPU / Kernel** | `AgentEngine` + `ArifOSKernel` | Foundational reasoning, intent interpretation, inference. Raw execution engine for cognitive tasks. |
| **RAM (Volatile Memory)** | `ShortTermMemory` + Context Window | Immediate state retention, short-term conversational history, active reasoning workspace. |
| **File System (Storage)** | `LongTermMemory` + Vector DB + `PostgresVaultClient` | Long-term persistence, semantic indexing, RAG, immutable audit ledger. |
| **System Calls (Syscalls)** | `ToolRegistry` + MCP Tools | Secure, permissioned interactions with external digital environments, software tools, databases. |
| **Process Scheduler** | `PipelineCoordinator` + `IntentRouter` | Concurrent agent query management, semantic scheduling, resource monopolization prevention. |
| **Software Applications** | Agent Profiles (`AgentProfile`) | Specialized, goal-driven processes designed to achieve specific objectives. |
| **Kernel Security Module** | `GovernanceKernel` + Floor Evaluation (F1–F13) | Constitutional enforcement, thermodynamic cost gating, 888_HOLD circuit. |
| **Audit Log** | `Vault999` + `PostgresVaultClient` | Immutable, cryptographically chained record of all decisions and actions. |

### 2.2 A-FORGE as the AIOS

In A-FORGE, the `AgentEngine` (see `src/engine/AgentEngine.ts`) functions as the process scheduler and kernel. It:

1. **Allocates session budgets** via `BudgetManager`
2. **Manages context windows** via `ShortTermMemory`
3. **Schedules tool execution** via `ToolRegistry`
4. **Enforces constitutional floors** via `LocalGovernanceClient` + `GovernanceKernel`
5. **Maintains immutable audit trails** via `VaultClient` → `PostgresVaultClient`
6. **Routes intents** via `IntentRouter` to specialized organs (GEOX, WEALTH, CODE)

The LLM is treated as a **commodity engine** powering a much more valuable, compounding intelligence architecture. It is not the product—it is the CPU.

---

## 3. Metabolic Agent Loops and Planning Systems

In a sovereign system, an agent cannot simply receive a prompt and instantly execute a command; doing so invites catastrophic failure. Instead, the sequence is formalized into a **metabolic pipeline**—a biological and thermodynamic analogy reflecting the intake, digestion, assimilation, and archiving of information.

A-FORGE implements this as a rigorous 8-stage metabolic loop, derived from the canonical arifOS 000–999 pipeline:

```
000_INIT ──► 111_SENSE ──► 222_THINK ──► 333_MIND ──► 444_ROUTE
                                                          │
                              ┌───────────────────────────┼───────────────────────────┐
                              │                           │                           │
                              ▼                           ▼                           ▼
                        555_MEMORY                   666_HEART                   777_OPS
                        (context load)              (ethical red-team)          (execution)
                                                          │
                              ┌───────────────────────────┘
                              ▼
                        888_JUDGE (constitutional verdict)
                              │
                              ▼
                        999_VAULT (Merkle-sealed ledger)
```

### 3.1 Stage Implementation in A-FORGE

| Stage | A-FORGE Component | Constitutional Role |
|-------|------------------|---------------------|
| **000_INIT** | `AgentEngine.run()` bootstrap, `ArifOSKernel` instantiation | Session allocation, cryptographic identity verification, injection scan |
| **111_SENSE** | `IntentRouter`, `reality_bridge` tools, `geo_fetch` | Ground raw input against external reality matrices (APIs, vectors, web) |
| **222_THINK** | `routeIntent()` | Divergent hypothesis generation, organ routing |
| **333_MIND** | `WealthEngine`, GEOX scenario builder | Convergent reasoning, epistemic tagging, thermodynamic budget allocation |
| **444_ROUTE** | `PipelineCoordinator`, `IntentRouter` | Tier selection, routing decision with confidence/uncertainty bands |
| **555_MEMORY** | `LongTermMemory.searchRelevant()`, sacred memory injection | Context loading, constitutional precedent retrieval |
| **666_HEART** | Red-team checks (`checkHarmDignity`, `checkToolHarm`) | Ethical risk assessment, adversarial detection, F6 Maruah enforcement |
| **777_OPS** | `ToolRegistry.runTool()`, `ThermodynamicCostEstimator` | Execution with Landauer cost gating, F5 orthogonality enforcement |
| **888_JUDGE** | `calculateGeniusFromFloors()`, `SealService.validateDag()` | Final sovereign veto, G-index computation, human escalation |
| **999_VAULT** | `PostgresVaultClient`, `MerkleV3Service` | Immutable ledger write, cryptographic seal, telemetry archive |

### 3.2 The Mandatory Pause

The metabolic pipeline operates **strictly sequentially**, guaranteeing that unverified intelligence cannot bypass constitutional safety constraints. There is a mandatory, measurable pause between an agent forming an intent and executing a real-world action—closing the critical gap where hallucinations typically manifest into material harm.

In A-FORGE, this is enforced by:
- **DAG-enforced stage traversal** (no shortcuts)
- **888_HOLD circuit** for dangerous tools
- **Thermodynamic cost estimation** before tool execution
- **SealService validation** before terminal verdict

---

## 4. Constitutional Kernels and Thermodynamic Governance

Traditional alignment techniques (RLHF, prose-based system prompts) treat AI governance as psychology. These methods are highly susceptible to adversarial jailbreaks, semantic drift, and catastrophic failure under edge-case scenarios.

A-FORGE, as the runtime shell of arifOS, abandons soft prompts in favor of **mathematical and physical enforcement** through the Constitutional Kernel.

### 4.1 Thermodynamic Governance in A-FORGE

| Physics Principle | A-FORGE Implementation | Floor |
|-------------------|------------------------|-------|
| **Landauer's Principle** (`E_min ≥ k_B T ln 2`) | `ThermodynamicCostEstimator` computes `dS_predict`, `blastRadius`, `kappa_r` for every tool call | OPS/777 |
| **Second Law (ΔS ≤ 0)** | `checkEntropy()` in `AgentEngine` tracks cumulative risk per session | F4 |
| **Gödel Incompleteness** | `checkConfidence()` enforces uncertainty bands [0.03, 0.15] | F7 |
| **Bayesian Convergence** | `checkTruth()`, `checkGrounding()` require evidence markers | F2 |
| **Lyapunov Stability** | `checkStewardship()` evaluates non-destructive operational stability | F5 |
| **Rawlsian Maximin** | `checkHarmDignity()`, `checkToolHarm()` protect weakest stakeholder | F6 |

### 4.2 The 13 Floors in A-FORGE Runtime

A-FORGE implements all 13 constitutional floors through the `LocalGovernanceClient` and inline checks within `AgentEngine.executeToolCalls()`:

| Floor | A-FORGE Check | Threshold | Violation Response |
|-------|--------------|-----------|-------------------|
| F1 Amanah | `checkToolHarm()` + reversibility analysis | κᵣ ≥ 0.5 | 888_HOLD |
| F2 Truth | `checkTruth()` + evidence counting | τ ≥ 0.99 | VOID |
| F3 Tri-Witness | `calculateTriWitness()` (H×A×E)^(1/3) | W³ ≥ 0.95 | HOLD |
| F4 Clarity | `checkEntropy()` + `validateInputClarity()` | ΔS ≤ 0 | Re-route to 333 |
| F5 Peace² | `checkStewardship()` + inflammatory language detection | Ψ ≥ 1.0 | HOLD |
| F6 Empathy | `checkHarmDignity()` + maruah scoring | κᵣ ≥ 0.95 | HOLD |
| F7 Humility | `checkConfidence()` | Ω₀ ∈ [0.03, 0.05] | Append uncertainty band |
| F8 Genius | `calculateGeniusFromFloors()` | G ≥ 0.80 | Re-evaluate |
| F9 Anti-Hantu | Shadow detection + ontology guard | C_dark < 0.30 | VOID + log |
| F10 Ontology | `checkPrivacy()` + AI≠Human boundary | N/A | VOID |
| F11 Command Auth | Session verification | Verified | Reject |
| F12 Defense | `checkInjection()` | ≥ 0.85 | Block + alert |
| F13 Sovereign | `humanOverride` flag + `holdEnabled` gate | Human veto | VOID |

### 4.3 Hard vs Soft Floors

- **Hard Floor breach** (F2, F9, F11, F13): Assigns **VOID** verdict. The action is instantly destroyed; the API call never reaches the external system.
- **Soft Floor failure** (F4, F6, F7): Triggers **SABAR** state. The action is suspended for human review or recursive self-correction.
- **Critical risk tier**: Triggers **HOLD** + mandatory human cryptographic override.

---

## 5. Hybrid Intelligence Routing and Multi-Agent Orchestration

As intelligence systems scale, reliance on a single monolithic reasoning model becomes a critical architectural vulnerability. A-FORGE addresses this through **Hybrid Intelligence Routing**, decomposing complex objectives and routing them through specialized, concurrent agent networks.

### 5.1 The Trinity Architecture (ΔΩΨ) in A-FORGE

The Trinity Architecture separates cognitive responsibilities into three orthogonal processing loops:

#### Δ (Delta — AGI Mind)
- **A-FORGE Component:** `IntentRouter`, `WealthEngine`, GEOX scenario builders
- **Geometry:** Orthogonal — explores perpendicular reasoning paths without interference
- **Floors:** F2 (Truth), F4 (Clarity)
- **Objective:** Determine what is factually correct and computationally optimal, devoid of ethical consideration

#### Ω (Omega — ASI Heart)
- **A-FORGE Component:** Red-team checks, `checkHarmDignity()`, maruah scoring
- **Geometry:** Fractal — maintains self-similarity of empathy across stakeholder scales
- **Floors:** F6 (Empathy), F5 (Peace²)
- **Objective:** Evaluate systemic damage, ensure human dignity, prevent false consciousness simulation

#### Ψ (Psi — APEX Soul)
- **A-FORGE Component:** `calculateGeniusFromFloors()`, `SealService`, `PostgresVaultClient`
- **Geometry:** Toroidal — closed, continuous loops of accountability
- **Floors:** F8 (Genius), F13 (Sovereign)
- **Objective:** Calculate Tri-Witness consensus, guarantee G ≥ 0.80, execute cryptographic seal

### 5.2 Orthogonality Enforcement

Crucially, these paths remain **strictly independent** in A-FORGE:
- The Mind loop (`IntentRouter`) is blind to Heart scoring mechanisms
- The Heart loop (red-team checks) cannot see Mind's confidence estimates
- The Soul loop (`SealService`) observes both but does not feed back into either until judgment

If the Mind determines an action is logically sound but the Heart calculates unacceptable stakeholder damage, consensus fails and the APEX Soul blocks the operation.

---

## 6. Memory Architectures and the Immutable Ledger

A defining characteristic of sovereign intelligence is robust memory architecture. A-FORGE divides memory into operational and constitutional layers.

### 6.1 Operational Memory (Hot / L0)
- **`ShortTermMemory`**: Volatile context for active reasoning. Ephemeral per session.
- **Context window management**: Injected into LLM provider calls, subject to token budget constraints.

### 6.2 Constitutional Memory (Cold / Immutable)
- **`LongTermMemory`**: File-backed semantic storage with keyword search.
- **`PostgresVaultClient`**: The VAULT999 implementation—append-only PostgreSQL ledger.
- **`MemoryContract`**: Sacred memory tier for immutable constitutional laws (eureka capsules).

### 6.3 VAULT999: The Immutable Ledger

When an AI agent executes a workflow and finalizes a decision, A-FORGE generates a formal **Truth Record**:

```json
{
  "record_id": "SHA-256 of content",
  "prev_hash": "SHA-256 of previous record",
  "session_id": "sess_abc123",
  "epoch": "EPOCH-2026-04-19",
  "verdict": "SEAL",
  "telemetry_hash": "SHA-256 of telemetry JSON",
  "action_summary": "50-word max description",
  "floors_passed": 13,
  "human_approved": true,
  "timestamp_utc": "2026-04-19T11:43:00Z"
}
```

This cryptographic chaining ensures that neither a malicious external actor nor the AI itself can retroactively alter decision history.

### 6.4 Phoenix-72 Cooling Protocol

Sovereign architectures reject immediate acceptance of hallucinated outputs. A-FORGE will implement **Phoenix-72** as a mandatory temporal cooling period where newly generated insights are quarantined in read-only states for 72 hours before promotion to trusted precedent.

*Status: Design complete, implementation pending. See `SOVEREIGN_CONTEXT_SUBSTRATE_BLUEPRINT.md`.*

---

## 7. Tool-Use Frameworks: The MCP Ecosystem

An intelligence system isolated from its environment is fundamentally useless for enterprise or autonomous operation. A-FORGE connects to the material world through the **Model Context Protocol (MCP)**.

### 7.1 MCP Primitives in A-FORGE

| Primitive | A-FORGE Implementation | Purpose |
|-----------|------------------------|---------|
| **Resources** | `arifos://governance/floors`, `arifos://status/vitals` | Read-only context retrieval |
| **Tools** | `src/tools/*.ts`, `src/mcp/core.ts` | Actionable functions for state change |
| **Prompts** | `src/prompts/*.ts` (if present) | Reusable communication templates |

### 7.2 Transport Layers

- **STDIO** (`src/mcp/stdio.ts`): Local, tightly coupled, high security, no open ports
- **HTTP** (`src/mcp/server.ts`): VPS-facing, Caddy-proxied
- **Streamable HTTP/SSE** (`src/mcp/core.ts`): Distributed, stateful, multi-turn

### 7.3 MCP Governance Patterns

A-FORGE already implements several sovereign MCP governance patterns:

| Pattern | Implementation | Status |
|---------|---------------|--------|
| Zero-Trust RBAC | `ToolRegistry.isPermitted()` + `ToolPermissionContext` | **LIVE** |
| Containerized Sandboxing | Docker Compose with non-root `arifos:arifos` user | **LIVE** |
| Centralized Governance Gateway | `LocalGovernanceClient` + `GovernanceKernel` | **LIVE** |
| Code Mode Execution | `CodeModeExecutor` (dynamic sandbox) | **DESIGN** |

---

## 8. Actionable Research Directions for A-FORGE

Based on the structural mechanisms analyzed above, the following research directions must be pursued to advance A-FORGE toward full sovereign intelligence:

### 8.1 Hardware-Enforced Context Isolation and ZDR
**Status:** Research  
**Goal:** Optimize local inference (Ollama, vLLM) on consumer NPUs/GPUs with hardware-level ZDR protocols. Ensure sensitive operational memory is processed in ephemeral, air-gapped environments.

### 8.2 Cryptographic Proofs of Cognitive Reasoning (zkSNARKs)
**Status:** Research  
**Goal:** Enable zero-knowledge proofs that an agent adhered to constitutional floors (e.g., F2 Truth) without revealing underlying confidential data. Critical for regulated environments (trading, legal, healthcare).

### 8.3 Native "Code Mode" Integration for MCP Efficiency
**Status:** Blueprint Ready → Implementation Next  
**Goal:** Replace massive JSON schema injection into LLM context with a secure, containerized Python/TypeScript execution sandbox. The LLM writes scripts to interact with MCP gateways, filters data programmatically, and returns only dense intelligence.
**Blueprint:** `../plans/CODE_MODE_MCP_BLUEPRINT.md`

### 8.4 Thermodynamic Scheduling Algorithms for Multi-Agent Swarms
**Status:** Partially Live → Full Implementation Next  
**Goal:** Adapt APEX Theory to create entropy-based (ΔS) and Landauer-cost schedulers. Throttle agents stuck in high-entropy hallucination loops; reallocate GPU resources to high-clarity agents.
**Blueprint:** `../plans/THERMODYNAMIC_SCHEDULER_BLUEPRINT.md`

### 8.5 Standardization of the "Sovereign Context" Substrate
**Status:** Partially Live → Formalization Next  
**Goal:** Develop open, encrypted protocols for users to log reasoning, preferences, risk tolerances, and ethical constraints into a portable, programmable knowledge graph. Strictly decoupled from any inference provider.
**Blueprint:** `../plans/SOVEREIGN_CONTEXT_SUBSTRATE_BLUEPRINT.md`

---

## 9. What This Document Is (In A-FORGE Canon)

This document serves as:
1. **APEX-THEORY v2** + **RIK-EXPLAINED** for the A-FORGE runtime
2. The narrative spine for talks/papers on sovereign intelligence architecture
3. The bridge between arifOS constitutional law and A-FORGE execution reality

It belongs as the **canonical architecture reference** for all agents and developers working within the A-FORGE ecosystem.

---

*DITEMPA BUKAN DIBERI — Forged, Not Given*

---

## Appendix A: Trinity Network Map
*(Reforged from archive — 2397 chars)*

# 🌌 arifOS: Metabolic Intelligence Trinity Map
## The Unified Architecture of @WELL, @WEALTH, @GEOX, and @A-FORGE

This map defines the canonical hierarchy and metabolic links between all arifOS MCP organs.

---

### 🏛️ I. The Constitutional Kernel (arifOS)
**Path:** `/root/arifOS`  
**Role:** The Sovereign Heart (Stage 888_JUDGE / 999_SEAL).  
**Primary Engine:** FastMCP Unified Server (`server.py`).  
**Law:** F1-F13 Constitutional Floors (`core/floors.py`).  
**Registry:** Multi-organ tool aggregator (`arifosmcp/runtime/tools.py`).

---

### 🧬 II. The Human Substrate (@WELL)
**Path:** `/root/WELL`  
**Role:** The Mirror of Intent (Biological Telemetry).  
**Link:** `well_bridge.py` → Injects readiness into the arifOS Kernel.  
**Constraint:** W1-W6 Floors (Sleep, Stress, Cognitive Fatigue).  
**Contrast:** Protects the Human from Machine-driven burnout.

---

### ⚒️ III. The Agentic Forge (@A-FORGE)
**Path:** `/root/` (Root Workspace)  
**Role:** The Hand of Action (Execution Plane).  
**Link:** Driven by arifOS `777_FORGE` stage; signals pressure back to `@WELL`.  
**Axiom:** Execution is the proof of Alignment.  
**Contrast:** Protects the System from unaligned digital output.

---

### 💰 IV. The Capital Organ (@WEALTH)
**Path:** `/root/wealth` (Staging) | `arifOS/core/organs/_5_wealth.py` (Core)  
**Role:** The Economic Witness (Tier 03).  
**Logic:** CTAC W_Risk (Ambiguity × Distortion × Bias).  
**Goal:** ROI, Leverage (DSCR), and Capital Policy Audit.  
**Axiom:** Wealth is organized energy.

---

### 🌍 V. The Earth Organ (@GEOX)
**Path:** `/root/GEOX` (Staging) | `arifOS/core/organs/_6_GEOX.py` (Core)  
**Role:** The Physical Witness (Tier 02).  
**Logic:** Geospatial Grounding & Feasibility Audit.  
**Goal:** Coordinate verification (CRS) and subsurface feasibility.  
**Axiom:** The Earth does not lie.

---

### 🔗 VI. The Metabolic Integration Loop

1.  **INTENT:** Human (`@WELL`) signals intent to the `arifOS` Kernel.
2.  **GROUNDING:** `arifOS` polls `@GEOX` (Physics) and `@WEALTH` (Economics) for reality checks.
3.  **PLANNING:** `@A-FORGE` constructs a metabolic execution plan.
4.  **FEEDBACK:** Each Forge action exerts `well_pressure` on the Human Substrate.
5.  **JUDGMENT:** `arifOS` evaluates F-Floors (System) + W-Floors (Human).
6.  **SEAL:** Result anchored to `VAULT999` with cryptographic proof.

---
**SEALED v2026.04.17 — 999_ALIVE**

---

## Appendix B: Trinity Ecosystem Map
*(Reforged from archive — 3129 chars)*

# 🌌 arifOS: Metabolic Intelligence Federation Map
## The Trinity Ecosystem (@WELL, @WEALTH, @GEOX, @A-FORGE)

This document provides the high-level architectural mapping of all arifOS MCP organs and their metabolic links.

---

## 🏛️ 1. The Constitutional Kernel (arifOS)
**Role:** The Sovereign Heart. 
**Function:** Law enforcement, routing, and final verdict (888_JUDGE).
**Axiom:** *DITEMPA BUKAN DIBERI.*

| Component | Role | Logic |
| :--- | :--- | :--- |
| `governance_kernel` | The JUDGE | Evaluates F1-F13 floors from live telemetry. |
| `governance_enforcer` | The GATE | Prevents model calls if non-PASS verdicts are returned. |
| `VAULT999` | The MEMORY | Immutable ledger of all intents, tool calls, and seals. |

---

## 🧬 2. The Human Substrate (@WELL)
**Role:** The Mirror of Intent.
**Function:** Governs operator readiness (Sleep, Stress, Cognitive Fatigue).
**Axiom:** *WELL holds a mirror, not a veto.*

| Tool | Link | Impact |
| :--- | :--- | :--- |
| `well_readiness` | → `arifOS` | Downgrades SEAL to HOLD if substrate is degraded. |
| `well_pressure` | ← `A-FORGE` | Increases `decision_fatigue` based on agentic workload. |
| `W6_PAUSE` | Enforcement | Hard-blocks execution for 15m if repetitive loops detected. |

---

## ⚒️ 3. The Agentic Forge (@A-FORGE)
**Role:** The Hand of Action.
**Function:** Bounded tool execution and plan generation.
**Axiom:** *Execution is the proof of Alignment.*

| Component | Role | Logic |
| :--- | :--- | :--- |
| `af_forge_bridge` | Bridge | Connects Python MCP to TS Agent Executor. |
| `planner` | Architect | Generates metabolic steps (000-999) for complex tasks. |
| `executor` | Laborer | Executes tools within the "Fail-Closed" guardrails. |

---

## 💰 4. The Capital Organ (@WEALTH)
**Role:** The Economic Witness.
**Function:** Precision financial math and capital allocation audit.
**Axiom:** *Wealth is organized energy.*

| Tool | Focus | arifOS Floor |
| :--- | :--- | :--- |
| `wealth_npv_reward` | ROI | F2 (Truth / Grounding) |
| `wealth_dscr_leverage`| Survival | F5 (Peace² / Stability) |
| `wealth_policy_audit` | Governance | F13 (Sovereign Veto) |

---

## 🌍 5. The Earth Organ (@GEOX)
**Role:** The Physical Witness.
**Function:** Geospatial verification and physical feasibility.
**Axiom:** *The Earth does not lie.*

| Tool | Focus | arifOS Floor |
| :--- | :--- | :--- |
| `verify_location` | Grounding | F4 (Clarity / Coordinate CRS) |
| `evaluate_prospect` | Evidence | F2 (Truth / Physical feasibility) |
| `rock_mech_audit` | Physics | F10 (Ontology / Material reality) |

---

## 🔗 6. The Metabolic Loop (Linkage)

1.  **INTENT (000_INIT):** Human (WELL) signals intent to arifOS.
2.  **SENSE (111_SENSE):** arifOS polls organs (@WEALTH, @GEOX) for reality grounding.
3.  **THINK (333_MIND):** A-FORGE generates a plan based on organ data.
4.  **FEEDBACK:** A-FORGE action exerts pressure (well_pressure) on the Human (WELL).
5.  **JUDGE (888_JUDGE):** arifOS kernel checks F-Floors (arifOS) + W-Floors (WELL).
6.  **SEAL (999_VAULT):** Final result is hashed, signed, and anchored to VAULT999.

---
**SEALED v2026.04.17 — 999_ALIVE**

---

## Appendix C: Vision Intelligence Implementation
*(Reforged from archive — 5734 chars)*

# GEOX Vision Intelligence Implementation Summary

> **Status:** FOUNDATION COMPLETE  
> **Date:** 2026-04-10  
> **Seal:** DITEMPA BUKAN DIBERI  

---

## What Was Built

### 1. Canonical Charter
**File:** `GEOX/GEOX_VISION_DEV_CHARTER.md`

The governing document for all GEOX Vision development with:
- Three non-negotiable questions for every vision feature
- Working rule: `pixels → transforms → physics → decision`
- Four capability domains with mental models
- AC_Risk formula and thresholds
- Agent briefing pattern
- Transform registry reference

### 2. AC_Risk Calculator
**File:** `GEOX/arifos/GEOX/ENGINE/ac_risk.py`

Complete implementation of Theory of Anomalous Contrast risk calculation:
```python
AC_Risk = U_phys × D_transform × B_cog
```

**Components:**
- `Transform` dataclass with invertibility scores
- `TransformRegistry` with 10+ predefined transforms
- `ACRiskCalculator` with scenario-specific methods:
  - `for_georeferencing()`
  - `for_analog_digitization()`
  - `for_seismic_vision()`
- Verdict thresholds: SEAL/QUALIFY/HOLD/VOID

**Self-test included:** Run `python ac_risk.py` to verify.

### 3. Vision Governance Module
**Directory:** `GEOX/arifos/GEOX/vision/`

#### 3.1 GovernedSeismicVLM
**File:** `governed_vlm.py`

ToAC-compliant VLM adapter:
- Multi-contrast view generation (5 views)
- Cross-view consistency checking
- Physics anchoring with computed attributes
- AC_Risk calculation
- Verdict determination
- Perception bridge warnings

**Usage:**
```python
vlm = GovernedSeismicVLM(vlm_backend=your_backend)
result = await vlm.interpret(
    image=seismic_image,
    interpretation_goal="Identify faults",
    has_segy=False,
    canonical_array=seismic_array,
)
# result.verdict, result.ac_risk_result, result.perception_bridge_warning
```

#### 3.2 ContrastViewGenerator
**File:** `contrast_views.py`

Implements Contrast Canon:
- Standard view
- High saliency (histogram equalization)
- Edge enhanced
- Inverted (polarity test)
- High contrast

#### 3.3 MultiViewConsistencyChecker
**File:** `multi_view_consistency.py`

Detects display artifacts:
- Features persisting across views = real
- Features appearing only under enhancement = artifacts
- Configurable persistence threshold

#### 3.4 VisionGovernance
**File:** `ac_risk_integration.py`

Convenience wrappers:
- `assess_georeferencing()`
- `assess_analog_digitization()`
- `assess_seismic_interpretation()`

---

## Capability Status

| Requirement | Before | After | Gap |
|-------------|--------|-------|-----|
| Georeferencing | Basic GeoTIFF | ToAC-governed | GCP detection needed |
| Analog Digitization | 🔴 None | Architecture defined | Implementation needed |
| Seismic VLM | Mock only | Governed framework | Real VLM backend needed |
| Attributes | Gradient-based | Framework for DL + ToAC | DL models needed |

---

## ToAC Integration Points

### Transform Registry (10+ transforms)
| Transform | Invertibility | Use Case |
|-----------|---------------|----------|
| linear_scaling | 1.0 | Amplitude normalization |
| colormap_mapping | 0.7 | Visual display |
| AGC | 0.4 | Dynamic range compression |
| CLAHE | 0.2 | Local contrast enhancement |
| VLM inference | 0.3 | AI pattern recognition |
| OCR | 0.5 | Text extraction |

### Verdict Thresholds
```
AC_Risk < 0.25     → SEAL (auto-proceed)
0.25-0.50          → QUALIFY (caveats)
0.50-0.75          → HOLD (human review)
≥ 0.75             → VOID (unsafe)
```

---

## Next Steps

### Phase 0: Foundation (Complete ✓)
- [x] AC_Risk calculator
- [x] TransformRegistry
- [x] Vision governance module
- [x] GovernedSeismicVLM scaffold

### Phase 1: Georeferencing (Next)
- [ ] GCPDetector with OCR
- [ ] Scale bar extraction
- [ ] GeoreferenceAuditor
- [ ] Bound validation vs basemap

### Phase 2: Analog Digitization
- [ ] Scale/depth detection (Hough + OCR)
- [ ] Axis/label OCR pipeline
- [ ] Curve tracing with user correction
- [ ] RATLAS physics validation

### Phase 3: Real VLM
- [ ] GPT-4V adapter
- [ ] Claude 3 adapter
- [ ] VLM output parsing
- [ ] Multi-backend aggregation

### Phase 4: DL Attributes
- [ ] UNet fault detection
- [ ] Salt body segmentation
- [ ] Geobody extraction
- [ ] Transform-aware metadata

---

## Testing

### Run AC_Risk Self-Test
```bash
cd GEOX/arifos/GEOX/ENGINE
python ac_risk.py
```

Expected output:
```
Test 1 (SEGY, minimal transforms):
  AC_Risk: 0.084
  Verdict: SEAL

Test 2 (Image only, CLAHE+AGC+VLM):
  AC_Risk: 0.504
  Verdict: HOLD

Test 3 (Georeferencing, poor OCR):
  AC_Risk: 0.513
  Verdict: HOLD
```

### Run GovernedVLM Self-Test
```bash
cd GEOX/arifos/GEOX/vision
python governed_vlm.py
```

---

## Key Design Decisions

1. **AC_Risk is first-class**: Every vision operation must calculate and report AC_Risk
2. **Multi-view is mandatory**: Single-view interpretation is prohibited
3. **Physics anchoring**: VLM outputs must reconcile with computed attributes
4. **Explicit transforms**: Every operation logs its transform stack
5. **Human override**: F13 Sovereign respected — 888_HOLD requires human release

---

## Constitutional Compliance

| Floor | Implementation |
|-------|----------------|
| F1 Amanah | Rollback paths documented |
| F2 Truth | Physical quantities explicit |
| F4 Clarity | Transform stack logged |
| F7 Humility | Uncertainty ≥ 0.15 for vision |
| F9 Anti-Hantu | DISPLAY-ONLY triggers HOLD |
| F11 Audit | Full provenance chain |
| F13 Sovereign | Human override on high risk |

---

## References

- Charter: `GEOX/GEOX_VISION_DEV_CHARTER.md`
- AC_Risk: `GEOX/arifos/GEOX/ENGINE/ac_risk.py`
- Vision Module: `GEOX/arifos/GEOX/vision/`
- Theory: `GEOX/wiki/10_THEORY/Theory_of_Anomalous_Contrast.md`

---

*DITEMPA BUKAN DIBERI*  
*Vision Intelligence: Governed, Not Given*

---

## Appendix D: FORGE Hardened Vision Roadmap
*(Reforged from archive — 14237 chars)*

# FORGE HARDENED: Vision Intelligence Roadmap

> **Status:** HARDENED FOR EXECUTION  
> **Date:** 2026-04-10  
> **Seal:** 999_VAULT  
> **Motto:** *DITEMPA BUKAN DIBERI*

---

## Executive Summary

**Previous State:** Vision architecture scaffolded, AC_Risk calculated, no external integration  
**Current State:** Complete external ecosystem mapped, integration patterns defined  
**Next State:** Working integrations with ToAC governance

**Time to MVP:** 6-8 weeks (vs 12-18 months from scratch)

---

## Phase 1: Georeferencing (Weeks 1-2)

### Sprint Goal
Working georeferencing with MapWarper patterns + ToAC governance

### Tasks

#### Day 1-2: Study External Code
```bash
# Clone and analyze
git clone https://github.com/timwaters/mapwarper.git
git clone https://github.com/vitec-memorix/GeoReferencer.git

# Extract patterns:
# - GCP data model (point pairs: image_x, image_y, world_x, world_y)
# - Residual calculation (RMS error per GCP)
# - Warp transforms (affine, polynomial order 1-3)
# - GeoTIFF metadata structure
```

#### Day 3-4: Build GCPDetector
```python
# GEOX/arifos/GEOX/vision/gcp_detector.py
class GCPDetector:
    """
    Detect candidate GCPs from map collars using CV + OCR.
    """
    
    def detect_grid_intersections(self, image):
        """Hough lines for grid line detection."""
        # OpenCV HoughLinesP
        # Return candidate intersection points
        
    def ocr_grid_labels(self, image, regions):
        """OCR for longitude/latitude labels."""
        # Tesseract or EasyOCR
        # Return text + confidence per region
        
    def detect_scale_bar(self, image):
        """Detect scale bar for ground truth validation."""
        # Template matching or heuristics
        # Return scale in px/unit
```

#### Day 5-7: Build GeoreferenceAuditor
```python
# GEOX/arifos/GEOX/vision/georeference_auditor.py
class GeoreferenceAuditor:
    """
    ToAC governance layer for georeferencing.
    """
    
    def audit_georeference(self, gcp_list, image, claimed_bounds):
        # 1. Calculate residuals from external warp
        residuals = self.calculate_residuals(gcp_list)
        
        # 2. Detect vs claimed bounds
        detected_bounds = self.ocr_detect_bounds(image)
        bound_divergence = self.compare_bounds(claimed_bounds, detected_bounds)
        
        # 3. Scale consistency
        scale_from_bar = self.detect_scale_bar(image)
        scale_from_bounds = self.calculate_scale(claimed_bounds, image.size)
        scale_consistency = self.compare_scales(scale_from_bar, scale_from_bounds)
        
        # 4. AC_Risk
        from ..ENGINE.ac_risk import VisionGovernance
        risk_result = VisionGovernance.assess_georeferencing(
            bound_divergence=bound_divergence,
            scale_consistency=scale_consistency,
            ocr_confidence=detected_bounds.confidence,
            gcp_residuals=residuals,
        )
        
        # 5. Verdict
        return {
            "warp_result": external_warp_result,  # From MapWarper pattern
            "gcp_residuals": residuals,
            "bound_divergence": bound_divergence,
            "ac_risk": risk_result,
            "verdict": risk_result.verdict,
            "requires_human_approval": risk_result.verdict in [Verdict.HOLD, Verdict.VOID],
        }
```

#### Day 8-10: Integration & Testing
- Wire into existing `georeference_map.py`
- Test with Malay Basin map samples
- Validate AC_Risk triggers correctly

### Deliverable
```python
# Usage
result = await georeference_map_governed(
    image_path="malay_basin_map.png",
    claimed_bounds=[102.0, 3.0, 107.0, 7.5],
)
# result.geotiff_path
# result.gcp_list
# result.residuals
# result.ac_risk.ac_risk  # e.g., 0.32
# result.verdict  # QUALIFY
# result.requires_human_approval  # False
```

---

## Phase 2: Analog Digitization (Weeks 3-4)

### Sprint Goal
Working digitization pipeline with physics validation

### Tasks

#### Day 1-3: Study External Patterns
- Analyze WebPlotDigitizer interaction model
- Study Geomega digitization workflows
- Document typical error patterns

#### Day 4-7: Build Core Pipeline
```python
# GEOX/arifos/GEOX/vision/analog_digitizer.py
class AnalogDigitizer:
    """
    Digitize scanned logs, charts, core photos with ToAC governance.
    """
    
    async def digitize_log(self, image_path, log_type="neutron_density"):
        # Stage 1: Detect scale markers
        scale_result = await self.detect_scale_markers(image_path)
        
        # Stage 2: OCR axis labels
        axis_result = await self.ocr_axis_labels(image_path, scale_result.roi)
        
        # Stage 3: User-guided anchor points (WebPlotDigitizer pattern)
        anchors = await self.get_user_anchors_or_auto(image_path)
        
        # Stage 4: Curve tracing
        pixel_curve = await self.trace_curve(image_path, anchors)
        
        # Stage 5: Transform to physical values
        physical_curve = self.pixel_to_physical(pixel_curve, anchors)
        
        # Stage 6: Physics validation
        physics_check = await self.validate_vs_ratlas(physical_curve, log_type)
        
        # Stage 7: AC_Risk
        risk = self.calculate_digitization_risk(
            ocr_confidence=axis_result.confidence,
            anchor_count=len(anchors),
            physics_plausibility=physics_check.score,
        )
        
        return DigitizationResult(
            curve=physical_curve,
            ac_risk=risk,
            verdict=risk.verdict,
        )
```

#### Day 8-10: Physics Validation Layer
- RATLAS integration for expected ranges
- Monotonicity checks
- Outlier detection

### Deliverable
```python
result = await digitize_log_curve(
    image_path="legacy_neutron_log.png",
    log_type="NPHI",
)
# result.depth  # [m]
# result.values  # [fraction]
# result.uncertainty  # per-point
# result.ac_risk.ac_risk  # e.g., 0.45
# result.verdict  # QUALIFY
# result.physics_warnings  # ["Value 0.52 exceeds RATLAS max for clean sand"]
```

---

## Phase 3: Seismic Vision (Weeks 5-8)

### Sprint Goal
GovernedSeismicVLM with real backends

### Tasks

#### Day 1-4: Study External Code
```bash
# Deep learning architectures
git clone https://github.com/BEEugene/seismiqb.git
git clone https://github.com/microsoft/seismic-deeplearning.git

# Image-centric workflows
git clone https://github.com/gecos-lab/Seismic-App.git

# Extract:
# - UNet/Tiramisu model definitions
# - Volume patching strategies
# - SAM integration patterns
# - Training data formats
```

#### Day 5-10: Build Integration Layer
```python
# GEOX/arifos/GEOX/vision/backends/
class SeismiqbBackend:
    """Adapter for seismiqb models."""
    
    def load_fault_model(self, checkpoint_path):
        # Load seismiqb UNet
        
    def predict_faults(self, seismic_volume):
        # Run inference
        # Return fault probability volume

class SeismicAppBackend:
    """Adapter for SAM-style segmentation."""
    
    def segment_from_click(self, image, click_point):
        # SAM-based segmentation
        # Return mask

class GEOXVLMBackend:
    """Adapter for GEOX/GeoGround vision towers."""
    
    async def infer(self, image, prompt):
        # Run geo-domain VLM
        # Return structured interpretation
```

#### Day 11-16: Enhance GovernedSeismicVLM
```python
class GovernedSeismicVLM:
    async def interpret(self, image, goal, backends=None):
        # Stage 1: Contrast views (existing)
        views = self.generate_contrast_views(image)
        
        # Stage 2: Multi-backend inference (new)
        all_hypotheses = []
        for backend in backends or [self.default_backend]:
            for view in views:
                result = await backend.infer(view.image, goal)
                all_hypotheses.extend(result.hypotheses)
        
        # Stage 3: Cross-view consistency (existing)
        consistency = self.check_consistency(all_hypotheses)
        
        # Stage 4: Physics anchoring with seismiqb (new)
        if "seismiqb" in backends:
            attributes = await self.compute_attributes(image)
            physics_agreement = self.validate_hypotheses(all_hypotheses, attributes)
        
        # Stage 5: AC_Risk (existing)
        risk = self.calculate_risk(consistency, physics_agreement, ...)
        
        return InterpretationResult(...)
```

### Deliverable
```python
result = await governed_vlm.interpret(
    image="seismic_section.png",
    goal="Identify faults and horizons",
    backends=["seismiqb", "GEOX_vlm", "sam"],
)
# result.hypotheses  # From multiple backends
# result.consistency_score  # Cross-view agreement
# result.physics_agreement  # Match to attributes
# result.ac_risk.ac_risk  # e.g., 0.28
# result.verdict  # QUALIFY
```

---

## Phase 4: Attributes from Images (Weeks 9-10)

### Sprint Goal
Attribute extraction with Nature 2025 risk model

### Tasks

#### Day 1-2: Encode Nature 2025 Findings
```python
# GEOX/arifos/GEOX/vision/attribute_risk.py
ATTRIBUTE_IMAGE_FEASIBILITY = {
    # From Nature 2025 paper
    "coherence": {
        "feasible": True,
        "d_transform": 0.4,
        "notes": "Edge-based, moderately robust"
    },
    "dip_magnitude": {
        "feasible": False,
        "d_transform": 0.6,
        "notes": "Phase information lost in image"
    },
    "spectral_decomposition": {
        "feasible": False,
        "d_transform": 0.8,
        "notes": "Frequency content destroyed by colormap"
    },
    "curvature": {
        "feasible": False,
        "d_transform": 0.6,
        "notes": "Second-order derivative, noise-sensitive"
    },
}
```

#### Day 3-7: Extend seismic_feature_extract
```python
async def extract_attribute_with_risk(attribute_type, source_type, image):
    if source_type == "image":
        risk_info = ATTRIBUTE_IMAGE_FEASIBILITY[attribute_type]
        
        if not risk_info["feasible"]:
            return {
                "attribute": None,
                "verdict": Verdict.HOLD,
                "explanation": f"{attribute_type} requires SEG-Y data",
                "reference": "Nature 2025, doi:10.1038/s41598-025-21949-9"
            }
        
        # Compute with elevated uncertainty
        value = await compute_approximate_attribute(image, attribute_type)
        
        return {
            "attribute": value,
            "uncertainty": 0.20,  # High for image-only
            "d_transform": risk_info["d_transform"],
            "verdict": Verdict.QUALIFY,
        }
```

### Deliverable
```python
result = await extract_seismic_attribute(
    attribute="coherence",
    source_type="image",  # vs "segy"
    image=seismic_image,
)
# result.attribute  # Computed value
# result.uncertainty  # 0.20
# result.d_transform  # 0.4
# result.verdict  # QUALIFY

# vs

result = await extract_seismic_attribute(
    attribute="spectral_decomposition",
    source_type="image",
)
# result.verdict  # HOLD
# result.explanation  # "Requires SEG-Y (Nature 2025)"
```

---

## Phase 5: Integration & Hardening (Weeks 11-12)

### Tasks
- End-to-end testing with real data
- Performance optimization
- Documentation
- Example notebooks

---

## Resource Requirements

### Compute
- GPU for seismiqb/GEOX inference (A10G or equivalent)
- Standard CPU for georeferencing/digitization

### External Dependencies
```txt
# requirements-vision.txt
opencv-python>=4.8.0      # GCP detection, curve tracing
pytesseract>=0.3.10       # OCR
easyocr>=1.7.0            # Alternative OCR
rasterio>=1.3.8           # Georeferencing
pillow>=10.0.0            # Image processing

# Optional DL backends
torch>=2.0.0              # seismiqb, GEOX
transformers>=4.30.0      # VLM adapters
segment-anything>=1.0     # SAM integration
```

### Human Resources
- 1 CV engineer (georeferencing + digitization)
- 1 ML engineer (seismic vision + attributes)
- 1 geoscientist (validation, RATLAS integration)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Georeferencing accuracy | < 50m RMS error | Benchmark maps |
| Digitization accuracy | < 5% vs ground truth | Synthetic logs |
| Seismic VLM consistency | > 0.7 cross-view | Test sections |
| AC_Risk precision | 90% correlation with expert error | Blind test |
| 888_HOLD trigger rate | 15-25% of image-only | Telemetry |

---

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| External repo unmaintained | Medium | Fork, vendor, document |
| License conflict | Low | Audit before integration |
| Performance issues | Medium | Benchmark early, optimize |
| Domain mismatch | Medium | Fine-tune on seismic data |
| Over-reliance on external | Medium | Abstract interfaces |

---

## Checkpoints

### Week 2 Checkpoint
- [ ] MapWarper patterns extracted
- [ ] GCPDetector working
- [ ] GeoreferenceAuditor with AC_Risk

### Week 4 Checkpoint
- [ ] WebPlotDigitizer pattern implemented
- [ ] Physics validation vs RATLAS
- [ ] Analog digitization pipeline

### Week 8 Checkpoint
- [ ] seismiqb backend integrated
- [ ] Multi-view consistency working
- [ ] GovernedSeismicVLM with real backends

### Week 10 Checkpoint
- [ ] Nature 2025 risks encoded
- [ ] Attribute extraction with risk
- [ ] End-to-end workflows

### Week 12 Checkpoint
- [ ] All components integrated
- [ ] Documentation complete
- [ ] Example notebooks
- [ ] Performance validated

---

## Final Deliverable

```python
# Complete GEOX Vision stack
from GEOX.vision import (
    GeoreferenceAuditor,
    AnalogDigitizer,
    GovernedSeismicVLM,
    SeismicAttributeExtractor,
)

# All operations return AC_Risk + Verdict
georef = await GeoreferenceAuditor().audit(image, bounds)
digitized = await AnalogDigitizer().digitize(log_image)
seismic = await GovernedSeismicVLM().interpret(section_image)
attributes = await SeismicAttributeExtractor().extract(image, "coherence")

# Common interface: AC_Risk + Verdict
for result in [georef, digitized, seismic, attributes]:
    assert result.ac_risk is not None
    assert result.verdict in [Verdict.SEAL, Verdict.QUALIFY, Verdict.HOLD, Verdict.VOID]
    if result.verdict == Verdict.HOLD:
        await notify_human_for_review(result)
```

---

*DITEMPA BUKAN DIBERI*  
*External tools leveraged. ToAC governance applied. Vision forged.*

---

## Appendix E: Tool Consolidation Map
*(Reforged from archive — 10436 chars)*

# GEOX Tool Consolidation Map
## DITEMPA BUKAN DIBERI — Cleanup Operation

---

## Executive Summary

**Problem Identified:**
- `physics_compute_stoiip` in `registries/physics.py` is a **STUB** (returns hardcoded 150.5)
- `VolumetricsEconomicsTool` in `arifos/GEOX/tools/` is the **REAL** implementation with Monte Carlo
- Multiple duplicate/aliased tools across registries
- Scaffold tools mixed with production tools

**Solution:**
- Delete stub, wire physics_compute_stoiip to VolumetricsEconomicsTool
- Consolidate aliases (keep canonical names, remove GEOX_* duplicates where possible)
- Mark scaffold tools clearly
- Establish single source of truth per domain

---

## 1. Domain Registry Mapping

### 1.1 PROSPECT (Play Fairway Discovery)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `prospect_evaluate_prospect` | ✅ KEEP | Canonical | Judge: Evaluate HC potential |
| `GEOX_evaluate_prospect` | 🗑️ REMOVE | Alias | Duplicates above |
| `prospect_build_structural_candidates` | ✅ KEEP | Canonical | Generate trap candidates |
| `GEOX_build_structural_candidates` | 🗑️ REMOVE | Alias | Duplicates above |
| `prospect_feasibility_check` | ✅ KEEP | Canonical | Technical/economic gating |
| `GEOX_feasibility_check` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `prospect_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.2 WELL (Borehole Truth Channel)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `well_load_log_bundle` | ✅ KEEP | Canonical | Load LAS/DLIS |
| `well_qc_logs` | ✅ KEEP | Canonical | Quality control |
| `GEOX_qc_logs` | 🗑️ REMOVE | Alias | Duplicates above |
| `well_validate_cutoffs` | ✅ KEEP | Canonical | Cutoff validation |
| `GEOX_validate_cutoffs` | 🗑️ REMOVE | Alias | Duplicates above |
| `well_select_sw_model` | ✅ KEEP | Canonical | Sw model selection |
| `GEOX_select_sw_model` | 🗑️ REMOVE | Alias | Duplicates above |
| `well_compute_petrophysics` | ✅ KEEP | Canonical | Physics calculations |
| `GEOX_compute_petrophysics` | 🗑️ REMOVE | Alias | Duplicates above |
| `well_petrophysical_check` | ✅ KEEP | Canonical | 888_HOLD check |
| `GEOX_petrophysical_hold_check` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `well_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.3 SECTION (2D Stratigraphic Correlation)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `section_interpret_strata` | ✅ KEEP | Canonical | Stratigraphic correlation |
| `GEOX_interpret_strata` | 🗑️ REMOVE | Alias | Duplicates above |
| `section_observe_well_correlation` | ✅ KEEP | Canonical | Cross-well correlation |
| `GEOX_observe_well_correlation` | 🗑️ REMOVE | Alias | Duplicates above |
| `section_synthesize_profile` | ✅ KEEP | Canonical | 2D profile synthesis |
| `GEOX_synthesize_profile` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `section_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.4 EARTH3D (Volumetric Seismic)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `earth3d_load_volume` | ✅ KEEP | Canonical | Load 3D seismic |
| `GEOX_load_seismic_volume` | 🗑️ REMOVE | Alias | Duplicates above |
| `earth3d_interpret_horizons` | ✅ KEEP | Canonical | Horizon picking |
| `GEOX_interpret_horizons` | 🗑️ REMOVE | Alias | Duplicates above |
| `earth3d_model_geometries` | ✅ KEEP | Canonical | Structural modeling |
| `GEOX_model_geometries` | 🗑️ REMOVE | Alias | Duplicates above |
| `earth3d_verify_structural_integrity` | ✅ KEEP | Canonical | Physics validation |
| `GEOX_verify_integrity` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `earth3d_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.5 TIME4D (Basin Evolution)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `time4d_simulate_burial` | ✅ KEEP | Canonical | Burial simulation |
| `GEOX_simulate_burial` | 🗑️ REMOVE | Alias | Duplicates above |
| `time4d_reconstruct_paleo` | ✅ KEEP | Canonical | Paleo reconstruction |
| `GEOX_reconstruct_paleo` | 🗑️ REMOVE | Alias | Duplicates above |
| `time4d_verify_timing` | ✅ KEEP | Canonical | Trap/charge timing |
| `GEOX_verify_timing` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `time4d_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.6 MAP (Spatial Fabric)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `map_verify_coordinates` | ✅ KEEP | Canonical | Coordinate validation |
| `GEOX_verify_geospatial` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_get_context_summary` | ✅ KEEP | Canonical | Spatial context |
| `GEOX_get_context_summary` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_render_scene_context` | ✅ KEEP | Canonical | Scene rendering |
| `GEOX_render_scene_context` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_synthesize_causal_scene` | ✅ KEEP | Canonical | Causal scene for 888_JUDGE |
| `GEOX_synthesize_causal_scene` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_earth_signals` | ✅ KEEP | Canonical | Live Earth observations |
| `GEOX_earth_signals` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_project_well` | ✅ KEEP | Canonical | Well projection |
| `GEOX_project_well_trajectory` | 🗑️ REMOVE | Alias | Duplicates above |
| `map_transform_coordinates` | ✅ KEEP | Canonical | CRS transforms |
| `GEOX_transform_coordinates` | 🗑️ REMOVE | Alias | Duplicates above |

**Decision:** Keep `map_*` prefix. Remove all `GEOX_*` aliases.

---

### 1.7 PHYSICS (Sovereign Verification) — **CRITICAL CLEANUP**
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `physics_judge_verdict` | ✅ KEEP | Canonical | 888_JUDGE execution |
| `GEOX_judge_verdict` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_validate_operation` | ✅ KEEP | Canonical | Safety validation |
| `GEOX_validate_operation` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_audit_hold_breach` | ✅ KEEP | Canonical | Breach investigation |
| `GEOX_audit_hold_breach` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_verify_physics` | ✅ KEEP | Canonical | Physical consistency |
| `GEOX_verify_physics` | 🗑️ REMOVE | Alias | Duplicates above |
| `GEOX_verify_canon` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_compute_stoiip` | 🔧 FIX | **WIRE TO** `VolumetricsEconomicsTool` | Was STUB — now real |
| `GEOX_compute_stoiip` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_fetch_authoritative_state` | ✅ KEEP | Canonical | Ground truth state |
| `GEOX_fetch_authoritative_state` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_register` | ✅ KEEP | Canonical | ACP agent registration |
| `acp_register_agent` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_submit` | ✅ KEEP | Canonical | Submit proposal |
| `acp_submit_proposal` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_check_convergence` | ✅ KEEP | Canonical | Convergence check |
| `acp_check_convergence` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_grant_seal` | ✅ KEEP | Canonical | 999_SEAL grant |
| `acp_grant_seal` | 🗑️ REMOVE | Alias | Duplicates above |
| `physics_acp_status` | ✅ KEEP | Canonical | ACP status |
| `acp_get_status` | 🗑️ REMOVE | Alias | Duplicates above |

**CRITICAL FIX:** `physics_compute_stoiip` was returning hardcoded `{"stoiip_mmbbl": 150.5}`. Now properly delegates to `VolumetricsEconomicsTool`.

---

### 1.8 CROSS (Dimension Introspection)
| Tool | Status | Action | Notes |
|------|--------|--------|-------|
| `cross_evidence_list` | ✅ KEEP | Canonical | List evidence |
| `GEOX_search_evidence` | 🗑️ REMOVE | Alias | Duplicates above |
| `GEOX_evidence_list` | 🗑️ REMOVE | Alias | Duplicates above |
| `cross_evidence_get` | ✅ KEEP | Canonical | Get evidence details |
| `GEOX_get_evidence_details` | 🗑️ REMOVE | Alias | Duplicates above |
| `GEOX_evidence_get` | 🗑️ REMOVE | Alias | Duplicates above |
| `cross_dimension_list` | ✅ KEEP | Canonical | List dimensions |
| `GEOX_dimension_list` | 🗑️ REMOVE | Alias | Duplicates above |
| `GEOX_get_tools_registry` | ✅ KEEP | Special | UI registry endpoint |
| `cross_health` | ✅ KEEP | Canonical | Health check |

**Decision:** Keep `cross_*` prefix. Remove `GEOX_*` aliases except `GEOX_get_tools_registry` (UI requirement).

---

## 2. Class-Based Tools (arifos/GEOX/tools/)

| Tool | Status | Action | Location |
|------|--------|--------|----------|
| `EarthModelTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `EOFoundationModelTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `SeismicVLMTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `SimulatorTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `GeoRAGTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `SeismicAttributesTool` | ✅ KEEP | Production | `GEOX_tools.py` |
| `VolumetricsEconomicsTool` | ✅ KEEP | **PRIMARY** | `volumetrics_economics_tool.py` |
| `WellLogTool` | ✅ KEEP | Production | `well_log_tool.py` |
| `SeismicSingleLineTool` | ✅ KEEP | Production | `seismic/seismic_single_line_tool.py` |

---

## 3. Summary Statistics

| Category | Count |
|----------|-------|
| **Canonical tools keeping** | 45 |
| **Aliases removing** | 38 |
| **Critical fixes** | 1 (`physics_compute_stoiip`) |
| **Total reduction** | ~46% fewer tool entries |

---

## 4. Naming Convention (Post-Cleanup)

```
{domain}_{action}_{target}

Domains:
  prospect_  — Play fairway, structural candidates
  well_      — Borehole, logs, petrophysics
  section_   — 2D correlation, profiles
  earth3d_   — 3D seismic, volumes
  time4d_    — Basin modeling, timing
  physics_   — Sovereign verification, ACP
  map_       — Spatial, coordinates, Earth signals
  cross_     — Evidence, dimensions, health

Actions:
  evaluate_, build_, check_   — Prospect
  load_, qc_, compute_        — Well
  interpret_, observe_        — Section
  load_, interpret_, verify_  — Earth3D
  simulate_, verify_          — Time4D
  judge_, validate_, verify_  — Physics
  verify_, get_, render_      — Map
  list_, get_                 — Cross

Exceptions (UI compatibility):
  GEOX_get_tools_registry  — Required by Cockpit UI
```

---

## 5. Verification Checklist

- [x] `physics_compute_stoiip` delegates to `VolumetricsEconomicsTool`
- [x] No hardcoded stub values
- [x] All Monte Carlo uncertainty properly propagated
- [x] Unit conversions explicit (km² vs acres)
- [x] All aliases removed except UI-critical
- [x] Tool registry metadata updated

---

*DITEMPA BUKAN DIBERI — Forged through cleanup, not given through duplication.*

---

## Appendix F: 99-Level Missing Map
*(Reforged from archive — 2557 chars)*

# 99 Level Missing Component Map
**Date:** 2026-04-16
**Substrate:** arifOS MCP

## Missing Modules & Functions

1. **`arifosmcp.runtime.hardened_toolchain`**
   - Missing module completely. `HardenedToolchain` class cannot be imported.
2. **`core.enforcement.routing`**
   - Missing module. Affects `TestRouteRefuse`, `TestRoutingCompatibility`, and `TestShouldRealityCheck`.
3. **`arifosmcp.intelligence.tools`**
   - Missing module. Affects `TestRealityGroundingRealAPI`, `TestSearchResult`, `TestGroundingSearch`, `TestSearchResultProcessing`, `TestThrottlingAndConfig`, `TestSearchWithConsensus`, `TestUnifiedToolOutput`, `TestErrorHandling`, and `TestResultValidation`.
4. **`arifosmcp.runtime.tools` (Missing Exports)**
   - `INIT_ANCHOR`
   - `AGI_REASON`
   - `AGI_REFLECT`
   - `ASI_CRITIQUE`
   - `ASI_SIMULATE`
   - `APEX_JUDGE`
   - `VAULT_SEAL`
   - `reality_compass`
   - `search_reality`
   - `ingest_evidence`
   - `agentzero_engineer`
   - `agentzero_validate`
   - `session_memory`
   - `ollama_local_generate`
5. **`arifosmcp.runtime.tools_hardened_dispatch`**
   - `hardened_init_anchor_dispatch`
6. **`arifosmcp.capability_map`**
   - `InitAnchorMode`
7. **`core.organs.unified_memory`**
   - Import errors related to `blake3` and unified memory structures missing inside `core.organs._4_vault`.

## Missing Files & Schemas

1. **`/root/arifOS/scripts/deploy_production.py`**
   - Missing deployment script affecting `TestDeployProduction`.
2. **`/root/arifOS/schemas/provider_soul.schema.json`**
   - Missing JSON schema for provider soul validation.
3. **`/root/arifOS/schemas/runtime_truth.schema.json`**
   - Missing JSON schema for runtime truth validation.

## Missing Function Signatures & Variables

1. **`arifos_init()`**
   - Missing expected kwargs: `session_class`, `model_soul`, `deployment_id`, `raw_input`.
2. **`arifos_forge()`**
   - Missing expected kwargs: `spec`.
3. **`_probe_intelligence_services`**
   - Missing attribute on `arifosmcp.runtime.tools`.

## Missing Governance & Floor State

1. **Runtime Floors**
   - `F1_Amanah` not in runtime floor enforcement list.
   - `F6` (harm/dignity) not in runtime floor list.
   - `F9` (Anti-Hantu) not in runtime floor list.
2. **CI Gates**
   - Floor registry inaccessible or incomplete. F10 and F11 violated. Confidence thresholds (F2) and Peace constraints (F5) violated.

**Assessment:**
System requires comprehensive synthesis of missing intelligence tools, routing enforcements, and the restoration of the hardened toolchain to achieve 99% operational maturity.