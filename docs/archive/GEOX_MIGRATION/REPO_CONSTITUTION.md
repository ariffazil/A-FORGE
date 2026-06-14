# TOMBSTONE — Migrated GEOX Document

> **Status:** ARCHIVED / NOT CANONICAL IN A-FORGE  
> **Origin:** GEOX repo (ariffazil/geox)  
> **Migrated to:** A-FORGE/docs/archive/GEOX_MIGRATION/  
> **Reason:** These documents were copied into A-FORGE during earlier federation consolidation. They belong to the GEOX (Earth Intelligence) or WEALTH (Capital Intelligence) sibling repos, not the A-FORGE execution shell. Keep them here for audit lineage only; do not treat them as A-FORGE canonical truth.  
> **Canonical SoT:** ariffazil/arifos/FEDERATION_CONTRACT.md and ariffazil/arifos/FEDERATION_STATUS.md

---

# GEOX Repository Constitution 🔩 — INTERNAL REFERENCE ONLY

> ⚠️ **SUBORDINATE DOCUMENT — NOT SOVEREIGN CONSTITUTIONAL AUTHORITY**
> This file describes GEOX's internal organizational structure. It is not a
> sovereign constitution and does not grant or define constitutional authority.
>
> **Canonical constitutional authority lives in:** `ariffazil/arifOS`
> For live federation status, see: `ariffazil/arifOS/FEDERATION_STATUS.md`

**Version:** 1.0.0
**Date:** 2026-04-12
**Status:** INTERNAL REFERENCE (not canonical law)

---

## The Core Doctrine

This repository is unified under **One Contract, Multiple Planes**.
To prevent chaos, semantic drift, and uncontrolled branching, all code must adhere to strict folder boundaries. The repository is organized into distinct logical zones, and cross-contamination is strictly forbidden.

### 1. Contract Plane (`contracts/`)
**The Single Source of Truth.**
This folder defines the absolute public interface for GEOX. Nothing here depends on `fastmcp` or `vps` runtimes. It is the constitution.
- **Owns:** Canonical tool names, request schemas, artifact schemas, standard response envelopes, governance status enums, and the runtime parity matrix.
- **Rule:** If a feature or artifact is not defined here, it does not exist in GEOX.

### 2. Control Plane (`control_plane/`)
**The Showroom and Dashboard Router.**
This folder houses the FastMCP registry, app manifests, and dashboard APIs.
- **Owns:** Registry listings, MCP App manifests, UI metadata, capability discovery, and routing adapters.
- **Rule:** The control plane *must not* execute heavy geological or physical logic. It routes requests to the correct execution backend.

### 3. Execution Plane (`execution_plane/`)
**The Governed Engine Room.**
This folder houses the sovereign execution environment (e.g., VPS).
- **Owns:** Seismic volume processing, petrophysics compute, physical validation, and evidence-grounded operations.
- **Rule:** The execution plane *must not* define public API contracts. It merely implements the interfaces defined in the `contracts/` plane.

### 4. Domain Layer (`domain/`)
**The Science Logic.**
This folder holds the pure geological and physical logic.
- **Owns:** Prospect evaluation models, petrophysical equations, map projection math.
- **Rule:** Domain code is strictly scientific. It does not know about MCP, REST, or UI formatting.

### 5. Governance Layer (`governance/`)
**The Constitutional Logic.**
This folder enforces F1-F13 floors and the 888_HOLD logic.
- **Owns:** Verdict evaluation, bias checks, and operational halts.
- **Rule:** Governance code is decoupled from domain logic. It acts as an independent auditing wrapper.

### 6. Compatibility Zone (`compatibility/`)
**The Quarantine Area.**
This folder is the resting place for all legacy aliases, deprecated endpoints, and transitional mappings.
- **Owns:** Old `GEOX_` namespaces, deprecated flat return payloads.
- **Rule:** *No new features are born here.* This folder exists solely to prevent breaking existing integrations while they migrate to the canonical contracts.

---

## Unification Parity 

- Both `GEOX-FastMCP` and `GEOX-VPS` runtimes **must** return the exact same `primary_artifact` shape for a given canonical tool.
- Both runtimes **must** wrap their responses in the canonical standard envelope defined in `contracts/enums/statuses.py` and `contracts/schemas/response/envelope.py`.
- Any discrepancy between the execution plane and control plane must be resolved in the adapter layers, ensuring the public contract remains immutable.

*DITEMPA BUKAN DIBERI — Forged, Not Given*


---

## Appendix: SOT AAA Federation Mapping
*(Reforged from archive — 1867 chars)*

# SOT: AAA Federation Runtime Mapping (Archived Snapshot)
> ⚠️ Historical cross-repo snapshot from 2026-05-11.
> Keep for audit lineage only; verify live state independently.
**Timestamp:** 2026-05-11
**Status:** LIVE_WITH_ONE_EXECUTION_GAP
**Seal:** PARTIAL — execution bridge absent, federation surfaces otherwise healthy

This document is the current cross-repo runtime map for the AAA-led federation after ingress repair, WEALTH invariant sealing, and arifOS readiness repair.

---

## Federation Runtime Snapshot

| Organ | Repo | Public / Local Surface | Current Truth |
|---|---|---|---|
| AAA | `/root/AAA` | `https://aaa.arif-fazil.com/ready` | `healthy` |
| arifOS | `/root/arifOS` | `https://arifos.arif-fazil.com/ready` | `pass` |
| GEOX | `/root/geox` | `https://geox.arif-fazil.com/ready` | `ok` |
| WEALTH | `/root/wealth` | `https://wealth.arif-fazil.com/ready` | `ready` |
| WELL | `/root/WELL` | `https://well.arif-fazil.com/ready` | `WELL_PASS` |
| A-FORGE bridge | `/root/A-FORGE` | `127.0.0.1:7071/health` | **unreachable** |

---

## Routing Law

1. **AAA** identifies and brokers the operator session.
2. **arifOS** judges with the 13 canonical tools and F1-F13 floors.
3. **GEOX / WEALTH / WELL** provide earth, capital, and human-readiness evidence.
4. **A-FORGE** is still the execution adapter of record, but its standalone bridge container is not currently running.
5. **VAULT999** remains the immutable audit destination.

---

## Current Constraint

The federation is no longer in the earlier transition described by this document's previous revision. The actual current gap is narrower:

- ingress is fixed,
- arifOS readiness is fixed,
- WEALTH canonical invariant surface is live,
- but the A-FORGE bridge runtime at `127.0.0.1:7071` is not up.

Any future execution-seal claim must account for that missing bridge runtime explicitly.

---

## Appendix: Alignment Document
*(Reforged from archive — 4714 chars)*

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