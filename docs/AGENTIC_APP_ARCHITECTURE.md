# Agentic App Architecture — A-FORGE Canonical Doctrine

> **DITEMPA BUKAN DIBERI — Forged, Not Given**

The canonical architecture doctrine for building governed agentic applications on the arifOS Federation. This document defines what agentic means, why traditional CRUD fails, and how the A-FORGE substrate structures state, memory, identity, governance, and execution across the federation.

---

## Section 0: The Missing Substrate — Why We Measure

### The 7 Gaps

Every governed agentic system without a work ledger exhibits the same 7 gaps:

| # | Gap | Symptom |
|---|-----|---------|
| 1 | **Reasoning budget** | Agents spin indefinitely, burning tokens with no termination criteria |
| 2 | **Context governance** | Prompts stuffed with irrelevant context; stale sources treated as fresh |
| 3 | **Predictive memory** | No governed promotion; memories promoted by vibes or naive recurrence |
| 4 | **World models** | No distinction between observation, derivation, interpretation, and hypothesis |
| 5 | **Verification > generation** | Proposals produced freely; verification is an afterthought |
| 6 | **Coordination cost** | Delegation happens without accounting; overhead exceeds specialist value |
| 7 | **Physical limits** | No awareness of CPU, memory, disk, rate limits, or human interruption cost |

### The Unified Diagnosis

All 7 gaps reduce to **one missing substrate**:

> **arifOS does not yet have a governed work ledger that records budget, context, evidence, coordination, resource use and verified outcomes for every run.**

The work ledger is not a database table. It is a runtime contract — a binding agreement between the agent and the constitution about what will be attempted, what it will cost, what counts as success, and what gets recorded when it is done.

### The Primary Metric

```
Governed Intelligence Efficiency (GIE) =
    verified decision value / (reasoning cost + tool cost + coordination cost + physical cost)
```

GIE is the single number that tells you whether a governed agent is being intelligent or just being expensive. A system with GIE < 1.0 is consuming more than it produces. A system with GIE > 1.0 is creating value per unit of governed cost.

GIE is not an optimization target. It is a measurement primitive. You cannot improve what you cannot measure. You cannot govern what you cannot measure. The work ledger makes GIE measurable.

### The Target Runtime Loop

Every run in the federation follows this loop. The Work Contract is created at INIT. Budgets are tracked at every stage. The TaskOutcome receipt is produced at SEAL.

```
000 INIT
  |
  | Create Work Contract (task objective, reasoning budget, context budget,
  |   tool budget, cost ceiling, verification target, autonomy ceiling)
  v
111 OBSERVE (select context, retrieve memory, gather world evidence)
  |
  v
333 THINK (spend bounded reasoning budget, emit proposals and uncertainty)
  |
  v
555 COORDINATE (delegate only when expected value exceeds overhead)
  |
  v
777 ACT (execute reversible steps)
  |
  v
888 VERIFY (test outcomes against explicit criteria)
  |
  v
999 RECEIPT (record cost, evidence, outcome and learning)
```

The Work Contract binds at INIT and cannot be loosened during execution. Budgets can only be spent, not increased. The TaskOutcome receipt is the immutable accounting of what was spent and what was achieved.

---

## Section 0: The Missing Substrate — Why We Measure

### The 7 Gaps

Every governed agentic system without a work ledger exhibits the same 7 gaps:

| # | Gap | Symptom |
|---|-----|---------|
| 1 | **Reasoning budget** | Agents spin indefinitely, burning tokens with no termination criteria |
| 2 | **Context governance** | Prompts stuffed with irrelevant context; stale sources treated as fresh |
| 3 | **Predictive memory** | No governed promotion; memories promoted by vibes or naive recurrence |
| 4 | **World models** | No distinction between observation, derivation, interpretation, and hypothesis |
| 5 | **Verification > generation** | Proposals produced freely; verification is an afterthought |
| 6 | **Coordination cost** | Delegation happens without accounting; overhead exceeds specialist value |
| 7 | **Physical limits** | No awareness of CPU, memory, disk, rate limits, or human interruption cost |

### The Unified Diagnosis

All 7 gaps reduce to **one missing substrate**:

> **arifOS does not yet have a governed work ledger that records budget, context, evidence, coordination, resource use and verified outcomes for every run.**

The work ledger is not a database table. It is a runtime contract — a binding agreement between the agent and the constitution about what will be attempted, what it will cost, what counts as success, and what gets recorded when it is done.

### The Primary Metric

```
Governed Intelligence Efficiency (GIE) =
    verified decision value / (reasoning cost + tool cost + coordination cost + physical cost)
```

GIE is the single number that tells you whether a governed agent is being intelligent or just being expensive. A system with GIE < 1.0 is consuming more than it produces. A system with GIE > 1.0 is creating value per unit of governed cost.

GIE is not an optimization target. It is a measurement primitive. You cannot improve what you cannot measure. You cannot govern what you cannot measure. The work ledger makes GIE measurable.

### The Target Runtime Loop

Every run in the federation follows this loop. The Work Contract is created at INIT. Budgets are tracked at every stage. The TaskOutcome receipt is produced at SEAL.

```
000 INIT
  |
  | Create Work Contract (task objective, reasoning budget, context budget,
  |   tool budget, cost ceiling, verification target, autonomy ceiling)
  v
111 OBSERVE (select context, retrieve memory, gather world evidence)
  |
  v
333 THINK (spend bounded reasoning budget, emit proposals and uncertainty)
  |
  v
555 COORDINATE (delegate only when expected value exceeds overhead)
  |
  v
777 ACT (execute reversible steps)
  |
  v
888 VERIFY (test outcomes against explicit criteria)
  |
  v
999 RECEIPT (record cost, evidence, outcome and learning)
```

The Work Contract binds at INIT and cannot be loosened during execution. Budgets can only be spent, not increased. The TaskOutcome receipt is the immutable accounting of what was spent and what was achieved.

### Build Order — Four Epochs

**Epoch 1 — Measure Work (P0):**
- AF-001: Work contract schema
- AF-002: Runtime event schema
- AF-003: Budget interceptor
- AF-004: Verification ledger

**Epoch 2 — Govern Information (P1):**
- AF-005: Context manifest compiler
- AF-006: Contradiction/supersession graph
- AF-007: Memory decision-value metadata

**Epoch 3 — Govern Federation (P2):**
- AF-008: Delegation accounting
- AF-009: Comparative routing experiments
- AF-010: Resource envelope

**Epoch 4 — Govern Physical Reality (P3):**
- AF-011: Reality-layer schema
- AF-012: Prediction/resolution records

---

## Section 1: Database vs Registry vs Memory (Corrected)

Three distinct concerns. Three distinct substrates. One mistake in classification corrupts all downstream governance.

### Database = Structured Facts

ACID transactions. CRUD operations. No temporal continuity. A database row does not know when it was observed, who observed it, or what it was observed against. It is a fact at point-in-time T0, frozen.

**Use for:** canonical identity, configuration records, materialized views, user accounts, tool manifests.

**Never for:** provenance, temporal truth, contradiction tracking, constitutional receipts.

### Registry = System Configuration

What exists in the system. Capabilities. Permissions. Versions. Health status. The registry is the system's self-model — it knows what it contains and what it is allowed to do.

**Use for:** tool registration, permission declarations, version tracking, capability manifests, surface audits.

**Never for:** execution history, past failures, constitutional scars.

### Memory = Governed Past

Provenance. Time. Scope. Truth class. Lifecycle. Correction. Memory is the substrate that knows not just what happened, but when, why, who observed it, how reliable it was, and whether it has been superseded.

**Use for:** session continuity, candidate memories, durable evidence, scar records, constitutional receipts.

**Never for:** raw facts (use Database), system configuration (use Registry).

### The Invariant

> **Storage holds state. The invariant substrate determines what that state means.**

A fact in PostgreSQL without provenance is a fact. The same fact in VAULT999 with hash-chain provenance is constitutional truth. The same fact in Qdrant is a semantic similarity vector. The storage is the same bytes. The substrate classification determines its meaning, trust level, and governance obligations.

### Vector DB is NOT Memory Alone

Qdrant and pgvector are semantic index layers. They enable similarity search — finding related memories, matching patterns, retrieving context. But a vector embedding without provenance metadata is noise. Vector DB is an index ON TOP OF canonical memory, not the memory itself.

**Correct mapping:**
- Qdrant/pgvector = semantic index (Plane B storage)
- PostgreSQL = canonical identity and M3/M4 durable memory
- FalkorDB = relationship projection (derived, rebuildable)
- VAULT999 = constitutional receipt (M6, append-only, hash-chained)
- Redis = ephemeral working memory (M1/M2)

---

## Section 2: Why Agentic Intelligence Breaks CRUD

### Traditional Request-Response (CRUD)

```
Request -> Validate -> Logic -> DB -> Response
```

Center = transaction. The database is the truth. The application is a stateless transformer. Every request is independent. History is optional.

### Agentic Intelligence (Governed Loop)

```
Goal -> Identity -> Observe -> Registry -> Memory -> Reason -> Govern -> Execute -> Verify -> Receipt -> Metabolize
```

Center = identity + governance. The agent has a goal. It must know who it is, what it is allowed to do, what has happened before, and what the constitution says. It reasons, but governance gates every action. Execution produces evidence. Evidence is verified. Verification produces a receipt. Receipts metabolize into scars or durable memory.

**Key differences:**
- **Stateful:** The agent carries context across calls. M0 (immediate) through M6 (permanent).
- **Temporal:** Every observation is timestamped. Stale data is suspect. T0 -> T1 re-probe before irreversible acts.
- **Identity-bound:** Actions are attributed. Actor, intent, evidence, authority — all on the envelope.
- **Governance-gated:** No action proceeds without floor checks. F1 (reversible-first) is the default.
- **Evidence-producing:** Every execution produces a VerdictEnvelope with provenance chain.
- **Metabolic:** Failures become scars. Scars reduce Phi for future matching intents. The system learns through pain.

---

## Section 3: The Four Planes (Corrected Memory Model)

### Plane A — Cognitive Memory Lifecycle

| Tier | Meaning | Retention | Example |
|------|---------|-----------|---------|
| **M0** | Immediate model context | One reasoning call | Prompt tokens, tool output for current step |
| **M1** | Working scratch | Seconds–minutes | Intermediate computation, scratchpad, tool cache |
| **M2** | Session continuity | Minutes–hours | Session state, claims, coherence metrics, trace chain |
| **M3** | Candidate memory | Days until evaluated | Raw observations, candidate promotions, unvalidated claims |
| **M4** | Durable governed memory | Months or policy-defined | Validated facts, tool execution records, provenance-tagged evidence |
| **M5** | Relationship/contradiction projection | Derived, rebuildable | FalkorDB graph, contradiction maps, similarity clusters |
| **M6** | Constitutional receipt/scar | Permanent/minimised | VAULT999 sealed events, scar records, hash-chained audit trail |

**M0–M2** are ephemeral. **M3** is the evaluation boundary. **M4+** requires governance approval. **M6** is immutable.

### Plane B — Physical Storage

| Backend | Memory Tiers | Role |
|---------|-------------|------|
| **Redis** | M1, M2 | Ephemeral working memory, session thread, tool cache |
| **PostgreSQL** | M3, M4 | Canonical identity, structured facts, durable governed memory |
| **Qdrant / pgvector** | Semantic index | Similarity search over M3/M4, not standalone memory |
| **FalkorDB** | M5 | Relationship projection, contradiction detection |
| **VAULT999** | M6 | Constitutional receipts, scar records, append-only audit |
| **SQLite** | Domain-local | Domain-organ local state, ephemeral computation |
| **Filesystem** | Artifacts | Code, documents, generated outputs — not governed memory |

### Plane C — Transport / Observation

| Backend | Role |
|---------|------|
| **NATS** | Event transport between organs, JetStream durability, dead-man switches |
| **Langfuse** | AI trace observability — prompt/response chains, token usage, cost |
| **Logs** | Diagnosis, debugging, error classification |
| **OpenTelemetry** | Distributed tracing across federation organs |

### Plane D — Interfaces / Adapters

| Adapter | Role |
|---------|------|
| **Hermes plugin** | IDE integration (Claude Code, OpenCode, Cursor, etc.) |
| **IDE profiles** | Per-IDE configuration and skill routing |
| **Markdown** | Human-readable documentation, doctrine files, runbooks |
| **MCP tools** | Programmatic interface — the governed API surface |
| **AAA cockpit** | Visual dashboard, A2A authority layer, session monitoring |

---

## Section 4: Correct Memory Flow (Fan-Out, Not Staircase)

Memory does not flow linearly from Redis to PostgreSQL to Qdrant to FalkorDB to VAULT999. That staircase model creates bottlenecks and single points of failure.

### Fan-Out Architecture

```
                    +--------------+
                    |  PostgreSQL  | <- canonical identity, M3/M4 facts
                    |  (primary)   |
                    +------+-------+
                           |
              +------------+------------+
              |            |            |
        +-----+-----+ +---+----+ +----+-----+
        |  Qdrant   | |FalkorDB| |  NATS    |
        | (semantic | | (graph | | (event   |
        |  index)   | | proj.) | | transport|
        +-----------+ +--------+ +----------+
              |            |            |
              +------------+------------+
                           |
                    +------+-------+
                    |  VAULT999    | <- constitutional receipts only
                    +--------------+
```

### Ownership Rules

1. **PostgreSQL owns canonical identity.** Every entity has one canonical record. Qdrant and FalkorDB derive from it, never replace it.
2. **Qdrant is an index.** It enables semantic search. It does not own truth. Rebuilding from PostgreSQL is always possible.
3. **FalkorDB is a projection.** Relationships are derived. Graph structure is rebuildable from canonical facts.
4. **NATS is transport.** Events flow between organs. NATS does not store governed state beyond JetStream replay.
5. **VAULT999 only for constitutionally significant events.** Not every action needs to be sealed. Only actions that affect floors, produce scars, or change authority.

---

## Section 5: Promotion Rules (Corrected)

### The "3+ Occurrences" Fallacy

Naive promotion rules like "3+ occurrences promotes to durable memory" are **UNSAFE**. They are vulnerable to:
- Single-source repetition (bot logs the same observation 3 times)
- Low-quality repetition (3 noisy sensor readings)
- Contradictory observations (3 readings that disagree on value)
- Scope contamination (observation from domain A repeated in domain B's memory)

### Correct Promotion Formula

```
promotable = (
    minimum_occurrences >= threshold
    AND independent_sources >= 2
    AND evidence_quality >= quality_floor
    AND contradiction_status != UNRESOLVED
    AND scope_consistency = true
)
```

### Promotion Criteria (TypeScript)

```typescript
interface PromotionCriteria {
  /** Minimum independent observations required */
  minimum_occurrences: number;
  /** Minimum distinct sources (guards against single-source spam) */
  independent_sources: number;
  /** Quality floor — below this, observation is ignored regardless of count */
  evidence_quality: number;
  /** Must be resolved before promotion (no unresolved contradictions) */
  contradiction_status: "NONE" | "RESOLVED" | "UNRESOLVED";
  /** Observation must be consistent with its declared scope */
  scope_consistency: boolean;
  /** Optional: domain-specific override */
  domain_override?: GovernedDomain;
}
```

### Tier Promotion Boundaries

| From | To | Required |
|------|----|----------|
| M0 -> M1 | Context survives reasoning call | Automatic (tool output) |
| M1 -> M2 | Working scratch survives seconds | Explicit session attach |
| M2 -> M3 | Session memory -> candidate | Session end, evaluation pending |
| M3 -> M4 | Candidate -> durable | PromotionCriteria gate PASS |
| M4 -> M5 | Durable -> relationship projection | Automatic (FalkorDB sync) |
| Any -> M6 | -> Constitutional receipt | Only for constitutionally significant events |

---

## Section 6: The 13 Benda Wajib

The 13 mandatory invariants for any governed agentic system. Violation of any hard invariant renders the action VOID. Soft violations produce CAUTION or HOLD.

### B1 — Every Action Has Actor

No action is unattributed. Every event envelope must carry `identity.actor_id` and `identity.session_id`. An anonymous action is an unconstitutional action.

### B2 — Every Action Has Explicit Intent

No implicit actions. The `intent.purpose` field must be populated with a natural-language description of why this action exists. Fuzzy intent = F4 CLARITY violation.

### B3 — Facts, Beliefs, Hypotheses Are Separate

Every claim must carry an epistemic class: `FACT`, `BELIEF`, `HYPOTHESIS`, `ESTIMATE`, `UNKNOWN`. Conflating them violates F2 TRUTH. A hypothesis treated as a fact is a lie.

### B4 — Every Capability Has One Owner

No shared ownership. Every tool, capability, and organ has exactly one canonical owner. Dual ownership creates authority conflicts. See Federation Organ Map.

### B5 — Every Mutation Classified Before Execution

No mutation proceeds without `action.classification`: OBSERVE, SUGGEST, SIMULATE, DRAFT, QUEUE, EXECUTE_REVERSIBLE, EXECUTE_HIGH_IMPACT, IRREVERSIBLE. Classification determines governance requirements.

### B6 — Authority Is Action-Specific and Time-Bounded

No blanket authority. Every lease is scoped to specific tools, specific actions, with a TTL. Expired authority is no authority. See `forge_lease`.

### B7 — Execution and Judgment Are Separate

The actor who executes cannot be the actor who judges. A-FORGE engineers. arifOS judges. Self-authorization is F13 SOVEREIGN violation.

### B8 — Every Action Has Expected Evidence

Before execution, declare what evidence would confirm success and what evidence would indicate failure. Without expected evidence, verification is impossible.

### B9 — Every State Transition Has Lineage

State changes must trace back to their trigger: what caused the transition, when, who authorized it. State without lineage is drift.

### B10 — Memory Is Correctable

No memory is permanent except M6 (VAULT999). Any memory can be corrected, superseded, or retracted. But corrections themselves are recorded (M4 lineage). Memory correction is not memory deletion.

### B11 — Irreversible Events Produce Scars

If an action is irreversible and causes harm, it must be sealed as a scar. Scars reduce Phi for future matching intents. The system learns from irreversible mistakes. F1 AMANAH demands this.

### B12 — System Has HOLD State

The system can always pause. HOLD is not failure — it is governance working correctly. Any agent can issue a HOLD. Only the sovereign (F13) can override a HOLD.

### B13 — Human Sovereignty Survives Automation

No matter how autonomous the system becomes, F13 (SOVEREIGN) ensures the human veto is final. Automation extends capability. It does not replace authority.

### B14 — Every Run Has a Governed Work Ledger

Every agent run must carry a WorkContract recording budget, context, evidence, coordination, resource use, and verified outcome. A run without a work ledger is an unaccountable run. F11 AUDITABILITY demands that every decision can be traced to its budget allocation and verified outcome. The WorkContract is created at 000 INIT and the TaskOutcome receipt is produced at 999 SEAL. Between these bookends, every lifecycle stage records spend against the budget.


---

## Section 7: Canonical Event Envelope

Every action in the federation produces a canonical event envelope. Seven sections. No exceptions.

### Envelope Sections

| Section | Purpose | Required |
|---------|---------|----------|
| **identity** | Who: actor, session, lease, correlation | Yes |
| **intent** | Why: purpose, goal, expected_outcome | Yes |
| **epistemic** | What class: fact/belief/hypothesis, confidence, sources | Yes |
| **action** | What: type, classification, tool, parameters | Yes |
| **governance** | Gates: floors checked, lease status, authority chain | Yes |
| **lineage** | Where from: parent event, trigger, causal chain | Yes |
| **metabolic** | What changed: scars, cooling state, phase | Conditional |

### Envelope Schema

See `/root/A-FORGE/schemas/agentic-event-envelope.schema.json` for the JSON Schema definition.

### TypeScript Definition

See `/root/A-FORGE/src/domain/types/memory-lifecycle.ts` for `AgenticEventEnvelope`.

---

## Section 8: The Eleven Layers

| Layer | Name | Role |
|-------|------|------|
| 0 | **Human Reality** | Physical world, human intent, sovereign authority |
| 1 | **Identity** | Who is acting, what is their authority scope |
| 2 | **Observation** | What is happening, sensory input, evidence intake |
| 3 | **Registry** | What exists in the system, capabilities, permissions |
| 4 | **Memory** | What has happened, provenance, temporal truth |
| 5 | **Reason** | What should happen, planning, simulation, prediction |
| 6 | **Governance** | What is allowed, floor checks, constitutional gates |
| 7 | **Execution** | What is done, mutation, side effects |
| 8 | **Verification** | What actually happened, evidence matching, outcome check |
| 9 | **Receipt** | What is recorded, audit trail, hash chain |
| 10 | **Metabolism** | What is learned, scar formation, cooling, wisdom update |
| 11 | **Sovereignty** | What cannot be overridden, human veto, F13 |

---

## Section 9: Canonical Lifecycle

The lifecycle of every governed action in the federation:

| Stage | Name | Description |
|-------|------|-------------|
| **000** | INIT | Session birth. Identity resolved. Authority scope loaded. |
| **111** | OBSERVE | Evidence intake. Sensors, queries, web fetches, tool calls. |
| **222** | ENCODE | Observation -> structured memory. Epistemic classification applied. |
| **333** | THINK | Reasoning, planning, simulation. Forge predict runs. |
| **444** | ROUTE | Organ routing. Evidence -> compute -> domain assignment. |
| **555** | CRITIQUE | Heart critique. Risk assessment. Ethical review. |
| **666** | HEART | Vitality check. Human readiness. WELL consultation. |
| **777** | FORGE | Engineering execution. Mutation, deployment, action. |
| **888** | JUDGE | Constitutional judgment. Floor checks. SEAL/HOLD/VOID. |
| **999** | SEAL | VAULT999 recording. Hash-chain append. Immutable receipt. |

### Work Ledger Integration

Every lifecycle stage records to the work ledger:

| Stage | Work Ledger Record |
|-------|--------------------|
| **000 INIT** | WorkContract created, budgets set |
| **111 OBSERVE** | ContextManifest recorded, context tokens counted |
| **333 THINK** | Reasoning cycles spent, model calls tracked |
| **555 COORDINATE** | Delegation costs recorded, expected vs actual value |
| **777 ACT** | Tool calls tracked, side effects logged |
| **888 VERIFY** | Verification outcomes recorded against criteria |
| **999 RECEIPT** | TaskOutcome emitted, GIE computed |


---

## Section 10: Build Order — The Measurement Spine

### Epoch 1 — Measure Work (P0)
- AF-001: WorkContract schema (memory-lifecycle.ts)
- AF-002: Runtime event schema (event envelope budget section)
- AF-003: Budget interceptor (track spend at each lifecycle stage)
- AF-004: Verification ledger (record outcomes against proposals)

### Epoch 2 — Govern Information (P1)
- AF-005: ContextManifest compiler (select/reject context with token costs)
- AF-006: Contradiction/supersession graph (WorldState tracking)
- AF-007: Memory decision-value metadata (MemoryValue replaces vibes-based promotion)

### Epoch 3 — Govern Federation (P2)
- AF-008: Delegation accounting (CoordinationAccounting per delegation)
- AF-009: Comparative routing experiments (measure delegation value)
- AF-010: Resource envelope (MetabolicEnvelope for machine/financial/human limits)

### Epoch 4 — Govern Physical Reality (P3)
- AF-011: Reality-layer schema (OBS/DER/INT/SPEC classification)
- AF-012: Prediction/resolution records (link predictions to outcomes)

## Section 11: Minimal Stack

For a governed agentic application to function, the minimum viable stack is:

| Component | Purpose | Minimum |
|-----------|---------|---------|
| **Identity store** | Actor, session, authority | PostgreSQL or SQLite |
| **Ephemeral memory** | Working state, session thread | Redis (or in-memory Map) |
| **Canonical memory** | Durable, provenance-tagged facts | PostgreSQL |
| **Event transport** | Inter-component communication | NATS (or EventEmitter for single-process) |
| **Governance engine** | Floor checks, verdict emission | In-process module (Benda Wajib validator) |
| **Receipt store** | Constitutional audit trail | Append-only JSONL file (VAULT999 pattern) |
| **Envelope standard** | Every response is a VerdictEnvelope | TypeScript types (see D3) |

**Everything else is optional.** Qdrant, FalkorDB, Langfuse, OpenTelemetry — these add capability, not correctness. A system can be constitutional with just PostgreSQL, Redis, and a governance module.

---

## Section 12: The Permanent Formula

```
Agentic App = State x Time x Identity x Capability x Evidence x Governance x Action x Verification x Receipt
```

Remove any factor and the system is no longer agentic:

- **Without State:** Stateless request-response. CRUD. Not agentic.
- **Without Time:** No temporal reasoning. Stale data is treated as fresh. F2 violation.
- **Without Identity:** Anonymous actions. No accountability. F11 violation.
- **Without Capability:** No permissions. Either blocked or ungoverned.
- **Without Evidence:** No verification. Claims without proof. F2 violation.
- **Without Governance:** No floors. No constitution. Just scripts with databases.
- **Without Action:** Observation without execution. Knowledge without agency.
- **Without Verification:** No difference between success and hallucination.
- **Without Receipt:** No audit trail. No metabolism. No learning from failure.

---

## Section 13: arifOS Mapping

| arifOS Component | Federation Role | Layer |
|------------------|----------------|-------|
| **arifOS kernel** | Governance, judgment, routing | Layers 5, 6, 11 |
| **AAA cockpit** | Identity, UX, A2A authority | Layers 0, 1, 2 |
| **A-FORGE** | Execution, engineering, mutation | Layers 7, 8, 9 |
| **GEOX** | Earth intelligence, domain evidence | Layers 2, 3 (domain) |
| **WEALTH** | Capital intelligence, domain compute | Layers 2, 3 (domain) |
| **WELL** | Vitality guard, human readiness | Layers 0, 6 (soft) |
| **VAULT999** | Immutable audit memory, scars, receipts | Layers 9, 10 |
| **F13 SOVEREIGN** | Human veto, final authority | Layer 11 |

### The Flow

```
Human (Layer 0)
    -> AAA (Layer 1: Identity)
        -> GEOX/WEALTH/WELL (Layer 2: Observation)
            -> Registry (Layer 3: What exists)
                -> Memory (Layer 4: What happened)
                    -> arifOS THINK (Layer 5: Reason)
                        -> arifOS JUDGE (Layer 6: Govern)
                            -> A-FORGE (Layer 7: Execute)
                                -> Verification (Layer 8: Check)
                                    -> VAULT999 (Layer 9: Receipt)
                                        -> Metabolism (Layer 10: Learn)
                                            -> Sovereignty (Layer 11: Veto survives)
```

---

## Appendix: Cross-References

| Deliverable | Path |
|-------------|------|
| Event Envelope Schema | `/root/A-FORGE/schemas/agentic-event-envelope.schema.json` |
| Memory Lifecycle Types | `/root/A-FORGE/src/domain/types/memory-lifecycle.ts` |
| Benda Wajib Validator | `/root/A-FORGE/src/domain/governance/benda-wajib.ts` |
| Vertical Agent Types | `/root/A-FORGE/src/domain/agents/vertical-agent/types.ts` |
| Vertical Agent State Machine | `/root/A-FORGE/src/domain/agents/vertical-agent/state-machine.ts` |
| Vertical Agent Engine | `/root/A-FORGE/src/domain/agents/vertical-agent/index.ts` |
| VerdictEnvelope (existing) | `/root/A-FORGE/src/domain/governance/verdict-envelope.ts` |
| APEX Contracts (existing) | `/root/A-FORGE/src/contracts/types.ts` |
| Federation Organ Map | `/root/AAA/docs/ORGAN.md` |

### Measurement Spine Types (Section 13-20)

| Type | Section | Purpose |
|------|---------|---------|
| WorkBudget | §13 | Bounded resource allocation for a governed run |
| WorkContract | §13 | Binding agreement between agent and constitution |
| ContextItem / ContextManifest | §14 | Governed information selection with token costs |
| MemoryValue | §15 | Decision-value metadata for promotion (replaces vibes) |
| RealityLayer / WorldState | §16 | OBS/DER/INT/SPEC classification of knowledge |
| VerificationProposal / VerificationRecord | §17 | Verification > generation tracking |
| Delegation | §18 | Coordination cost accounting |
| MetabolicEnvelope | §19 | Machine, financial, and human limits |
| TaskOutcome | §20 | Immutable receipt of what was spent and achieved |


---

*Forged 2026-07-12 by A-FORGE. Updated with measurement spine (Section 0, BW14, Epochs AF-001–AF-012).*
*Canonical doctrine for agentic application architecture.*
*DITEMPA BUKAN DIBERI — 999 SEAL ALIVE*

---

## Section 5A: L4→L5 Promotion Formula (Addition 1)

### Why "3+ Occurrences" Is UNSAFE

Naive promotion rules like "3+ occurrences promotes to durable memory" are vulnerable to:
- **Single-source repetition:** Bot logs the same observation 3 times
- **Low-quality repetition:** 3 noisy sensor readings
- **Contradictory observations:** 3 readings that disagree on value
- **Scope contamination:** Observation from domain A repeated in domain B's memory

### The Governed Formula

The promotion from L4 (durable governed memory in PostgreSQL) to L5 (relationship/contradiction projection in FalkorDB) uses a multi-dimensional formula:

```
promotion_score = (
    frequency_weight × log2(access_count + 1) ×
    independence_weight × (unique_sources / max_sources) ×
    evidence_weight × mean(evidence_confidence) ×
    contradiction_penalty × (1 - contested_ratio) ×
    scope_weight × scope_specificity ×
    consequence_weight × (1 - human_consequence)
)

promote = (score ≥ threshold) AND (contested == false) AND (independent_sources ≥ 2)
```

### Component Breakdown

| Component | Formula | Purpose |
|-----------|---------|---------|
| **Frequency** | `log2(access_count + 1)` | Logarithmic to prevent spam gaming |
| **Independence** | `unique_sources / max_sources` | Normalized source diversity |
| **Evidence** | `mean(evidence_confidence)` | Quality of evidence backing |
| **Contradiction** | `(1 - contested_ratio)` | Penalizes disputed memories |
| **Scope** | `scope_specificity` | Domain-specific relevance |
| **Consequence** | `(1 - human_consequence)` | Penalizes human-consequential claims |

### Hard Gates (Non-Negotiable)

1. **contested == false** — Unresolved disputes block promotion
2. **independent_sources >= 2** — Minimum source diversity
3. **score >= threshold** — Composite score must meet threshold (default: 0.65)

### Default Configuration

```typescript
const DEFAULT_PROMOTION_FORMULA: PromotionFormula = {
  weights: {
    frequency_weight: 0.20,
    independence_weight: 0.25,
    evidence_weight: 0.25,
    contradiction_penalty: 0.15,
    scope_weight: 0.10,
    consequence_weight: 0.05,
  },
  threshold: 0.65,
  max_sources: 10,
  min_independent_sources: 2,
};
```

### Implementation

See `/root/A-FORGE/src/domain/types/memory-lifecycle.ts` — `PromotionFormula`, `PromotionInput`, `PromotionResult`, `computePromotionScore()`.

See `/root/A-FORGE/src/domain/governance/benda-wajib.ts` — `validatePromotion()`.

---

## Section 5B: Reasoning Budget — Metabolic Control for Thinking (Addition 2)

### The Problem

Without a reasoning budget, agents can spiral into infinite reasoning loops, consuming tokens and time without converging on action. The budget enforces convergence by capping steps, tool calls, cost, and tokens — and by escalating when confidence stalls.

### The Budget

The reasoning budget caps THINKING expenditure. It is complementary to the 17x rule which caps DECISION expenditure:

| Control | Caps | Trigger |
|---------|------|---------|
| **17x Rule** | DECISION expenditure | Cost > 17x expected value |
| **Reasoning Budget** | THINKING expenditure | Steps/tokens/cost exceed limits |

Together they form the metabolic control layer.

### Configuration

```typescript
const DEFAULT_REASONING_BUDGET: ReasoningBudget = {
  max_steps: 12,
  max_tool_calls: 20,
  max_cost_usd: 0.50,
  max_tokens: 100000,
  escalation_condition: "confidence < 0.60 after 3 attempts",
  halt_condition: "repeated_failure >= 3 OR contradiction_unresolved",
};
```

### Escalation and Halt

| Condition | Action |
|-----------|--------|
| `confidence < 0.60 after 3 attempts` | **ESCALATE** — route to higher authority (888_JUDGE) |
| `repeated_failure >= 3` | **HALT** — stop reasoning, report failure |
| `contradiction_unresolved` | **HALT** — cannot proceed with unresolved contradictions |
| Any budget dimension exceeded | **HALT** — force convergence or escalation |

### Integration with Vertical Agents

Vertical agents respect the reasoning budget at each lifecycle stage:

```typescript
// Before advancing to next stage
const budgetCheck = checkReasoningBudget(status, budget);
if (budgetCheck.should_halt) {
  return { success: false, reason: "HALT: budget exceeded" };
}
if (budgetCheck.should_escalate && next !== "888_JUDGE") {
  return { success: false, reason: "ESCALATE: must route to judge" };
}
```

### Implementation

See `/root/A-FORGE/src/domain/types/memory-lifecycle.ts` — `ReasoningBudget`, `ReasoningBudgetStatus`, `checkReasoningBudget()`.

See `/root/A-FORGE/src/domain/governance/benda-wajib.ts` — `validateReasoningBudget()`.

See `/root/A-FORGE/src/domain/agents/vertical-agent/index.ts` — `VerticalAgentEngine` with budget enforcement.
