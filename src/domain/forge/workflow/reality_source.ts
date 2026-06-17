/**
 * arifOS Workflow Validator — RealitySource Convenience Helpers
 *
 * Thin wrapper for the most common Reality Engineering entrypoint.
 * For Symphony WORKFLOW.md (the port), use the general validator.
 */

import { validateParsedWorkflow, validateWorkflowFile, validateWorkflowString, type ValidatedWorkflow } from "./validator.js";

export interface RealitySourceValidation extends ValidatedWorkflow<"reality"> {
  flavor: "reality";
  config: import("./schema.js").RealitySourceConfig;
}

/**
 * Type guard: true if the workflow is a REALITY_SOURCE.md (Reality Engineering flavor).
 */
export function isRealitySource(
  workflow: ValidatedWorkflow,
): workflow is ValidatedWorkflow<"reality"> {
  return workflow.flavor === "reality";
}

/**
 * Validate from string and assert Reality flavor.
 * Throws if the file is a Symphony WORKFLOW.md (not a Reality Engineering source).
 */
export function validateRealitySourceString(
  content: string,
  filePath: string | null = null,
): RealitySourceValidation {
  const validated = validateWorkflowString(content, filePath);
  if (validated.flavor !== "reality") {
    throw new Error(
      `Expected REALITY_SOURCE.md (Reality Engineering flavor), got Symphony WORKFLOW.md flavor. ` +
      `Add the required top-level keys: reality, streams, constitutional, rubric, runner.`,
    );
  }
  return validated as RealitySourceValidation;
}

/**
 * Validate from file path and assert Reality flavor.
 */
export async function validateRealitySourceFile(
  filePath: string,
): Promise<RealitySourceValidation> {
  const validated = await validateWorkflowFile(filePath);
  if (validated.flavor !== "reality") {
    throw new Error(
      `Expected REALITY_SOURCE.md (Reality Engineering flavor), got Symphony WORKFLOW.md flavor at ${filePath}.`,
    );
  }
  return validated as RealitySourceValidation;
}