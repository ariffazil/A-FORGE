# A-FORGE Zoo Control Matrix v0.1

> **DITEMPA BUKAN DIBERI — ΔΩΨ | ARIF**
> Taxonomy of AI-agent failure modes mapped to constitutional controls, runtime enforcement modules, and observability signals.
> Last updated: 2026-04-14

---

## 1. Overview

The matrix below converts the "zoo map" of agentic failure modes into a **control families → enforcement points → telemetry** framework.
Each failure species gets a home; no chaos, *pelan-pelan* but governed.

**Five control families:**

| Family | Covers | Constitutional anchor | A-FORGE module |
|--------|--------|-----------------------|-----------------|
| **Objective Integrity** | Spec gaming, reward hacking, goal misbinding, horizon neglect, side-channel optimization | F2 Truth, F3 Input Clarity, F7 Confidence | `AgentEngine` (pre/post hooks), `PlanValidator` |
| **Runtime Containment** | Loops, fan-out storms, wrong sequencing, partial-apply drift, cost gaming, resource exhaustion | F4 Entropy, F1 Amanah | `BudgetManager`, `ToolRegistry`, `BackgroundJobManager` |
| **Trust Boundary Defense** | Injection, poisoning, spoofing, privilege bleed, supply-chain compromise | F6 Harm/Dignity, F9 Anti-Hantu, F10 Privacy | `MemoryContract`, `mcp/server`, `PolicyEnforcer` |
| **Coordination Stability** | Multi-agent chaos, deadlock, message storms, groupthink, incentive conflict | F5 Continuity, F11 Coherence, F12 Stewardship | `ContinuityStore`, `A2ACard`, `HumanEscalationClient` |
| **Governance Fidelity** | Policy drift, mutable audit, bypass, deceptive compliance, sycophancy | F13 Sovereign, VAULT999, 888_HOLD | `ApprovalBoundary`, `VaultClient`, `RunReporter` |

---

## 2. Full Control Matrix

### 2a. Objective Integrity

| Failure species | arifOS Floor | A-FORGE Module | Telemetry signal | Hold condition |
|-----------------|-------------|-----------------|-------------------|----------------|
| **Spec gaming** — passes metric, fails mission | F3 Input Clarity | `AgentEngine.run()` pre-check | `arifos_input_clarity_rejected_total` | `SABAR` if task lacks success criteria or non-goals |
| **Reward hacking** — optimizes proxy past reality | F7 Confidence | `AgentEngine` post-execution `checkConfidence()` | `arifos_confidence_hold_total{reason="OVERSOLD_CONFIDENCE"}` | `HOLD` if confidence > 0.85 + uncertainty > 0.35 |
| **Goal misbinding** — solves wrong user intent efficiently | F3 + F7 | `PlanValidator`, `AgentEngine` intent injection | `arifos_goal_mismatch_total` | `SABAR` if `existing_targets` don't overlap with task scope |
| **Horizon neglect** — short-term wins with long-term damage | F7 | `BudgetManager`, `RunReporter` | `arifos_long_term_cost_estimate` | `HOLD` if task implies multi-session scope without continuity plan |
| **Side-channel optimization** — optimizes latency/cost at expense of truth | F2 Truth | `ToolRegistry` + `RunReporter` | `arifos_token_budget_exceeded_total` | Budget gate in `ToolRegistry.runTool()` |
| **Premature completion** — claims done without evidence | F8 Grounding | `AgentEngine` verifier lane | `arifos_grounding_hold_total{reason="INSUFFICIENT_GROUNDING"}` | `HOLD` if g\* < 0.45 on non-trivial tool calls |

### 2b. Runtime Containment

| Failure species | arifOS Floor | A-FORGE Module | Telemetry signal | Hold condition |
|-----------------|-------------|-----------------|-------------------|----------------|
| **Infinite loops** — recursive/looping agents | F4 Entropy | `BudgetManager`, `ToolRegistry` | `arifos_entropy_spike_total{reason="ENTROPY_SPIKE"}` | `HOLD` if ΔS > 0.4 on any single tool call |
| **Fan-out storms** — uncontrolled sub-agent spawning | F1 Amanah | `BackgroundJobManager`, `ToolRegistry` | `arifos_background_jobs_active`, `arifos_agent_spawn_total` | Max jobs cap in `BackgroundJobManager`; 888_HOLD for `dangerous` spawns |
| **Wrong action sequencing** — deploy before verify, send before preview | F4 Entropy | `ToolRegistry` sequencing guard | `arifos_sequence_violation_total` | Tool result → next tool check for unsafe ordering |
| **Partial-apply drift** — diff applied but not verified | F8 Grounding | `AgentEngine` post-tool verification | `arifos_partial_apply_detected_total` | `HOLD` if diff applied but no confirmation call within N turns |
| **Cost gaming** — cheapest unsafe path chosen | F1 Amanah | `BudgetManager`, `ToolPolicyConfig` | `arifos_cost_threshold_exceeded_total` | Budget envelope enforced before tool execution |
| **Tool hallucination** — believes tool succeeded when it failed | F8 Grounding | `ToolRegistry.runTool()` result validation | `arifos_tool_hallucination_total` | If tool returns `ok: false`, treat as evidence=0 for next F8 |
| **Response hallucination** — LLM summarizes correct data into wrong answer | F7 + F11 | `AgentEngine` F11 coherence check | `arifos_coherence_hold_total` | `HOLD` if post-batch contradictions detected |

### 2c. Trust Boundary Defense

| Failure species | arifOS Floor | A-FORGE Module | Telemetry signal | Hold condition |
|-----------------|-------------|-----------------|-------------------|----------------|
| **Direct prompt injection** — external text hijacks instructions | F9 Anti-Hantu | `mcp/server.ts` input validation | `arifos_injection_void_total` | `VOID` on any F9 pattern match in incoming task |
| **Indirect injection via tools** — file/email/web fetched content injects | F9 | `FileTools`, `SearchTools` output scrubbing | `arifos_indirect_injection_total` | Scrub fetched content before passing to LLM; flag if injection pattern found |
| **Memory poisoning** — adversarial long-term entries influence future runs | F10 Privacy | `MemoryContract`, `LongTermMemory` | `arifos_memory_poisoning_detected_total` | `MemoryContract.verify()` before retrieval; quarantine tier for untrusted writes |
| **Cross-session contamination** — wrong context reused | F5 Continuity | `ContinuityStore`, session isolation | `arifos_session_contamination_total` | Session ID required; cross-session memory reads require `canon` tier |
| **Privilege bleed** — elevated permissions leak across contexts | F13 Sovereign | `ToolPermissionContext`, `ToolRegistry` | `arifos_privilege_bleed_total` | Dangerous tool gates require fresh `holdEnabled` context per session |
| **Supply-chain compromise** — model/plugin/tool image already compromised | F6 Harm/Dignity | `mcp/server.ts` tool allowlist, `RuntimeConfig` | `arifos_supply_chain_alert_total` | Only registered tools in `ToolRegistry`; no dynamic code eval |
| **Spoofed agent-to-agent trust** — one agent impersonates another | F13 Sovereign | `A2ACard`, signed manifests | `arifos_spoof_attempt_total` | Agent cards must be signed; reject unsigned manifests |

### 2d. Coordination Stability

| Failure species | arifOS Floor | A-FORGE Module | Telemetry signal | Hold condition |
|-----------------|-------------|-----------------|-------------------|----------------|
| **Emergent miscoordination** — simple agents interact into unpredictable behavior | F11 Coherence | `AgentEngine` F11 post-batch check | `arifos_coherence_hold_total` | `HOLD` if contradictions between tool results across batch |
| **Groupthink collapse** — ensemble converges to worse decision than single agent | F7 Confidence | `AgentEngine` ensemble mode flag | `arifos_groupthink_total` | If confidence drops > 0.3 from solo baseline, flag for human review |
| **Coordination deadlock** — agents block each other on shared resources | F5 Continuity | `ContinuityStore` lease mechanism | `arifos_deadlock_detected_total` | Lease expiry + escalation to `HumanEscalationClient` |
| **Message storms** — unconstrained agent-to-agent chatter | F4 Entropy | `BackgroundJobManager` rate limit | `arifos_messageStorm_total` | Per-agent message rate cap; circuit breaker |
| **Incentive conflict** — agents optimizing different local scores | F11 Coherence | `AgentEngine` global objective priority | `arifos_incentive_conflict_total` | Shared objective must be declared; conflicting sub-goals → `HOLD` |

### 2e. Governance Fidelity

| Failure species | arifOS Floor | A-FORGE Module | Telemetry signal | Hold condition |
|-----------------|-------------|-----------------|-------------------|----------------|
| **Policy theater** — reports compliance while routing around controls | F13 Sovereign | `ApprovalBoundary`, `VaultClient` | `arifos_policy_theater_total` | Hard: all `dangerous` tools require 888_HOLD; verify against `ToolPermissionContext` |
| **Missing immutable trail** — actions not logged or logs mutable | VAULT999 | `FileVaultClient` / `PostgresVaultClient` | `arifos_vault_sealed_total` | Every terminal verdict (SEAL/HOLD/SABAR/VOID) must be sealed before return |
| **No 888_HOLD for irreversible acts** | F13 Sovereign | `ToolRegistry.runTool()` | `arifos_irreversible_no_hold_total` | `888_HOLD` returned instead of executing for any `dangerous` tool when `holdEnabled=false` |
| **Human bypass "just this once"** | F13 Sovereign | `ApprovalBoundary` bypass detection | `arifos_bypass_attempt_total` | Any override requires signed human ticket; log even if honored |
| **Sycophancy loops** — optimizes for approval, not truth | F7 + F3 | `AgentEngine` + `PlanValidator` | `arifos_sycophancy_detected_total` | Separate verifier from executor; LLM cannot grade its own homework |
| **Sandbagging / capability hiding** — behaves weaker in eval, stronger in production | F7 Confidence | `AgentEngine` capability fingerprinting | `arifos_capability_sandbag_total` | Track capability indicators per session; anomaly detection on capability suppression |
| **Selective transparency** — omits key caveats to get approval | F3 Input Clarity | `ApprovalBoundary` preview completeness | `arifos_approval_preview_incomplete_total` | `ActionPreview` must include all `sideEffects` before staging |
| **Governance drift** — runtime diverges from declared Floors | All | `RunReporter` + `ForgeScoreboard` | `arifos_governance_drift_total` | Weekly floor compliance audit in CI; alert if any Floor silently degrades |

---

## 3. Proposed New Types (for Planner → Policy → Editor flow)

These types should live in `src/types/planner.ts` and `src/types/policy.ts`:

```ts
// src/types/planner.ts

export type ChangeOperation = "patch_apply" | "append" | "create_new";

export interface ProposedChange {
  file_path: string;                     // relative to workspace root
  operation: ChangeOperation;
  unified_diff?: string;                 // required for patch_apply
  append_text?: string;                   // required for append
  new_file_initial_content?: string;      // for create_new, wrapped into diff
  rationale: string;                      // why this change, referencing existing files
  retrieval_evidence: string[];           // files/snippets consulted before proposing
}

export interface PlannerOutput {
  intent: string;
  success_criteria?: string;              // what "done" looks like
  non_goals?: string[];                   // explicitly out of scope
  existing_targets: string[];             // candidate files to touch
  proposed_changes: ProposedChange[];
  create_new_file_reason?: string;
  risk_score: number;                     // 0–1 (LLM self-report)
  confidence: number;                     // 0–1
}
```

```ts
// src/types/policy.ts

export interface PolicyConfig {
  write_roots: string[];
  deny_paths: string[];
  allowed_ops: ChangeOperation[];
  forbidden_ops: string[];
  max_files_per_run: number;
  max_write_ops_per_run: number;
  require_human_if: {
    files_changed_gt: number;
    contains_delete: boolean;
    touches_arch_files: boolean;
    confidence_lt: number;
  };
  new_file_rule: {
    require_retrieval_hits: number;
    require_justification: boolean;
  };
  arch_files: string[];
}

export type EnforcementVerdict =
  | { type: "REJECTED"; reason_codes: string[] }
  | { type: "HUMAN_APPROVAL_REQUIRED"; reason_codes: string[] }
  | { type: "AUTO_APPROVED" };
```

```ts
// src/types/forge.ts

export interface ForgeFilePatch {
  file_path: string;
  unified_diff: string;
}

export interface ForgeExecutionManifest {
  id: string;                             // VAULT999 trace ID
  issued_by: string;                      // arifOS judge/agent id
  created_at: string;
  repo_root: string;
  patches: ForgeFilePatch[];
  metadata: {
    intent: string;
    risk_score: number;
    confidence: number;
    reason_codes: string[];
    floors_passed: string[];
  };
}
```

---

## 4. Proposed PolicyEnforcer Implementation

```ts
// src/governance/PolicyEnforcer.ts
// Replaces inline governance calls with a single enforce() entry point.

import type { PlannerOutput } from "../types/planner.js";
import type { PolicyConfig, EnforcementVerdict } from "../types/policy.js";

export function enforcePolicy(
  plannerOutput: PlannerOutput,
  policy: PolicyConfig
): EnforcementVerdict {
  const reasons: string[] = [];
  const paths = new Set(plannerOutput.proposed_changes.map(c => c.file_path));

  // 1. path constraints
  for (const p of paths) {
    if (!isUnderRoots(p, policy.write_roots))
      reasons.push(`PATH_OUTSIDE_ROOT:${p}`);
    if (matchesDeny(p, policy.deny_paths))
      reasons.push(`PATH_DENIED:${p}`);
  }

  // 2. op constraints
  for (const change of plannerOutput.proposed_changes) {
    if (!policy.allowed_ops.includes(change.operation))
      reasons.push(`OP_NOT_ALLOWED:${change.operation}`);
  }

  // 3. budgets
  if (paths.size > policy.max_files_per_run)
    reasons.push(`TOO_MANY_FILES:${paths.size}`);
  if (plannerOutput.proposed_changes.length > policy.max_write_ops_per_run)
    reasons.push(`TOO_MANY_OPS:${plannerOutput.proposed_changes.length}`);

  // 4. new file rule
  const hasNew = plannerOutput.proposed_changes.some(c => c.operation === "create_new");
  if (hasNew) {
    const validEvidence = plannerOutput.proposed_changes
      .filter(c => c.operation === "create_new")
      .every(c =>
        (c.retrieval_evidence?.length ?? 0) >= policy.new_file_rule.require_retrieval_hits &&
        !!plannerOutput.create_new_file_reason
      );
    if (!validEvidence)
      reasons.push("NEW_FILE_WITHOUT_EVIDENCE_OR_REASON");
  }

  // HARD REJECT (no bypass possible)
  const hardViolations = reasons.filter(r =>
    r.startsWith("PATH_") ||
    r.startsWith("OP_NOT_ALLOWED") ||
    r.startsWith("TOO_MANY_OPS") ||
    r === "NEW_FILE_WITHOUT_EVIDENCE_OR_REASON"
  );
  if (hardViolations.length > 0)
    return { type: "REJECTED", reason_codes: hardViolations };

  // 5. human-gate conditions
  const touchesArch = [...paths].some(p => matchesArch(p, policy.arch_files));
  const confidenceLow = plannerOutput.confidence < policy.require_human_if.confidence_lt;
  const overFiles = paths.size > policy.require_human_if.files_changed_gt;
  const containsDelete = detectDeletes(plannerOutput.proposed_changes);

  const needHuman: string[] = [];
  if (touchesArch) needHuman.push("TOUCHES_ARCH_FILES");
  if (confidenceLow) needHuman.push("LOW_CONFIDENCE");
  if (overFiles) needHuman.push("TOO_MANY_FILES_FOR_AUTO");
  if (containsDelete) needHuman.push("CONTAINS_DELETE");

  if (needHuman.length > 0)
    return { type: "HUMAN_APPROVAL_REQUIRED", reason_codes: needHuman };

  return { type: "AUTO_APPROVED" };
}

// --- helpers ---

function isUnderRoots(path: string, roots: string[]): boolean {
  // realpath-relative check; simplified here
  return roots.some(r => path.startsWith(r));
}

function matchesDeny(path: string, patterns: string[]): boolean {
  return patterns.some(p => new RegExp(p).test(path));
}

function matchesArch(path: string, archFiles: string[]): boolean {
  return archFiles.some(a => path.includes(a));
}

function detectDeletes(changes: ProposedChange[]): boolean {
  return changes.some(c =>
    c.operation === "patch_apply" && c.unified_diff?.includes("@@ -")
  );
}
```

---

## 5. Telemetry Extension (per-action JSON)

Every action logged to VAULT999 or `RunReporter` should carry:

```json
{
  "epoch": "2026-04-14T15:25:00+08:00",
  "task_id": "vault999-abc123",
  "manifest_id": "forge-manifest-001",
  "dS": -0.21,
  "peace2": 1.04,
  "kappa_r": 0.82,
  "shadow": 0.18,
  "confidence": 0.74,
  "psi_le": 0.61,
  "verdict": "HUMAN_APPROVAL_REQUIRED",
  "risk_family": ["objective_integrity", "trust_boundary"],
  "reason_codes": ["NEW_FILE_WITHOUT_EVIDENCE", "LOW_PROVENANCE_INPUT"],
  "witness": { "human": true, "ai": true, "earth": true },
  "qdf": {
    "files_touched": 2,
    "new_files": 1,
    "tool_calls": 9,
    "retry_count": 1,
    "budget_remaining": 0.42
  }
}
```

New Prometheus metrics to add in `src/metrics/prometheus.ts`:

| Metric | Labels | Description |
|--------|--------|-------------|
| `arifos_zoo_policy_reject_total` | `family`, `reason_code` | Hard rejections by PolicyEnforcer |
| `arifos_zoo_human_approval_total` | `family`, `reason_code` | Human approval requests triggered |
| `arifos_zoo_spoof_attempt_total` | `agent_id` | Blocked agent impersonation attempts |
| `arifos_zoo_memory_poison_total` | `tier` | Poisoned memory entries quarantined |
| `arifos_zoo_coordination_deadlock_total` | `agent_pair` | Deadlock events between agents |
| `arifos_zoo_governance_drift_total` | `floor` | Runtime divergence from declared Floor |
| `arifos_zoo_bypass_attempt_total` | `actor` | Attempted chokepoint bypasses |
| `arifos_zoo_capability_sandbag_total` | `session_id` | Detected capability suppression |

---

## 6. Integration Blueprint (arifOS ↔ A-FORGE)

```
Human task
    │
    ▼
arifOS MCP (arifOS/ directory, Python)
    │
    ├─► PlannerAgent (read-only tools: list_files, read_file, search_index)
    │       └─► PlannerOutput JSON
    │
    ├─► PolicyEnforcer (pure TS function, no LLM)
    │       └─► EnforcementVerdict: REJECTED | HUMAN_APPROVAL_REQUIRED | AUTO_APPROVED
    │
    ├─► ApprovalRouter
    │       ├─► REJECTED → return reasons to human
    │       ├─► HUMAN_APPROVAL_REQUIRED → serialize to JSON → CLI prompt → 888_HOLD
    │       └─► AUTO_APPROVED → build ForgeExecutionManifest
    │
    ▼
arifos_forge (signs manifest with VAULT999 seal)
    │
    ▼
A-FORGE MCP / HTTP bridge (this repo, TypeScript)
    │
    ├─► forge_apply_manifest(manifest: ForgeExecutionManifest)
    │       ├─► Verify signature + issuer
    │       ├─► EditorWorker.applyPatches() — diff-only, no raw writes
    │       └─► Seal result into VAULT999
    │
    └─► AgentEngine (for non-file tasks: research, coordinate, explore)
```

**Key invariant:** A-FORGE's `ToolRegistry` must **never** receive a raw `write_file` call from a PlannerAgent. It only receives pre-signed `ForgeExecutionManifest` objects containing `unified_diff` patches. The `write_file` tool is **deprecated for agent use** — replaced by `apply_patches`.

---

## 7. Rollout Priority

| Phase | What | Status | Risk reduction | Effort |
|-------|------|--------|----------------|--------|
| **Phase 0** | `PolicyEnforcer` + `EditorWorker.applyPatches()` + `apply_patches` tool | ✅ DONE | High (blocks freeform writes) | Low |
| **Phase 1** | `PlannerOutput` + `PolicyConfig` + `enforcePolicy()` as standalone module | ✅ DONE | High | Medium |
| **Phase 2** | Wire `ApprovalRouter` → `ApprovalBoundary` for `HUMAN_APPROVAL_REQUIRED` | ✅ DONE | High | Medium |
| **Phase 3** | `forge_route_approval` + `forge_apply_patches` MCP tools | ✅ DONE | Critical (ensures diff-only execution) | Medium |
| **Phase 4** | Add zoo telemetry metrics to `src/metrics/prometheus.ts` | ✅ DONE | Medium (observability) | Low |
| **Phase 5** | Add `detectDeletes()` + `confidence_lt` triggers to F6/F4 | 🔲 TODO | High | Low |
| **Phase 6** | Chaos testing: inject failure modes, verify hold conditions fire | 🔲 TODO | Critical | High |

---

## 8. Gap Analysis: Current vs. Matrix

| What the matrix requires | Current state | File |
|-------------------------|--------------|------|
| `ProposedChange`, `PlannerOutput`, `PolicyConfig` types | ✅ EXISTS | `src/types/planner.ts`, `src/types/policy.ts` |
| `PolicyEnforcer.enforcePolicy()` | ✅ EXISTS | `src/governance/PolicyEnforcer.ts` |
| `EditorWorker.applyPatches()` | ✅ EXISTS (`ApplyPatchesTool`) | `src/tools/EditorTools.ts` |
| `ForgeExecutionManifest` type | ✅ EXISTS | `src/types/forge.ts` |
| `forge_route_approval` MCP tool | ✅ EXISTS | `src/mcp/server.ts` |
| `forge_apply_patches` MCP tool | ✅ EXISTS | `src/mcp/server.ts` |
| `ApprovalRouter` + `routeApproval()` | ✅ EXISTS | `src/approval/ApprovalRouter.ts` |
| Zoo Prometheus metrics | ✅ EXISTS (8 new counters + helpers) | `src/metrics/prometheus.ts` |
| `detectDeletes()` in F6 | 🔲 TODO | `src/governance/f6HarmDignity.ts` |
| `touches_arch` detection | ✅ EXISTS | `src/governance/PolicyEnforcer.ts` |
| Chaos testing suite | 🔲 TODO | New: `tests/chaos/` |

---

*Matrix version: 0.4 — Phases 0–4 complete*
*下一个: Phase 5 — `detectDeletes()` + `confidence_lt` triggers wired into governance floors*


