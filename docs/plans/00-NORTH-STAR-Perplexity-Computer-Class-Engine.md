# North-Star Spec — Perplexity-Computer-Class Engine Under arifOS

> **The 1-page spec.** Every other forge item maps back to this.
> Read this first, then read the relevant plan.

**Version:** v2026.06.06  
**Status:** RATIFIED — north-star only, no mutation  
**Authority:** arifOS (law) + A-FORGE (execution)

---

## The Target

A **governed compound orchestration engine** on sovereign VPS:

- Perplexity Computer-class **execution**
- arifOS-class **governance**
- Immutable **audit** (VAULT999)
- F13 absolute **veto**
- Tiered **epistemic certainty** on every claim
- **Survive** tool churn, model swaps, repo reorganizations, infrastructure migrations

This is **not** AGI in the marketing sense. This is a **sovereign, auditable, governable** orchestration engine that can be trusted with high-stakes, long-horizon work.

---

## Capability Plane Map

| Capability | Perplexity Computer | arifOS Target |
|---|---|---|
| **Goal plane** | High-level prompt → project | `OutcomeSpec` + `RunConfig` JSON schema (sovereign intent object) |
| **Planning** | DAG via orchestrator model | Planning Organ: task graph, reversibility classification, lineage, veto points |
| **Time horizon** | Hours to months (aspirational) | Epoch-bound continuity — plan inside epoch, epoch seals on completion |
| **Model router** | ~19 models, capability routing | 30+ models, capability registry with latency/cost/quality, online bandit learning |
| **Execution sandbox** | Cloud sandbox per task | Per-task ephemeral `--rm` container, seccomp, read-only FS, TTL, bounded workspace |
| **Browser** | Playwright (cloud) | `aforge_browser_*` MCP tools, F11 allowlist, PII redaction, VAULT999 receipts |
| **Memory** | Multi-plane + connectors | L1 working, L2 knowledge, L3 governance (VAULT999), Qdrant vector, Graphiti relational |
| **Governance** | Config + some audit | F1–F13 always-on, 888_HOLD for irreversible, 999 SEAL, hash-chained VAULT999 |
| **Identity** | Session-level | Sovereign cryptographic agent identity (ZKPC path), signed action lineage |
| **Observability** | Partial logging | Prometheus/Grafana/Langfuse/NATS + constitutional telemetry: epoch, dS, peace², κᵣ, verdict |
| **Human veto** | Checkpoint config | **Absolute F13 sovereign veto** — non-bypassable, ratification queue, Telegram/Matrix bridge |

---

## Constitutional Runtime Loop

```
HUMAN INTENT
    ↓
[OutcomeSpec + RunConfig]                 ← Goal Plane
    ↓
[Planning Organ]                          ← DAG, reversibility, veto points, receipts
    ↓
[Epoch Engine]                            ← Temporal container, scope, lineage, seal anchor
    ↓
[Memory Router]                           ← L1/L2/L3 under epoch + plan context
    ↓
[Model Router]                            ← Best model (capability + cost + latency)
    ↓
[A-FORGE Execution Engine]                ← Ephemeral sandbox, browser, file/code, connectors
    ↓
[888_HOLD gate]                           ← Pause before irreversible, push to human
    ↓
[Domain Organs]                           ← GEOX witness | WEALTH capital | WELL readiness | AGI reason | ASI critique
    ↓
[arifOS Judge]                            ← F1–F13 enforcement, verdict
    ↓
[VAULT999 Seal]                           ← hash-chained, Merkle, immutable
    ↓
[APEX/HASI Dashboard]                     ← Observe, introspect, replay
    ↓
[999 SEAL → telemetry emit]
```

**This loop must survive** tool churn, model swaps, repo reorganizations, infrastructure migrations.

---

## What "Done" Looks Like

When all 16 forge items close, the machine will:

- Accept high-level objectives via `OutcomeSpec` schema
- Decompose to a DAG plan under epoch governance
- Route subtasks to the best of 30+ models via a learning capability registry
- Execute in isolated, ephemeral sandboxes with browser + file + code runners
- Browse the web, read/write files, run code — all under MCP contracts with VAULT999 receipts
- Persist missions across VPS restarts via Temporal-bound epochs
- Propagate epistemic uncertainty tiers from GEOX/WEALTH evidence to agent decisions
- Block irreversible actions at F13-enforced 888_HOLD gates
- Seal completed missions to VAULT999 with hash-chained immutable audit
- Reach Arif's local Mac for native app/file tasks via a sovereign signed bridge
- Self-improve model routing over time via outcome learning

**= Perplexity-Computer-class compound orchestration engine with constitutional depth, sovereign governance, and immutable audit — deployed on sovereign VPS, owned by Arif Fazil.**

---

## Non-Goals (Explicit)

- **Not** chasing "AGI" benchmark scores. Sovereignty > capability.
- **Not** replacing human judgment. arifOS is the chokepoint, not a second constitution.
- **Not** building a public product. A-FORGE is internal forge infrastructure.
- **Not** auto-deploying. Every irreversible action requires F13 ratification.

---

## Where to Go From Here

1. Open `01-FORGE-LIST-16-Items-Sprint-Roadmap.md` for the full item list and sprint sequence.
2. If you're working on P1 (Browser MCP), open `02-PLAN-P1-Browser-MCP-v1.md`.
3. If you want to know where the items came from, open `03-SOURCE-SYNTHESIS-3-Source-Convergence.md`.
4. When in doubt, return to the **AGI_MACHINE_ROADMAP_INDEX.md** at the top of `docs/plans/`.

---

**DITEMPA BUKAN DIBERI — 999 SEAL pending sovereign execution**  
*v2026.06.06 | Seri Kembangan, MY*
