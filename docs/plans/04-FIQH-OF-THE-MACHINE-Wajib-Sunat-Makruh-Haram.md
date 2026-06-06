# Fiqh of the Machine — Wajib / Sunat / Makruh / Haram Cheat Sheet

> **The operator's guide.** One page. Maps every AGI-machine forge action against the arifOS canon.
> Read this BEFORE proposing a forge. If your action is haram, stop. If makruh, justify.

**Version:** v2026.06.06  
**Status:** RATIFIED — operator guide, not a forge plan  
**Authority:** arifOS (law) + A-FORGE (execution)  
**Tier:** CLAIM (mapped against canon + build order, 3 sources converged — see `03-SOURCE-SYNTHESIS-3-Source-Convergence.md`)

---

## How to Use This Sheet

1. Before proposing any forge: locate the action in the table below.
2. **Haram** → halt. Do not proceed. Floor violation.
3. **Makruh** → justify in writing. F13 ratifies the override.
4. **Wajib** → non-negotiable. If missing, the system is "an agent playground, not a sovereign machine".
5. **Sunat** → strongly recommended. Skip only with explicit F13 sign-off.
6. **Harus** → permissible. Pick based on appetite, budget, risk.

**The 3-word test:** "Is this constitutional?" If unsure, ask arifOS. If still unsure, ask Arif.

---

## WAJIB (fard) — Non-negotiable substrate

Without these, the system is **not** a sovereign intelligence machine. It is a generic agent.

| # | Component | Why it's wajib | Forge item |
|---|---|---|---|
| W1 | **Planning Organ Blueprint** | Explicit task graphs, veto points, reversibility classification, receipts, lineage. "No non-trivial execution path bypasses the Planning Organ." | (canon-level, not in 16-item list) |
| W2 | **Epoch Architecture** | Lawful continuity containers (intent, plan, receipts, telemetry, seal). Without it, auditability is decorative. | P4 + C7 (Temporal) |
| W3 | **OutcomeSpec + RunConfig** | Formal sovereign intent object. Scope, constraints, sensitivity, budget defined for every mission. | **P5** |
| W4 | **F1–F13 Enforcement Layer** | Floors as hard gates, not style tips. Architectural law. | **C1** |
| W5 | **Single constitutional chokepoint** | arifOS = sole judger + sealer. A-FORGE never adjudicates. Organs never self-seal. | (canon invariant) |
| W6 | **Layered Memory (L1/L2/L3) + VAULT999 as ledger** | L1 working, L2 knowledge, L3 ledger. VAULT999 is the flight recorder, NOT the brain. | (canon invariant) |
| W7 | **Epoch-bound durable execution** | Long missions recoverable, resumable, sealable at epoch level. | P4 + C7 |
| W8 | **MCP-governed Execution Engine (A-FORGE)** | A-FORGE is operator chair/orchestrator, not a rival constitution. | (canon invariant) |
| W9 | **VAULT999 full coverage for critical actions** | Seal-writing is a constitutional surface. Tightly controlled + audited. | **C4** |
| W10 | **F13 sovereign veto wiring** | Absolute halt path: Arif → arifOS → A-FORGE. Stops non-reversible actions. | **C8** |
| W11 | **Security boundaries: ingress, DB, model backends** | Reverse proxy as mediation. Internal DB/model services private by default. | (VPS blueprint) |

**Wajib delivery path:** W1, W5, W6, W8, W11 are canon-level invariants — already in the substrate. **W2, W3, W4, W7, W9, W10 are forge items** that MUST close to call this a sovereign machine.

---

## SUNAT (mustahab) — Strongly recommended differentiators

Skip only with explicit F13 sign-off. These are what separate "Perplexity-Computer-class" from "generic agent".

| # | Component | Why it's sunat | Forge item |
|---|---|---|---|
| S1 | **Sub-agent state persistence** | Agents survive restarts. Missions span days/weeks with clean lineage. | **P6** |
| S2 | **Epistemic witnessing + tiers (C3)** | CLAIM/PLAUSIBLE/HYPOTHESIS/ESTIMATE/UNKNOWN wired into GEOX/WEALTH/WELL outputs. | **C3** |
| S3 | **Model capability + cost registry with online learning** | Better routing, lower cost, improved quality over time. | **C9** |
| S4 | **APEX/HASI observability dashboards** | Machine can run without UI but not without telemetry eventually. | (Phase D in build order) |
| S5 | **MCP-native A2A federation contracts** | GEOX → WEALTH → AAA via stable contracts. Includes `_envelope` drift fix. | **C5** |
| S6 | **Reflexive/conscience layer (C10)** | System-level critique, scar metabolism, precision scoring. | **C10** |

**Sunat delivery path:** Sequential after wajib. S1 in Sprint 2. S2, S3, S5 in Sprint 3. S4, S6 post-core.

---

## HARUS (mubah) — Permissible, context-dependent

Useful for "Computer-class" behavior. Not constitutionally mandated. Design choices depend on appetite, budget, risk.

| # | Component | Notes | Forge item |
|---|---|---|---|
| H1 | **Browser MCP tools** (`aforge_browser_*`) | Almost necessary for Perplexity-style research agent. Not "must browse" to be valid. | **P1** |
| H2 | **Vision routing via llava:7b** | Screenshot/PII, GUI tasks, UX testing. | **P2** |
| H3 | **Ephemeral per-task Docker sandbox** | Some sandbox is required; Docker per-task vs alternatives is a choice. | **P3** |
| H4 | **Firecracker/microVM** | Strong hardening. Canon doesn't lock you to it. | **C6** |
| H5 | **Local LLM inference (Ollama, GPUs)** | Tier-2/3 upgrade. API-only Tier-1 is valid. | (VPS blueprint) |
| H6 | **Vendor choices** (Temporal vs other workflow engines, Caddy vs Traefik, Redis vs others) | Canon: invariants over implementations. | (operational) |

**Harus rule:** Pick the cheapest option that meets the wajib substrate's requirements. Upgrade only when pain is real.

---

## MAKRUH — Structurally discouraged

Not haram, but goes against canon's design guidance. Avoid unless you have very strong justification.

| # | Anti-pattern | Why discouraged |
|---|---|---|
| M1 | **Direct prompt → action bypassing Planning Organ** | Explicitly named anti-pattern in canon. |
| M2 | **Treating all memory as one undifferentiated store** | "Just use one big vector DB for everything" corrodes the machine. |
| M3 | **Expanding public exposure (ports/APIs) before governance is coherent** | "Public exposure before internal governance is coherent" is a design failure. |
| M4 | **Letting domain organs self-authorize judgment** | GEOX/WEALTH/WELL must not become rival constitutions or final judges. |
| M5 | **Over-engineering early** (full GPU, separate vector DB) before pain is real | Tier 1 first. Vector search "not Day 1". Avoid premature complexity. |

**Makruh test:** If you want to do any of these, write a 1-paragraph justification. F13 ratifies the override.

---

## HARAM — Constitutionally forbidden

Floor violation, not design choice. If your agents forge any of these, the system is in floor breach.

| # | Forbidden action | Why it's haram |
|---|---|---|
| X1 | **Duplicate constitutions / multiple judgment centers** | Any attempt to make A-FORGE, GEOX, WEALTH, WELL, or another runtime its own "constitution" or seal authority. |
| X2 | **Bypassing arifOS for high-stakes decisions** | Agent writes to VAULT999 or moves capital without going through arifOS MCP and F1–F13. |
| X3 | **Writing permanent seals outside the authorised VAULT999 path** | Ledger semantics are invariant. Back-channel seals not allowed. |
| X4 | **Removing or disabling 888_HOLD and F13 veto in irreversible paths** | "Reversible-first" and F13 veto are constitutional. Stripping them breaks maruah. |
| X5 | **Exposing internal DBs, LLM backends, or governance endpoints directly to public internet** | Internal DB/model backends must be private by default. Ingress via governance-aware boundary only. |
| X6 | **Making VAULT999 "the brain" instead of the governance ledger** | Over-writing L1/L2 logic with "everything in VAULT999" is a violation. |
| X7 | **Silent runtime changes that alter identity/authority boundaries without F13-ratified canon updates** | Changing seal authority, floors, or build-order logic without updating canon is not allowed. |

**Haram test:** If you find yourself about to do any of these, **stop immediately**. 888_HOLD + F13 required to even discuss an override. The canon is the canon.

---

## The AGI-Machine Vision Equation

```
AGI-Machine Vision = WAJIB substrate + SUNAT depth + HARUS capability − MAKRUH − HARAM
```

- **Wajib + Sunat** = sovereign AGI substrate + AGI-class quality
- **Harus (P1–P3, P7)** = Perplexity-Computer-class capability
- **Makruh −** = remove anti-patterns
- **Haram −** = never violate, no exceptions

**The vision is achievable in 4–6 weeks of focused forge work** — provided we close the wajib items first (W2, W3, W4, W7, W9, W10) and stay out of haram territory. The sunat items sharpen the machine. The harus items add capability. The makruh and haram items are what kill sovereign machines silently.

---

## Quick Decision Flowchart

```
Proposed action
    │
    ├─ Is it haram (X1–X7)?  ──YES──► HALT. 888_HOLD + F13.
    │       NO
    │
    ├─ Is it makruh (M1–M5)? ──YES──► Justify in writing. F13 ratifies.
    │       NO
    │
    ├─ Is it wajib (W1–W11)? ──YES──► Do it. Non-negotiable.
    │       NO
    │
    ├─ Is it sunat (S1–S6)?  ──YES──► Strongly recommended. Schedule in next sprint.
    │       NO
    │
    └─ Is it harus (H1–H6)?  ──YES──► Permissible. Pick based on budget/risk.
            NO
        │
        └─ Out of scope. Escalate to F13 for canon update.
```

---

**DITEMPA BUKAN DIBERI — 999 SEAL pending VAULT999 wiring**  
*v2026.06.06 | Seri Kembangan, MY*
