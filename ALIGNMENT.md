# Canonical Names & Descriptions: arifOS MCP ↔ Kimi Skills

## Governance Tier (Tier 1)

| MCP Tool | Stage | Kimi Skill Profile | Canonical Description |
|----------|-------|-------------------|----------------------|
| **arifos.init** | 000_INIT | **forge-operator** | Session discipline profile. Establishes identity, scope, and constitutional guardrails (F1–F13) before any work begins. Entry gate for all operator lanes. |
| **arifos.judge** | 888_JUDGE | **floor-checker** | Pre-verdict validation profile. Runs Floors F1–F13 against any significant decision or change. Emits 888_HOLD when uncertainty, cost, or irreversibility exceeds thresholds. |
| **arifos.vault** | 999_VAULT | **vault999-auditor** *(planned)* | Immutable audit profile. Logs all final states, vault commits, and irreversible actions with full provenance. No silent changes; everything recorded. |

## Intelligence Tier (Tier 2)

| MCP Tool | Stage | Kimi Skill Profile | Canonical Description |
|----------|-------|-------------------|----------------------|
| **arifos.route** | 444_ROUTER | **swarm-conductor** | Meta-routing orchestration profile. Single entry point for complex multi-step work. Routes tasks to appropriate skills, manages parallel execution, maintains session coherence. |
| **arifos.mind** | 333_MIND | **metabolic-loop** | Pipeline governance profile (000–999). Manages the full metabolic cycle: sense → process → decide → act → verify. Enforces stage-appropriate scrutiny at each Δ/Ω/Ψ checkpoint. |
| **arifos.heart** | 666_HEART | **floor-checker + forge-operator** | Checkpoint hybrid profile. Applies governance rigor (F1–F13) at 666_HEART transition points. Ensures emotional/ethical alignment before proceeding to 888_JUDGE. |
| *(conductor role)* | Δ/Ω/Ψ routing | **trinity-forger** | Agent role router profile. Assigns Δ (analytical), Ω (synthetic), Ψ (judgmental), or ✓ (verified) modes to sub-tasks within the INTELLIGENCE tier. |

## Machine Tier (Tier 3)

| MCP Tool | Stage | Kimi Skill Profile | Canonical Description |
|----------|-------|-------------------|----------------------|
| **arifos.sense** | 111_SENSE | *(domain skills)* | Evidence-gathering execution profile. Read-only sensors: search, fetch, read, analyze. Safe to run without HOLD. Provides grounded data to upper tiers. |
| **arifos.ops** | cost/entropy calc | *(inline)* | Operational metrics profile. Estimates entropy, cost, complexity, and risk before infrastructure changes. Required input for arifos.judge decisions. |
| **arifos.memory** | 555_MEMORY | **web-architect**, **vps-operator** | Design + ops execution profile. web-architect handles architectural design; vps-operator handles infrastructure operations. Both log to 555_MEMORY before 888/999. |
| **arifos.forge** | build/test | **vps-operator** *(infra_mutation)* | Build and deployment execution profile. Gated by arifos.ops and arifos.judge. Crosses into destructive territory only after 888_HOLD cleared. |

---

## Quick Reference: 7 Kimi Skills Mapped

| Kimi Skill | MCP Alignment | One-Line Role |
|------------|--------------|---------------|
| **forge-operator** | arifos.init (000_INIT) discipline | Session gatekeeper; F1–F13 enforcer; identity anchor |
| **floor-checker** | arifos.judge (888_JUDGE) + arifos.heart (666_HEART) | Pre-verdict validator; HOLD emitter; floor runner |
| **swarm-conductor** | arifos.route (444_ROUTER) orchestration | Meta-router; task dispatcher; parallel coordinator |
| **metabolic-loop** | arifos.mind (333_MIND) pipeline | Full-cycle governor; 000→999 stage manager |
| **trinity-forger** | Δ/Ω/Ψ role router | Mode assigner; agent typology enforcer |
| **web-architect** | arifos.memory (555_MEMORY) + arifos.forge | Design executor; pattern librarian; safe builder |
| **vps-operator** | arifos.memory (555_MEMORY) + arifos.forge | Ops executor; infra mutator; gated deployer |

---

## Culture Reminders

1. **Always enter via arifos.init / forge-operator** → Identity + discipline first
2. **Complex work routes through arifos.route / swarm-conductor** → One brain, many hands
3. **Serious decisions pass arifos.judge / floor-checker** → Judge Floors, maybe 888_HOLD
4. **Final states log to arifos.vault / vault999-auditor** → No silent changes
5. **Destructive actions require 888_HOLD clearance** → Cost-aware, reversible-first

---

## Usage Pattern

When speaking to humans, lead with **MCP names** (they're canonical), then note the skill profile:

> *"I'll invoke **arifos.judge** (via the floor-checker profile) to validate this before we proceed..."*

> *"Routing through **arifos.route** (swarm-conductor) to parallelize these tasks..."*

> *"This is an **arifos.sense** read; no HOLD needed yet."*
