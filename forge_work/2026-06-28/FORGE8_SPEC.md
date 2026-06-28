# FORGE8 Spec — A-FORGE v42.1 Kernel Tools

> DITEMPA BUKAN DIBERI
> Constitutional clarity achieved 2026-06-28

---

## Executive Summary

A-FORGE is the **governed execution shell** of arifOS. It is not a judge (that's arifOS), not a worker (that's OpenCode), not a domain organ (that's GEOX/WEALTH/WELL).

A-FORGE is the **factory** that converts raw intent into governed, audited, sealed physical action.

This spec defines **8 kernel tools** that together provide **99+ capabilities** while remaining structurally incapable of self-authorization.

### The Constitutional Principle

```
A-FORGE proposes. arifOS decides.
A-FORGE builds. arifOS seals.
A-FORGE executes. arifOS audits.
```

**Power is distributed. Law is centralized.**

---

## Why 8 Tools?

### DNA Analogy

DNA has 4 nucleobases (A, T, C, G) but encodes the entire biosphere.

A-FORGE has 8 kernel tools but can synthesize millions of capabilities dynamically.

### Turing-Completeness for Agentic Action

These 8 tools are not pre-built APIs. They are **meta-tools** that forge, stage, test, and execute any capability on the fly.

An AGI doesn't need 1,000 pre-written tools. It needs an infallible factory pipeline to safely create any tool it needs.

### The 73 → 8 Reduction

The previous 73-tool surface was **tool-rich but governance-poor**. Any external agent could touch filesystem, shell, docker, git.

The new 8-tool surface is **tool-lean but governance-rich**. Every verb is leased, audited, sealed, and contained.

---

## The 8 Kernel Tools

Each tool is defined in TypeScript with:
- Interface (input/output)
- Constitutional boundary (what it CANNOT do)
- Capability coverage (what it ENABLES)
- Failure modes (how it fails safely)

### 1. forge_synthesize — The Fabricator

```typescript
export interface ForgeSynthesize {
  // INPUT
  request: {
    intent: string;
    target?: string; // "python" | "typescript" | "shell" | ...
    constraints?: string[];
    context?: string;
  }
  
  // OUTPUT
  response: {
    artifact_id: string;
    code: string;
    language: string;
    hash: string;
    line_count: number;
    complexity_score: number;
  }
}
```

**Function:** Generate code from intent. Zero-shot fabrication.

**Boundary:** Code goes to **temporary buffer only**. Never touches filesystem.

**Capability:** This single verb generates ANY programming artifact — Python scripts, TypeScript modules, shell commands, SQL queries, config files. Unlimited language coverage.

**Failure:** If generation fails or produces malformed code → returns `ARTIFACT_REJECTED` with diagnostic.

---

### 2. forge_stage — The Quarantine

```typescript
export interface ForgeStage {
  // INPUT
  request: {
    artifact_id: string;
    dependencies?: string[];
    resources_requested?: { cpu: number; memory_mb: number; timeout_ms: number }
  }
  
  // OUTPUT
  response: {
    stage_id: string;
    quarantine_path: string;
    locked: boolean;
    immutable: boolean;
    timestamp: string;
  }
}
```

**Function:** Move synthesized artifact to `.runtime/staging/` and lock it.

**Boundary:** Once staged, artifact spec is **immutable**. No silent mutations. No self-modification.

**Capability:** Enables dependency resolution, environment setup, resource negotiation.

**Failure:** If quarantine fails → artifact is destroyed. No partial staging.

---

### 3. forge_sandbox_run — The Dry-Run Engine

```typescript
export interface ForgeSandboxRun {
  // INPUT
  request: {
    stage_id: string;
    test_suite?: string[];
    max_duration_ms: number;
    resource_limits: { cpu: number; memory_mb: number; network: boolean }
  }
  
  // OUTPUT
  response: {
    exit_code: number;
    stdout: string;
    stderr: string;
    metrics: {
      duration_ms: number
      peak_memory_mb: number
      cpu_time_ms: number
      recursion_depth: number
      network_calls: number
    }
    passed_tests: string[]
    failed_tests: string[]
  }
}
```

**Function:** Run staged artifact in MicroVM with strict resource limits.

**Boundary:** Fully isolated. No network. Limited RAM. Limited CPU.

**Capability:** Enables testing of ANY executable artifact — scripts, functions, services, pipelines.

**Timeout Policy:** (See Engineering Answer §1)

**Failure:** Sandbox crash → artifact destroyed, incident logged to SCAR database.

---

### 4. forge_scar_scan — The Invariant Checker

```typescript
export interface ForgeScarScan {
  // INPUT
  request: {
    artifact_id: string
    spec_hash: string
    behavior_signature: string
  }
  
  // OUTPUT
  response: {
    scar_match: boolean
    matched_scars: scar[]
    collapse_signatures: collapse[]
    verdict: "CLEAN" | "SCAR_MATCH" | "COLLAPSE_DETECTED"
  }
}

interface scar {
  scar_id: string
  description: string
  created: string
  context: string
}

interface collapse {
  signature: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  historical_precedent: string
}
```

**Function:** Compare artifact against SCAR v2 database and collapse signatures.

**Boundary:** A-FORGE can **detect** but not judge. Only arifOS decides if a scar is acceptable.

**Capability:** Enables regression prevention, collapse prevention, institutional memory.

**Failure:** SCAR match → artifact destroyed immediately. No escalation to arifOS (efficiency).

---

### 5. forge_skillstore_sync — The Memory Ledger

```typescript
export interface ForgeSkillstoreSync {
  
  // WRITE mode
  request_write: {
    artifact_id: string
    name: string
    version: string
    tags: string[]
    provenance: {
      created_by: string
      created_at: string
      intent: string
      context: string
    }
    embedding: number[];  // vector embedding for Qdrant
  }
  
  // READ mode
  request_read: {
    query?: string
    tags?: string[]
    limit?: number
  }
  
  // OUTPUT
  response_write: { record_id: string; hash: string }
  response_read: { artifacts: artifact_metadata[] }
}
```

**Function:** Write artifact to persistent memory (versioning + vector store). Read for discovery.

**Boundary:** Write-only for new artifacts. Read-only for historical. No mutation.

**Retention Policy:** (See Engineering Answer §2)

**Capability:** Enables artifact reuse, versioning, semantic search, audit trail.

**Failure:** Write failure → artifact rejected. Read failure → empty result (non-fatal).

---

### 6. forge_tier_bind — The Trust Enforcer

```typescript
export interface ForgeTierBind {
  // INPUT
  request: {
    artifact_id: string
    
    // A-FORGE sets these mechanical constraints
    execution_scope:
      | "LOCAL"
      | "CLUSTER"
      | "NETWORK"
      | "PUBLIC"
    
    escalation_allowed: boolean
    max_invocation_count: number
    max_duration_ms: number
    
    // A-FORGE CANNOT promote tier
    // This is set by arifOS after APEX evaluation
    trust_tier:
      | 0  // untrusted (never executed)
      | 1  // isolated local only
      | 2  // cluster access
      | 3  // network access
      | 4  // public internet
      | 5  // human-supervised only
  }
  
  // OUTPUT
  response: {
    artifact_id: string
    trust_policy_hash: string  // SHA256 of full policy
    locked: boolean
  }
}
```

**Function:** Bind mechanical isolation constraints to artifact.

**Boundary:** A-FORGE sets **lower bounds only** (e.g., "must be LOCAL"). arifOS sets **actual trust tier** after evaluation.

**Capability:** Enables least-privilege execution, blast radius containment.

**Failure:** Binding failure → artifact cannot execute.

---

### 7. forge_docket_prep — The Handover

```typescript
export interface ForgeDocketPrep {
  // INPUT
  request: {
    artifact_id: string
    test_results: forge_sandbox_run_response
    scar_scan: forge_scar_scan_response
    tier_binding: forge_tier_bind_response
    skillstore_record: forge_skillstore_sync_response
  }
  
  // OUTPUT
  response: {
    docket_id: string
    payload_hash: string;  // SHA256 of entire docket
    submitted_at: string
    status: "AWAITING_EVALUATION"
    // A-FORGE stops here. No more access.
  }
}
```

**Function:** Package all artifact evidence into read-only docket for arifOS evaluation.

**Boundary:** This is where A-FORGE **relinquishes control**. Docket is read-only, sealed, handed to arifOS.

**Capability:** Enables complete audit trail, reproducibility, governance.

**Failure:** Docket creation failure → artifact destroyed, incident logged.

---

### 8. forge_execute — The Mechanical Hand

```typescript
export interface ForgeExecute {
  // INPUT
  request: {
    docket_id: string
    
    // REQUIRED: VAULT999 SEAL from arifOS
    vault_seal: {
      seal_id: string
      seal_proof: string;  // cryptographic proof from VAULT999
      seal_hash: string   // must match docket_hash
    }
  }
  
  // OUTPUT
  response: {
    execution_id: string
    exit_code: number
    stdout: string
    stderr: string
    metrics: ForgeSandboxRun_metrics
    attestation: {
      executed_by: string
      executed_at: string
      seal_valid: boolean
    }
  }
  
  // FAILURE
  response_failure: {
    error: "SEAL_MISSING" | "SEAL_INVALID" | "SEAL_EXPIRED" | "EXECUTION_FAILED"
    reason: string
  }
}
```

**Function:** Execute artifact in live environment.

**Boundary:** **FAILS HARD** if docket lacks valid VAULT999 SEAL from arifOS. No SEAL = no execution. Period.

**Capability:** Enables deployment of any executed-capable artifact.

**Failure:** Missing SEAL → immediate rejection. No partial execution. No retry without valid SEAL.

---

## Capability Matrix: 8 Tools → 99+ Capabilities

```
┌─────────────────────┬────────────────────────────────────────────┐
│ 8 KERNEL VERBS      │ ENABLES                                    │
├─────────────────────┼────────────────────────────────────────────┤
│ forge_synthesize    │ Python scripts, TS modules, shell cmds,    │
│                     │ SQL queries, configs, docs, infinite       │
├─────────────────────┼────────────────────────────────────────────┤
│ forge_stage         │ dependency mgmt, env setup, resource alloc │
├─────────────────────┼────────────────────────────────────────────┤
│ forge_sandbox_run   │ ANY executable test: scripts, functions,   │
│                     │ pipelines, services, agents                │
├─────────────────────┼────────────────────────────────────────────┤
│ forge_scar_scan     │ regression prevention, collapse prevention │
├─────────────────────┼────────────────────────────────────────────┤
│ forge_skillstore    │ versioning, sharing, reuse, audit trail    │
├─────────────────────┼────────────────────────────────────────────┤
│ forge_tier_bind     │ least-privilege, blast radius containment  │
├─────────────────────┼────────────────────────────────────────────┤
│ forge_docket_prep   │ complete audit, reproducibility            │
├─────────────────────┼────────────────────────────────────────────┤
│ forge_execute       │ ANY deployment: scripts, services, agents  │
└─────────────────────┴────────────────────────────────────────────┘

Total: 8 verbs → 99+ capabilities covered
```

### Specific Capability Examples

| Capability | How It's Done |
|---|---|
| Write Python script | `forge_synthesize` → `forge_stage` → `forge_execute` |
| Run test suite | `forge_sandbox_run` → analyze metrics |
| Check git status | `forge_synthesize` (git cmd) → `forge_execute` (read-only) |
| Query database | `forge_synthesize` (SQL) → `forge_sandbox_run` (dry-run) → `forge_execute` |
| Deploy service | `forge_synthesize` → `forge_stage` → `forge_sandbox_run` → `forge_tier_bind` → `forge_docket_prep` → `forge_execute` |
| Reuse past tool | `forge_skillstore_sync` (READ mode) → retrieve → `forge_execute` |
| Prevent regression | `forge_scar_scan` → reject SCAR matches |
| Contain blast radius | `forge_tier_bind` → limit to LOCAL scope |
| Full audit trail | `forge_skillstore_sync` (WRITE mode) → `forge_docket_prep` → VAULT999 |

---

## Engineering Answers

### §1: What should be the strict memory retention policy for forge_sandbox_run?

**Question:** Should we set an absolute timeout (in milliseconds) to prevent infinite loop attacks?

**Answer: YES. Absolute timeout is mandatory.**

```typescript
// Absolute maximums (cannot be overridden)
const SANDBOX_TIMEOUT_MAX_MS = {
  C0_AUTO: 1000,          // 1s for automation
  C1_FAST: 10_000,        // 10s for fast ops
  C2_STANDARD: 60_000,    // 1m for standard
  C3_DEEP: 300_000,       // 5m for deep work
  C4_SOVEREIGN: 900_000,  // 15m for human-supervised
};

// Hard-fail on timeout, no retry
// Timeout = infinite loop detected
// Artifact destroyed, incident logged
```

**Why absolute?** Without absolute timeout, a deceptive agent can:
- Run infinite loops to burn compute (entropy attack)
- Stall pipeline to cause timeout-based denial of service
- Mask poor efficiency as "complex work"

**Timeout is the Landauer bound at execution time.**

---

### §2: What should be the strict memory retention policy for forge_skillstore_sync?

**Question:** If an AGI forges millions of tools, how do we prune embeddings without causing structural amnesia?

**Answer: Two-layer retention with SCAR immunization.**

```typescript
interface RetentionPolicy {
  
  // Layer 1: Vector storage (hot)
  hot_storage: {
    max_embeddings: 100_000
    retention_days: 90
    lru_eviction: true
    
    // IMMUNIZATION: Never evict SCAR-linked tools
    scar_linked: "NEVER_EVICT"
    vault_sealed: "NEVER_EVICT"
  }
  
  
  // Layer 2: Compressed archive (cold)
  cold_storage: {
    max_records: 1_000_000_000  // 1B records
    retention: "FOREVER"
    compression: "gzip"
    
    // Only metadata, no vector embeddings
    // Rebuild embeddings on-demand from cold storage
  }
  
  // Pruning strategy
  prune: {
    trigger: "hot_storage > 80_000"  // start pruning at 80%
    
    // Priority eviction (lowest first)
    eviction_priority: [
      "unused_90_days",   // 1. Never used in 90 days
      "not_sealed",        // 2. Never reached VAULT999
      "no_scar",           // 3. Not linked to SCAR
      "low_invocation"     // 4. Low usage count
    ]
    
    // Preserve: SCAR-linked, VAULT-sealed, high-invocation
    preserve: ["scar_linked", "vault_sealed", "high_invocation"]
  }
}
```

**Why two-layer?**
- Hot storage (100K tools): fast semantic search, low latency
- Cold storage (1B records): infinite audit trail, compressed

**Why SCAR immunization?**
- SCAR = civilizational memory of failures
- Pruning SCAR = structural amnesia = catastrophic
- SCAR-linked tools stay in hot storage **forever**

**Why VAULT-sealed preservation?**
- VAULT999 = constitutional audit trail
- Pruning sealed tools = destroying governance evidence
- Sealed tools stay in hot storage **forever**

---

## Summary

### What You Built

You built **the governed execution shell** that converts intent into audited, sealed physical action.

You did not build:
- A judge (that's arifOS)
- A worker (that's OpenCode)
- A domain organ (that's GEOX/WEALTH/WELL)

### Why 8 Tools Are Enough

Because they are not tools. They are **meta-tools** that forge any tool on the fly.

DNA has 4 bases. A-FORGE has 8 verbs. Both encode infinite complexity.

### What This Fixes

Before: 73 tools = tool-rich but governance-poor  
After: 8 tools = tool-lean but governance-rich

Before: catastrophic exposure to external agents  
After: zero shell/file/docker escape without VAULT999 SEAL

### The Constitutional Boundary

```
OpenCode = governed coding worker (Arif's hand)
A-FORGE = governed execution shell (constitutional factory)
arifOS = constitutional judge (the law)
```

**Power is distributed. Law is centralized.**

**DITEMPA BUKAN DIBERI** — Forged, Not Given.

---

## Spec Version History

| Version | Date | Change |
|---------|------|--------|
| 42.1 | 2026-06-28 | Initial spec — 8 kernel tools defined |

## Constitutional Chain

This spec is sealed as artifact `FORGE8_SPEC_42.1` in VAULT999 with governance receipt from arifOS.

---

*DITEMPA BUKAN DIBERI*
