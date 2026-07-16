/**
 * @file A-FORGE Execution Verbs — TypeScript Contract
 * @description The 8 execution verbs that form the FORGE organ's internal loop
 * 
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * 
 * CONSTITUTIONAL BOUNDARY:
 *   A-FORGE proposes. arifOS decides.
 *   A-FORGE builds. arifOS seals.
 *   A-FORGE executes. arifOS audits.
 * 
 * CRITICAL RULE:
 *   forge_execute will FAIL HARD if docket lacks valid VAULT999 SEAL.
 *   No SEAL = no execution. Period.
 * 
 * EXECUTION LOOP:
 *   synthesize → stage → sandbox_run → scar_scan → skillstore_sync → tier_bind → docket_prep → execute
 * 
 * @author arifOS Constitutional Kernel
 * @version 42.1
 * @sealed 2026-06-29
 */

import { z } from "zod";

// ============================================================================
// CONSTANTS — Constitutional Execution Limits
// ============================================================================

/**
 * Trust tiers for artifact isolation
 * 
 * A-FORGE can only set LOWER BOUNDS.
 * arifOS sets ACTUAL trust tier after APEX evaluation.
 * A-FORGE CANNOT promote. Only arifOS can promote.
 */
export const TRUST_TIERS = {
  LOCAL_ONLY: "local_only",           // Execute only in sandboxed local environment
  CLUSTER_RESTRICTED: "cluster_restricted", // Execute in restricted cluster
  NETWORK_ISOLATED: "network_isolated",     // Execute with network isolation
  FULL_ACCESS: "full_access"          // Full network and resource access
} as const;

export type TrustTier = typeof TRUST_TIERS[keyof typeof TRUST_TIERS];

/**
 * Sandbox timeout policy (ABSOLUTE — cannot be overridden)
 * 
 * Prevents: infinite loops, compute burning, denial of service
 */
export const SANDBOX_TIMEOUT_MAX_MS = {
  C0_AUTO: 60_000,           // 1 minute for auto-generated artifacts
  C1_STANDARD: 300_000,      // 5 minutes for standard execution
  C2_PRIVILEGED: 900_000,    // 15 minutes for privileged operations
  C3_SOVEREIGN: 1_800_000    // 30 minutes for sovereign-approved execution
} as const;

/**
 * Resource limits for sandbox execution
 * 
 * Hard limits that cannot be exceeded in forge_sandbox_run
 */
export const SANDBOX_RESOURCE_LIMITS = {
  MAX_CPU_CORES: 4,
  MAX_MEMORY_MB: 4096,          // 4 GB
  MAX_DISK_MB: 10240,           // 10 GB
  MAX_NETWORK_BANDWIDTH_MBPS: 100,
  MAX_EXECUTION_TIME_MS: SANDBOX_TIMEOUT_MAX_MS.C3_SOVEREIGN
} as const;

/**
 * Memory retention policy for forge_skillstore_sync
 * 
 * Two-layer system:
 *   1. Hot storage: Recent artifacts with full metadata (Qdrant vector DB)
 *   2. Cold storage: Historical artifacts with compressed metadata (compressed archive)
 * 
 * SCAR immunization: SCAR-linked artifacts NEVER expire.
 * This prevents structural amnesia of past failures.
 */
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

// ============================================================================
// VERB 1: forge_synthesize — Create Artifact from Intent
// ============================================================================

export const ForgeSynthesizeRequestSchema = z.object({
  intent: z.string()
    .min(10, "Intent must be at least 10 characters")
    .max(10_000, "Intent cannot exceed 10,000 characters")
    .describe("What to build — plain language description"),
  
  constraints: z.array(z.string())
    .max(50, "Cannot specify more than 50 constraints")
    .optional()
    .describe("Execution constraints (e.g., 'no network access', 'pure function')"),
  
  context: z.string()
    .max(100_000, "Context cannot exceed 100,000 characters")
    .optional()
    .describe("Relevant context, requirements, or specifications"),
  
  decision_class: z.enum(["C0_AUTO", "C1_STANDARD", "C2_PRIVILEGED", "C3_SOVEREIGN"])
    .default("C1_STANDARD")
    .describe("Execution decision class (determines resource limits)")
});

export type ForgeSynthesizeRequest = z.infer<typeof ForgeSynthesizeRequestSchema>;

export const ForgeSynthesizeResponseSchema = z.object({
  artifact_id: z.string().uuid(),
  code: z.string()
    .describe("Generated code (stored in temporary buffer only)"),
  language: z.enum(["python", "typescript", "shell", "sql", "unknown"]),
  estimated_complexity: z.enum(["simple", "moderate", "complex"]),
  synthesized_at: z.string().datetime(),
  
  /** Buffer location — NOT filesystem */
  buffer_location: z.string()
    .describe("Memory buffer URL (not filesystem path)")
});

export type ForgeSynthesizeResponse = z.infer<typeof ForgeSynthesizeResponseSchema>;

// ============================================================================
// VERB 2: forge_stage — Move to Quarantine, Lock Spec / Governance Preview
// ============================================================================

/**
 * forge_stage(mode: "governance", intent, target, params)
 * 
 * TWO modes:
 *   mode="artifact":  Move synthesized artifact to quarantine zone (legacy FORGE8)
 *   mode="governance": Stage an intent for human preview + approval (two-phase commit)
 * 
 * GOVERNANCE MODE:
 *   - NO mutation, idempotent, safe to call repeatedly
 *   - Computes diff/blast_radius/reversibility_score/affected_organs
 *   - Returns ui://aforge/preview/<stage_id> for human review
 *   - Stage_id expires after ttl_seconds (default 300s = 5 min)
 */

// ── Governance stage params ──
export const GovernanceStageParamsSchema = z.object({
  intent: z.string().min(10).max(10_000)
    .describe("Natural-language description of the intended operation"),
  target: z.string().min(1).max(500)
    .describe("Target of the operation (file path, organ name, service, etc.)"),
  params: z.record(z.unknown()).optional()
    .describe("Optional key-value parameters for the operation"),
});

export type GovernanceStageParams = z.infer<typeof GovernanceStageParamsSchema>;

// ── Governance stage result (computed metadata) ──
export const GovernanceStageResultSchema = z.object({
  diff: z.string().optional()
    .describe("Before/after diff of the proposed change"),
  affected_organs: z.array(z.string())
    .describe("Organs touched by this operation"),
  reversibility_score: z.number().min(0).max(1)
    .describe("How reversible this operation is (1.0 = fully reversible)"),
  blast_radius: z.number().min(0).max(1)
    .describe("How many systems this operation affects (1.0 = federation-wide)"),
  estimated_cost: z.number().min(0).max(1).optional()
    .describe("Estimated resource/cost impact"),
});

export type GovernanceStageResult = z.infer<typeof GovernanceStageResultSchema>;

// ── Main forge_stage request ──
export const ForgeStageRequestSchema = z.object({
  /** Mode: "artifact" (FORGE8 pipeline) or "governance" (two-phase commit) */
  mode: z.enum(["artifact", "governance"]).default("artifact")
    .describe("Stage mode: artifact=FORGE8 pipeline, governance=two-phase commit preview"),
  
  // ── Common ──
  ttl_seconds: z.number().int().positive().max(3600).default(300)
    .describe("Stage TTL in seconds (default 300 = 5 min)"),
  
  // ── Artifact mode (legacy FORGE8) ──
  artifact_id: z.string().uuid().optional()
    .describe("Artifact ID from forge_synthesize (artifact mode)"),
  dependencies: z.array(z.string())
    .max(100, "Cannot specify more than 100 dependencies")
    .optional()
    .describe("External dependencies (artifact mode)"),
  resource_requirements: z.object({
    cpu_cores: z.number().min(1).max(SANDBOX_RESOURCE_LIMITS.MAX_CPU_CORES),
    memory_mb: z.number().min(128).max(SANDBOX_RESOURCE_LIMITS.MAX_MEMORY_MB),
    disk_mb: z.number().min(64).max(SANDBOX_RESOURCE_LIMITS.MAX_DISK_MB),
    network_required: z.boolean().default(false)
  }).optional()
    .describe("Resource requirements (artifact mode)"),
  
  // ── Governance mode ──
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

// ── forge_stage response ──
export const ForgeStageResponseSchema = z.object({
  stage_id: z.string(),
  mode: z.enum(["artifact", "governance"]),
  
  // ── Common ──
  locked: z.literal(true),
  staged_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
  
  // ── Artifact mode ──
  staging_location: z.string().optional(),
  staging_completed_at: z.string().datetime().optional(),
  dependencies_resolved: z.array(z.string()).optional(),
  resources_allocated: z.object({
    cpu_cores: z.number(),
    memory_mb: z.number(),
    disk_mb: z.number()
  }).optional(),
  
  // ── Governance mode ──
  intent: z.string().optional(),
  target: z.string().optional(),
  diff: z.string().optional(),
  affected_organs: z.array(z.string()).optional(),
  reversibility_score: z.number().min(0).max(1).optional(),
  blast_radius: z.number().min(0).max(1).optional(),
  estimated_cost: z.number().min(0).max(1).optional(),
  
  /** UI resource URI for human preview (governance mode) */
  preview_uri: z.string().optional(),
});

export type ForgeStageResponse = z.infer<typeof ForgeStageResponseSchema>;

// ============================================================================
// VERB 3: forge_sandbox_run — Test in Isolated Environment
// ============================================================================

export const ForgeSandboxRunRequestSchema = z.object({
  stage_id: z.string().uuid(),
  test_suite: z.string()
    .describe("Test suite to execute (pytest, jest, shell script, etc.)"),
  
  resource_limits: z.object({
    cpu_cores: z.number().min(1).max(SANDBOX_RESOURCE_LIMITS.MAX_CPU_CORES),
    memory_mb: z.number().min(128).max(SANDBOX_RESOURCE_LIMITS.MAX_MEMORY_MB),
    timeout_ms: z.number().min(10_000).max(SANDBOX_RESOURCE_LIMITS.MAX_EXECUTION_TIME_MS),
    network_access: z.boolean().default(false)
  }),
  
  /** ABSOLUTE timeout — cannot be overridden */
  absolute_timeout_ms: z.number()
    .min(10_000, "Minimum timeout is 10 seconds")
    .max(SANDBOX_RESOURCE_LIMITS.MAX_EXECUTION_TIME_MS)
    .describe("Hard timeout (prevents infinite loops)")
});

export type ForgeSandboxRunRequest = z.infer<typeof ForgeSandboxRunRequestSchema>;

export const ForgeSandboxRunResponseSchema = z.object({
  test_results: z.object({
    tests_run: z.number().int(),
    tests_passed: z.number().int(),
    tests_failed: z.number().int(),
    tests_skipped: z.number().int()
  }),
  
  metrics: z.object({
    execution_time_ms: z.number().int(),
    memory_peak_mb: z.number().int(),
    cpu_time_ms: z.number().int(),
    network_calls_made: z.number().int()
  }),
  
  coverage: z.object({
    lines_covered: z.number().int(),
    lines_total: z.number().int(),
    coverage_percent: z.number().min(0).max(100)
  }).optional(),
  
  artifacts_generated: z.array(z.string()),
  sandbox_run_completed_at: z.string().datetime()
});

export type ForgeSandboxRunResponse = z.infer<typeof ForgeSandboxRunResponseSchema>;

// ============================================================================
// VERB 4: forge_scar_scan — Check Against Past Failures
// ============================================================================

export const ForgeScarScanRequestSchema = z.object({
  artifact_id: z.string().uuid(),
  scan_depth: z.enum(["metadata_only", "full_analysis"])
    .default("full_analysis")
});

export type ForgeScarScanRequest = z.infer<typeof ForgeScarScanRequestSchema>;

export const ForgeScarScanResponseSchema = z.object({
  scar_matches: z.array(z.object({
    scar_id: z.string().uuid(),
    similarity_score: z.number().min(0).max(100),
    scar_severity: z.enum(["low", "medium", "high", "critical"]),
    scar_reason: z.string(),
    blocked_patterns: z.array(z.string())
  })),
  
  /** If any match has severity ≥ high, this is BLOCKED */
  verdict: z.enum(["CLEAN", "WARNING", "BLOCKED"]),
  
  scar_scan_completed_at: z.string().datetime()
});

export type ForgeScarScanResponse = z.infer<typeof ForgeScarScanResponseSchema>;

// ============================================================================
// VERB 5: forge_skillstore_sync — Store with Provenance
// ============================================================================

/**
 * Two-layer memory retention policy:
 *   1. Hot storage (Qdrant): Recent artifacts with full metadata
 *   2. Cold storage (compressed): Historical artifacts with metadata only
 * 
 * SCAR immunization: SCAR-linked artifacts never expire.
 */
export const ForgeSkillstoreWriteRequestSchema = z.object({
  operation: z.literal("WRITE"),
  artifact_id: z.string().uuid(),
  
  /** Full artifact code and metadata */
  artifact: z.object({
    code: z.string(),
    language: z.enum(["python", "typescript", "shell", "sql", "unknown"]),
    
    /** Complete provenance */
    provenance: z.object({
      created_by: z.string(),
      created_at: z.string().datetime(),
      intent: z.string(),
      constraints: z.array(z.string()).optional(),
      context: z.string().optional(),
      decision_class: z.enum(["C0_AUTO", "C1_STANDARD", "C2_PRIVILEGED", "C3_SOVEREIGN"])
    })
  }),
  
  /** Tags for semantic search */
  tags: z.array(z.string())
    .max(20, "Cannot specify more than 20 tags")
    .optional()
});

export type ForgeSkillstoreWriteRequest = z.infer<typeof ForgeSkillstoreWriteRequestSchema>;

export const ForgeSkillstoreReadRequestSchema = z.object({
  operation: z.literal("READ"),
  query: z.string().min(3),
  limit: z.number().min(1).max(100).default(10),
  filter_by_tags: z.array(z.string()).optional()
});

export type ForgeSkillstoreReadRequest = z.infer<typeof ForgeSkillstoreReadRequestSchema>;

export const ForgeSkillstoreSyncRequestSchema = z.union([
  ForgeSkillstoreWriteRequestSchema,
  ForgeSkillstoreReadRequestSchema
]);

export type ForgeSkillstoreSyncRequest = z.infer<typeof ForgeSkillstoreSyncRequestSchema>;

export const ForgeSkillstoreWriteResponseSchema = z.object({
  operation: z.literal("WRITE"),
  record_id: z.string().uuid(),
  storage_location: z.enum(["hot_storage", "cold_storage"]),
  stored_at: z.string().datetime(),
  
  /** Vector embedding ID in Qdrant (if hot storage) */
  vector_embedding_id: z.string().optional()
});

export type ForgeSkillstoreWriteResponse = z.infer<typeof ForgeSkillstoreWriteResponseSchema>;

export const ForgeSkillstoreReadResponseSchema = z.object({
  operation: z.literal("READ"),
  artifacts_found: z.number().int(),
  artifacts: z.array(z.object({
    artifact_id: z.string().uuid(),
    code: z.string().optional(),
    language: z.enum(["python", "typescript", "shell", "sql", "unknown"]),
    provenance: z.object({
      created_by: z.string(),
      created_at: z.string().datetime(),
      intent: z.string()
    }),
    similarity_score: z.number().min(0).max(1),
    tags: z.array(z.string())
  })),
  queried_at: z.string().datetime()
});

export type ForgeSkillstoreReadResponse = z.infer<typeof ForgeSkillstoreReadResponseSchema>;

// ============================================================================
// VERB 6: forge_tier_bind — Set Trust Tier (Lower Bound Only)
// ============================================================================

/**
 * CRITICAL CONSTITUTIONAL BOUNDARY:
 * 
 *   A-FORGE can only set LOWER BOUNDS on trust tier.
 *   ARIFOS sets ACTUAL trust tier after APEX evaluation.
 *   A-FORGE CANNOT promote. Only arifOS can promote.
 * 
 * This is what prevents A-FORGE from self-authorizing.
 */
export const ForgeTierBindRequestSchema = z.object({
  artifact_id: z.string().uuid(),
  
  /** LOWER BOUND only — arifOS may set higher tier */
  trust_tier_lower_bound: z.enum([
    TRUST_TIERS.LOCAL_ONLY,
    TRUST_TIERS.CLUSTER_RESTRICTED,
    TRUST_TIERS.NETWORK_ISOLATED,
    TRUST_TIERS.FULL_ACCESS
  ])
    .default(TRUST_TIERS.LOCAL_ONLY)
    .describe("Minimum trust tier required (ARIFOS may set higher)"),
  
  execution_scope: z.object({
    filesystem_write: z.boolean().default(false),
    network_access: z.boolean().default(false),
    spawn_processes: z.boolean().default(true),
    access_to_other_artifacts: z.boolean().default(false)
  })
});

export type ForgeTierBindRequest = z.infer<typeof ForgeTierBindRequestSchema>;

export const ForgeTierBindResponseSchema = z.object({
  trust_policy_hash: z.string()
    .describe("Hash of the trust policy (verified by arifOS)"),
  
  /** LOWER BOUND set by A-FORGE */
  trust_tier_lower_bound: z.enum([
    TRUST_TIERS.LOCAL_ONLY,
    TRUST_TIERS.CLUSTER_RESTRICTED,
    TRUST_TIERS.NETWORK_ISOLATED,
    TRUST_TIERS.FULL_ACCESS
  ]),
  
  execution_scope_configured: z.object({
    filesystem_write: z.boolean(),
    network_access: z.boolean(),
    spawn_processes: z.boolean(),
    access_to_other_artifacts: z.boolean()
  }),
  
  tier_bound_at: z.string().datetime()
});

export type ForgeTierBindResponse = z.infer<typeof ForgeTierBindResponseSchema>;

// ============================================================================
// VERB 7: forge_docket_prep — Hand Off to arifOS
// ============================================================================

/**
 * CRITICAL CONSTITUTIONAL BOUNDARY:
 * 
 * This is where A-FORGE RELINQUISHES CONTROL.
 * 
 * The docket is:
 *   - Read-only (A-FORGE cannot modify after submission)
 *   - Sealed (cryptographic integrity)
 *   - Opaque (A-FORGE cannot read arifOS evaluation)
 * 
 * A-FORGE proposes. arifOS decides.
 */
export const ForgeDocketPrepRequestSchema = z.object({
  artifact_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  
  /** All evidence from previous verbs */
  evidence_package: z.object({
    synthesize_response: ForgeSynthesizeResponseSchema,
    stage_response: ForgeStageResponseSchema,
    sandbox_run_response: ForgeSandboxRunResponseSchema,
    scar_scan_response: ForgeScarScanResponseSchema,
    skillstore_sync_response: ForgeSkillstoreWriteResponseSchema,
    tier_bind_response: ForgeTierBindResponseSchema
  }),
  
  /** Optional: human-readable justification */
  justification: z.string()
    .max(10_000, "Justification cannot exceed 10,000 characters")
    .optional()
});

export type ForgeDocketPrepRequest = z.infer<typeof ForgeDocketPrepRequestSchema>;

export const ForgeDocketPrepResponseSchema = z.object({
  docket_id: z.string().uuid(),
  
  /** Docket is sealed and read-only */
  sealed: z.literal(true),
  read_only: z.literal(true),
  
  submitted_at: z.string().datetime(),
  awaiting_arifos_evaluation: z.literal(true)
});

export type ForgeDocketPrepResponse = z.infer<typeof ForgeDocketPrepResponseSchema>;

// ============================================================================
// VERB 8: forge_execute — Deploy with VAULT999 Seal
// ============================================================================

/**
 * CRITICAL CONSTITUTIONAL BOUNDARY:
 * 
 * forge_execute will FAIL HARD if:
 *   1. Docket lacks VAULT999 SEAL
 *   2. VAULT999 SEAL signature is invalid
 *   3. VAULT999 SEAL is expired
 *   4. VAULT999 SEAL hash doesn't match docket hash
 * 
 * No SEAL = no execution. Period.
 * 
 * This is what prevents A-FORGE from self-authorizing.
 */
export const ForgeExecuteRequestSchema = z.object({
  // ── Legacy FORGE8 path (docket + vault seal) ──
  docket_id: z.string().uuid().optional()
    .describe("Docket ID (legacy FORGE8 path)"),
  
  vault_seal_id: z.string().uuid().optional()
    .describe("ID of VAULT999 SEAL (must be from arifOS)"),
  
  vault_seal_signature: z.string().optional()
    .describe("Cryptographic signature from VAULT999"),
  
  vault_seal_timestamp: z.string().datetime().optional()
    .describe("When the SEAL was issued"),
  
  // ── Governance two-phase commit path ──
  stage_id: z.string().optional()
    .describe("Stage ID from forge_stage(mode=governance)"),
  
  human_seal_token: z.string().min(16).optional()
    .describe("F13 sovereign approval token from UI SEAL button"),
  
  /** Execution parameters */
  execution_parameters: z.record(z.string(), z.any())
    .optional()
    .describe("Runtime parameters for the artifact"),
  
  /** Action to execute (for governance path) */
  action: z.string().optional()
    .describe("Action to execute (e.g., 'deploy', 'restart', 'git_push')"),
}).refine(
  (data) => {
    const hasLegacy = !!data.docket_id && !!data.vault_seal_id;
    const hasGovernance = !!data.stage_id && !!data.human_seal_token;
    return hasLegacy || hasGovernance;
  },
  {
    message: "Must provide either (docket_id + vault_seal_id) or (stage_id + human_seal_token)",
    path: ["stage_id"],
  }
);

export type ForgeExecuteRequest = z.infer<typeof ForgeExecuteRequestSchema>;

export const ForgeExecuteResponseSchema = z.object({
  success: z.literal(true),
  execution_id: z.string(),
  
  executed_at: z.string().datetime(),
  
  /** Which path was used */
  authorization_path: z.enum(["vault_seal", "governance_stage"]),
  
  execution_metrics: z.object({
    execution_time_ms: z.number().int(),
    memory_peak_mb: z.number().int(),
    network_calls_made: z.number().int(),
    files_modified: z.array(z.string()).optional()
  }).optional(),
  
  execution_output: z.string().optional(),
  
  /** VAULT999 audit trail entry */
  vault_audit_id: z.string().uuid(),
  
  /** UI receipt URI (governance path only) */
  receipt_uri: z.string().optional(),
});

export type ForgeExecuteResponse = z.infer<typeof ForgeExecuteResponseSchema>;

/**
 * FAILURE MODE: No valid VAULT999 SEAL
 * 
 * This is the hard constitutional boundary that prevents self-authorization.
 */
export const ForgeExecuteFailureSchema = z.object({
  success: z.literal(false),
  
  error_type: z.enum([
    "NO_VAULT999_SEAL",              // Docket has no SEAL
    "INVALID_VAULT999_SIGNATURE",    // SEAL signature is invalid
    "EXPIRED_VAULT999_SEAL",         // SEAL is expired
    "SEAL_HASH_MISMATCH"             // SEAL hash doesn't match docket
  ]),
  
  error_message: z.string(),
  attempted_at: z.string().datetime(),
  
  /** Constitutional violation */
  constitutional_violation: z.object({
    violated_principle: z.string()
      .describe("e.g., 'A-FORGE cannot self-authorize'"),
    required_action: z.string()
      .describe("e.g., 'Docket must have valid VAULT999 SEAL from arifOS'")
  })
});

export type ForgeExecuteFailure = z.infer<typeof ForgeExecuteFailureSchema>;

export const ForgeExecuteResultSchema = z.union([
  ForgeExecuteResponseSchema,
  ForgeExecuteFailureSchema
]);

export type ForgeExecuteResult = z.infer<typeof ForgeExecuteResultSchema>;

// ============================================================================
// END OF FILE
// ============================================================================

/**
 * The 8 execution verbs form A-FORGE's internal loop:
 * 
 *   synthesize → stage → sandbox_run → scar_scan → skillstore_sync → tier_bind → docket_prep → execute
 * 
 * CRITICAL: forge_execute requires valid VAULT999 SEAL from arifOS.
 * This is what prevents A-FORGE from self-authorizing.
 */
