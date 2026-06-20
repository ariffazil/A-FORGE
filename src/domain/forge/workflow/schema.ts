/**
 * arifOS Workflow Validator — Zod Schemas
 *
 * Port of OpenAI Symphony SPEC §5.3 (Front Matter Schema) to TypeScript/Zod.
 * Source: https://github.com/openai/symphony/blob/main/SPEC.md (Apache 2.0)
 *
 * Two schema families:
 *   1. SymphonyWorkflowConfigSchema — exact port of Symphony WORKFLOW.md
 *   2. RealitySourceConfigSchema — arifOS Reality Engineering extension
 *
 * Convention: unknown keys are accepted (forward compatibility per SPEC §5.3).
 */

import { z } from "zod";

// ───────────────────────────────────────────────────────────────────────────
// Symphony WORKFLOW.md (port from SPEC §5.3)
// ───────────────────────────────────────────────────────────────────────────

const TrackerSchema = z
  .object({
    kind: z.string().min(1),
    endpoint: z.string().url().optional(),
    api_key: z.string().min(1).optional(),
    project_slug: z.string().min(1).optional(),
    required_labels: z.array(z.string()).default([]),
    active_states: z.array(z.string()).default(["Todo", "In Progress"]),
    terminal_states: z
      .array(z.string())
      .default(["Closed", "Cancelled", "Canceled", "Duplicate", "Done"]),
  })
  .passthrough();

const PollingSchema = z
  .object({
    interval_ms: z.number().int().positive().default(30000),
  })
  .passthrough();

const WorkspaceSchema = z
  .object({
    root: z.string().min(1).optional(),
  })
  .passthrough();

const HooksSchema = z
  .object({
    after_create: z.string().optional(),
    before_run: z.string().optional(),
    after_run: z.string().optional(),
    before_remove: z.string().optional(),
    timeout_ms: z.number().int().positive().default(60000),
  })
  .passthrough();

const AgentSchema = z
  .object({
    max_concurrent_agents: z.number().int().positive().default(10),
    max_turns: z.number().int().positive().default(20),
    max_retry_backoff_ms: z.number().int().positive().default(300000),
    max_concurrent_agents_by_state: z.record(z.string(), z.number().int().positive()).default({}),
  })
  .passthrough();

const CodexSchema = z
  .object({
    command: z.string().min(1).default("codex app-server"),
    approval_policy: z.string().optional(),
    thread_sandbox: z.string().optional(),
    turn_sandbox_policy: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    turn_timeout_ms: z.number().int().positive().default(3600000),
    read_timeout_ms: z.number().int().positive().default(5000),
    stall_timeout_ms: z.number().int().default(300000),
  })
  .passthrough();

export const SymphonyWorkflowConfigSchema = z
  .object({
    tracker: TrackerSchema.optional(),
    // Use preprocess to ensure top-level defaults are applied even when the key
    // is missing entirely (Zod's `.default({})` only applies the literal {}, not
    // the inner field defaults).
    polling: z.preprocess((v) => v ?? {}, PollingSchema),
    workspace: WorkspaceSchema.optional(),
    hooks: HooksSchema.optional(),
    agent: z.preprocess((v) => v ?? {}, AgentSchema),
    codex: CodexSchema.optional(),
  })
  .passthrough();

export type SymphonyWorkflowConfig = z.infer<typeof SymphonyWorkflowConfigSchema>;

// ───────────────────────────────────────────────────────────────────────────
// arifOS Reality Engineering — REALITY_SOURCE.md (extension)
// ───────────────────────────────────────────────────────────────────────────

const RealityAnchorSchema = z
  .object({
    primary_stream: z.enum(["geox", "wealth", "well", "multi"]),
    claim_strictness: z.enum(["screen", "appraise", "decision"]).default("screen"),
  })
  .passthrough();

const StreamConfigSchema = z
  .object({
    endpoint: z.string().min(1),
    basin_filter: z.array(z.string()).optional(),
    capital_class: z.string().optional(),
    subject: z.string().optional(),
    evidence_required: z.array(z.string()).default([]),
  })
  .passthrough();

const StreamsSchema = z.record(z.string(), StreamConfigSchema);

const ConstitutionalSchema = z
  .object({
    floors_active: z.array(z.string()).default(["F1", "F2", "F11", "F13"]),
    witness_required: z.array(z.enum(["earth", "ai", "human"])).default(["earth", "ai", "human"]),
    irreversible_actions: z
      .array(z.string())
      .default(["vault_seal", "external_relay", "git_push"]),
  })
  .passthrough();

const RubricSchema = z
  .object({
    axes: z.array(z.enum(["Q", "O", "C", "F"])).default(["Q", "O", "C", "F"]),
    weights: z
      .object({
        Q: z.number().min(0).max(1).default(0.30),
        O: z.number().min(0).max(1).default(0.15),
        C: z.number().min(0).max(1).default(0.25),
        F: z.number().min(0).max(1).default(0.30),
      })
      .default({ Q: 0.30, O: 0.15, C: 0.25, F: 0.30 }),
    seal_threshold: z.number().min(0).max(1).default(0.85),
    sabar_threshold: z.number().min(0).max(1).default(0.65),
    hold_threshold: z.number().min(0).max(1).default(0.45),
    per_axis_minimum: z.number().min(0).max(1).default(0.65),
  })
  .passthrough()
  .refine(
    (r) => Math.abs(r.weights.Q + r.weights.O + r.weights.C + r.weights.F - 1.0) < 0.001,
    { message: "Rubric weights must sum to 1.0" },
  );

const RealityWorkspaceSchema = z
  .object({
    root: z.string().min(1).optional(),
    evidence_cache: z.string().min(1).optional(),
    hooks: HooksSchema.optional(),
  })
  .passthrough();

const RunnerSchema = z
  .object({
    command: z.string().min(1),
    approval_policy: z.string().default("constitutional_only"),
    thread_sandbox: z.string().default("evidence_write"),
    turn_timeout_ms: z.number().int().positive().default(3600000),
    stall_timeout_ms: z.number().int().default(300000),
  })
  .passthrough();

export const RealitySourceConfigSchema = z
  .object({
    reality: RealityAnchorSchema,
    streams: StreamsSchema.default({}),
    agent: AgentSchema.optional(),
    constitutional: ConstitutionalSchema.default({
      floors_active: ["F1", "F2", "F11", "F13"],
      witness_required: ["earth", "ai", "human"],
      irreversible_actions: ["vault_seal", "external_relay", "git_push"],
    }),
    rubric: RubricSchema.default({
      axes: ["Q", "O", "C", "F"],
      weights: { Q: 0.30, O: 0.15, C: 0.25, F: 0.30 },
      seal_threshold: 0.85,
      sabar_threshold: 0.65,
      hold_threshold: 0.45,
      per_axis_minimum: 0.65,
    }),
    workspace: RealityWorkspaceSchema.optional(),
    polling: PollingSchema.optional(),
    terminal_states: z.array(z.string()).default(["sealed", "void", "expired"]),
    active_states: z
      .array(z.string())
      .default(["pending", "in_progress", "sabar", "human_review"]),
    runner: RunnerSchema,
  })
  .passthrough();

export type RealitySourceConfig = z.infer<typeof RealitySourceConfigSchema>;

/**
 * Detect workflow file flavor by top-level keys.
 * Returns "reality" if ANY Reality Engineering marker is present.
 * Marker keys: reality, runner, rubric, constitutional.
 *
 * Rationale: not every REALITY_SOURCE.md includes every key (some omit
 * constitutional defaults). We treat the presence of the core identity keys
 * (reality OR runner) as the signal.
 */
export function detectWorkflowFlavor(
  config: Record<string, unknown>,
): "reality" | "symphony" {
  const hasRealityMarker =
    "reality" in config || "runner" in config || "rubric" in config;
  const hasSymphonyMarker = "tracker" in config || "codex" in config;
  // If reality markers dominate (or symphony markers absent), treat as reality.
  if (hasRealityMarker && !hasSymphonyMarker) return "reality";
  if (hasRealityMarker && hasSymphonyMarker) {
    // Mixed config — prefer reality (newer schema).
    return "reality";
  }
  return "symphony";
}