/**
 * arifOS Workflow Validator — Error Classes
 *
 * Port of OpenAI Symphony SPEC §5.5 error surface to TypeScript.
 * Source: https://github.com/openai/symphony/blob/main/SPEC.md
 * License: Apache 2.0 (Symphony) → arifOS derivative, attribution preserved.
 *
 * Error classes (language-agnostic, ported verbatim):
 *   - missing_workflow_file
 *   - workflow_parse_error
 *   - workflow_front_matter_not_a_map
 *   - template_parse_error (during prompt rendering)
 *   - template_render_error (unknown variable/filter, invalid interpolation)
 *
 * Extension error (arifOS Reality Engineering):
 *   - reality_source_validation_error
 */

export type WorkflowErrorClass =
  | "missing_workflow_file"
  | "workflow_parse_error"
  | "workflow_front_matter_not_a_map"
  | "template_parse_error"
  | "template_render_error"
  | "reality_source_validation_error";

export class WorkflowError extends Error {
  public readonly errorClass: WorkflowErrorClass;
  public readonly filePath: string | null;
  public readonly hint: string | null;

  constructor(
    errorClass: WorkflowErrorClass,
    message: string,
    options: { filePath?: string | null; hint?: string | null; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : {});
    this.name = "WorkflowError";
    this.errorClass = errorClass;
    this.filePath = options.filePath ?? null;
    this.hint = options.hint ?? null;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      errorClass: this.errorClass,
      message: this.message,
      filePath: this.filePath,
      hint: this.hint,
    };
  }
}

export class MissingWorkflowFileError extends WorkflowError {
  constructor(filePath: string | null) {
    super(
      "missing_workflow_file",
      `Workflow file not found: ${filePath ?? "(unspecified)"}`,
      {
        filePath,
        hint: "Create WORKFLOW.md in the repo root or pass --workflow <path> explicitly.",
      },
    );
    this.name = "MissingWorkflowFileError";
  }
}

export class WorkflowParseError extends WorkflowError {
  constructor(filePath: string | null, cause: unknown, hint?: string | null) {
    super(
      "workflow_parse_error",
      `Failed to parse workflow file: ${cause instanceof Error ? cause.message : String(cause)}`,
      { filePath, cause, hint: hint ?? "Check YAML front matter syntax and Markdown body delimiters." },
    );
    this.name = "WorkflowParseError";
  }
}

export class WorkflowFrontMatterNotAMapError extends WorkflowError {
  constructor(filePath: string | null, actualType: string) {
    super(
      "workflow_front_matter_not_a_map",
      `YAML front matter must decode to a map/object, got: ${actualType}`,
      {
        filePath,
        hint: "Ensure front matter starts with `---` and contains key: value pairs.",
      },
    );
    this.name = "WorkflowFrontMatterNotAMapError";
  }
}

export class TemplateParseError extends WorkflowError {
  constructor(message: string, filePath: string | null, cause?: unknown) {
    super("template_parse_error", message, { filePath, cause });
    this.name = "TemplateParseError";
  }
}

export class TemplateRenderError extends WorkflowError {
  constructor(message: string, filePath: string | null, cause?: unknown) {
    super("template_render_error", message, { filePath, cause });
    this.name = "TemplateRenderError";
  }
}

/**
 * arifOS Reality Engineering extension.
 * Emitted when REALITY_SOURCE.md fails Reality Engineering schema validation.
 */
export class RealitySourceValidationError extends WorkflowError {
  constructor(missing: string[], filePath: string | null) {
    super(
      "reality_source_validation_error",
      `REALITY_SOURCE.md missing required keys: ${missing.join(", ")}`,
      {
        filePath,
        hint: "Required top-level keys for Reality Engineering: reality, streams, agent, constitutional, rubric, workspace, polling, runner.",
      },
    );
    this.name = "RealitySourceValidationError";
  }
}