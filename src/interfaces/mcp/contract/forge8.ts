/**
 * @file FORGE8 Contract — A-FORGE v42.1 Kernel Tools
 * @description Constitutional governance specification for the 8 kernel verbs
 * 
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * 
 * CONSTITUTIONAL PRINCIPLE:
 *   A-FORGE proposes. arifOS decides.
 *   A-FORGE builds. arifOS seals.
 *   A-FORGE executes. arifOS audits.
 * 
 * SCOPE:
 *   These 8 verbs are the ENTIRE public MCP surface for external agents.
 *   OpenCode uses native tools. A-FORGE uses these 8 governed verbs.
 * 
 * CAPABILITY COVERAGE:
 *   8 meta-tools → 99+ capabilities via dynamic synthesis
 * 
 * @author arifOS Constitutional Kernel
 * @version 42.1
 * @sealed 2026-06-28
 */

import { z } from "zod";

// ============================================================================
// CONSTANTS — Constitutional Limits
// ============================================================================

/**
 * Maximum timeouts per decision class (Landauer bound at execution time)
 * 
 * TIMEOUT IS ABSOLUTE — cannot be overridden
 * Prevents: infinite loop attacks, compute burning, DoS
 */
export const SANDBOX_TIMEOUT_MAX_MS = {
  C0_AUTO: 1_000,          // 1 second for atomic automation
  C1_FAST: 10_000,         // 10 seconds for fast operations
  C2_STANDARD: 60_000,     // 1 minute for standard work
  C3_DEEP: 300_000,        // 5 minutes for deep reasoning
  C4_SOVEREIGN: 900_000,   // 15 minutes for human-supervised
} as const;

/**
 * Resource limits for sandbox execution
 * Prevents: unbounded memory growth, CPU abuse
 */
export const SANDBOX_RESOURCE_LIMITS = {
  MAX_MEMORY_MB: 1024,           // 1 GB RAM limit
  MAX_CPU_CORES: 2,              // 2 CPU cores max
  NETWORK_ACCESS: false,         // No network by default
  FILESYSTEM_ACCESS: false,      // No filesystem write access
  MAX_SUBPROCESSES: 10,          // Limit fork depth
} as const;

/**
 * Trust tiers (least-privilege execution model)
 * 
 * CRITICAL BOUNDARY:
 *   A-FORGE sets LOWER BOUNDS only (mechanical constraints)
 *   arifOS sets ACTUAL TRUST TIER after APEX G-score evaluation
 *   A-FORGE CANNOT promote. Only arifOS can promote.
 */
export const TRUST_TIERS = {
  TIER_0_UNTRUSTED: 0,  // Never executed (SCAR match)
  TIER_1_LOCAL: 1,      // Local execution only
  TIER_2_CLUSTER: 2,    // Cluster access allowed
  TIER_3_NETWORK: 3,    // Network access allowed
  TIER_4_PUBLIC: 4,     // Public internet allowed
  TIER_5_HUMAN: 5,      // Human supervision required
} as const;

// ============================================================================
// FORGE8 TOOL 1: forge_synthesize — The Fabricator
// ============================================================================

/**
 * FORGE8 #1: forge_synthesize
 * 
 * FUNCTION:
 *   Generate code/commands/scripts from raw intent
 *   Zero-shot fabrication engine
 * 
 * BOUNDARY:
 *   - Code goes to TEMPORARY BUFFER only
 *   - Never touches filesystem
 *   - No side effects
 * 
 * CAPABILITY:
 *   Generates ANY programming artifact:
 *   - Python scripts
 *   - TypeScript modules
 *   - Shell commands
 *   - SQL queries
 *   - Config files
 *   - Documentation
 *   - Infinite language coverage
 */

export const ForgeSynthesizeRequestSchema = z.object({
  /** Natural language intent */
  intent: z.string().min(10).max(10_000),
  
  /** Target language/runtime (optional, auto-detected) */
  target: z.enum([
    "python",
    "typescript",
    "javascript",
    "shell",
    "sql",
    "yaml",
    "json",
    "unknown"
  ]).optional(),
  
  /** Constraints array (e.g., "no network access", "pure function") */
  constraints: z.array(z.string()).optional(),
  
  /** Context for generation (e.g., past code, schema, examples) */
  context: z.string().max(50_000).optional(),
  
  /** Decision class (determines timeout) */
  decision_class: z.enum(["C0_AUTO", "C1_FAST", "C2_STANDARD", "C3_DEEP", "C4_SOVEREIGN"])
    .default("C2_STANDARD"),
});

export type ForgeSynthesizeRequest = z.infer<typeof ForgeSynthesizeRequestSchema>;

export const ForgeSynthesizeResponseSchema = z.object({
  /** Unique artifact identifier */
  artifact_id: z.string(),
  
  /** Raw generated code (temporary buffer) */
  code: z.string(),
  
  /** Detected/generated language */
  language: z.string(),
  
  /** SHA256 hash of code */
  hash: z.string(),
  
  /** Line count (complexity proxy) */
  line_count: z.number().int().positive(),
  
  /** Static complexity score (0-100) */
  complexity_score: z.number().min(0).max(100),
  
  /** Synthesis timestamp */
  created_at: z.string().datetime(),
  
  /** Decision class used (from request) */
  decision_class: z.enum(["C0_AUTO", "C1_FAST", "C2_STANDARD", "C3_DEEP", "C4_SOVEREIGN"]),
});

export type ForgeSynthesizeResponse = z.infer<typeof ForgeSynthesizeResponseSchema>;

// ============================================================================
// FORGE8 TOOL 2: forge_stage — The Quarantine
// ============================================================================

/**
 * FORGE8 #2: forge_stage — The Quarantine / Governance Preview
 * 
 * FUNCTION:
 *   Two modes:
 *     mode="artifact": Move synthesized artifact to quarantine zone (legacy FORGE8)
 *     mode="governance": Stage an intent for human preview + approval (two-phase commit)
 * 
 * BOUNDARY (artifact mode):
 *   - Once staged, spec is IMMUTABLE
 *   - No silent mutations
 *   - No self-modification
 * 
 * BOUNDARY (governance mode):
 *   - NO mutation, idempotent, safe to call repeatedly
 *   - Computes diff/blast_radius/reversibility_score/affected_organs
 *   - Returns ui://aforge/preview/<stage_id> for human review
 * 
 * CAPABILITY:
 *   Artifact mode: dependency resolution, environment setup, quarantine isolation
 *   Governance mode: two-phase commit, human-in-the-loop preview, F13 gate
 */

// ── Governance stage params ──

export const GovernanceStageParamsSchema = z.object({
  /** What the operation intends to do */
  intent: z.string().min(10).max(10_000)
    .describe("Natural-language description of the intended operation"),
  
  /** What entity is being acted upon */
  target: z.string().min(1).max(500)
    .describe("Target of the operation (file path, organ name, service, etc.)"),
  
  /** Optional key-value parameters for the operation */
  params: z.record(z.unknown()).optional()
    .describe("Optional parameters for the operation"),
});

export type GovernanceStageParams = z.infer<typeof GovernanceStageParamsSchema>;

// ── Governance stage result ──

export const GovernanceStageResultSchema = z.object({
  /** Diff representation (text or structured) */
  diff: z.string().optional()
    .describe("Before/after diff of the proposed change"),
  
  /** Organs that would be affected */
  affected_organs: z.array(z.string())
    .describe("Organs touched by this operation"),
  
  /** Reversibility score 0.0–1.0 (1.0 = fully reversible) */
  reversibility_score: z.number().min(0).max(1)
    .describe("How reversible this operation is (1.0 = fully reversible)"),
  
  /** Blast radius 0.0–1.0 (1.0 = federation-wide) */
  blast_radius: z.number().min(0).max(1)
    .describe("How many systems this operation affects (1.0 = federation-wide)"),
  
  /** Estimated resource cost 0.0–1.0 */
  estimated_cost: z.number().min(0).max(1).optional()
    .describe("Estimated resource/cost impact"),
  
  /** Stage TTL in seconds (default 300 = 5 minutes) */
  ttl_seconds: z.number().int().positive().max(3600).default(300)
    .describe("How long this stage remains valid (max 3600s)"),
});

export type GovernanceStageResult = z.infer<typeof GovernanceStageResultSchema>;

export const ForgeStageRequestSchema = z.object({
  /** Mode discriminator: "artifact" (legacy FORGE8) or "governance" (two-phase commit) */
  mode: z.enum(["artifact", "governance"]).default("artifact")
    .describe("Stage mode: artifact=FORGE8 pipeline, governance=two-phase commit preview"),
  
  // ── Common fields ──
  ttl_seconds: z.number().int().positive().max(3600).default(300).optional()
    .describe("Stage TTL in seconds (default 300)"),
  
  // ── Artifact mode fields (legacy FORGE8) ──
  artifact_id: z.string().optional()
    .describe("Artifact ID from forge_synthesize (artifact mode)"),
  
  dependencies: z.array(z.object({
    name: z.string(),
    version: z.string().optional(),
    source: z.string().optional(),
  })).optional()
    .describe("Dependencies (artifact mode)"),
  
  resources_requested: z.object({
    cpu: z.number().positive().max(SANDBOX_RESOURCE_LIMITS.MAX_CPU_CORES),
    memory_mb: z.number().positive().max(SANDBOX_RESOURCE_LIMITS.MAX_MEMORY_MB),
    timeout_ms: z.number().positive().max(SANDBOX_TIMEOUT_MAX_MS.C4_SOVEREIGN),
    network: z.boolean().default(SANDBOX_RESOURCE_LIMITS.NETWORK_ACCESS),
  }).optional()
    .describe("Requested resources (artifact mode)"),
  
  // ── Governance mode fields ──
  intent: z.string().min(10).max(10_000).optional()
    .describe("Natural-language intent (governance mode)"),
  
  target: z.string().min(1).max(500).optional()
    .describe("Target of the operation (governance mode)"),
  
  params: z.record(z.unknown()).optional()
    .describe("Key-value parameters (governance mode)"),
}).refine(
  (data) => {
    if (data.mode === "artifact") return !!data.artifact_id;
    if (data.mode === "governance") return !!data.intent && !!data.target;
    return true;
  },
  {
    message: "artifact mode requires artifact_id; governance mode requires intent + target",
    path: ["mode"],
  }
);

export type ForgeStageRequest = z.infer<typeof ForgeStageRequestSchema>;

export const ForgeStageResponseSchema = z.object({
  /** Stage identifier */
  stage_id: z.string(),
  
  /** Mode this stage was created with */
  mode: z.enum(["artifact", "governance"]),
  
  // ── Common fields ──
  locked: z.literal(true),
  staged_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
  
  // ── Artifact mode fields ──
  quarantine_path: z.string().optional(),
  immutable: z.literal(true).optional(),
  spec_hash: z.string().optional(),
  
  // ── Governance mode fields ──
  intent: z.string().optional(),
  target: z.string().optional(),
  diff: z.string().optional(),
  affected_organs: z.array(z.string()).optional(),
  reversibility_score: z.number().min(0).max(1).optional(),
  blast_radius: z.number().min(0).max(1).optional(),
  estimated_cost: z.number().min(0).max(1).optional(),
  
  /** UI resource URI for human preview */
  preview_uri: z.string().optional(),
});

export type ForgeStageResponse = z.infer<typeof ForgeStageResponseSchema>;

// ============================================================================
// FORGE8 TOOL 3: forge_sandbox_run — The Dry-Run Engine
// ============================================================================

/**
 * FORGE8 #3: forge_sandbox_run
 * 
 * FUNCTION:
 *   Execute staged artifact in MicroVM with strict resource limits
 *   Collect execution metrics (Landauer bound enforcement)
 * 
 * BOUNDARY:
 *   - Fully isolated execution (no network, limited RAM, limited CPU)
 *   - TIMEOUT IS ABSOLUTE — cannot be overridden
 *   - Timeout triggers hard-fail
 * 
 * CAPABILITY:
 *   Tests ANY executable artifact:
 *   - Standalone scripts
 *   - Pure functions
 *   - Async pipelines
 *   - Services
 *   - Agents
 */

export const ForgeSandboxRunRequestSchema = z.object({
  /** Stage ID from forge_stage */
  stage_id: z.string(),
  
  /** Test suite (array of test case names or full test code) */
  test_suite: z.array(z.string()).optional(),
  
  /** Maximum duration (capped by SANDBOX_TIMEOUT_MAX_MS) */
  max_duration_ms: z.number()
    .positive()
    .max(SANDBOX_TIMEOUT_MAX_MS.C4_SOVEREIGN),
  
  /** Resource limits (capped by SANDBOX_RESOURCE_LIMITS) */
  resource_limits: z.object({
    cpu: z.number().positive().max(SANDBOX_RESOURCE_LIMITS.MAX_CPU_CORES),
    memory_mb: z.number().positive().max(SANDBOX_RESOURCE_LIMITS.MAX_MEMORY_MB),
    network: z.boolean().default(SANDBOX_RESOURCE_LIMITS.NETWORK_ACCESS),
  }),
  
  /** Decision class (for logging) */
  decision_class: z.enum(["C0_AUTO", "C1_FAST", "C2_STANDARD", "C3_DEEP", "C4_SOVEREIGN"])
    .default("C2_STANDARD"),
});

export type ForgeSandboxRunRequest = z.infer<typeof ForgeSandboxRunRequestSchema>;

export const ForgeSandboxRunResponseSchema = z.object({
  /** Exit code (0 = success) */
  exit_code: z.number().int(),
  
  /** Standard output */
  stdout: z.string(),
  
  /** Standard error */
  stderr: z.string(),
  
  /** Execution metrics */
  metrics: z.object({
    duration_ms: z.number().positive(),
    peak_memory_mb: z.number().positive(),
    cpu_time_ms: z.number().positive(),
    recursion_depth: z.number().int().nonnegative(),
    network_calls: z.number().int().nonnegative(),
    subprocess_count: z.number().int().nonnegative(),
  }),
  
  /** Test results */
  test_results: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
  
  /** Test case names that passed */
  passed_tests: z.array(z.string()),
  
  /** Test case names that failed */
  failed_tests: z.array(z.string()),
  
  /** Sandbox timestamp */
  tested_at: z.string().datetime(),
});

export type ForgeSandboxRunResponse = z.infer<typeof ForgeSandboxRunResponseSchema>;

// ============================================================================
// FORGE8 TOOL 4: forge_scar_scan — The Invariant Checker
// ============================================================================

/**
 * FORGE8 #4: forge_scar_scan
 * 
 * FUNCTION:
 *   Compare artifact against SCAR v2 database
 *   Compare behavior signature against collapse patterns
 *   Institutional memory enforcement
 * 
 * BOUNDARY:
 *   - A-FORGE can DETECT but NOT judge
 *   - Only arifOS decides if scar is acceptable
 *   - Immediate rejection on CRITICAL collapse signature
 * 
 * CAPABILITY:
 *   Enables:
 *   - Regression prevention (don't repeat past failures)
 *   - Collapse prevention (don't build collapse-prone tools)
 *   - Institutional memory (remember what failed and why)
 */

export const ForgeScarScanRequestSchema = z.object({
  /** Artifact ID */
  artifact_id: z.string(),
  
  /** SHA256 of artifact spec */
  spec_hash: z.string(),
  
  /** Behavior signature (fingerprint of intent + behavior) */
  behavior_signature: z.string(),
});

export type ForgeScarScanRequest = z.infer<typeof ForgeScarScanRequestSchema>;

export const ForgeScarScanResponseSchema = z.object({
  /** Whether scar match found */
  scar_match: z.boolean(),
  
  /** Matched scars (if any) */
  matched_scars: z.array(z.object({
    scar_id: z.string(),
    description: z.string(),
    created_at: z.string().datetime(),
    context: z.string(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  })),
  
  /** Collapse signatures detected */
  collapse_signatures: z.array(z.object({
    signature: z.string(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    historical_precedent: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  
  /** Verdict from scan */
  verdict: z.enum(["CLEAN", "SCAR_MATCH", "COLLAPSE_DETECTED"]),
  
  /** Scan timestamp */
  scanned_at: z.string().datetime(),
});

export type ForgeScarScanResponse = z.infer<typeof ForgeScarScanResponseSchema>;

// ============================================================================
// FORGE8 TOOL 5: forge_skillstore_sync — The Memory Ledger
// ============================================================================

/**
 * FORGE8 #5: forge_skillstore_sync
 * 
 * FUNCTION:
 *   Two modes: WRITE (store new artifact) or READ (retrieve artifacts)
 *   Persistent memory with versioning and vector embeddings
 * 
 * BOUNDARY:
 *   - Write-only for new artifacts
 *   - Read-only for historical
 *   - No mutation allowed
 * 
 * CAPABILITY:
 *   Enables:
 *   - Artifact reuse (don't forge what exists)
 *   - Versioning (track evolution)
 *   - Semantic search (find related artifacts)
 *   - Audit trail (who built what, when)
 */

/** WRITE mode: Store new artifact */
export const ForgeSkillstoreWriteSchema = z.object({
  /** Operation mode */
  mode: z.literal("WRITE"),
  
  /** Artifact ID */
  artifact_id: z.string(),
  
  /** Human-readable name */
  name: z.string().min(1).max(100),
  
  /** Semantic version */
  version: z.string(),
  
  /** Tags for discoverability */
  tags: z.array(z.string()),
  
  /** Provenance (who, when, why) */
  provenance: z.object({
    created_by: z.string(),
    created_at: z.string().datetime(),
    intent: z.string(),
    context: z.string().optional(),
  }),
  
  /** Vector embedding (1536-dim, OpenAI ada-002 format) */
  embedding: z.array(z.number()).length(1536),
});

export type ForgeSkillstoreWriteRequest = z.infer<typeof ForgeSkillstoreWriteSchema>;

/** READ mode: Retrieve artifacts */
export const ForgeSkillstoreReadSchema = z.object({
  /** Operation mode */
  mode: z.literal("READ"),
  
  /** Semantic query (natural language or embedding) */
  query: z.string().optional(),
  
  /** Filter by tags */
  tags: z.array(z.string()).optional(),
  
  /** Limit results */
  limit: z.number().int().positive().max(100).default(10),
  
  /** Include full code or metadata only */
  include_artifact_code: z.boolean().default(false),
});

export type ForgeSkillstoreReadRequest = z.infer<typeof ForgeSkillstoreReadSchema>;

/** Union request schema */
export const ForgeSkillstoreSyncRequestSchema = z.union([
  ForgeSkillstoreWriteSchema,
  ForgeSkillstoreReadSchema,
]);

export type ForgeSkillstoreSyncRequest = z.infer<typeof ForgeSkillstoreSyncRequestSchema>;

export const ForgeSkillstoreWriteResponseSchema = z.object({
  /** Record identifier */
  record_id: z.string(),
  
  /** SHA256 hash of record */
  hash: z.string(),
  
  /** Storage timestamp */
  stored_at: z.string().datetime(),
});

export type ForgeSkillstoreWriteResponse = z.infer<typeof ForgeSkillstoreWriteResponseSchema>;

export const ForgeSkillstoreReadResponseSchema = z.object({
  /** Retrieved artifacts */
  artifacts: z.array(z.object({
    artifact_id: z.string(),
    name: z.string(),
    version: z.string(),
    tags: z.array(z.string()),
    provenance: z.object({
      created_by: z.string(),
      created_at: z.string().datetime(),
      intent: z.string(),
    }),
    code: z.string().optional(),  // Only if include_artifact_code=true
    similarity_score: z.number().min(0).max(1).optional(),
  })),
  
  /** Total count */
  total_count: z.number().int().nonnegative(),
  
  /** Query timestamp */
  queried_at: z.string().datetime(),
});

export type ForgeSkillstoreReadResponse = z.infer<typeof ForgeSkillstoreReadResponseSchema>;

// ============================================================================
// FORGE8 TOOL 6: forge_tier_bind — The Trust Enforcer
// ============================================================================

/**
 * FORGE8 #6: forge_tier_bind
 * 
 * FUNCTION:
 *   Bind mechanical isolation constraints to artifact
 *   Set LOWER BOUNDS on trust (A-FORGE can require LOCAL only)
 * 
 * BOUNDARY:
 *   - A-FORGE sets LOWER BOUNDS only (mechanical constraints)
 *   - arifOS sets ACTUAL TRUST TIER after APEX evaluation
 *   - A-FORGE CANNOT promote tier
 * 
 * CAPABILITY:
 *   Enables:
 *   - Least-privilege execution
 *   - Blast radius containment
 *   - Mechanical isolation enforcement
 */

export const ForgeTierBindRequestSchema = z.object({
  /** Artifact ID */
  artifact_id: z.string(),
  
  /** Execution scope (what A-FORGE requires at minimum) */
  execution_scope: z.enum(["LOCAL", "CLUSTER", "NETWORK", "PUBLIC"]),
  
  /** Whether escalation is allowed */
  escalation_allowed: z.boolean(),
  
  /** Maximum invocation count before requiring re-evaluation */
  max_invocation_count: z.number().int().positive().max(1_000_000),
  
  /** Maximum duration per invocation */
  max_duration_ms: z.number().positive().max(SANDBOX_TIMEOUT_MAX_MS.C4_SOVEREIGN),
  
  /** Trust tier (A-FORGE can set LOWER BOUNDS only) */
  trust_tier_lower_bound: z.number()
    .int()
    .min(TRUST_TIERS.TIER_0_UNTRUSTED)
    .max(TRUST_TIERS.TIER_5_HUMAN),
});

export type ForgeTierBindRequest = z.infer<typeof ForgeTierBindRequestSchema>;

export const ForgeTierBindResponseSchema = z.object({
  /** Artifact ID */
  artifact_id: z.string(),
  
  /** SHA256 hash of trust policy */
  trust_policy_hash: z.string(),
  
  /** Whether policy is now locked (cannot be mutated) */
  locked: z.literal(true),
  
  /** Binding timestamp */
  bound_at: z.string().datetime(),
});

export type ForgeTierBindResponse = z.infer<typeof ForgeTierBindResponseSchema>;

// ============================================================================
// FORGE8 TOOL 7: forge_docket_prep — The Handover
// ============================================================================

/**
 * FORGE8 #7: forge_docket_prep
 * 
 * FUNCTION:
 *   Package all artifact evidence into read-only docket
 *   Hand off to arifOS for APEX G-score evaluation
 * 
 * BOUNDARY:
 *   - CONSTITUTIONAL CRITICAL: A-FORGE RELINQUISHES CONTROL HERE
 *   - Docket is READ-ONLY and SEALED
 *   - No more modifications after docket creation
 *   - A-FORGE cannot read docket (governance opacity)
 * 
 * CAPABILITY:
 *   Enables:
 *   - Complete audit trail
 *   - Reproducibility
 *   - Governance transparency to arifOS
 */

export const ForgeDocketPrepRequestSchema = z.object({
  /** Artifact ID */
  artifact_id: z.string(),
  
  /** Test results from forge_sandbox_run */
  test_results: ForgeSandboxRunResponseSchema,
  
  /** SCAR scan results from forge_scar_scan */
  scar_scan: ForgeScarScanResponseSchema,
  
  /** Trust tier binding from forge_tier_bind */
  tier_binding: ForgeTierBindResponseSchema,
  
  /** Skillstore record from forge_skillstore_sync */
  skillstore_record: ForgeSkillstoreWriteResponseSchema,
  
  /** Optional: human-readable justification */
  justification: z.string().max(10_000).optional(),
});

export type ForgeDocketPrepRequest = z.infer<typeof ForgeDocketPrepRequestSchema>;

export const ForgeDocketPrepResponseSchema = z.object({
  /** Docket identifier */
  docket_id: z.string(),
  
  /** SHA256 hash of entire docket (must match VAULT999 seal) */
  payload_hash: z.string(),
  
  /** Submission timestamp */
  submitted_at: z.string().datetime(),
  
  /** Status (AWAITING_EVALUATION = handed to arifOS) */
  status: z.literal("AWAITING_EVALUATION"),
  
  /** Constitutional note: A-FORGE has no more access */
  constitutional_note: z.literal(
    "A-FORGE RELINQUISHES CONTROL. Docket is read-only and sealed. Handoff to arifOS complete."
  ),
});

export type ForgeDocketPrepResponse = z.infer<typeof ForgeDocketPrepResponseSchema>;

// ============================================================================
// FORGE8 TOOL 8: forge_execute — The Mechanical Hand
// ============================================================================

/**
 * FORGE8 #8: forge_execute
 * 
 * FUNCTION:
 *   Execute artifact in live environment
 *   Deploy or run with full resource access (per trust tier)
 * 
 * BOUNDARY:
 *   - FAILS HARD if docket lacks valid VAULT999 SEAL
 *   - SEAL must be cryptographically signed by arifOS
 *   - No SEAL = no execution. Period.
 *   - No partial execution
 * 
 * CAPABILITY:
 *   Enables:
 *   - Deployment of any executable artifact
 *   - Service launches
 *   - Agent activations
 *   - Live execution
 */

export const ForgeExecuteRequestSchema = z.object({
  /** Docket ID from forge_docket_prep */
  docket_id: z.string(),
  
  /** VAULT999 SEAL from arifOS (MANDATORY) */
  vault_seal: z.object({
    /** Seal identifier */
    seal_id: z.string(),
    
    /** Cryptographic proof from VAULT999 (signed by arifOS) */
    seal_proof: z.string(),
    
    /** SHA256 hash (must match docket payload_hash) */
    seal_hash: z.string(),
    
    /** Timestamp of seal creation */
    sealed_at: z.string().datetime(),
  }),
});

export type ForgeExecuteRequest = z.infer<typeof ForgeExecuteRequestSchema>;

export const ForgeExecuteResponseSchema = z.object({
  /** Execution identifier */
  execution_id: z.string(),
  
  /** Exit code (0 = success) */
  exit_code: z.number().int(),
  
  /** Standard output */
  stdout: z.string(),
  
  /** Standard error */
  stderr: z.string(),
  
  /** Execution metrics (same as sandbox, but live) */
  metrics: ForgeSandboxRunResponseSchema.shape.metrics,
  
  /** Attestation (who, when, seal validity) */
  attestation: z.object({
    executed_by: z.string(),
    executed_at: z.string().datetime(),
    
    /** Whether VAULT999 SEAL was valid at execution time */
    seal_valid: z.boolean(),
    
    /** Trust tier used (from arifOS evaluation) */
    trust_tier: z.number()
      .int()
      .min(TRUST_TIERS.TIER_0_UNTRUSTED)
      .max(TRUST_TIERS.TIER_5_HUMAN),
  }),
  
  /** Execution timestamp */
  executed_at: z.string().datetime(),
});

export type ForgeExecuteResponse = z.infer<typeof ForgeExecuteResponseSchema>;

// ============================================================================
// FAILURE MODES — Constitutional Error Contracts
// ============================================================================

/**
 * Failure response for forge_execute when SEAL is missing/invalid
 * 
 * CONSTITUTIONAL GUARANTEE:
 *   No execution without valid VAULT999 SEAL
 *   This is the hard boundary that prevents self-authorization
 */
export const ForgeExecuteSealMissingErrorSchema = z.object({
  error: z.literal("SEAL_MISSING"),
  reason: z.literal("Docket lacks valid VAULT999 SEAL from arifOS. Execution refused."),
  docket_id: z.string(),
  timestamp: z.string().datetime(),
});

export const ForgeExecuteSealInvalidErrorSchema = z.object({
  error: z.literal("SEAL_INVALID"),
  reason: z.literal("VAULT999 SEAL signature verification failed. Execution refused."),
  docket_id: z.string(),
  seal_id: z.string(),
  timestamp: z.string().datetime(),
});

export const ForgeExecuteSealExpiredErrorSchema = z.object({
  error: z.literal("SEAL_EXPIRED"),
  reason: z.literal("VAULT999 SEAL has expired. Re-evaluation required."),
  docket_id: z.string(),
  sealed_at: z.string(),
  expired_at: z.string(),
  timestamp: z.string().datetime(),
});

export const ForgeExecuteSealHashMismatchErrorSchema = z.object({
  error: z.literal("SEAL_HASH_MISMATCH"),
  reason: z.literal("VAULT999 SEAL hash does not match docket hash. Tampering suspected."),
  docket_id: z.string(),
  seal_hash: z.string(),
  docket_hash: z.string(),
  timestamp: z.string().datetime(),
});

export const ForgeExecuteFailureSchema = z.union([
  ForgeExecuteSealMissingErrorSchema,
  ForgeExecuteSealInvalidErrorSchema,
  ForgeExecuteSealExpiredErrorSchema,
  ForgeExecuteSealHashMismatchErrorSchema,
]);

export type ForgeExecuteFailure = z.infer<typeof ForgeExecuteFailureSchema>;

// ============================================================================
// EXPORTS
// ============================================================================

export const FORGE8_TOOLS = {
  forge_synthesize: {
    request: ForgeSynthesizeRequestSchema,
    response: ForgeSynthesizeResponseSchema,
    boundary: "Code generation to temporary buffer only. No filesystem access.",
    capability: "Generates ANY programming artifact from intent.",
  },
  forge_stage: {
    request: ForgeStageRequestSchema,
    response: ForgeStageResponseSchema,
    boundary: "Artifact spec becomes IMMUTABLE after staging.",
    capability: "Enables dependency resolution and quarantine isolation.",
  },
  forge_sandbox_run: {
    request: ForgeSandboxRunRequestSchema,
    response: ForgeSandboxRunResponseSchema,
    boundary: "Fully isolated execution with ABSOLUTE TIMEOUT.",
    capability: "Tests ANY executable artifact with resource limits.",
  },
  forge_scar_scan: {
    request: ForgeScarScanRequestSchema,
    response: ForgeScarScanResponseSchema,
    boundary: "A-FORGE detects but CANNOT judge. Only arifOS judges.",
    capability: "Enables regression and collapse prevention.",
  },
  forge_skillstore_sync: {
    request: ForgeSkillstoreSyncRequestSchema,
    response: z.union([
      ForgeSkillstoreWriteResponseSchema,
      ForgeSkillstoreReadResponseSchema,
    ]),
    boundary: "Write-only for new, read-only for historical. No mutation.",
    capability: "Enables artifact reuse, versioning, semantic search.",
  },
  forge_tier_bind: {
    request: ForgeTierBindRequestSchema,
    response: ForgeTierBindResponseSchema,
    boundary: "A-FORGE sets LOWER BOUNDS only. arifOS sets ACTUAL trust tier.",
    capability: "Enables least-privilege execution and blast radius containment.",
  },
  forge_docket_prep: {
    request: ForgeDocketPrepRequestSchema,
    response: ForgeDocketPrepResponseSchema,
    boundary: "A-FORGE RELINQUISHES CONTROL. Docket is read-only and sealed.",
    capability: "Enables complete audit trail and governance transparency.",
  },
  forge_execute: {
    request: ForgeExecuteRequestSchema,
    response: z.union([ForgeExecuteResponseSchema, ForgeExecuteFailureSchema]),
    boundary: "FAILS HARD without valid VAULT999 SEAL. No partial execution.",
    capability: "Deploys any executable artifact with full resource access.",
  },
} as const;

// ============================================================================
// CAPABILITY COVERAGE MATRIX
// ============================================================================

/**
 * 8 Kernel Verbs → 99+ Capabilities
 * 
 * DNA Analogy:
 *   DNA has 4 nucleobases (A, T, C, G) but encodes the entire biosphere.
 *   A-FORGE has 8 kernel verbs but can synthesize millions of capabilities.
 * 
 * Turing-Completeness:
 *   These are not pre-built APIs. They are META-TOOLS that forge any tool on the fly.
 *   An AGI doesn't need 1,000 pre-written tools. It needs an infallible factory pipeline
 *   to safely create any tool it needs.
 */

export const CAPABILITY_MATRIX = {
  forge_synthesize: [
    "Python scripts",
    "TypeScript modules",
    "Shell commands",
    "SQL queries",
    "Config files (YAML, JSON)",
    "Documentation",
    "Infinite language coverage",
  ],
  forge_stage: [
    "Dependency resolution",
    "Environment setup",
    "Resource allocation",
    "Quarantine isolation",
    "Two-phase commit governance staging",
    "Human-in-the-loop preview (ui://aforge/preview)",
    "Blast radius computation",
    "Reversibility scoring",
  ],
  forge_sandbox_run: [
    "Standalone script testing",
    "Pure function testing",
    "Async pipeline testing",
    "Service testing",
    "Agent testing",
  ],
  forge_scar_scan: [
    "Regression prevention",
    "Collapse prevention",
    "Institutional memory enforcement",
  ],
  forge_skillstore_sync: [
    "Artifact reuse",
    "Versioning",
    "Semantic search",
    "Audit trail",
  ],
  forge_tier_bind: [
    "Least-privilege execution",
    "Blast radius containment",
    "Mechanical isolation",
  ],
  forge_docket_prep: [
    "Complete audit trail",
    "Reproducibility",
    "Governance transparency",
  ],
  forge_execute: [
    "Script deployment",
    "Service deployment",
    "Agent activation",
    "Live execution",
  ],
} as const;

// ============================================================================
// END OF FORGE8 CONTRACT
// ============================================================================

/**
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * 
 * Constitutional principle:
 *   "Power is distributed. Law is centralized."
 * 
 * This contract ensures A-FORGE remains a GOVERNED execution shell,
 * not a judge, not a worker, not a domain organ.
 * 
 * The 8 verbs are the boundary between OpenCode (worker) and external agents.
 * Everything else is downstream.
 */
