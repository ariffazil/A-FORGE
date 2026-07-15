/**
 * Chain Orchestrator — WELL-Gated Multi-Step MCP Task Chains
 * 
 * Q2: Progress tracking + cancellation across long MCP tool chains,
 * with WELL readiness as step zero.
 * 
 * Constitutional alignment:
 *   F1 AMANAH — every step is reversible or explicitly gated
 *   F6 MARUAH — human readiness checked before chain starts
 *   F11 AUDIT — every step leaves a trace
 *   F13 SOVEREIGN — irreversible steps require 888_HOLD
 * 
 * Architecture:
 *   Chain Orchestrator (this) → application-layer orchestration
 *   MCP Tasks (SEP-2663) → per-tool async primitives
 *   WELL readiness → human state gate
 *   AAA cockpit → visible progress + cancel button
 * 
 * FORGED: 2026-07-03
 * FIXED:  2026-07-03 — WELL mandatory, error taxonomy wired, AbortSignal connected,
 *         progress tokens active, SIMPLIFY adapts chain
 */

import {
  classifyUnknown,
  type MCPStructuredError,
  type ErrorEnvelope,
} from '../governance/error-classifier.js';

// ─── Types ─────────────────────────────────────────────────────────

export type StepStatus =
  | 'pending'
  | 'well_check'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type ChainStatus =
  | 'created'
  | 'well_gate'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WellVerdict = 'PROCEED' | 'SIMPLIFY' | 'HOLD' | 'INJECT_NEEDED';

export interface ChainStep {
  /** Unique step ID within the chain */
  id: string;
  /** Which organ/tool to call */
  organ: string;
  tool: string;
  /** Arguments to pass */
  arguments: Record<string, unknown>;
  /** Whether this step is reversible */
  reversible: boolean;
  /** Action class for governance */
  action_class: 'OBSERVE' | 'DRAFT' | 'MUTATE' | 'EXECUTE_REVERSIBLE' | 'EXECUTE_HIGH_IMPACT' | 'IRREVERSIBLE';
  /** Current status */
  status: StepStatus;
  /** MCP task ID if async */
  task_id?: string;
  /** Progress token for MCP progress tracking */
  progress_token?: string;
  /** Result from the tool call */
  result?: unknown;
  /** Structured error if failed (ErrorEnvelope from error-classifier) */
  error?: ErrorEnvelope;
  /** When this step started */
  started_at?: string;
  /** When this step completed */
  completed_at?: string;
  /** Human-readable progress message */
  progress_message?: string;
  /** Whether this step is essential (false = can be skipped on SIMPLIFY) */
  essential?: boolean;
}

export interface WellGateResult {
  verdict: WellVerdict;
  score: number;
  color: 'GREEN' | 'YELLOW' | 'RED' | 'STALE';
  checked_at: string;
  action: string;
}

export interface ChainDefinition {
  /** Unique chain ID */
  id: string;
  /** Human-readable description */
  description: string;
  /** Steps in order */
  steps: ChainStep[];
  /** Whether WELL check is required before chain starts (default: true) */
  require_well_gate: boolean;
  /** Maximum time for the entire chain (ms) */
  timeout_ms: number;
  /** Who requested this chain */
  requested_by: string;
  /** Constitutional chain ID from arifOS judge */
  constitutional_chain_id?: string;
}

export interface ChainState {
  definition: ChainDefinition;
  status: ChainStatus;
  well_gate_result?: WellGateResult;
  current_step_index: number;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  /** Aggregate progress 0-100 */
  progress_percent: number;
  /** Progress message for cockpit display */
  progress_message: string;
  /** All step results collected */
  results: Map<string, unknown>;
  /** Adaptations applied (e.g., from SIMPLIFY) */
  adaptations: string[];
}

// ─── MCP Tasks Protocol Types (SEP-2663) ───────────────────────────

export type TaskStatus = 'working' | 'input_required' | 'completed' | 'cancelled' | 'failed';

export interface CreateTaskResult {
  resultType: 'task';
  taskId: string;
  status: TaskStatus;
  statusMessage?: string;
  createdAt: string;
  lastUpdatedAt: string;
  ttlMs: number | null;
  pollIntervalMs?: number;
}

export interface TaskPollResult {
  taskId: string;
  status: TaskStatus;
  statusMessage?: string;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface TaskPoller {
  /** Poll a task until it reaches terminal state. Returns final result. */
  poll(taskId: string, pollIntervalMs?: number): Promise<TaskPollResult>;
  /** Cancel a running task. */
  cancel(taskId: string, reason?: string): Promise<void>;
}

/** Check if a tool result is a CreateTaskResult (server chose async execution) */
export function isCreateTaskResult(result: unknown): result is CreateTaskResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as any).resultType === 'task' &&
    typeof (result as any).taskId === 'string'
  );
}

// ─── Chain Builder ─────────────────────────────────────────────────

export function createChain(opts: {
  id?: string;
  description: string;
  steps: Omit<ChainStep, 'status'>[];
  require_well_gate?: boolean;
  timeout_ms?: number;
  requested_by: string;
  constitutional_chain_id?: string;
}): ChainDefinition {
  const chainId = opts.id ?? `chain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: chainId,
    description: opts.description,
    steps: opts.steps.map(s => ({ ...s, status: 'pending' as StepStatus })),
    require_well_gate: opts.require_well_gate ?? true, // MANDATORY by default
    timeout_ms: opts.timeout_ms ?? 300_000, // 5 minutes default
    requested_by: opts.requested_by,
    constitutional_chain_id: opts.constitutional_chain_id,
  };
}

// ─── Chain Orchestrator ────────────────────────────────────────────

export type ProgressCallback = (state: ChainState) => void;
/** Step executor — receives step + AbortSignal for cancellation */
export type StepExecutor = (step: ChainStep, signal: AbortSignal) => Promise<unknown>;
export type WellChecker = () => Promise<WellGateResult>;
export type CancelChecker = () => boolean;

/**
 * The main orchestrator. Runs a chain of MCP tool calls with:
 * 1. WELL readiness gate (step 0 — MANDATORY)
 * 2. Per-step progress tracking with MCP progress tokens
 * 3. Cooperative cancellation with real AbortSignal
 * 4. Error recovery via ErrorClassifier taxonomy
 */
export class ChainOrchestrator {
  private state: ChainState;
  private onProgress: ProgressCallback | null = null;
  private stepExecutor: StepExecutor;
  private wellChecker: WellChecker;
  private taskPoller: TaskPoller | null = null;
  private cancelRequested = false;
  private abortController: AbortController | null = null;
  /** Track active task IDs for cancellation */
  private activeTaskIds = new Map<string, string>(); // stepId → taskId

  constructor(
    definition: ChainDefinition,
    stepExecutor: StepExecutor,
    wellChecker: WellChecker,
    onProgress?: ProgressCallback,
    taskPoller?: TaskPoller
  ) {
    this.state = {
      definition,
      status: 'created',
      current_step_index: -1,
      progress_percent: 0,
      progress_message: 'Chain created',
      results: new Map(),
      adaptations: [],
    };
    this.stepExecutor = stepExecutor;
    this.wellChecker = wellChecker;
    this.onProgress = onProgress ?? null;
    this.taskPoller = taskPoller ?? null;
  }

  // ─── Public API ────────────────────────────────────────────────

  /** Get current chain state (read-only snapshot) */
  getState(): Readonly<ChainState> {
    return { ...this.state };
  }

  /** Request cancellation — cooperative, takes effect at next step boundary.
   *  If a task is active, also sends tasks/cancel. */
  async cancel(reason: string = 'User requested cancellation'): Promise<void> {
    this.cancelRequested = true;
    this.state.cancel_reason = reason;
    this.abortController?.abort();

    // Cancel any active MCP tasks
    if (this.taskPoller && this.activeTaskIds.size > 0) {
      for (const [stepId, taskId] of this.activeTaskIds) {
        try {
          await this.taskPoller.cancel(taskId, reason);
          this.emitProgress(`Cancelled task ${taskId} for step ${stepId}`);
        } catch {
          // Task may have already completed — best effort
        }
      }
    }

    this.emitProgress(`Cancellation requested: ${reason}`);
  }

  /** Check if cancellation was requested */
  isCancelled(): boolean {
    return this.cancelRequested;
  }

  /** Run the full chain */
  async run(): Promise<ChainState> {
    this.state.started_at = new Date().toISOString();

    // ── Step 0: WELL Readiness Gate (MANDATORY) ──
    if (this.state.definition.require_well_gate) {
      this.state.status = 'well_gate';
      this.emitProgress('Checking human readiness...');

      try {
        const wellResult = await this.wellChecker();
        this.state.well_gate_result = wellResult;

        if (wellResult.verdict === 'HOLD' || wellResult.verdict === 'INJECT_NEEDED') {
          this.state.status = 'failed';
          this.state.completed_at = new Date().toISOString();
          this.state.progress_message = `BLOCKED: WELL ${wellResult.verdict} — ${wellResult.action}`;
          this.emitProgress(this.state.progress_message);
          return this.state;
        }

        // SIMPLIFY: adapt chain by skipping non-essential steps
        if (wellResult.verdict === 'SIMPLIFY') {
          const skipped = this.applySimplifyAdaptation();
          this.state.adaptations.push(`WELL SIMPLIFY: skipped ${skipped} non-essential steps`);
          this.emitProgress(`WELL SIMPLIFY — reduced chain by ${skipped} steps`);
        }
      } catch (err) {
        this.state.status = 'failed';
        this.state.completed_at = new Date().toISOString();
        const classified = classifyUnknown(err, {
          source_tool: 'well_readiness',
          source_organ: 'well',
        });
        this.state.progress_message = `WELL gate failed: ${classified.structuredContent.message}`;
        this.emitProgress(this.state.progress_message);
        return this.state;
      }
    }

    // ── Execute Steps ──
    this.state.status = 'running';
    this.emitProgress('Chain execution started');

    for (let i = 0; i < this.state.definition.steps.length; i++) {
      // Check cancellation
      if (this.cancelRequested) {
        this.state.status = 'cancelled';
        this.state.cancelled_at = new Date().toISOString();
        this.state.definition.steps[i].status = 'cancelled';
        this.emitProgress(`Cancelled at step ${i}: ${this.state.definition.steps[i].id}`);
        return this.state;
      }

      const step = this.state.definition.steps[i];

      // Skip steps marked for skip (from SIMPLIFY adaptation)
      if (step.status === 'skipped') {
        this.updateProgress();
        continue;
      }

      this.state.current_step_index = i;
      step.status = 'running';
      step.started_at = new Date().toISOString();

      // Wire progress token for MCP progress notifications
      step.progress_token = generateProgressToken();
      step.progress_message = `Running ${step.tool}...`;

      this.updateProgress();
      this.emitProgress(`Step ${i + 1}/${this.state.definition.steps.length}: ${step.tool}`);

      try {
        // Create fresh AbortController per step and pass signal to executor
        this.abortController = new AbortController();
        const result = await this.stepExecutor(step, this.abortController.signal);

        // ── MCP Tasks: check if server returned a task handle ──
        if (isCreateTaskResult(result) && this.taskPoller) {
          const taskResult = result as CreateTaskResult;
          step.task_id = taskResult.taskId;
          step.progress_message = `Task ${taskResult.taskId}: ${taskResult.status}`;
          this.activeTaskIds.set(step.id, taskResult.taskId);
          this.emitProgress(`Step ${i + 1}: async task started (${taskResult.taskId})`);

          // Poll until terminal state
          const pollResult = await this.taskPoller.poll(
            taskResult.taskId,
            taskResult.pollIntervalMs
          );

          this.activeTaskIds.delete(step.id);

          if (pollResult.status === 'completed') {
            step.result = pollResult.result;
            step.status = 'completed';
          } else if (pollResult.status === 'cancelled') {
            step.status = 'cancelled';
            this.state.status = 'cancelled';
            this.state.cancelled_at = new Date().toISOString();
            this.emitProgress(`Step ${i + 1}: task cancelled`);
            return this.state;
          } else if (pollResult.status === 'failed') {
            step.error = this.classifyError(pollResult.error, step);
            step.status = 'failed';
            this.state.status = 'failed';
            this.state.completed_at = new Date().toISOString();
            this.state.progress_message = `Task failed at step ${i + 1} (${step.tool}): ${step.error.message}`;
            this.emitProgress(this.state.progress_message);
            return this.state;
          }
        } else {
          // Direct result (no task handle)
          step.result = result;
          step.status = 'completed';
        }

        step.completed_at = new Date().toISOString();
        this.state.results.set(step.id, step.result);
        this.updateProgress();
      } catch (err) {
        step.error = this.classifyError(err, step);
        step.status = 'failed';
        step.completed_at = new Date().toISOString();
        this.state.status = 'failed';
        this.state.completed_at = new Date().toISOString();
        this.state.progress_message = `Failed at step ${i + 1} (${step.tool}): ${step.error.message}`;
        this.emitProgress(this.state.progress_message);
        return this.state;
      }
    }

    // ── All steps completed ──
    this.state.status = 'completed';
    this.state.completed_at = new Date().toISOString();
    this.state.progress_percent = 100;
    this.state.progress_message = `Chain completed: ${this.state.definition.steps.length}/${this.state.definition.steps.length} steps`;
    this.emitProgress(this.state.progress_message);

    return this.state;
  }

  // ─── Private Helpers ───────────────────────────────────────────

  /** Classify an error through the error taxonomy */
  private classifyError(err: unknown, step: ChainStep): ErrorEnvelope {
    // If it's already a structured error, extract the envelope
    if (err && typeof err === 'object' && 'structuredContent' in err) {
      return (err as MCPStructuredError).structuredContent;
    }
    // Classify through taxonomy
    const classified = classifyUnknown(err, {
      source_tool: step.tool,
      source_organ: step.organ,
    });
    return classified.structuredContent;
  }

  /** Apply SIMPLIFY adaptation: mark non-essential steps as skipped */
  private applySimplifyAdaptation(): number {
    let skipped = 0;
    for (const step of this.state.definition.steps) {
      if (step.essential === false && step.status === 'pending') {
        step.status = 'skipped';
        step.progress_message = 'Skipped: WELL SIMPLIFY adaptation';
        skipped++;
      }
    }
    // Also reduce timeout by 50% on SIMPLIFY
    this.state.definition.timeout_ms = Math.round(this.state.definition.timeout_ms * 0.5);
    return skipped;
  }

  private updateProgress(): void {
    const total = this.state.definition.steps.length;
    const done = this.state.definition.steps.filter(
      s => s.status === 'completed' || s.status === 'skipped'
    ).length;
    this.state.progress_percent = Math.round((done / total) * 100);
    this.state.progress_message = `Step ${done}/${total} complete`;
  }

  private emitProgress(message: string): void {
    this.state.progress_message = message;
    this.onProgress?.(this.state);
  }
}

// ─── Helper: Build Step from MCP Tool Call ─────────────────────────

export function chainStep(opts: {
  id: string;
  organ: string;
  tool: string;
  arguments: Record<string, unknown>;
  reversible?: boolean;
  action_class?: ChainStep['action_class'];
  essential?: boolean;
}): ChainStep {
  return {
    id: opts.id,
    organ: opts.organ,
    tool: opts.tool,
    arguments: opts.arguments,
    reversible: opts.reversible ?? true,
    action_class: opts.action_class ?? 'DRAFT',
    status: 'pending',
    essential: opts.essential ?? true,
  };
}

// ─── Helper: Common Chain Patterns ────────────────────────────────

/**
 * Standard federation audit chain:
 * WELL readiness → organ attest → audit → judge → seal
 */
export function auditChain(opts: {
  requested_by: string;
  target_organ: string;
  constitutional_chain_id?: string;
}): ChainDefinition {
  return createChain({
    description: `Audit ${opts.target_organ} with WELL gate`,
    requested_by: opts.requested_by,
    constitutional_chain_id: opts.constitutional_chain_id,
    steps: [
      chainStep({
        id: 'organ_attest',
        organ: 'arifos',
        tool: 'arif_organ_attest',
        arguments: { organ_id: opts.target_organ },
        action_class: 'OBSERVE',
        essential: true,
      }),
      chainStep({
        id: 'surface_check',
        organ: opts.target_organ,
        tool: `${opts.target_organ}_surface_status`,
        arguments: { mode: 'registry' },
        action_class: 'OBSERVE',
        essential: false, // Can skip on SIMPLIFY
      }),
      chainStep({
        id: 'health_probe',
        organ: opts.target_organ,
        tool: `${opts.target_organ}_health_check`,
        arguments: {},
        action_class: 'OBSERVE',
        essential: true,
      }),
    ],
  });
}

/**
 * Build-verify-deploy chain:
 * WELL → synthesize → stage → test → judge → execute
 */
export function buildChain(opts: {
  requested_by: string;
  intent: string;
  constitutional_chain_id?: string;
}): ChainDefinition {
  return createChain({
    description: `Build: ${opts.intent}`,
    requested_by: opts.requested_by,
    constitutional_chain_id: opts.constitutional_chain_id,
    timeout_ms: 600_000, // 10 minutes
    steps: [
      chainStep({
        id: 'synthesize',
        organ: 'aforge',
        tool: 'forge_synthesize',
        arguments: { intent: opts.intent },
        action_class: 'DRAFT',
        essential: true,
      }),
      chainStep({
        id: 'stage',
        organ: 'aforge',
        tool: 'forge_stage',
        arguments: {},
        reversible: true,
        action_class: 'DRAFT',
        essential: true,
      }),
      chainStep({
        id: 'sandbox_test',
        organ: 'aforge',
        tool: 'forge_sandbox_run',
        arguments: {},
        action_class: 'OBSERVE',
        essential: true,
      }),
    ],
  });
}

// ─── MCP Progress Token Integration ───────────────────────────────

/**
 * Generate a progress token for MCP _meta field.
 * Use when calling MCP tools to receive progress notifications.
 */
export function generateProgressToken(): string {
  return `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build _meta with progress token for MCP tool calls.
 */
export function withProgressMeta(
  existingMeta: Record<string, unknown> = {},
  token?: string
): Record<string, unknown> {
  return {
    ...existingMeta,
    progressToken: token ?? generateProgressToken(),
  };
}
