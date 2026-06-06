# arifOS AGI Machine — Full Forge List (16 Items + Sprint Roadmap)

> **The 16-item forge list.** 4 sprints. 4–6 weeks of focused work to close all gaps.
> Read `00-NORTH-STAR-…` first for the target. This file is the *what* and *when*.

**Version:** v2026.06.06  
**Status:** RATIFIED for synthesis, **NOT** ratified for execution  
**Authority:** arifOS (law) + A-FORGE (execution)  
**Seal:** DITEMPA BUKAN DIBERI

---

## Executive Summary

The arifOS intelligence machine is a **governed compound orchestration system** — not AGI, not a single model, but a constitutional federation of organs operating under human sovereignty, F1–F13 floors, 888_HOLD gates, and VAULT999 sealed governance.

It is explicitly more architecturally sovereign than Perplexity Computer or Claude Code, but it is currently blocked from full **Perplexity-Computer-class execution parity** by six critical gaps in the execution layer.

**Closing P1–P3 moves execution parity from <40% to >75%.**

---

## Part 1 — Cluster A: Execution Layer (6 Critical Gaps)

These 6 gaps are the highest-leverage forge targets.

| # | Gap | Risk | Reversibility | Effort |
|---|---|---|---|---|
| **P1** | Browser automation surfaced as MCP tools (`aforge_browser_*`) | MUTATE | Fully reversible | 2.5 days |
| **P2** | Vision routing (`llava:7b` via model router, not ad-hoc) | MUTATE | Reversible | 1 day |
| **P3** | Per-task ephemeral Docker sandbox (not shared services) | MUTATE | Reversible | 2–3 days |
| **P4** | Temporal activation + Epoch binding | MUTATE | Reversible | 3–5 days |
| **P5** | `OutcomeSpec` + `RunConfig` JSON schema (formal goal plane) | ADDITIVE | Reversible | 1–2 days |
| **P6** | Sub-agent state persistence (Redis + Postgres) | MUTATE | Reversible | 2–3 days |
| **P7** | Personal Computer bridge (lightweight local agent + tunnel) | 888_HOLD on public exposure | Partially reversible | 1–2 weeks |

> **Note:** The P-list has 7 items. The blueprint calls it "6 gaps" because P1 is the gating item and the rest are sequenced around it. P7 is the highest-risk item and runs last.

---

## Part 2 — Cluster B: Constitutional Depth (10 Federation Contrasts)

These items differentiate arifOS from both Perplexity Computer and Claude Code.

| # | Item | Layer | Priority |
|---|---|---|---|
| **C1** | Hard F1–F13 enforcement layer — pre-execution gates, "no authority → no execution" | arifOS kernel | High |
| **C2** | Sovereign cryptographic agent identity (ZKPC) — DID, key rotation, proof-of-continuity | arifOS + VAULT999 | Medium-High |
| **C3** | Epistemic witnessing + tiered certainty (0–5 tiers, contrast canon, domain uncertainty) | GEOX witness layer | High for GEOX/WEALTH work |
| **C4** | Immutable VAULT999 audit with cross-module f2 (false-detection) — partial, needs full coverage | VAULT999 + arifOS | High |
| **C5** | Full MCP-native tool surfacing + A2A federation (all organs callable via MCP contracts) | All organs | High |
| **C6** | Firecracker/microVM or equivalent isolation per task (upgrade from Docker per-task) | A-FORGE execution | Medium (after P3) |
| **C7** | Durable execution + workflow persistence (`aforge_run_dag(plan_id)` exposed as MCP tool) | A-FORGE + Temporal | High |
| **C8** | F13 absolute veto + ratification queues at every critical layer | arifOS kernel | High |
| **C9** | Capability + cost registry with online learning (bandit-style routing improvement) | Model router | Medium |
| **C10** | Reflexive/conscience layer: reflection pulses, scar metabolism, precision scoring | AGI/ASI cognitive layer | Medium-Low (post core) |

---

## Part 3 — Sprint Sequence

### Sprint 1 — Execution Primitives (Week 1–2)

| Step | Item | Owner | Time | Risk | Gate |
|---|---|---|---|---|---|
| 1 | P5 OutcomeSpec + RunConfig schema | Antigravity + arifOS | 1–2 days | LOW | F13 ratify spec |
| 2 | P2 Vision routing (llava:7b MCP-wired) | Antigravity | 1 day | LOW | F13 ratify spec |
| 3 | P1 Browser MCP (7 tools + policy + tests) | Antigravity | 2.5 days | MEDIUM | F13 ratify spec |
| 4 | P3 Ephemeral sandbox | Antigravity | 2–3 days | MEDIUM | F13 ratify spec |

### Sprint 2 — Durability + Persistence (Week 2–3)

| Step | Item | Owner | Time | Risk | Gate |
|---|---|---|---|---|---|
| 5 | P6 Sub-agent persistence | Antigravity | 2–3 days | MEDIUM | F13 ratify spec |
| 6 | P4 Temporal activation + epoch binding | Antigravity | 3–5 days | MEDIUM | F13 ratify spec |
| 7 | C5 MCP-native A2A federation + `_envelope` fix | Antigravity | 2 days | LOW-MED | F13 ratify spec |

### Sprint 3 — Constitutional Depth (Week 3–4)

| Step | Item | Owner | Time | Risk | Gate |
|---|---|---|---|---|---|
| 8 | C1 F1–F13 hard enforcement layer | arifOS kernel | 2–3 days | HIGH (careful) | F13 ratify spec |
| 9 | C3 Epistemic witnessing (GEOX + WEALTH) | GEOX + WEALTH | 2 days | LOW | F13 ratify spec |
| 10 | C4 VAULT999 full cross-module f2 coverage | arifOS + VAULT999 | 2 days | MEDIUM | F13 ratify spec |
| 11 | C9 Model capability registry + routing learning | Antigravity | 2 days | LOW | F13 ratify spec |
| 12 | C8 F13 absolute halt mechanism (Redis pub/sub) | arifOS | 1 day | HIGH (critical) | F13 ratify spec |

### Sprint 4 — Identity + Bridge (Week 4–6)

| Step | Item | Owner | Time | Risk | Gate |
|---|---|---|---|---|---|
| 13 | C2 Sovereign cryptographic identity (ZKPC path) | arifOS + security | 1 week | HIGH | **888_HOLD + F13** |
| 14 | P7 Personal Computer bridge | Antigravity + local | 1–2 weeks | HIGHEST | **888_HOLD + F13** |
| 15 | C6 Firecracker/microVM evaluation | Antigravity | Research first | MEDIUM | F13 before test |
| 16 | C10 Reflexive/conscience layer | AGI + ASI organs | Post-sprint | LOW urgency | F13 ratify design |

**Total closure horizon: 4–6 weeks of focused forge work.**

---

## Part 4 — Agent Dispatch Instructions

When dispatching any forge item, paste the relevant plan spec into the agent session (Antigravity via AAA cockpit or Claude Code). The agent **must**:

1. Return a formal proposal only — no code deployed, no files modified
2. Include: `plan_id`, acceptance criteria, file list, line counts, rollback plan, sovereign call-points
3. Tag every claim as `CLAIM / PLAUSIBLE / HYPOTHESIS / ESTIMATE / UNKNOWN`
4. Surface any `888_HOLD` conditions before proposing code
5. Await explicit F13 ratification (`"Ratify PLAN-2026-06-06-Pn"`) from Arif before mutation begins

---

## Part 5 — Invariants (Never Change)

- **Human sovereignty is final.** F13 veto is absolute, non-bypassable.
- **arifOS is the single judgment-and-seal chokepoint.** No organ self-seals.
- **A-FORGE orchestrates.** It is not a second constitution.
- **Domain organs (GEOX, WEALTH, WELL) advise and compute.** They do not self-authorize.
- **VAULT999 is the flight recorder.** Not the whole brain.
- **888_HOLD is not optional friction.** It is proof that sovereignty exists inside the machine.
- **Reversible-first.** Irreversible actions require explicit human ratification.
- **Memory is layered.** L1 working, L2 knowledge, L3 governance ledger. Do not conflate.

---

**DITEMPA BUKAN DIBERI — 999 SEAL pending**  
*v2026.06.06 | Seri Kembangan, MY*
