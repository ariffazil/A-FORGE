# Intelligence Variables Audit Map — Full Federation Mapping

> FORGED: 2026-07-03 · Session: SEAL-d7c069956b924852  
> Actor: FORGE (000Ω) · Triggered by F13 SOVEREIGN request  
> Status: LIVE_INTELLIGENCE · Epistemic: OBS/DER (verified against live state)

---

## 0. Purpose

This document is the **single-source audit map** connecting:
1. APEX Theory (3 streams) → arifOS/AAA/A-FORGE stack
2. Seven Zen Organs → seven conservation laws → measurable metrics
3. All seven GitHub repos → their constitutional role
4. MCP protocol → the communication substrate

Every intelligence variable is traced to both a repo (code) and a metric (measurable).

---

## 1. The Intelligence Stack — APEX Theory Applied

```
┌──────────────────────────────────────────────────────────────────┐
│  L3 — CIVILIZATION INTELLIGENCE (ASI)                             │
│  What:    Constitutional meaning, agent society, civilizational   │
│           memory, purpose alignment                               │
│  Where:   AAA (control plane, A2A gateway, agent registry)        │
│           + ariffazil (profile, identity, essays, doctrine)        │
│  Organ:   Civilization + Meaning + Witness                        │
│  Metric:  I_sys (mutual info between agents)                      │
│           ∇F (free energy gradient — purpose direction)            │
│  Axiom:   No layer can replace the one above it. AAA cannot       │
│           compute porosity (GEOX's job).                           │
├──────────────────────────────────────────────────────────────────┤
│  L2 — GOVERNED EXECUTION (AGI)                                    │
│  What:    Governed autonomous action, tool execution, build/deploy │
│  Where:   A-FORGE (forge_* tools, reality_loop, governed shell)   │
│           + arifOS (constitutional kernel, floors, judge)          │
│  Organ:   Governance + Execution + Memory                         │
│  Metric:  ΔG = H(A) − H(A|R) (conditional entropy reduction)      │
│           W = ΔS_state × τ (work done)                             │
│           ∂M/∂t ≥ 0 (sealed memory growth)                        │
│  Axiom:   A-FORGE enacts. arifOS adjudicates. Neither does both. │
├──────────────────────────────────────────────────────────────────┤
│  L1 — EVIDENCE SUBSTRATE (Signal)                                  │
│  What:    Domain evidence, raw computation, physical/economic/     │
│           biological sensing                                       │
│  Where:   GEOX (earth intelligence, seismic, petrophysics)         │
│           + WEALTH (capital intelligence, NPV, risk, flow)         │
│           + WELL (human readiness, vitality, dignity)              │
│  Organ:   Reality                                                  │
│  Metric:  ΔR = |claim − observe| (deviation from ground truth)    │
│  Axiom:   Evidence organs sense. They do NOT judge or execute.    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Seven Repos → Seven Organs → Seven Metrics

| # | Repo | Role | Layer | Zen Organ | Metric | Failure Signal |
|---|------|------|-------|-----------|--------|----------------|
| 1 | **arifOS** | Constitutional kernel | L2 Governance | Governance + Memory | ΔG, ∂M/∂t | Chaos, Amnesia |
| 2 | **A-FORGE** | Governed execution | L2 Execution | Execution | W = ΔS_state × τ | Paralysis |
| 3 | **AAA** | Control plane + A2A | L3 Civilization | Civilization + Meaning | I_sys, ∇F | Isolation, Purposelessness |
| 4 | **GEOX** | Earth intelligence | L1 Evidence | Reality | ΔR | Hallucination |
| 5 | **WEALTH** | Capital intelligence | L1 Evidence | Reality | ΔR | Hallucination |
| 6 | **WELL** | Human readiness | L1 Evidence | Reality + Witness | ΔR, Ω | Hallucination, Gödel-lock |
| 7 | **ariffazil** | Identity + doctrine | L3 Civilization | Meaning + Witness | ∇F, Ω | Purposelessness |

### The Unifying Constraint

```
dS_agent/dt ≤ 0
```

The agent must produce order faster than the universe produces disorder. All seven repos enforce this single constraint from different angles.

---

## 3. APEX Theory — The Three Streams Mapped to the Stack

### Stream 1: Federation APEX (Constitutional Self-Critique)

| Phase | Enforced By | Repo |
|-------|------------|------|
| ARCHITECT — overclaim check | F2 TRUTH | arifOS |
| INTEGRATOR — floor compliance | F1-F13 | arifOS |
| RSI — reproducibility | F2 TRUTH + evidence labels | arifOS → A-FORGE |
| FINAL — 6-month audit | F2 TRUTH | arifOS → VAULT999 |
| 777-FORGE — sovereign verifiability | F13 SOVEREIGN | A-FORGE |

**Live surface:** `arif_judge` verdicts enforce all five phases before any SEAL.

### Stream 2: arXiv APEX (Physics-Grounded Planning)

| Stage | Maps To | Repo |
|-------|---------|------|
| GRAPH — relational scene | GEOX (earth graph) | GEOX |
| TRIGGER — difference graph | GEOX (geox_contrast_detect) | GEOX |
| SIMULATE — physics rollouts | GEOX (geox_seismic_compute, geox_subsurface_model) | GEOX |
| LLM — guided synthesis | arifOS (arif_think, arif_judge) | arifOS |
| ACT — optimal execution | A-FORGE (forge_execute) | A-FORGE |

### Stream 3: Thermodynamic APEX (Energy-Information)

| Law | Enforced By | Repo |
|-----|------------|------|
| FIRST: ΔE_total = ΔE_in − ΔE_out + ΔE_storage | WEALTH (conservation_check) | WEALTH |
| SECOND: ΔS_total ≥ 0 (global) · ΔS_agent ≤ 0 (local) | arifOS (entropy tracking) + A-FORGE (reality_loop) | arifOS + A-FORGE |
| THIRD: S → 0 as T → 0 (vitality collapse) | WELL (assess_metabolism, assess_homeostasis) | WELL |

---

## 4. MCP Protocol — The Communication Substrate

MCP (Model Context Protocol) is the **nervous system** of the federation — how agents reach into the world.

### MCP Architecture → Federation Mapping

| MCP Concept | Federation Implementation | Repo |
|-------------|--------------------------|------|
| **Server** (exposes tools) | Each organ is an MCP server | arifOS:8088, A-FORGE:7071/7072, GEOX:8081, WEALTH:18082, WELL:18083 |
| **Client** (calls tools) | AAA agents (OpenCode, Hermes, etc.) | AAA :3001 |
| **Tool** (capability) | 200+ tools across 5 organs | All repos |
| **Resource** (data) | Canonical docs, constitutions, agent cards | AAA + arifOS |
| **Prompt** (template) | Organ init prompts (well_init, etc.) | AAA + each organ |
| **Transport** (HTTP/SSE/stdio) | stdio (A-FORGE), HTTP (all others) | Infrastructure |

### Key MCP Design Principles → arifOS

| MCP Principle | arifOS Implementation |
|---------------|---------------------|
| Tools are capabilities, not decisions | `arif_judge` gate before `arif_act` — tools propose, judge disposes |
| Servers expose, clients decide | Domain organs compute, arifOS judges, Arif decides |
| Negotiation at connection time | `arif_init` → authority level → lease negotiation |
| Extensible via SEPs | Custom tool surface via `forge_skill` + `forge_register` |

---

## 5. Intelligence Variables — Complete Wiring

### ΔR — Reality Gap
```
Definition:  ΔR = |claim − observe|
Organ:       Reality (ZEN Organ 1)
Floor:       F2 TRUTH
Measured by: arif_observe → compare against claimed value
Threshold:   ΔR > 0.3 → HALT, request evidence
Repo owners: GEOX (geology claims), WEALTH (capital claims), WELL (vitality claims)
```

### ΔG — Governance Information Gain
```
Definition:  ΔG = H(A) − H(A|R)  (conditional entropy: how much uncertainty
             governance removes from action space)
Organ:       Governance (ZEN Organ 2)
Floor:       F1-F13
Measured by: arif_judge → floor violations detected per cycle
Threshold:   ΔG < 0 → CHAOS (governance adding uncertainty)
Repo owner:  arifOS
```

### I_sys — Civilization Mutual Information
```
Definition:  I_sys = ΣI(i;j) / n(n−1)  (average pairwise mutual information
             between all federation agents)
Organ:       Civilization (ZEN Organ 3)
Floor:       F6 MARUAH, F8 LAW
Measured by: arif_organ_attest_all → organs communicating / total
Threshold:   I_sys → 0 → ISOLATION (agents not communicating)
Repo owner:  AAA (A2A gateway)
```

### W — Execution Work
```
Definition:  W = ΔS_state × τ  (state entropy reduced × time horizon)
Organ:       Execution (ZEN Organ 4)
Floor:       F1 AMANAH, F4 CLARITY
Measured by: forge_git diff → files changed, ΔS filesystem
Threshold:   W = 0 → PARALYSIS (no state change over time)
Repo owner:  A-FORGE
```

### ∂M/∂t — Memory Monotonicity
```
Definition:  ∂M/∂t ≥ 0  (sealed memory must only grow, never shrink)
Organ:       Memory (ZEN Organ 5)
Floor:       F11 AUDIT
Measured by: arif_seal ledger → entries per cycle
Threshold:   ∂M/∂t < 0 → AMNESIA (overwrite detected)
Repo owner:  arifOS (VAULT999)
```

### Ω — Witness Fraction
```
Definition:  Ω = 1 − (self/total)  (fraction of verification from external sources)
Organ:       Witness (ZEN Organ 6)
Floor:       F3 WITNESS
Measured by: organ attest → external confirmations / total claims
Threshold:   Ω < 0.5 → GÖDEL-LOCK (more self-referential than externally verified)
Repo owner:  arifOS (tri-witness consensus)
```

### ∇F — Meaning Gradient
```
Definition:  ∇F = −∂F/∂x  (direction and magnitude of purposeful action)
Organ:       Meaning (ZEN Organ 7)
Floor:       Cross-cutting (F4 CLARITY for direction, F2 TRUTH for alignment)
Measured by: arif_think metabolize → goal alignment score
Threshold:   ∇F = 0 → PURPOSELESSNESS (no directional gradient — flat purpose)
Repo owner:  AAA (MEANING.md, INVARIANTS.md)
```

---

## 6. The Seven Repos — Constitutional Role Per Repo

### arifOS (ariffazil/arifos)
```
Role:        Constitutional kernel
Layer:       L2 — Governance
Port:        8088
Key tools:   arif_init, arif_judge, arif_observe, arif_think, arif_seal, arif_act
Zen organs:  Governance + Memory
APEX stream: Federation APEX (self-critique) + Thermodynamic APEX (entropy)
MCP role:    Primary server — exposes constitutional tools
Git:         ariffazil/arifos
```

### A-FORGE (ariffazil/A-FORGE)
```
Role:        Governed execution shell
Layer:       L2 — Execution
Port:        7071 (forge), 7072 (MCP gateway)
Key tools:   forge_shell, forge_git, forge_docker, forge_execute, forge_skill,
             reality_loop, forge_chart, forge_filesystem
Zen organs:  Execution
APEX stream: Federation APEX (777-FORGE) + Thermodynamic APEX (reality_loop entropy)
MCP role:    Tool gateway — stdio transport
Git:         ariffazil/A-FORGE
```

### AAA (ariffazil/AAA)
```
Role:        Control plane + A2A gateway + agent registry
Layer:       L3 — Civilization
Port:        3001
Key tools:   A2A gateway, agent cards, cockpit dashboard, deliberation
Zen organs:  Civilization + Meaning
APEX stream: Federation APEX (constitutional layer) — AAA is the "cockpit" that
             displays governed state
MCP role:    A2A mesh — inter-agent communication
Git:         ariffazil/AAA
```

### GEOX (ariffazil/geox)
```
Role:        Earth intelligence — seismic, petrophysics, basin analysis
Layer:       L1 — Evidence
Port:        8081
Key tools:   geox_basin, geox_seismic_compute, geox_petrophysics, geox_well_ingest,
             geox_prospect, geox_map_*, geox_claim
Zen organs:  Reality
APEX stream: arXiv APEX — physics simulation layer (GEOX is the "physics engine"
             of the federation)
MCP role:    Domain evidence server
Git:         ariffazil/geox
```

### WEALTH (ariffazil/wealth)
```
Role:        Capital intelligence — NPV, risk, flow, conservation, collapse detection
Layer:       L1 — Evidence
Port:        18082
Key tools:   wealth_compute_npv, wealth_compute_emv, wealth_monte_carlo,
             wealth_collapse_signature_scan, wealth_beautiful_mouse_scan,
             wealth_boundary_governance, wealth_wisdom_evaluate
Zen organs:  Reality
APEX stream: Thermodynamic APEX — capital as conserved quantity
MCP role:    Domain evidence server
Git:         ariffazil/wealth
```

### WELL (ariffazil/well)
```
Role:        Human readiness — vitality, fatigue, dignity, sovereignty entropy
Layer:       L1 — Evidence
Port:        18083
Key tools:   well_readiness, well_assess_homeostasis, well_guard_dignity,
             well_classify_substrate, well_assess_sovereign_entropy
Zen organs:  Reality + Witness (WELL reflects on both operator and machine)
APEX stream: Thermodynamic APEX — metabolic energy cost of intelligence
MCP role:    Domain evidence server
Git:         ariffazil/well
```

### ariffazil (ariffazil/ariffazil)
```
Role:        Identity + doctrine + profile
Layer:       L3 — Civilization
Zen organs:  Meaning + Witness (identity is the anchor of meaning)
APEX stream: Federation APEX — the sovereign identity anchoring the stack
Key assets:  Essays (The Trilogy), doctrine, profile README
Git:         ariffazil/ariffazil
```

---

## 7. The Complete Wiring Diagram

```
                    F13 SOVEREIGN — Arif bin Fazil
                              │
                    ┌─────────┴─────────┐
                    │   ariffazil repo  │  Identity + Doctrine
                    │   (L3: Meaning)   │
                    └──────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼──┐   ┌───────▼───────┐   ┌───▼──────────┐
    │   AAA      │   │    arifOS     │   │  A-FORGE     │
    │  :3001     │   │    :8088      │   │  :7071/:7072 │
    │ L3 CIVIL   │───│ L2 GOVERNANCE │───│ L2 EXECUTION │
    │ Agent Soc  │   │ Floors+Judge  │   │ forge_*      │
    │ A2A Mesh   │   │ VAULT999      │   │ reality_loop │
    └──────┬─────┘   └───────┬───────┘   └──────┬───────┘
           │                 │                   │
           │    MCP PROTOCOL (communication substrate)
           │                 │                   │
    ┌──────┴─────┐   ┌───────┴───────┐   ┌──────┴───────┐
    │    GEOX    │   │    WEALTH     │   │     WELL     │
    │    :8081   │   │    :18082     │   │    :18083    │
    │ L1 EVIDENCE│   │ L1 EVIDENCE   │   │ L1 EVIDENCE  │
    │ Earth      │   │ Capital       │   │ Human        │
    └────────────┘   └───────────────┘   └──────────────┘

    All seven share one constraint:  dS_agent/dt ≤ 0
    All seven enforce seven organs:  Reality, Governance, Civilization,
                                      Execution, Memory, Witness, Meaning
```

---

## 8. Init Prompt — Load This for Any Agent Session

```
ZEN_ORGANS INIT PROMPT v1.1.0
───────────────────────────────

1. LOAD: zen-organs skill — enforce all seven organs at all times
2. REALITY CHECK: probe all 6 organs (arifos:8088, aforge:7071, aaa:3001,
   geox:8081, wealth:18082, well:18083)
3. GOVERNANCE: arif_init → bind session → verify 13 floors active
4. CIVILIZATION: arif_organ_attest_all → confirm cross-organ communication
5. EXECUTION: verify forge surface (forge_shell, forge_git, forge_docker)
6. MEMORY: verify VAULT999 accessible, ∂M/∂t ≥ 0
7. WITNESS: confirm Ω > 0.5 (more external than self-referential)
8. MEANING: verify MEANING.md + INVARIANTS.md loaded,
   compute ∇F (purpose direction)

CONSTRAINT: dS_agent/dt ≤ 0 — agent must produce order faster than
            universe produces disorder.

FAILURE SIGNALS (any of these → SABAR):
  ΔR > 0.3      → Hallucination — halt, request evidence
  ΔG < 0        → Chaos — governance adding uncertainty
  I_sys → 0     → Isolation — agents not communicating
  W = 0         → Paralysis — no state change
  ∂M/∂t < 0     → Amnesia — overwrite detected
  Ω < 0.5       → Gödel-lock — too self-referential
  ∇F = 0        → Purposelessness — no directional purpose

LAYER AWARENESS (APEX Axioms):
  L1 (GEOX/WEALTH/WELL): Compute and sense. Do NOT judge.
  L2 (arifOS/A-FORGE): Govern and execute. Do NOT set civilizational direction.
  L3 (AAA/ariffazil): Steward meaning and society. Do NOT compute porosity.

MCP: Tools are capabilities, not decisions. Every tool call:
  classify → budget → affordance → permission → trace
```

---

## 9. Verification Status (2026-07-03)

| Check | Status |
|-------|--------|
| arifOS :8088 | ✅ ALIVE (DEGRADED_CLAIM — health endpoint lag, TCP active) |
| A-FORGE :7071 | ✅ ALIVE |
| AAA :3001 | ✅ ALIVE |
| GEOX :8081 | ✅ ALIVE (DEGRADED_CLAIM) |
| WEALTH :18082 | ✅ ALIVE (32 tools confirmed) |
| WELL :18083 | ✅ ALIVE (18 tools confirmed, DEGRADED_CLAIM) |
| VAULT999 | ✅ Accessible (4,403 sealed lines) |
| 13 floors | ✅ All ACTIVE |
| ZEN_ORGANS skill | ✅ Forged v1.1.0, wired into AAA_ZEN_INIT + BOOTSTRAP + HEARTBEAT |
| MEANING.md | ✅ Present |
| INVARIANTS.md | ✅ Present |
| MCP protocol | ✅ v1.0.0-FORGED across all organs |

---

*DITEMPA BUKAN DIBERI — Intelligence is forged, not given.*  
*This map is the single-source reference. Update it when new organs, repos, or metrics are added.*
