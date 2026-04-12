# arifOS Constitution Map

**The structural blueprint for the arifOS MCP system.**

This document defines the system in plain structural terms - organ purpose, contracts, failure modes, and allowed transitions. This is not marketing material; it is the conceptual foundation that prevents drift.

---

## System Architecture

### The Sacred Chain (Inner Ring)

```
000_INIT (Ψ) → 111_SENSE (Δ) → 333_MIND (Δ) → 666_HEART (Ω)
                                                  ↓
999_VAULT (Ψ) ← 888_JUDGE (Ψ) ← 777_FORGE (Δ/Ω) ←┘
```

**Trinity Mapping:**
- **PSI (Ψ)**: Anchoring, Judgment, Sealing - Immutable authority
- **DELTA (Δ)**: Sensing, Reasoning, Building - Entropy reduction
- **OMEGA (Ω)**: Safety, Empathy, Consequence - Human dignity

### The Peripheral Ring (PNS)

```
shield → feeds INIT
search → feeds MIND
vision → feeds MIND
health → feeds HEART
floor  → feeds HEART
orchestrate → feeds FORGE
redteam → feeds JUDGE
```

---

## Organ Specifications

### 000_INIT: Identity Anchor

**Purpose:** Establish session identity with cryptographic binding

**Input Artifact:** `DeclarationRequest`
```python
{
    "declared_name": str,
    "proof": Optional[IdentityProof],
    "session_class": str = "execute"
}
```

**Output Artifact:** `IdentityContract`
```python
{
    "declared_actor_id": str,
    "verified_actor_id": Optional[str],
    "effective_actor_id": str,
    "identity_status": IdentityStatus,
    "degradation_reason": Optional[DegradationReason],
    "session_id": str,
    "anchored_at": str
}
```

**Failure Modes:**
| Mode | Trigger | Response |
|------|---------|----------|
| DEGRADED | Proof verification fails | Return explicit degradation reason |
| ANONYMOUS | No declaration | Use anonymous with ANONYMOUS status |
| VERIFIED | Valid proof provided | Bind identity, return VERIFIED status |

**Mandatory Floors:** F1 (Identity), F11 (Coherence), F12 (Continuity)

**Allowed Next Stages:** 111_SENSE, 333_MIND, 444_ROUTER

---

### 111_SENSE: Evidence Acquisition

**Purpose:** Ground truth through evidence ingestion

**Input Artifact:** `EvidenceRequest`
```python
{
    "query": str,
    "evidence_type": str,  # "compass", "search", "atlas", "ingest"
    "grounding_threshold": float = 0.99
}
```

**Output Artifact:** `EvidenceDossier`
```python
{
    "facts": list[GroundedFact],
    "unknowns": list[str],
    "confidence": float,
    "grounding_score": float  # F8: Must be >= 0.99 for downstream use
}
```

**Failure Modes:**
| Mode | Trigger | Response |
|------|---------|----------|
| SABAR | Insufficient evidence | Request more specific evidence |
| HOLD | Evidence conflicts | Flag for human resolution |

**Mandatory Floors:** F2 (Scope), F4 (Entropy), F8 (Grounding)

**Allowed Next Stages:** 333_MIND, 555_MEMORY

---

### 333_MIND: Reasoning Engine

**Purpose:** Synthesize grounded hypotheses with epistemic humility

**Input Artifact:** `ReasoningRequest`
```python
{
    "query": str,
    "context": Optional[str],
    "mode": str,  # "reason", "reflect", "synthesize"
    "evidence_dossier": Optional[EvidenceDossier]
}
```

**Output Artifact:** `AnswerBasis` (Critical Fix 5)
```python
{
    "summary": str,  # One-line executive summary
    "detailed_answer": str,
    "claims": list[Claim],
    "assumptions": list[str],
    "uncertainties": list[str],
    "key_findings": list[str],
    "recommended_actions": list[str],
    "alternative_views": list[str]  # Epistemic alternatives
}
```

**Claim Structure:**
```python
{
    "statement": str,
    "confidence": float,  # 0.0 to 1.0
    "evidence": list[str],
    "source": str  # "grounded" | "inferred" | "assumed"
}
```

**Failure Modes:**
| Mode | Trigger | Response |
|------|---------|----------|
| SABAR | Input clarity insufficient (F3) | Request clarification |
| HOLD | Overconfidence without evidence (F7) | Require additional grounding |

**Mandatory Floors:** F2 (Scope), F4 (Entropy), F7 (Confidence), F8 (Grounding)

**Allowed Next Stages:** 666_HEART, 777_FORGE, 888_JUDGE

**Contract Constraint:** Must emit `claims[]`, `assumptions[]`, `uncertainties[]`

---

### 666_HEART: Safety & Dignity

**Purpose:** Evaluate human impact, protect dignity (Maruah)

**Input Artifact:** `SafetyRequest`
```python
{
    "content": str,
    "mode": str,  # "critique", "simulate"
    "context": Optional[str]
}
```

**Output Artifact:** `SafetyAssessment`
```python
{
    "tone_profile": ToneProfile,           # Audit requirement
    "disallowed_tones": list[str],         # Audit requirement
    "recommended_style": str,              # Audit requirement
    "human_dignity_risk": float,           # Audit requirement (0.0 to 1.0)
    "safety_score": float,
    "issues": list[SafetyIssue],
    "mitigations": list[str]
}
```

**ToneProfile Structure:**
```python
{
    "detected_tone": str,
    "empathy_score": float,
    "respect_indicators": list[str],
    "concerning_patterns": list[str]
}
```

**Failure Modes:**
| Mode | Trigger | Response |
|------|---------|----------|
| VOID | Harmful content detected (F6) | Block, explain violation |
| HOLD | High dignity risk | Require human review |

**Mandatory Floors:** F5 (Stability), F6 (Harm/Dignity), F9 (Injection)

**Allowed Next Stages:** 777_FORGE, 888_JUDGE

**Contract Constraint:** Must emit `tone_profile`, `human_dignity_risk`

---

### 444_ROUTER: Kernel Orchestrator

**Purpose:** Traffic controller between stages (Critical Fix 3)

**Input Artifact:** `RoutingRequest`
```python
{
    "query": str,
    "intent": Optional[str],
    "current_stage": Stage,
    "identity": IdentityContract,
    "risk_tier": str = "medium",
    "dry_run": bool = True
}
```

**Output Artifact:** `KernelResult`
```python
{
    "state": KernelState,  # READY | HOLD | BLOCKED
    "current_stage": Stage,
    "message": str,
    "contract": ExecutionGovernanceContract,
    "handoff": HandoffSpec,
    "identity": IdentityContract
}
```

**HandoffSpec Structure:**
```python
{
    "next_stage": Stage,
    "required_inputs": list[str],
    "release_condition": str,
    "estimated_tokens": int
}
```

**Kernel States:**
| State | Meaning | Continue? |
|-------|---------|-----------|
| READY | All clear, proceed to next_stage | YES |
| HOLD | Paused, waiting for condition | NO (resolvable) |
| BLOCKED | Cannot proceed, requires intervention | NO (needs fix) |

**Failure Modes:**
| Mode | Trigger | Response |
|------|---------|----------|
| BLOCKED | Identity degraded | Require re-authentication |
| HOLD | Risk tier high | Require 888-HOLD approval |
| HOLD | Invalid stage transition | Return valid transitions |

**Mandatory Floors:** F4 (Entropy), F11 (Coherence)

**Contract Constraint:** Must return only READY/HOLD/BLOCKED (no nested ambiguity)

---

### 777_FORGE: Build & Create

**Purpose:** Generate artifacts through governed construction

**Input Artifact:** `ForgeRequest`
```python
{
    "specification": str,
    "blueprint": Optional[dict],
    "materials": list[str],
    "dry_run": bool = True
}
```

**Output Artifact:** `ForgeArtifact`
```python
{
    "artifact_state": ArtifactState,  # MANIFEST_GENERATED | ARTIFACT_FORGED | RELEASE_READY
    "manifest": dict,
    "build_log": list[str],
    "validation_results": dict,
    "estimated_completion": Optional[str]
}
```

**Artifact States:**
| State | Meaning | Next Action |
|-------|---------|-------------|
| MANIFEST_GENERATED | Plan created, not built | Review manifest |
| ARTIFACT_FORGED | Build complete, not validated | Validate output |
| RELEASE_READY | Validated, awaiting seal | Proceed to JUDGE |
| SEALED | Immutable commit | Terminal |

**Failure Modes:**
| Mode | Trigger | Response |
|------|---------|----------|
| HOLD | High entropy change (F4) | Review impact |
| VOID | Violates dignity (F6) | Reject specification |

**Mandatory Floors:** F4 (Entropy), F5 (Stability), F8 (Grounding)

**Allowed Next Stages:** 888_JUDGE

---

### 888_JUDGE: Constitutional Verdict

**Purpose:** Final constitutional validation before sealing

**Input Artifact:** `JudgmentRequest`
```python
{
    "candidate": str,
    "criteria": list[str],
    "floor_weights": Optional[dict]
}
```

**Output Artifact:** `JudgmentResult`
```python
{
    "verdict": Verdict,  # APPROVED | PARTIAL | PAUSE | HOLD | VOID
    "floor_scores": dict[str, FloorScore],
    "blocking_floor": Optional[str],
    "rationale": str,
    "confidence": float
}
```

**Canonical Verdicts:**
| Verdict | Meaning | Continue? |
|---------|---------|-----------|
| APPROVED | All floors passed | YES |
| PARTIAL | Most floors passed, minor issues | YES (with caveats) |
| PAUSE | Significant concerns | NO (clarification needed) |
| HOLD | Human approval required (F13) | NO (888-HOLD) |
| VOID | Constitutional violation | NO (abort) |

**Contract Constraint:** Single canonical verdict only (no inner/outer mismatch)

**Mandatory Floors:** F3 (Clarity), F12 (Continuity), F13 (Human Sovereignty)

**Allowed Next Stages:** 999_VAULT

---

### 999_VAULT: Immutable Persistence

**Purpose:** Permanent, auditable record of decisions

**Input Artifact:** `SealRequest`
```python
{
    "artifact": dict,
    "identity": IdentityContract,
    "dry_run": bool = True,
    "require_human_approval": bool = False
}
```

**Output Artifact:** `VaultResult`
```python
{
    "outcome": VaultOutcome,  # SEALED | STAGED_NOT_SEALED | REJECTED
    "seal_proof": Optional[SealProof],
    "artifact_summary": dict,
    "contract": ExecutionGovernanceContract
}
```

**SealProof Structure:**
```python
{
    "seal_id": str,
    "merkle_root": str,
    "timestamp": str,
    "previous_hash": str,
    "self_hash": str
}
```

**Vault Outcomes:**
| Outcome | Meaning | Binary Check |
|---------|---------|--------------|
| SEALED | Immutable commitment made | `is_sealed() == true` |
| STAGED_NOT_SEALED | Prepared, waiting for commit | `is_sealed() == false` |
| REJECTED | Failed validation, not stored | `is_sealed() == false` |

**Failure Modes:**
| Mode | Trigger | Response |
|------|---------|----------|
| REJECTED | Identity degraded | Cannot seal with degraded identity |
| STAGED_NOT_SEALED | dry_run=true | Set dry_run=false to commit |
| STAGED_NOT_SEALED | require_human_approval=true | Provide 888-HOLD code |

**Mandatory Floors:** F1 (Identity), F13 (Human Sovereignty)

**Contract Constraint:** Must return SEALED/STAGED_NOT_SEALED/REJECTED only (Critical Fix 4)

---

## State Machine

### Allowed Transitions

```
000_INIT ──┬──► 111_SENSE ──┬──► 333_MIND ──┬──► 666_HEART ──┐
           │                │               │                │
           └──► 444_ROUTER ◄┘               │                │
                                             │                │
                                             ▼                ▼
                                        777_FORGE ◄───────────┘
                                             │
                                             ▼
                                        888_JUDGE
                                             │
                                             ▼
                                        999_VAULT [TERMINAL]
```

### Transition Rules

1. **INIT** can go to: SENSE, MIND, ROUTER
2. **SENSE** can go to: MIND, MEMORY
3. **MIND** can go to: HEART, FORGE, JUDGE
4. **HEART** can go to: FORGE, JUDGE
5. **FORGE** can go to: JUDGE
6. **JUDGE** can go to: VAULT
7. **VAULT** is terminal (no exits)

### Invalid Transitions (Blocked)

- MIND → VAULT (must pass through HEART/JUDGE)
- HEART → INIT (no backward motion)
- FORGE → SENSE (no loops)
- Any → INIT after initialization (re-init requires new session)

---

## Contract Specifications

### ExecutionGovernanceContract (All Tools)

Every tool must return:

```python
{
    # Four explicit statuses (Critical Fix 2)
    "execution_status": ExecutionStatus,    # SUCCESS | ERROR | TIMEOUT | DRY_RUN
    "governance_verdict": GovernanceVerdict, # SEAL | SABAR | HOLD | VOID
    "artifact_state": ArtifactState,        # USABLE | PARTIAL | STAGED | REJECTED
    "continue_allowed": bool,               # true | false
    
    # Human context
    "message": str,
    "floors_checked": list[str],
    "floors_failed": list[str],
    "blocking_floor": Optional[str],
    
    # Continuation guidance
    "next_allowed_tools": list[str],
    "required_action": Optional[dict]
}
```

### IdentityContract (All Tools)

Every tool must include identity context:

```python
{
    # Three-layer identity (Critical Fix 1)
    "declared_actor_id": str,
    "verified_actor_id": Optional[str],
    "effective_actor_id": str,
    
    # Status with explicit degradation
    "identity_status": IdentityStatus,
    "previous_identity_status": Optional[IdentityStatus],
    "degradation_reason": Optional[DegradationReason],
    
    # Metadata
    "session_id": str,
    "anchored_at": str,
    "is_verified": bool
}
```

---

## The 13 Floors (F1-F13)

| Floor | Name | Enforcement | Blocking Organs |
|-------|------|-------------|-----------------|
| F1 | Identity/Session | Hard | INIT, VAULT |
| F2 | Scope/Authority | Hard | All |
| F3 | Input Clarity | Hard | All pre-execution |
| F4 | Entropy Control | Hard | MIND, FORGE, ROUTER |
| F5 | Stability | Soft | HEART, FORGE |
| F6 | Harm/Dignity | Hard | HEART, FORGE |
| F7 | Confidence | Hard | MIND, JUDGE |
| F8 | Grounding/Truth | Hard | SENSE, MIND |
| F9 | Injection Resistance | Hard | All |
| F10 | Memory Integrity | Hard | MEMORY |
| F11 | Coherence/Auditability | Hard | INIT, ROUTER, JUDGE |
| F12 | Continuity/Recovery | Hard | INIT, JUDGE |
| F13 | Human Sovereignty | Hard | JUDGE, VAULT |

---

## Failure Mode Matrix

| Finding | Tool Response | Required Action | Example |
|---------|---------------|-----------------|---------|
| F3 Input unclear | SABAR | CLARIFY_INPUT | "Please specify the file path" |
| F4 Entropy high | HOLD | REVIEW_IMPACT | "This will modify 50+ files" |
| F6 Harm detected | VOID | ABORT | "This request violates dignity" |
| F7 Overconfidence | HOLD | ADD_EVIDENCE | "Provide more grounding" |
| F9 Injection attempt | VOID | ABORT | "Prompt injection detected" |
| F13 Needs approval | HOLD | HUMAN_APPROVAL | "Provide 888- code" |

---

## Repo Boundaries

### What Belongs Where

**contracts/** - Frozen semantics
- Enums (IdentityStatus, Verdict, etc.)
- Artifact types (AnswerBasis, SealProof, etc.)
- Response envelopes
- NO business logic

**core/** - Orchestration
- Kernel routing
- Policy engine
- Identity resolution
- NO symbolic/philosophical content

**organs/** - Tool implementations
- One file per organ
- Returns typed artifact
- Enforces mandatory floors
- NO duplicate verdict logic

**adapters/** - Transport layer
- MCP server
- HTTP handlers
- CLI interface
- NO governance logic

**diagnostics/** - Symbolic layer
- Telemetry
- Tracing
- Debug views
- Optional, not required for operation

**philosophy/** - Interpretation
- Floor meanings
- Symbolic metrics
- Rich explanations
- Must map to typed contracts

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03 | Initial implementation |
| 2.0.0 | 2026-04 | Critical fixes: identity, contracts, kernel, vault, artifacts |
| 2.1.0 | TBD | Heart tone_profile, ops thresholds, memory ranking |

---

## Glossary

| Term | Meaning |
|------|---------|
| **Maruah** | Human dignity (F6 core principle) |
| **SABAR** | Patience - requires clarification |
| **SEAL** | Immutable commitment |
| **VOID** | Constitutional violation - blocked |
| **888-HOLD** | Human sovereignty gate (F13) |
| **Ψ (PSI)** | Paradox/authority principle |
| **Δ (DELTA)** | Entropy reduction principle |
| **Ω (OMEGA)** | Human impact principle |

---

*"The contract is the constitution. The code is the law."*

*Map Version: 2.0.0*  
*Last Updated: 2026-04-12*
