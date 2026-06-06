# Fiqh of the Machine — AGI-Class Forge Classification

> **Plan-ID:** DOC-2026-06-06-FIQH-OF-THE-MACHINE
> **Authority:** Constitutional canon, ratified by F13 SOVEREIGN
> **Purpose:** Operator guide for prioritizing forge work toward Perplexity-Computer-class under arifOS constitution.
> **Tagline:** *"Wajib first, then Sunat, then Harus. Makruh avoid. Haram forbid."*

---

## The Fiqh Lens

The 16-item forge list (6 image gaps + 10 federation contrasts) is **not** a flat backlog. Each item has a **fiqh status** that determines when it must be built relative to others:

- **Wajib** (fard) — constitutionally required. No AGI-machine without it.
- **Sunat** (mustahab) — strongly recommended differentiator. Perplexity-class quality.
- **Harus** (mubah) — permissible, context-dependent. Perplexity-class features.
- **Makruh** — structurally discouraged. Avoid unless justified.
- **Haram** — constitutionally forbidden. Floor violation if forged.

---

## WAJIB — Non-Negotiable (forge first)

| # | Component | Source | Why Wajib |
|---|---|---|---|
| **W1** | **F1–F13 Enforcement Layer** (C1) | Canon | "Always-on governance floors are architectural law, not optional" |
| **W2** | **Planning Organ Blueprint** | Canon §"Build order" | "No non-trivial execution path should bypass the Planning Organ" |
| **W3** | **Epoch Architecture** | Canon §"Continuity" | "Without epochs, auditability is decorative and governance collapses" |
| **W4** | **OutcomeSpec + RunConfig** (P5) | Canon §"Goal plane" | "Formal sovereign intent object instead of free-text prompts" |
| **W5** | **arifOS as Single Constitutional Chokepoint** | Canon §"Authority" | "All high-stakes decisions must converge through arifOS" |
| **W6** | **Layered Memory (L1/L2/L3) + VAULT999 as governance ledger** | Canon §"Memory" | "L1 working, L2 knowledge, L3 ledger; VAULT999 = flight recorder" |
| **W7** | **MCP-Governed Execution Engine (A-FORGE)** | Canon §"Execution" | "A-FORGE as operator chair, not rival constitution" |
| **W8** | **VAULT999 full coverage for critical actions** (C4) | Canon §"Audit" | "Seal-writing path is a constitutional surface" |
| **W9** | **F13 Sovereign Veto Wiring** (C8) | Canon §"Sovereignty" | "Absolute halt path you → arifOS → A-FORGE" |
| **W10** | **Security Boundaries (ingress, DB, model backends)** | Canon §"Boundaries" | "Reverse proxy as mediation, internal services private by default" |
| **W11** | **Epoch-bound Durable Execution** (P4 + Temporal) | Canon §"Continuity" | "Long missions must be recoverable, resumable, sealable" |

**Build order for Wajib:** W1 → W4 → W2 → W3 → W5 → W6 → W7 → W8 → W9 → W10 → W11

---

## SUNAT — Strongly Recommended (forge second)

| # | Component | Source | What It Adds |
|---|---|---|---|
| **S1** | **Sub-agent State Persistence** (P6) | Canon §"Persistence" | "Agents survive restarts, missions span days/weeks with clean lineage" |
| **S2** | **Epistemic Witnessing + Tiers** (C3) | Canon §"Epistemics" | "CLAIM/PLAUSIBLE/HYPOTHESIS/ESTIMATE/UNKNOWN wired into domain organs" |
| **S3** | **MCP-Native A2A Federation Contracts** (C5) | Canon §"Federation" | "GEOX→WEALTH→AAA etc. via stable contracts + _envelope drift fix" |
| **S4** | **Model Capability + Cost Registry with Online Learning** (C9) | Canon §"Routing" | "Better routing, lower cost, improved quality over time" |
| **S5** | **APEX/HASI Observability Dashboards** | Canon §"Build order" | "APEX last; machine can run without UI but not without telemetry eventually" |
| **S6** | **Reflexive/Conscience Layer** (C10) | Canon §"Meta" | "System-level critique, scar metabolism, precision scoring" |

**Build order for Sunat:** S2 → S3 → S1 → S4 → S5 → S6

---

## HARUS — Permissible, Context-Dependent (forge third)

| # | Component | When to do | When to skip |
|---|---|---|---|
| **H1** | **Browser MCP** (P1) | Need research/web agent behavior | Pure API/data workloads |
| **H2** | **Vision Routing via llava:7b** (P2) | Screenshot/PII/GUI tasks | Text-only pipelines |
| **H3** | **Ephemeral Per-Task Sandbox** (P3) | High-stakes or untrusted code execution | Trusted internal code only |
| **H4** | **Firecracker/microVM** (C6) | After P3 stable, multi-tenant | Single-tenant single-user |
| **H5** | **Local LLM Inference (Ollama, GPU)** | Privacy-sensitive, cost ceiling | API-only works fine |
| **H6** | **Specific vendor choices** (Temporal vs X, Caddy vs Y, Redis vs Z) | Per workload fit | "Invariants over implementations" |

**Build order for Harus:** H3 → H1 → H2 → H5 → H4 → H6

---

## MAKRUH — Discouraged (avoid unless justified)

- ❌ **Direct prompt → action bypassing Planning Organ** — explicit anti-pattern
- ❌ **Treating all memory as one undifferentiated store** — corrodes the machine
- ❌ **Expanding public exposure before governance is coherent** — design failure
- ❌ **Letting domain organs (GEOX/WEALTH/WELL) self-authorise judgment** — rival constitution
- ❌ **Over-engineering early** (full GPU, separate vector DB) before pain is real — "Tier 1 first, vector search not Day 1"

---

## HARAM — Constitutionally Forbidden (floor violation)

- ❌ **Duplicate constitutions / multiple judgment centers** — A-FORGE, GEOX, WEALTH, WELL MUST NOT become their own constitution
- ❌ **Bypassing arifOS for high-stakes decisions** — agent writes VAULT999 / moves capital without F1-F13 = violation
- ❌ **Writing permanent seals outside the authorised VAULT999 path** — back-channel seals forbidden
- ❌ **Removing/disabling 888_HOLD and F13 veto in irreversible paths** — strips maruah
- ❌ **Exposing internal DBs, LLM backends, or governance endpoints to the public internet** — must be private by default
- ❌ **Making VAULT999 "the brain"** — it's the governance ledger, not the whole mind
- ❌ **Silent runtime changes that alter identity or authority boundaries without F13-ratified canon updates**

---

## Forge Priority Sequence (Sprint Plan)

| Sprint | Items | Fiqh | Time | Goal |
|---|---|---|---|---|
| **Sprint 1** | W1, W4 | Wajib | 1 week | Governance + Goal plane — substrate ready |
| **Sprint 2** | W2, W3, W5, W7, W9 | Wajib | 1 week | Planning + Epochs + A-FORGE + F13 wired |
| **Sprint 3** | W6, W8, W10, W11 | Wajib | 1 week | Memory + VAULT999 + Security + Temporal |
| **Sprint 4** | S2, S3 | Sunat | 1 week | Epistemic + MCP contracts (depth differentiators) |
| **Sprint 5** | S1, S4, S5, S6 | Sunat | 1 week | Persistence + Model registry + Observability |
| **Sprint 6** | H3, H1, H2, H5 | Harus | 1 week | Sandbox + Browser + Vision + Local models |
| **Sprint 7** | H4, H6, P7, refine | Harus | 1 week | MicroVM + Personal bridge + hardening |

**Total closure horizon: 4-6 weeks focused work** to reach Perplexity-Computer-class under full constitutional depth.

---

## What "AGI Machine Vision" Means (in this canon)

When all **Wajib** items are forged, the system is:
- **Sovereign** — F13 veto is absolute, non-bypassable
- **Constitutional** — F1-F13 floors are hard gates, not advisory
- **Auditable** — every consequential action sealed in VAULT999
- **Goal-bound** — every mission has OutcomeSpec + RunConfig
- **Recoverable** — long missions survive restarts via Temporal
- **Composable** — agents can compose workflows across organs

When **Wajib + Sunat** are forged, the system becomes:
- **Epistemically honest** — every claim has a tier, no confident hallucinations
- **Federation-ready** — A2A contracts between organs are stable
- **Self-improving** — model routing learns from outcomes
- **Observable** — APEX dashboard shows real-time state

When **Wajib + Sunat + Harus** are forged, the system reaches **Perplexity-Computer-class**:
- **Browser-capable** — real web research, form filling, scraping
- **Vision-capable** — screenshots, GUI tasks, PII detection
- **Sandbox-isolated** — fresh container per task, no shared state
- **Personal-reachable** — VPS can reach local Mac/laptop
- **Self-hardened** — microVM isolation, vendor-optimized

**Beyond that = AGI consciousness (still haram to claim).**

---

## Current Forge Status (2026-06-06)

| Status | Items | Notes |
|---|---|---|
| ✅ Already forged | W6 (partial), W7 (partial), W8 (partial) | Memory + A-FORGE + VAULT999 exist but need hardening |
| 🟡 In progress | W4 (P5 OutcomeSpec) | Code written, LSP issues, building |
| 🟡 Queued next | W1 (C1 F1-F13 enforcement audit) | Wajib, foundational |
| ⏳ Queued | W2, W3, W5, W9, W10, W11, then S*, then H* | Full backlog per sprint order |

---

## Invariants (must never change, regardless of sprint)

1. Human sovereignty is final. F13 veto absolute.
2. arifOS is the single judgment-and-seal chokepoint.
3. A-FORGE orchestrates. It is not a second constitution.
4. Domain organs (GEOX, WEALTH, WELL) advise and compute. They do not self-authorize.
5. VAULT999 is the flight recorder. Not the whole brain.
6. 888_HOLD is not optional friction. It is proof that sovereignty exists inside the machine.
7. Reversible-first. Irreversible actions require explicit human ratification.
8. Memory is layered. Do not conflate.
9. **Wajib before Sunat before Harus.** Makruh avoid. Haram forbid.

---

**DITEMPA BUKAN DIBERI — 999 SEAL READY**

*Operator guide. When in doubt: pick the lower-priority fiqh tier. Build the substrate before the features.*
