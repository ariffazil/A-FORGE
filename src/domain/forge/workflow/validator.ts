/**
 * arifOS Workflow Validator — Main Validator
 *
 * Glues parser + schema + renderer into a single entrypoint.
 * Supports both Symphony WORKFLOW.md (port) and arifOS REALITY_SOURCE.md (extension).
 *
 * Dynamic reload semantics (Symphony SPEC §6.2):
 *   - On change, MUST re-read and re-apply workflow config and prompt template
 *   - Reloaded config applies to future dispatch/retry/hook/agent-launch decisions
 *   - Invalid reloads MUST NOT crash the service; emit operator-visible error
 */

import {
  SymphonyWorkflowConfigSchema,
  RealitySourceConfigSchema,
  detectWorkflowFlavor,
  type SymphonyWorkflowConfig,
  type RealitySourceConfig,
} from "./schema.js";
import { parseWorkflowFile, loadWorkflowFile, type ParsedWorkflow } from "./parser.js";
import { renderTemplate, type TemplateContext } from "./renderer.js";
import {
  WorkflowError,
  WorkflowParseError,
  RealitySourceValidationError,
  type WorkflowErrorClass,
} from "./errors.js";

export type WorkflowFlavor = "symphony" | "reality";

export interface ValidatedWorkflow<S extends WorkflowFlavor = WorkflowFlavor> {
  flavor: S;
  filePath: string | null;
  rawConfig: Record<string, unknown>;
  config: S extends "reality" ? RealitySourceConfig : SymphonyWorkflowConfig;
  promptTemplate: string;
  /** SHA256 of source content for change detection (SPEC §6.2 dynamic reload). */
  contentHash: string;
}

/**
 * Validate a parsed workflow against the appropriate schema.
 * Routes to RealitySourceConfigSchema if the flavor is "reality", else SymphonyWorkflowConfigSchema.
 */
export function validateParsedWorkflow(
  parsed: ParsedWorkflow,
  filePath: string | null,
): ValidatedWorkflow {
  const flavor: WorkflowFlavor = detectWorkflowFlavor(parsed.config);

  if (flavor === "reality") {
    const result = RealitySourceConfigSchema.safeParse(parsed.config);
    if (!result.success) {
      const missing = result.error.issues
        .filter((i) => i.code === "invalid_type")
        .map((i) => i.path.join("."));
      throw new RealitySourceValidationError(missing, filePath);
    }
    return {
      flavor: "reality",
      filePath,
      rawConfig: parsed.config,
      config: result.data as RealitySourceConfig,
      promptTemplate: parsed.promptTemplate,
      contentHash: hashContent(JSON.stringify(parsed.config) + parsed.promptTemplate),
    };
  }

  const result = SymphonyWorkflowConfigSchema.safeParse(parsed.config);
  if (!result.success) {
    throw new WorkflowParseError(
      filePath,
      result.error,
      "Symphony WORKFLOW.md schema validation failed.",
    );
  }
  return {
    flavor: "symphony",
    filePath,
    rawConfig: parsed.config,
    config: result.data as SymphonyWorkflowConfig,
    promptTemplate: parsed.promptTemplate,
    contentHash: hashContent(JSON.stringify(parsed.config) + parsed.promptTemplate),
  };
}

/**
 * Load, parse, and validate a workflow file from disk in one call.
 */
export async function validateWorkflowFile(
  filePath: string,
): Promise<ValidatedWorkflow> {
  const parsed = await loadWorkflowFile(filePath);
  return validateParsedWorkflow(parsed, filePath);
}

/**
 * Validate a workflow from raw string content (useful for tests).
 */
export function validateWorkflowString(
  content: string,
  filePath: string | null = null,
): ValidatedWorkflow {
  const parsed = parseWorkflowFile(content, filePath);
  return validateParsedWorkflow(parsed, filePath);
}

/**
 * Render a validated workflow's prompt template against a context.
 * Unknown variables fail loudly (Symphony SPEC §5.4 contract).
 */
export function renderWorkflowPrompt(
  workflow: ValidatedWorkflow,
  context: TemplateContext,
): string {
  return renderTemplate(workflow.promptTemplate, context, workflow.filePath);
}

/**
 * Dispatch preflight validation per Symphony SPEC §6.3.
 * Throws WorkflowError with operator-visible class if validation fails.
 */
export function dispatchPreflight(workflow: ValidatedWorkflow): void {
  if (workflow.flavor === "symphony") {
    const cfg = workflow.config as SymphonyWorkflowConfig;
    if (!cfg.tracker?.kind) {
      throw new WorkflowError(
        "workflow_parse_error" as WorkflowErrorClass,
        "tracker.kind is required for dispatch",
        { filePath: workflow.filePath, hint: "Set `tracker.kind: linear` (only supported value)." },
      );
    }
    if (!cfg.codex?.command) {
      throw new WorkflowError(
        "workflow_parse_error" as WorkflowErrorClass,
        "codex.command is required for dispatch",
        { filePath: workflow.filePath, hint: "Set `codex.command: codex app-server`." },
      );
    }
  } else {
    const cfg = workflow.config as RealitySourceConfig;
    if (!cfg.runner?.command) {
      throw new WorkflowError(
        "workflow_parse_error" as WorkflowErrorClass,
        "runner.command is required for Reality Engineering dispatch",
        { filePath: workflow.filePath, hint: "Set `runner.command: arifos-runner invoke 333-AGI`." },
      );
    }
    if (!cfg.reality?.primary_stream) {
      throw new WorkflowError(
        "workflow_parse_error" as WorkflowErrorClass,
        "reality.primary_stream is required for Reality Engineering dispatch",
        { filePath: workflow.filePath, hint: "Set `reality.primary_stream: geox|wealth|well|multi`." },
      );
    }
  }
}

function hashContent(s: string): string {
  // Lightweight FNV-1a hash — sufficient for change detection, not crypto.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}