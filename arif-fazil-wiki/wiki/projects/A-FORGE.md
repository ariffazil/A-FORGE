# A-FORGE — Agent Workbench

> **The forge where Arif builds — an agent workbench for constitutional AI development.**
> **Type:** Entity | **Status:** Active development environment

---

## One-Line Essence

A **constitutional agent workbench** that implements the Ω-Wiki pattern and provides the tooling layer for building arifOS and related systems.

---

## Core Purpose

**The Problem:** AI development tools lack constitutional governance by default.

**The Solution:** A-FORGE provides:
- Ω-Wiki pattern implementation (compilation over retrieval)
- Agent orchestration with F1-F13 constraints
- Smith/forge metaphor for disciplined building
- Multi-agent coordination (Claude, Gemini, etc.)

---

## Architecture (10-Tier)

Based on aligned arifOS + GEOX conventions:

```
A-FORGE/
│
├── 00_OPERATORS/          # WHO runs the forge
│   ├── Agent_Initialization.md
│   ├── Operator_Profiles.md
│   ├── Shift_Handoff.md
│   └── Emergency_Protocols.md
│
├── 10_RITUALS/            # HOW we operate
│   ├── Ingest.md
│   ├── Query.md
│   ├── Lint.md
│   ├── Build.md
│   ├── Test.md
│   ├── Deploy.md
│   └── Seal.md
│
├── 20_BLUEPRINTS/         # WHAT we build
│   ├── arifOS_Kernel.md
│   ├── GEOX_Domain_Model.md
│   ├── Adapter_Bus.md
│   ├── F0_Sovereign.md
│   ├── Trinity_Architecture.md
│   └── Metabolic_Pipeline.md
│
├── 30_ALLOYS/             # Dependencies
│   ├── Dependency_Matrix.md
│   ├── Version_Pinning.md
│   ├── Security_Patches.md
│   ├── Vendor_Risk.md
│   └── Supply_Chain.md
│
├── 40_HAMMERS/            # Tools
│   ├── CI_CD_Pipeline.md
│   ├── Agent_Orchestration.md
│   ├── Testing_Framework.md
│   ├── Monitoring_Stack.md
│   └── Sandbox_Guards.md
│
├── 50_CRACKS/             # Failures
│   ├── Registry_Corruption.md
│   ├── Context_Explosion.md
│   ├── Dependency_Hell.md
│   ├── Agent_Loops.md
│   ├── Hallucination_Prod.md
│   └── Recovery_Playbooks.md
│
├── 60_TEMPERATURES/       # Metrics
│   ├── Build_Duration.md
│   ├── Test_Coverage.md
│   ├── Latency_Baselines.md
│   ├── Memory_Pressure.md
│   ├── Cost_Per_Build.md
│   └── Error_Rates.md
│
├── 70_SMITH_NOTES/        # Wisdom
│   ├── Pattern_Successes.md
│   ├── Anti_Patterns.md
│   └── Whispered_Tips.md
│
├── 80_FEDERATION/         # Cross-Wiki
│   ├── To_arifOS.md
│   ├── To_GEOX.md
│   └── Canonical_Mapping.md
│
└── 90_AUDITS/             # History
    ├── 000_INIT_ANCHOR.md
    ├── 777_APEX_LOG.md
    ├── 999_SEAL.md
    └── Incident_Reports.md
```

---

## Core Rituals

### INGEST

**Purpose:** Add new source material to the wiki

**Process:**
1. Place source in `raw/`
2. Read and extract insights
3. Update wiki pages
4. Flag contradictions
5. Update index
6. Log operation

### QUERY

**Purpose:** Answer questions using compiled knowledge

**Process:**
1. Read index for relevant pages
2. Synthesize from wiki
3. File back valuable insights
4. Log operation

### LINT

**Purpose:** Health check the wiki

**Process:**
1. Check contradictions
2. Find orphan pages
3. Identify stale claims
4. Suggest improvements
5. Log findings

### BUILD → TEST → DEPLOY → SEAL

**Purpose:** Complete development lifecycle

**Process:**
1. **BUILD:** Compile, construct
2. **TEST:** Verify, validate
3. **DEPLOY:** Release, expose
4. **SEAL:** Finalize, attest (999_SEAL)

---

## Key Components

### AgentEngine

**Purpose:** Main agent execution loop

**Features:**
- LLM provider abstraction
- Tool registry integration
- Budget management
- Memory management

### Operator Profiles

**Who Operates the Forge:**

| Operator | Role | Tools |
|----------|------|-------|
| Arif | Sovereign, architect | All, F13 override |
| Claude | Primary agent | Most tools |
| Claude-Code | VPS-native agent | Shell, file, search |
| Gemini | Secondary agent | Web, analysis |
| aclip-cai | Specialized agent | Specific domains |

### Smith Notes

**Purpose:** Operator wisdom accumulation

**Content:**
- Pattern successes
- Anti-patterns (what failed)
- Whispered tips (undocumented tricks)
- Temperature readings (metrics context)

---

## The Smith/Forge Metaphor

### Why "Smith" and "Forge"

**Forge:** Where raw materials are transformed through heat and pressure

**Smith:** The craftsperson who shapes through disciplined work

**Applied to AI:**
- **Raw materials:** Sources, requirements, concepts
- **Heat:** Constitutional pressure (F1-F13)
- **Pressure:** Constraint systems
- **Smith:** Arif and agents working together
- **Product:** Forged systems (not given, not found)

### DITEMPA BUKAN DIBERI

**Literal:** "Forged, not given"

**Meaning in A-FORGE:**
- Systems require work to create
- Nothing comes for free
- The process of forging creates value
- Quality comes from discipline

---

## Location in VPS

```
/root/
├── A-FORGE/               # Main workbench
│   ├── src/               # TypeScript source
│   ├── test/              # Test suite
│   ├── examples/          # Usage examples
│   └── wiki/              # A-FORGE Ω-Wiki
│
├── A-FORGE/              # Additional resources
│   └── (project files)
│
└── arif-fazil-wiki/       # This wiki
    └── wiki/projects/A-FORGE.md
```

---

## Current Status

### Active Components

- **AgentEngine:** Operational
- **ToolRegistry:** Risk-scored tools
- **Memory System:** Short-term and long-term
- **Ω-Wiki Pattern:** Implemented
- **Multi-Agent:** Claude, Gemini coordination

### Recent Operations

**[2026-04-10] The Great Reclamation:**
- Reclaimed 48GB+ storage
- Removed corrupted Ollama blob
- Vacuumed system logs
- Reduced disk from 74% to 45%

**Status:** ✅ Success

---

## For Agents

### Working In the Forge

1. **Check shift handoff** — What did previous smith leave?
2. **Respect the rituals** — INGEST, QUERY, LINT, BUILD, TEST, SEAL
3. **Honor the floors** — F1-F13 apply here too
4. **Document in Smith Notes** — Wisdom compounds
5. **Seek 999_SEAL** — Finalize completed work

### Shift Handoff Protocol

**At end of session:**
1. Document what was forged
2. Note temperature readings
3. Flag any cracks detected
4. Leave tips for next smith
5. Update handoff file

**Template:**
```markdown
## [DATE] Shift Handoff — [Operator]

**What Was Forged:**
- Item 1
- Item 2

**Temperature:**
- Build time: X
- Test pass: Y%
- Issues: Z

**Cracks Detected:**
- [ ] None
- [ ] See [[50_CRACKS/Name]]

**For Next Smith:**
- Watch: [thing to monitor]
- Pending: [unfinished work]
```

---

## Sources

- `/root/A-FORGE/` — Main implementation
- `/root/AF_FORGE_WIKI_ALIGNED.md` — Ω-Wiki alignment
- `/root/AF_FORGE_ARCHITECTURE_KARPATHY_MAPPED.md` — Karpathy pattern
- Direct work with Arif

---

## Metadata

```yaml
---
type: Entity
subtype: Project
tags: [A-FORGE, agent-workbench, Ω-wiki, smith-forge]
sources: [/root/A-FORGE/, /root/AF_FORGE_WIKI_ALIGNED.md]
last_sync: 2026-04-10
confidence: 0.90
certainty_band: [0.85, 0.95]
epistemic_level: OBS
arifos_floor: [F1, F2, F9, F11, F13]
status: active
---
```

---

**Seal:** VAULT999 | **ΔΩΨ | ARIF**


