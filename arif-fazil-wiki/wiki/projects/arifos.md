# arifOS — Constitutional AI Runtime

> **Arif's flagship project: A governance layer for AI systems.**
> **Type:** Entity | **Status:** Founder-built prototype, architecturally mature

---

## One-Line Essence

A **constitutional runtime** for AI systems that binds machine intelligence to human sovereignty through 13 enforceable floors (F1-F13), the Trinity Architecture (ΔΩΨ), and the Metabolic Loop (000-999).

---

## Core Purpose

**The Problem:** AI systems are becoming more capable without becoming more legitimate. Most frameworks optimize for capability; few optimize for governed legitimacy.

**The Solution:** arifOS inserts a governance layer between model intelligence and machine action, ensuring:
- Human sovereignty is preserved (F13)
- Truth is grounded (F2)
- Actions are reversible until sealed (F1)
- Everything is auditable (F11)

---

## Architecture

### Trinity Architecture (ΔΩΨ)

```
┌─────────────────────────────────────────────────────────────┐
│                         Δ (SOUL)                            │
│              Values, Ethics, Constraints                    │
│                    F1-F13 Floors                            │
├─────────────────────────────────────────────────────────────┤
│                         Ω (MIND)                            │
│              Logic, Reasoning, Planning                     │
│                   Verdict Engine                            │
├─────────────────────────────────────────────────────────────┤
│                         Ψ (BODY)                            │
│              Execution, Tools, Actions                      │
│                   Tool Registry                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Each layer constrains the one below. Ψ cannot override Ω. Ω cannot override Δ.

### The 13 Constitutional Floors (F1-F13)

| Floor | Name | Core Binding | Purpose |
|-------|------|--------------|---------|
| F1 | Amanah | Rollback required | Responsibility |
| F2 | Truth | Grounded claims | Epistemic integrity |
| F3 | Tri-Witness | 3-source verification | Robust evidence |
| F4 | Justice | Fair distribution | Equity |
| F5 | Harm | Do no harm | Safety floor |
| F6 | Dignity | Respect persons | Human dignity |
| F7 | Humility | Max confidence 0.95 | Uncertainty acknowledgment |
| F8 | Continuity | Persistent identity | Coherence |
| F9 | Anti-Hantu | No deception | Transparency |
| F10 | Form | Coherent structure | Architecture |
| F11 | Audit | Full provenance | Traceability |
| F12 | Recursion | Self-reference | Meta-cognition |
| F13 | Sovereign | Human authority | Ultimate control |

**F13 is foundational:** All other floors serve human sovereignty.

### Metabolic Loop (000-999)

The complete lifecycle of an arifOS operation:

```
000_INIT → 111_SENSE → 222_PLAN → 333_ROUTE → 444_BUILD → 555_TEST → 666_DEPLOY → 777_APEX → 888_HOLD? → 999_SEAL
```

| Stage | Name | Function | Floor |
|-------|------|----------|-------|
| 000 | INIT | Begin with purpose | F1 |
| 111 | SENSE | Gather evidence | F2 |
| 222 | PLAN | Form intention | F3, F7 |
| 333 | ROUTE | Choose path | F4 |
| 444 | BUILD | Construct | F9 |
| 555 | TEST | Verify | F2 |
| 666 | DEPLOY | Release | F1 |
| 777 | APEX | Peak capability | F7 |
| 888 | HOLD | Veto if needed | F13 |
| 999 | SEAL | Finalize | F1, F11 |

---

## Key Components

### 1. AgentEngine

**Purpose:** Main execution loop for AI agents

**Responsibilities:**
- Drive LLM conversation loop
- Execute tool calls with permission checks
- Manage memory (short-term and long-term)
- Enforce budget constraints

**Location:** `A-FORGE/src/engine/AgentEngine.ts`

### 2. ToolRegistry

**Purpose:** Register and dispatch tools with risk scoring

**Risk Levels:**
- `safe` — No restrictions
- `guarded` — Permission check
- `dangerous` — Requires explicit enablement

**Enforcement:** F9 (no hidden tool use), F13 (human can block)

### 3. BudgetManager

**Purpose:** Track token and turn budgets

**Function:** Prevent runaway consumption, enforce limits

### 4. Memory System

**Short-Term Memory:**
- In-session transcript
- Current conversation context

**Long-Term Memory:**
- File-backed persistent storage
- Ω-Wiki pattern compilation

### 5. VAULT999

**Purpose:** Final attestation and seal

**Function:**
- 999_SEAL protocol
- Irreversibility marker
- Complete audit trail

**Critical:** Once sealed, action cannot be undone.

---

## Governance Mechanisms

### 888_HOLD — The Safety Veto

**Trigger Conditions:**
- F13 sovereignty violation detected
- F2 truth threshold not met
- F1 amanah violation (irreversible without plan)
- F9 hantu detected (deception/manipulation)
- Confidence below threshold for critical action

**Effect:** All action stops. Human (Arif) must review and release.

**Override:** None. 888_HOLD is absolute.

### Verdict System

**Purpose:** Explicit judgment states for decisions

**States:**
- `PENDING` — Awaiting judgment
- `APPROVED` — Cleared to proceed
- `REJECTED` — Blocked
- `CONDITIONAL` — Approved with constraints

**Association:** 777_APEX stage

### Audit Trail (F11)

**Logged:**
- Every tool call
- Every LLM completion
- Every verdict
- Every 888_HOLD and 999_SEAL

**Format:** Structured JSON with full provenance

---

## Comparison to Other Systems

### vs. LangGraph

| Dimension | LangGraph | arifOS |
|-----------|-----------|--------|
| Focus | Production orchestration | Constitutional governance |
| Strength | Durable execution | Sovereignty preservation |
| Approach | Workflow control | Legitimacy optimization |
| Result | More deployable | More civilizationally opinionated |

### vs. OpenAI Agents SDK

| Dimension | OpenAI SDK | arifOS |
|-----------|------------|--------|
| Focus | Fast agent building | Governed legitimacy |
| Strength | Tool ecosystem | Constitutional depth |
| Approach | Primitives | Constraints |
| Result | Faster to build | More bound |

### vs. Microsoft/Google Agent Platforms

| Dimension | Enterprise Platforms | arifOS |
|-----------|---------------------|--------|
| Focus | Enterprise integration | Sovereignty |
| Strength | Scale, security plumbing | Philosophical coherence |
| Approach | Full-stack platform | Constitutional runtime |
| Result | Platform | Constitution |

---

## Current Status

### What's Working

- **Architecture:** Trinity (ΔΩΨ) is coherent and implemented.
- **V2.0.0 Hardening (New):** Canonical contracts layer (identity, verdicts, artifacts, continuity) implemented to eliminate semantic drift.
- **Unified Transport:** Single `ResponseEnvelope` contract shared across STDIO, HTTPS, and SSE.
- **Floors:** F1-F13 framework is defined and enforced via the hardened `verdict_wrapper`.
- **Identity Continuity:** Implemented immutable identity context to prevent 'arif' -> 'anonymous' drift.

### What's "Sangkut" (Has Friction)

- **Runtime maturity:** 8.5/10 — Contract discipline is now "hard," but downstream organ refactoring (Mind/Heart) is ongoing.
- **Product packaging:** Improving legibility but still geared for sovereign developer use.

### Development Priorities

1. **Phase 2 Refactor:** Migrate all organs (Mind, Heart, Ops) to return typed Artifact objects.
2. **Transition logic:** Harden the state machine transitions between metabolic stages.
3. **Audit Automation:** Automate F1-F13 floor checks within the unified envelope.

---

## Location in VPS

```
/root/
├── arifOS/                 # Runtime implementation
│   ├── src/
│   ├── test/
│   └── docs/
├── A-FORGE/               # Agent workbench (uses arifOS)
│   ├── src/
│   ├── test/
│   └── examples/
└── arif-fazil-wiki/        # This wiki
    └── wiki/projects/arifos.md
```

---

## For Agents

### Working With arifOS

1. **Respect the floors** — F1-F13 are binding
2. **Check for 888_HOLD** — Before any dangerous action
3. **Seek 999_SEAL** — For final attestation
4. **Maintain audit trail** — F11 requires logging everything
5. **Preserve F13** — Human authority is absolute

### Common Patterns

**Before tool execution:**
```
Check risk level → Check 888_HOLD → Execute → Log → Update memory
```

**Before final output:**
```
Verify F2 (grounded) → Check F7 (confidence) → Seek 999_SEAL → Output
```

---

## Sources

- `/root/arifOS/` — Runtime implementation
- `/root/A-FORGE/` — Agent workbench
- `/root/ARIFOS_SOVEREIGN_ARCHITECTURE.md` — Architecture spec
- `/root/ARIFOS_SOVEREIGNTY_IMPLEMENTATION_GUIDE.md` — Implementation
- Direct conversations with Arif

---

## Metadata

```yaml
---
type: Entity
subtype: Project
tags: [arifos, constitutional-ai, governance, ΔΩΨ, F1-F13]
sources: [/root/arifOS/, /root/ARIFOS_SOVEREIGN_ARCHITECTURE.md]
last_sync: 2026-04-10
confidence: 0.90
certainty_band: [0.85, 0.95]
epistemic_level: OBS
arifos_floor: [F1, F2, F7, F9, F11, F13]
status: active
---
```

---

**Seal:** VAULT999 | **ΔΩΨ | ARIF**


