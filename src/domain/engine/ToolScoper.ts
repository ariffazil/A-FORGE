/**
 * ToolScoper — Budget-aware tool surface scoping module.
 *
 * Implements the Vercel/OpenAI SDK principle: "Remove 80% of tools, get better results."
 * Sits between forge_plan and tool execution. Scopes the available tool surface based on:
 *   1. Action class (OBSERVE → only read tools, MUTATE → only mutation tools, etc.)
 *   2. Current budget status (budget exceeding 80% restricts expensive tools)
 *   3. Current pipeline stage (111_OBSERVE, 333_REASON, 555_ROUTE, 777_EXECUTE)
 *
 * PLAN: PLAN-2026-06-22-P0-ToolScoper
 * @module
 */

import type { BudgetStatus } from "../types/agent.js";
import type { BudgetManager } from "./BudgetManager.js";

// ─── Public Types ───────────────────────────────────────────────────────

/**
 * Canonical action classes for A-FORGE's 8-class action taxonomy.
 * Mirrors the forge_plan classification schema used in MCP gates.
 */
export type ActionClass =
  | "OBSERVE"
  | "READ"
  | "THINK"
  | "DRAFT"
  | "MUTATE"
  | "IRREVERSIBLE";

/**
 * Allowed pipeline stages in the arifOS metabolic cycle.
 * Maps to the reflex loop (000→111→222→...→999).
 */
export type PipelineStage =
  | "000_CLARIFY"
  | "111_OBSERVE"
  | "222_EVIDENCE"
  | "333_REASON"
  | "444_COMPOSE"
  | "555_ROUTE"
  | "666_HEART"
  | "777_EXECUTE"
  | "888_JUDGE"
  | "999_SEAL";

/**
 * Result of a scope operation — the filtered tool surface and its justification.
 */
export interface ScopedToolSurface {
  /** Tool names (or glob patterns) that are allowed under this scope. */
  allowedTools: string[];
  /** Tool names explicitly excluded — present in the registry but disallowed. */
  excludedTools: string[];
  /** Human-readable explanation of why this scope was applied. */
  reason: string;
  /** Snapshot of budget status at scope time. */
  budgetStatus: string;
  /** Whether the budget triggered a downshift (expensive tools removed). */
  budgetDownshifted: boolean;
}

// ─── Default Tool-to-Action Maps ───────────────────────────────────────

/**
 * Mapping from ActionClass to allowed tool name/glob patterns.
 *
 * Wildcard patterns (e.g. `geox_*`) match any tool whose name starts with
 * the given prefix. Exact matches take precedence.
 */
const DEFAULT_ACTION_TOOL_MAP: Record<ActionClass, string[]> = {
  OBSERVE: [
    "arif_ping",
    "arif_observe",
    "arif_measure",
    "arif_memory",
    "forge_query",
    "geox_*",
    "wealth_*",
    "well_*",
  ],
  READ: [
    "arif_observe",
    "arif_measure",
    "arif_memory",
    "forge_query",
    "geox_basin_profile",
    "geox_system_registry_status",
    "geox_header_inspect",
    "wealth_system_registry_status",
    "wealth_vault_query",
    "well_trace_lineage",
  ],
  THINK: [
    "arif_think",
    "arif_judge",
    "arif_critique",
    "geox_evidence_reason",
    "wealth_wisdom_evaluate",
    "wealth_omni_wisdom",
    "well_assess_metabolism",
    "well_assess_homeostasis",
  ],
  DRAFT: [
    "arif_compose",
    "forge_dry_run",
    "forge_plan",
    "arif_critique",
    "arif_seal",
  ],
  MUTATE: [
    "arif_seal",
    "forge_execute",
    "forge_approve",
    "arif_forge",
    "arif_memory",
    "write",
    "edit",
    "forge_remember",
  ],
  IRREVERSIBLE: [
    "arif_seal",
    "forge_execute",
    "arif_forge",
  ],
};

/**
 * Expensive tools that get stripped when the budget downshift is active.
 * These are typically LLM-heavy or API-costly tools.
 */
const EXPENSIVE_TOOLS: readonly string[] = [
  "arif_judge",
  "arif_think",
  "geox_evidence_reason",
  "wealth_wisdom_evaluate",
  "wealth_omni_wisdom",
  "geox_seismic_compute",
  "geox_prospect_evaluate",
  "arif_explore",
];

/**
 * Pipeline-specific tool narrowing.
 * When a stage is active, tools not in its allowed set are excluded
 * unless the action class already permits them.
 */
const PIPELINE_STAGE_TOOLS: Partial<Record<PipelineStage, string[]>> = {
  "000_CLARIFY": ["arif_ping", "arif_observe", "arif_think"],
  "111_OBSERVE": ["arif_ping", "arif_observe", "arif_measure", "arif_memory", "forge_query"],
  "222_EVIDENCE": ["arif_fetch", "geox_evidence_reason", "geox_data_qc_bundle", "arif_memory"],
  "333_REASON": ["arif_think", "arif_judge", "geox_evidence_reason", "wealth_wisdom_evaluate"],
  "444_COMPOSE": ["arif_compose"],
  "555_ROUTE": ["arif_kernel_route", "arif_gateway_connect"],
  "666_HEART": ["arif_critique", "well_guard_dignity"],
  "777_EXECUTE": ["forge_execute", "arif_forge", "forge_approve"],
  "888_JUDGE": ["arif_judge", "arif_seal"],
  "999_SEAL": ["arif_seal"],
};

// ─── Stage-to-Action-Class Alignment ───────────────────────────────────

/**
 * Default mapping from pipeline stage to the natural action class.
 * Used as a fallback when an explicit action class isn't provided.
 */
const STAGE_TO_ACTION: Record<PipelineStage, ActionClass> = {
  "000_CLARIFY": "OBSERVE",
  "111_OBSERVE": "OBSERVE",
  "222_EVIDENCE": "READ",
  "333_REASON": "THINK",
  "444_COMPOSE": "DRAFT",
  "555_ROUTE": "READ",
  "666_HEART": "THINK",
  "777_EXECUTE": "MUTATE",
  "888_JUDGE": "THINK",
  "999_SEAL": "IRREVERSIBLE",
};

// ─── Pattern Matching ──────────────────────────────────────────────────

/**
 * Check whether a tool name matches a pattern.
 * Patterns can be exact (`arif_ping`) or wildcard (`geox_*`).
 */
function matchesToolPattern(toolName: string, pattern: string): boolean {
  if (pattern.endsWith("/*")) {
    // Namespace wildcard: e.g. "geox/*" → split on / for namespace tools
    const ns = pattern.slice(0, -2);
    return toolName.startsWith(ns) && (toolName.length === ns.length || toolName[ns.length] === "/");
  }
  if (pattern.endsWith("_*")) {
    // Prefix wildcard: e.g. "geox_*" → matches any geox_<suffix>
    const prefix = pattern.slice(0, -2);
    return toolName.startsWith(prefix);
  }
  return toolName === pattern;
}

/**
 * Filter a list of real tool names against a set of patterns.
 */
function filterByPatterns(
  availableToolNames: string[],
  patterns: string[],
): string[] {
  return patterns.flatMap((pattern) => {
    const matched = availableToolNames.filter((t) => matchesToolPattern(t, pattern));
    return matched.length > 0 ? matched : [pattern];
  });
}

/**
 * Extract the subset of patterns that matched no available tool.
 * These are "known intent" tools that don't exist in the registry yet.
 */
function findUnmatchedPatterns(
  availableToolNames: string[],
  patterns: string[],
): string[] {
  return patterns.filter((p) => !p.endsWith("_*") && !p.endsWith("/*") &&
    !availableToolNames.some((t) => matchesToolPattern(t, p)));
}

// ─── ToolScoper Class ──────────────────────────────────────────────────

/**
 * Scopes the available tool surface based on action class, budget status,
 * and pipeline stage.
 *
 * ## Usage
 * ```typescript
 * const scoper = new ToolScoper(budgetManager);
 * const surface = scoper.scope("MUTATE", "777_EXECUTE", budgetStatus);
 * // surface.allowedTools → limited to mutation tools
 * ```
 *
 * ## Design Principle
 * "Remove 80% of tools, get better results." By narrowing the tool surface
 * to only what's needed for the current action class and stage, the LLM
 * spends less cognitive load on tool selection and more on the actual task.
 */
export class ToolScoper {
  /**
   * @param budgetManager - Optional BudgetManager for downshift detection.
   * @param actionToolMap - Optional override for the default action→tool mapping.
   * @param expensiveTools - Optional override for the expensive-tool list.
   */
  constructor(
    private readonly budgetManager?: BudgetManager,
    private readonly actionToolMap?: Partial<Record<ActionClass, string[]>>,
    private readonly expensiveTools?: readonly string[],
  ) {}

  /**
   * Scope the tool surface for a given action class, pipeline stage, and budget.
   *
   * Applies three narrowing passes in order:
   *   1. Action class filter — restrict to tools relevant to the action
   *   2. Pipeline stage filter — further restrict to stage-relevant tools
   *   3. Budget downshift — strip expensive tools if budget > 80%
   *
   * @param actionClass - The action class to scope for.
   * @param stage - The current pipeline stage.
   * @param budgetStatus - Optional explicit budget status; if absent, queried
   *                       from the BudgetManager (if available).
   * @returns The scoped tool surface.
   */
  scope(
    actionClass: ActionClass,
    stage: PipelineStage,
    budgetStatus?: BudgetStatus,
  ): ScopedToolSurface {
    // ── Resolve budget status ────────────────────────────────────────
    const resolvedBudget = budgetStatus ?? this.budgetManager?.getStatus();
    const shouldDownshift = resolvedBudget?.shouldDownshift ?? false;
    const budgetLabel = resolvedBudget
      ? `${(resolvedBudget.usagePercent * 100).toFixed(1)}% used, $${resolvedBudget.totalCostUsd} spent, ${resolvedBudget.turnsRemaining} turns remaining`
      : "no budget tracking";

    // ── Resolve available patterns ────────────────────────────────────
    const actionPatterns = this.resolveActionPatterns(actionClass);
    const stagePatterns = PIPELINE_STAGE_TOOLS[stage] ?? [];

    // ── Pass 1: Action class filter ──────────────────────────────────
    // The action class is the primary gate — what are you allowed to do?
    let allowedPatterns = [...actionPatterns];

    // ── Pass 2: Pipeline stage filter (narrows further) ───────────────
    // If the stage has specific tool constraints, intersect them.
    if (stagePatterns.length > 0) {
      // Stage constraint is a narrowing filter — tools must be in BOTH
      // action class patterns AND stage tools to pass.
      const intersection = actionPatterns.filter((p) =>
        stagePatterns.some((sp) =>
          sp === p || sp.endsWith("_*") && p.startsWith(sp.slice(0, -2)) ||
          p.endsWith("_*") && sp.startsWith(p.slice(0, -2)),
        ),
      );

      // For read-only stages (111_OBSERVE, 555_ROUTE) where the stage
      // definition lists concrete tools, use the stage tools as-is when
      // the intersection is empty — this preserves "sense_observe" etc.
      // even when the action class uses wildcards like "geox_*".
      if (intersection.length > 0) {
        allowedPatterns = intersection;
      } else {
        // Stage patterns augment rather than replace action class patterns
        // when the action class is broad (e.g. OBSERVE with geox_* wildcards).
        allowedPatterns = [...new Set([...actionPatterns, ...stagePatterns])];
      }
    }

    // ── Pass 3: Budget downshift ────────────────────────────────────
    // When budget exceeds 80%, strip expensive tools.
    let excludedPatterns: string[] = [];
    if (shouldDownshift) {
      const expensive = this.expensiveTools ?? EXPENSIVE_TOOLS;
      excludedPatterns = allowedPatterns.filter((p) =>
        expensive.some((ep) => matchesToolPattern(ep, p) || matchesToolPattern(p, ep))
      );
      allowedPatterns = allowedPatterns.filter(
        (p) => !excludedPatterns.includes(p),
      );
    }

    // ── Build result ──────────────────────────────────────────────────
    return {
      allowedTools: [...new Set(allowedPatterns)],
      excludedTools: [...new Set(excludedPatterns)],
      reason: this.buildReason(actionClass, stage, shouldDownshift, allowedPatterns.length),
      budgetStatus: budgetLabel,
      budgetDownshifted: shouldDownshift,
    };
  }

  /**
   * Scope with explicit registry awareness. Takes a list of real tool names
   * from the registry and resolves wildcards against them.
   *
   * @param actionClass - The action class to scope for.
   * @param stage - The current pipeline stage.
   * @param registryToolNames - All tool names currently registered.
   * @param budgetStatus - Optional budget status.
   * @returns The scoped tool surface with concrete tool names.
   */
  scopeRegistry(
    actionClass: ActionClass,
    stage: PipelineStage,
    registryToolNames: string[],
    budgetStatus?: BudgetStatus,
  ): ScopedToolSurface {
    const surface = this.scope(actionClass, stage, budgetStatus);

    // Resolve wildcards against the real registry
    const concreteAllowed = filterByPatterns(registryToolNames, surface.allowedTools);
    const concreteExcluded = filterByPatterns(registryToolNames, surface.excludedTools);
    const unmatched = findUnmatchedPatterns(registryToolNames, surface.allowedTools);

    return {
      allowedTools: [...new Set(concreteAllowed)],
      excludedTools: [...new Set(concreteExcluded)],
      reason: surface.reason + (unmatched.length > 0
        ? ` (${unmatched.length} intent-only tools not in registry)`
        : ""),
      budgetStatus: surface.budgetStatus,
      budgetDownshifted: surface.budgetDownshifted,
    };
  }

  /**
   * Resolve the tool patterns for a given action class.
   * Merges the default map with any user-provided overrides.
   */
  private resolveActionPatterns(actionClass: ActionClass): string[] {
    const defaults = DEFAULT_ACTION_TOOL_MAP[actionClass];
    const overrides = this.actionToolMap?.[actionClass];
    if (!overrides || overrides.length === 0) {
      return defaults;
    }
    // Merge overrides: overrides replace defaults for the same class
    return overrides;
  }

  /**
   * Build a human-readable reason string for the scope decision.
   */
  private buildReason(
    actionClass: ActionClass,
    stage: PipelineStage,
    downshifted: boolean,
    toolCount: number,
  ): string {
    const parts: string[] = [
      `Action class "${actionClass}" restricts to ${toolCount} tool pattern(s)`,
    ];
    const stageLabel = stage.replace(/_/g, " ").toLowerCase();
    parts.push(`pipeline stage "${stageLabel}"`);
    if (downshifted) {
      parts.push("budget downshift active — expensive tools excluded");
    }
    return parts.join("; ");
  }
}

// ─── Factory & Helpers ──────────────────────────────────────────────────

let defaultScoper: ToolScoper | undefined;

/**
 * Get the default singleton ToolScoper instance.
 *
 * Optionally accepts a BudgetManager to wire up budget-aware scoping.
 * The singleton is lazily created on first call and cached.
 *
 * @param budgetManager - Optional BudgetManager instance.
 * @returns A ToolScoper instance.
 */
export function getToolScoper(budgetManager?: BudgetManager): ToolScoper {
  if (!defaultScoper) {
    defaultScoper = new ToolScoper(budgetManager);
  }
  return defaultScoper;
}

/**
 * Reset the singleton scoper (primarily for testing).
 * After calling this, the next `getToolScoper()` call creates a fresh instance.
 */
export function resetToolScoper(): void {
  defaultScoper = undefined;
}

/**
 * Classify a forge_plan action into a canonical ActionClass.
 *
 * Maps the forge_plan classification output to the 6-class action taxonomy.
 * Supports both string and object payloads containing `actionClass` or `action`.
 *
 * ## Default classifications
 * - `"observe"`, `"observe_read"`, `"read_only"` → `"OBSERVE"`
 * - `"read"`, `"inspect"`, `"query"` → `"READ"`
 * - `"think"`, `"reason"`, `"plan"`, `"evaluate"` → `"THINK"`
 * - `"draft"`, `"compose"`, `"preview"` → `"DRAFT"`
 * - `"mutate"`, `"write"`, `"execute"`, `"build"`, `"deploy"` → `"MUTATE"`
 * - `"irreversible"`, `"seal"`, `"destroy"`, `"delete"` → `"IRREVERSIBLE"`
 *
 * @param actionClass - The classification string from forge_plan.
 * @param args - Optional arguments payload (may contain `actionClass` or `action`).
 * @returns The resolved ActionClass.
 * @default "OBSERVE" when no classification can be determined.
 */
export function classifyAction(
  actionClass: string,
  args?: Record<string, unknown>,
): ActionClass {
  // Resolve the raw classification string
  const raw = (args?.actionClass as string) ?? actionClass ?? "";

  const normalized = raw.toLowerCase().trim();

  if (normalized.includes("irreversible") || normalized === "seal" || normalized === "destroy" || normalized === "delete") {
    return "IRREVERSIBLE";
  }
  if (normalized.includes("mutate") || normalized === "write" || normalized === "execute" || normalized === "build" || normalized === "deploy") {
    return "MUTATE";
  }
  if (normalized.includes("draft") || normalized === "compose" || normalized === "preview") {
    return "DRAFT";
  }
  if (normalized.includes("think") || normalized === "reason" || normalized === "plan" || normalized === "evaluate") {
    return "THINK";
  }
  if (normalized === "read" || normalized === "inspect" || normalized === "query") {
    return "READ";
  }
  if (normalized.includes("observe") || normalized === "read_only") {
    return "OBSERVE";
  }

  // Default to OBSERVE for unrecognized classifications (safe default)
  return "OBSERVE";
}

/**
 * Infer the appropriate ActionClass from a pipeline stage.
 * Useful when no explicit action class was provided but the stage is known.
 *
 * @param stage - The current pipeline stage.
 * @returns The inferred action class for the given stage.
 */
export function stageToActionClass(stage: PipelineStage): ActionClass {
  return STAGE_TO_ACTION[stage] ?? "OBSERVE";
}
