# FORGE8 Master Contract — A-FORGE Civilizational Execution Architecture

> DITEMPA BUKAN DIBERI — Forged, Not Given
> Constitutional clarity achieved 2026-06-29

---

## Executive Summary

A-FORGE is not 8 tools. A-FORGE is **one of eight civilizational organs** executing a governed loop.

This architecture defines three levels:

```
Civilizational Level (8 organs):
  SENSE → MEMORY → REASON → JUDGE → FORGE → ACT → WITNESS → SCAR/VAULT

Organ Level (FORGE = A-FORGE has 8 execution verbs):
  forge_synthesize
  forge_stage
  forge_sandbox_run
  forge_scar_scan
  forge_skillstore_sync
  forge_tier_bind
  forge_docket_prep
  forge_execute

Tool Level (many tools under each organ):
  GEOX: 30+ geoscience tools
  WEALTH: 25+ capital tools
  WELL: 22+ readiness tools
  A-FORGE: 80+ execution tools (collapsed to 8 verbs for governance)
```

**Constitutional Principle**: Power is distributed. Law is centralized.

---

## The Civilizational Loop

Every action in arifOS flows through this loop:

```
┌─────────────────────────────────────────────────────────┐
│  1. SENSE — Observe reality (GEOX, WEALTH, WELL)        │
│     ↓                                                    │
│  2. MEMORY — Retrieve provenance (SkillStore, VAULT999) │
│     ↓                                                    │
│  3. REASON — Understand situation (111 THINK, 333 EXPLORE) │
│     ↓                                                    │
│  4. JUDGE — Evaluate ethics (APEX, SABAR, arif_judge)   │
│     ↓                                                    │
│  5. FORGE — Build artifact (A-FORGE's 8 verbs)          │
│     ↓                                                    │
│  6. ACT — Execute with VAULT999 seal                     │
│     ↓                                                    │
│  7. WITNESS — Validate against reality (Tri-Witness)    │
│     ↓                                                    │
│  8. SCAR/VAULT — Preserve lessons (SCAR Law, VAULT999)  │
│     ↓                                                    │
│  (Loop repeats)                                          │
└─────────────────────────────────────────────────────────┘
```

---

## The 8 Civilizational Organs

Each organ has a specific function and prevents a specific danger:

| Organ | Function | Prevents |
|-------|----------|----------|
| **SENSE** | Observe reality | Hallucination from stale memory |
| **MEMORY** | Preserve provenance | Amnesia and repeated work |
| **REASON** | Understand situation | Blind execution |
| **JUDGE** | Evaluate ethics | Unsafe capability |
| **FORGE** | Build artifact | Advice without implementation |
| **ACT** | Execute with seal | Paralysis |
| **WITNESS** | Validate reality | Self-validation |
| **SCAR/VAULT** | Preserve lessons | Repeated failure and denial |

### Key Insight

These are not arbitrary 8 tools. These are the **8 irreducible organs of civilization** that every human institution runs on.

Every civilizational function fits into one of these:

- Planning → REASON
- Building → FORGE
- Auditing → JUDGE
- Learning → SCAR/VAULT
- Acting → ACT
- Verifying → WITNESS
- Remembering → MEMORY
- Observing → SENSE

---

## A-FORGE: The FORGE Organ

A-FORGE is the FORGE organ. It has 8 execution verbs that form its internal loop:

```
forge_synthesize
  ↓ (create artifact from intent)
forge_stage
  ↓ (move to quarantine, lock spec)
forge_sandbox_run
  ↓ (test in isolated environment)
forge_scar_scan
  ↓ (check against past failures)
forge_skillstore_sync
  ↓ (store with provenance)
forge_tier_bind
  ↓ (set trust tier, lower bound only)
forge_docket_prep
  ↓ (hand off to arifOS)
forge_execute
  ↓ (deploy with VAULT999 seal)
```

### Constitutional Boundaries (Critical)

Every verb has a constitutional boundary:

1. **forge_synthesize**: Code generation, not filesystem access
2. **forge_stage**: Spec becomes IMMUTABLE after staging
3. **forge_sandbox_run**: Isolated execution, ABSOLUTE timeout
4. **forge_scar_scan**: A-FORGE detects, arifOS judges
5. **forge_skillstore_sync**: Write-only for new, read-only for historical
6. **forge_tier_bind**: LOWER BOUND only, arifOS sets ACTUAL tier
7. **forge_docket_prep**: A-FORGE RELINQUISHES CONTROL
8. **forge_execute**: FAILS HARD without valid VAULT999 SEAL

### Why forge_execute Cannot Self-Authorize

```typescript
// CRITICAL CONSTITUTIONAL BOUNDARY:
//
// forge_execute will FAIL HARD if:
//   1. Docket lacks VAULT999 SEAL
//   2. VAULT999 SEAL signature is invalid
//   3. VAULT999 SEAL is expired
//   4. VAULT999 SEAL hash doesn't match docket hash
//
// No SEAL = no execution. Period.
//
// This is what prevents A-FORGE from self-authorizing.
```

---

## Engineering Answers

### Question 1: Timeout Policy for forge_sandbox_run

**Question**: Should we set absolute timeout on sandbox execution to prevent infinite loops?

**Answer**: Yes, ABSOLUTE timeout is mandatory.

**Implementation**:

```typescript
export const SANDBOX_TIMEOUT_MAX_MS = {
  C0_AUTO: 60_000,           // 1 minute for auto-generated artifacts
  C1_STANDARD: 300_000,      // 5 minutes for standard execution
  C2_PRIVILEGED: 900_000,    // 15 minutes for privileged operations
  C3_SOVEREIGN: 1_800_000    // 30 minutes for sovereign-approved execution
} as const;
```

**Why**:
- Prevents infinite loops and compute burning
- Enforceable (not advisory)
- Hardcoded into sandbox runtime
- Cannot be overridden by artifact code

**Constitutional Principle**: Landauer limit must be enforced at execution time, not advisory time.

---

### Question 2: Memory Retention Policy for forge_skillstore_sync

**Question**: If we have millions of artifacts, what's the retention policy?

**Answer**: Two-layer retention system.

**Implementation**:

```typescript
export const MEMORY_RETENTION_POLICY = {
  hot_storage: {
    retention_days: 365,              // 1 year for hot storage
    max_artifacts: 100_000,           // 100K artifacts in hot storage
    vector_embedding: true,           // Full vector embeddings in Qdrant
    provenance_completeness: "full"   // Complete provenance required
  },
  cold_storage: {
    retention_days: "infinite",       // Never expire SCAR-linked artifacts
    compression: "gzip_level_9",      // Maximum compression
    vector_embedding: false,          // No embeddings (save space)
    provenance_completeness: "metadata_only" // Metadata only (no full code)
  },
  scar_immunization: {
    enabled: true,
    rule: "SCAR-linked artifacts NEVER move to cold storage or expire",
    reason: "Prevents structural amnesia of past failures"
  },
  pruning_policy: {
    triggered_when: "hot_storage > 90% capacity",
    prunes: "non-SCAR artifacts older than 365 days",
    moves_to: "cold_storage"
  }
} as const;
```

**Key**: SCAR-linked artifacts are immunized. They never expire. This prevents structural amnesia of past failures.

**Constitutional Principle**: SCAR Law must prevent repeated failures. Memory must preserve lessons, not just artifacts.

---

## File Structure

```
/root/A-FORGE/
├── forge_work/2026-06-29/
│   ├── FORGE8_SPEC.md                          # High-level specification
│   ├── FORGE8_CIVILIZATIONAL_SPEC.md           # Civilizational 8 organs spec
│   └── FORGE8_MASTER_CONTRACT.md               # This file (master documentation)
│
└── src/interfaces/mcp/contract/
    ├── civilizational_eight_organs.ts           # Master TypeScript contract
    ├── forge8_execution_verbs.ts                # 8 A-FORGE execution verbs
    └── (forge8.ts - older version, can be archived)
```

---

## Usage Guide

### How to Use This Contract

1. **Read the civilizational overview**: `FORGE8_CIVILIZATIONAL_SPEC.md`
2. **Read the master documentation**: This file (`FORGE8_MASTER_CONTRACT.md`)
3. **Import the TypeScript contract**: 
   ```typescript
   import { CIVILIZATIONAL_METADATA } from './contract/civilizational_eight_organs';
   import { ForgeSynthesizeRequestSchema } from './contract/forge8_execution_verbs';
   ```

### Example: Building an Artifact

```typescript
import {
  ForgeSynthesizeRequestSchema,
  ForgeStageRequestSchema,
  ForgeExecuteRequestSchema
} from './forge8_execution_verbs';

// Step 1: Synthesize
const synthesize_request = ForgeSynthesizeRequestSchema.parse({
  intent: "Build a Python script to analyze market data",
  decision_class: "C1_STANDARD"
});

const synthesize_response = await forge_synthesize(synthesize_request);
// Returns: { artifact_id: "uuid-123", code: "def analyze(): ...", ... }

// Step 2: Stage
const stage_request = ForgeStageRequestSchema.parse({
  artifact_id: synthesize_response.artifact_id
});

const stage_response = await forge_stage(stage_request);
// Returns: { stage_id: "uuid-456", staging_location: "/quarantine/staging", locked: true, ... }

// ... (sandbox_run, scar_scan, skillstore_sync, tier_bind, docket_prep)

// Step 8: Execute (REQUIRES VAULT999 SEAL)
const execute_request = ForgeExecuteRequestSchema.parse({
  docket_id: docket_response.docket_id,
  vault_seal_id: "seal-uuid-from-arifos",
  vault_seal_signature: "cryptographic-signature-from-vault999",
  vault_seal_timestamp: "2026-06-29T12:00:00Z"
});

const execute_result = await forge_execute(execute_request);

if (execute_result.success) {
  console.log("Artifact executed successfully");
} else {
  console.log("Constitutional violation:", execute_result.error_type);
  // e.g., "NO_VAULT999_SEAL", "INVALID_SIGNATURE", etc.
}
```

---

## Summary

**A-FORGE is not 8 tools. A-FORGE is one of eight civilizational organs executing a governed loop.**

The three levels:

1. **Civilizational Level**: 8 organs (SENSE → SCAR/VAULT)
2. **Organ Level**: FORGE = A-FORGE with 8 execution verbs
3. **Tool Level**: Domain-specific tools (GEOX/WEALTH/WELL)

Constitutional principle: **Power is distributed. Law is centralized.**

Key engineering answers:
- Timeout policy: ABSOLUTE timeout on sandbox (prevents infinite loops)
- Memory retention: Two-layer system with SCAR immunization (prevents structural amnesia)

Why forge_execute cannot self-authorize:
- Requires valid VAULT999 SEAL from arifOS
- Fails hard if seal is missing, invalid, expired, or hash mismatch
- This is the constitutional boundary that prevents A-FORGE from self-authorization

```
DITEMPA BUKAN DIBERI

AGI is not one mind.
AGI is eight governed organs executing one civilizational loop.

Power is distributed. Law is centralized.
```

---

## Sealed

Constitutional chain ID: FORGE8_MASTER_CONTRACT_42_1
Sealed: 2026-06-29
By: FORGE (000Ω)
