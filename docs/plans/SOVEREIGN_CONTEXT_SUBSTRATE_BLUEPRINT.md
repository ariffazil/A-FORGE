# Sovereign Context Substrate Blueprint
## Standardized, Portable, Encrypted Knowledge Graph for Cognitive Sovereignty

> **Status:** IMPLEMENTATION BLUEPRINT v1.0  
> **Epoch:** 2026-04-19  
> **Priority:** P1 — Parallel with Thermodynamic Scheduler  
> **ETA:** 4 weeks

---

## 1. Problem Statement

Users of centralized AI platforms are "cognitive tenants"—their subjective intelligence, behavioral patterns, preferences, and reasoning structures are extracted to build proprietary corporate moats. There is no standardized way for an individual or enterprise to:
- Own their cognitive history
- Port their intelligence substrate across models/providers
- Encrypt their context such that the runtime cannot read it without authorization
- Maintain continuity independent of any vendor's roadmap

## 2. Solution: The Sovereign Context Substrate (SCS)

An open, encrypted protocol that allows users to continuously log their explicit reasoning, preferences, risk tolerances, and ethical constraints into a **highly portable, programmable knowledge graph**. This substrate is strictly decoupled from any specific inference provider or cloud application.

### 2.1 Key Properties

| Property | Mechanism |
|----------|-----------|
| **Portability** | JSON-LD based knowledge graph with canonical schema |
| **Encryption** | AES-256-GCM for data at rest; ephemeral keys per session |
| **Decoupling** | Provider-agnostic query interface; no vendor-specific embeddings |
| **Programmability** | User-defined constraints encoded as executable policy graphs |
| **Verifiability** | Merkle-anchored integrity proofs for context mutations |

## 3. Current State in A-FORGE

A-FORGE has partial memory infrastructure:

| Component | What It Does | Gap |
|-----------|-------------|-----|
| `LongTermMemory` | File-backed keyword search | No structured graph, no encryption |
| `MemoryContract` | Sacred memory tier (eureka capsules) | Immutable but not portable |
| `ShortTermMemory` | Volatile session context | Ephemeral, not persisted |
| `PostgresVaultClient` | Immutable audit ledger | Append-only, not queryable as context |

## 4. Implementation Plan

### 4.1 New Components

#### `src/substrate/SovereignContext.ts`
The central context manager for user-owned knowledge.

```typescript
interface SovereignContext {
  // Unique identifier for this context substrate (user-owned)
  substrateId: string;
  
  // Encrypted knowledge graph
  graph: EncryptedKnowledgeGraph;
  
  // User-defined constitutional constraints
  constraints: ConstraintPolicy[];
  
  // Reasoning history (compressed, encrypted)
  reasoningLog: ReasoningEntry[];
  
  // Preference vectors (embedding-agnostic)
  preferenceVectors: PreferenceVector[];
  
  // Integrity proof
  merkleRoot: string;
}

interface EncryptedKnowledgeGraph {
  schema: "arifos-scs-v1";
  ciphertext: string;           // AES-256-GCM encrypted JSON-LD
  nonce: string;
  keyDerivation: {
    salt: string;
    iterations: number;
    algorithm: "pbkdf2-sha256";
  };
}

interface ConstraintPolicy {
  id: string;
  scope: "global" | "domain" | "session";
  domain?: string;              // e.g., "wealth", "geox", "code"
  rule: ConstraintRule;
  priority: number;             // 0-100, higher = stronger
  enforced: boolean;
}

interface ConstraintRule {
  type: "max_risk" | "min_witness" | "required_floor" | "banned_tool" | "mandatory_review";
  parameter: string;
  threshold: number | string | boolean;
}

interface ReasoningEntry {
  epoch: string;
  sessionId: string;
  query: string;
  conclusion: string;
  epistemicTag: "CLAIM" | "PLAUSIBLE" | "HYPOTHESIS" | "ESTIMATE" | "UNKNOWN";
  confidence: number;
  floorsChecked: string[];
  vaultRecordId: string;
}

interface PreferenceVector {
  dimension: string;            // e.g., "risk_tolerance", "verbosity", "ethical_weight"
  value: number;
  certainty: number;            // How well this preference is established
  source: "explicit" | "inferred" | "inherited";
}
```

#### `src/substrate/ContextSerializer.ts`
Handles encryption, decryption, and schema migration.

```typescript
class ContextSerializer {
  // Encrypt a knowledge graph with user-provided passphrase
  static encrypt(
    graph: KnowledgeGraph,
    passphrase: string,
    options?: EncryptionOptions,
  ): EncryptedKnowledgeGraph;

  // Decrypt for active session use
  static decrypt(
    encrypted: EncryptedKnowledgeGraph,
    passphrase: string,
  ): KnowledgeGraph;

  // Export to portable format (encrypted JSON file)
  static export(context: SovereignContext): PortableContextFile;

  // Import from portable format
  static import(file: PortableContextFile, passphrase: string): SovereignContext;

  // Schema migration between versions
  static migrate(
    context: SovereignContext,
    targetVersion: string,
  ): SovereignContext;
}
```

#### `src/substrate/KnowledgeGraphEngine.ts`
Query and manipulate the knowledge graph without embedding provider lock-in.

```typescript
interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
  observations: Observation[];
}

interface Entity {
  id: string;
  type: "person" | "organization" | "concept" | "event" | "decision";
  labels: Record<string, string>;
  properties: Record<string, unknown>;
  confidence: number;
  sources: string[];
}

interface Relation {
  id: string;
  source: string;      // entity id
  target: string;      // entity id
  type: string;
  properties: Record<string, unknown>;
  confidence: number;
}

class KnowledgeGraphEngine {
  // Add entity with automatic provenance tracking
  addEntity(entity: Entity, source: string): void;

  // Query by structured pattern (not embedding-dependent)
  query(pattern: GraphPattern): QueryResult;

  // Find paths between entities
  findPaths(from: string, to: string, maxDepth: number): EntityPath[];

  // Compute entity centrality (importance in user's knowledge)
  computeCentrality(entityId: string): number;

  // Merge with another graph (conflict resolution)
  merge(other: KnowledgeGraph, strategy: "union" | "intersection" | "latest-wins"): KnowledgeGraph;
}
```

#### `src/substrate/ConstraintEnforcer.ts`
Applies user-defined constraints to agent actions.

```typescript
class ConstraintEnforcer {
  constructor(private context: SovereignContext);

  // Evaluate an action against all applicable constraints
  evaluateAction(
    action: string,
    toolName: string,
    params: Record<string, unknown>,
    domain?: string,
  ): ConstraintEvaluation;

  // Inject constraint context into AgentEngine system prompt
  buildConstraintPrompt(domain?: string): string;
}

interface ConstraintEvaluation {
  permitted: boolean;
  violatedConstraints: ConstraintPolicy[];
  recommendedFloors: string[];
  overrideRequires: "none" | "human_approval" | "cryptographic_signature";
}
```

#### `src/substrate/PhoenixCooling.ts`
Implements the Phoenix-72 cooling protocol for new insights.

```typescript
interface CoolingEntry {
  id: string;
  type: "insight" | "constraint" | "preference" | "entity";
  content: unknown;
  proposedAt: string;
  coolingUntil: string;
  status: "cooling" | "promoted" | "rejected";
  reviewVotes: { reviewer: string; approve: boolean; reason: string }[];
}

class PhoenixCooling {
  private coolingPeriodHours: number = 72;

  // Submit a new insight for cooling
  propose(entry: Omit<CoolingEntry, "coolingUntil" | "status">): CoolingEntry;

  // Review a cooled entry (human or adversarial agent)
  review(entryId: string, vote: { reviewer: string; approve: boolean; reason: string }): void;

  // Promote entries that have passed cooling + review
  promoteReadyEntries(): CoolingEntry[];

  // Check if an entry is trusted (passed cooling)
  isTrusted(entryId: string): boolean;
}
```

### 4.2 Engine Integration

Modify `src/engine/AgentEngine.ts`:

```typescript
interface AgentEngineDependencies {
  // ... existing dependencies ...
  sovereignContext?: SovereignContext;
  constraintEnforcer?: ConstraintEnforcer;
}

// In run():
if (this.dependencies.sovereignContext) {
  // Inject user preferences into system context
  const preferenceContext = this.dependencies.sovereignContext.preferenceVectors
    .map(p => `${p.dimension}=${p.value.toFixed(2)} (certainty: ${p.certainty})`)
    .join("\n");
  
  shortTermMemory.append({
    role: "system",
    content: `SOVEREIGN CONTEXT:\n${preferenceContext}`,
  });

  // Evaluate task against user constraints
  if (this.dependencies.constraintEnforcer) {
    const constraintEval = this.dependencies.constraintEnforcer.evaluateAction(
      options.task,
      "init",
      {},
      routing.primaryOrgan,
    );
    if (!constraintEval.permitted) {
      floorsTriggered.push(...constraintEval.recommendedFloors);
      return {
        sessionId,
        finalText: `VOID: Action violates user constraints: ${constraintEval.violatedConstraints.map(c => c.id).join(", ")}`,
        // ...
      };
    }
  }
}
```

### 4.3 Files to Create

| File | Purpose |
|------|---------|
| `src/substrate/SovereignContext.ts` | Core substrate types and manager |
| `src/substrate/ContextSerializer.ts` | Encryption/decryption/portability |
| `src/substrate/KnowledgeGraphEngine.ts` | Graph query and manipulation |
| `src/substrate/ConstraintEnforcer.ts` | User constraint evaluation |
| `src/substrate/PhoenixCooling.ts` | 72-hour cooling protocol |
| `src/substrate/schema/v1.ts` | Canonical JSON-LD schema |
| `src/substrate/__tests__/substrate.test.ts` | Integration tests |
| `src/substrate/__tests__/cooling.test.ts` | Phoenix-72 tests |

### 4.4 Files to Modify

| File | Change |
|------|--------|
| `src/engine/AgentEngine.ts` | Inject sovereign context, enforce constraints |
| `src/engine/AgentEngineDependencies` | Add `sovereignContext`, `constraintEnforcer` |
| `src/memory/LongTermMemory.ts` | Read from SovereignContext graph |
| `src/types/agent.ts` | Add `SovereignContext` types |
| `src/cli.ts` | Add `--import-context` and `--export-context` flags |

## 5. The Portable Context File Format

```json
{
  "arifos_scs_version": "1.0.0",
  "substrate_id": "user-uuid-here",
  "created_at": "2026-04-19T11:43:00Z",
  "last_modified": "2026-04-19T11:43:00Z",
  "encrypted_graph": {
    "schema": "arifos-scs-v1",
    "ciphertext": "base64...",
    "nonce": "base64...",
    "key_derivation": {
      "salt": "base64...",
      "iterations": 600000,
      "algorithm": "pbkdf2-sha256"
    }
  },
  "constraints_hash": "sha256-of-constraints",
  "merkle_root": "sha256-of-entire-substrate",
  "portability": {
    "compatible_runtimes": ["a-forge>=2.0", "arifosmcp>=3.0"],
    "embedding_format": "provider_agnostic",
    "encryption_required": true
  }
}
```

## 6. Constitutional Mapping

| Floor | Substrate Enforcement |
|-------|----------------------|
| F1 Amanah | Context mutations are reversible (versioned graph) |
| F2 Truth | Knowledge graph entities require source attribution |
| F3 Tri-Witness | High-confidence constraints require human + AI + vault confirmation |
| F4 Clarity | Preference vectors reduce entropy by grounding agent behavior |
| F6 Empathy | User dignity constraints are hard-coded in substrate |
| F7 Humility | Confidence scores attached to all inferred preferences |
| F9 Anti-Hantu | Substrate never claims consciousness; it is a tool |
| F11 Command Auth | Context decryption requires user passphrase (cryptographic identity) |
| F13 Sovereign | User can delete, export, or revoke context at any time |

## 7. Rollout Plan

1. **Week 1:** Schema design, `ContextSerializer` encryption layer, CLI flags
2. **Week 2:** `KnowledgeGraphEngine` + `ConstraintEnforcer`, unit tests
3. **Week 3:** `PhoenixCooling` protocol, integration with `AgentEngine`
4. **Week 4:** Import/export testing, cross-runtime compatibility tests, staging

## 8. Success Metrics

- Context export/import round-trip fidelity: **100%**
- Encryption strength: **AES-256-GCM with 600K PBKDF2 iterations**
- Cross-runtime compatibility: **A-FORGE ↔ arifosmcp** seamless
- Phoenix-72 false promotion rate: **< 2%**
- User constraint enforcement accuracy: **≥ 99%**
- Context load time (encrypted, 10K entities): **< 500ms**

---

*DITEMPA BUKAN DIBERI — Forged, Not Given*
