/**
 * arifOS Workflow Validator — Public API
 *
 * Exports for use across A-FORGE and downstream organs.
 */

export {
  WorkflowError,
  MissingWorkflowFileError,
  WorkflowParseError,
  WorkflowFrontMatterNotAMapError,
  TemplateParseError,
  TemplateRenderError,
  RealitySourceValidationError,
  type WorkflowErrorClass,
} from "./errors.js";

export {
  SymphonyWorkflowConfigSchema,
  RealitySourceConfigSchema,
  detectWorkflowFlavor,
  type SymphonyWorkflowConfig,
  type RealitySourceConfig,
} from "./schema.js";

export {
  parseWorkflowFile,
  loadWorkflowFile,
  type ParsedWorkflow,
} from "./parser.js";

export {
  renderTemplate,
  type TemplateContext,
} from "./renderer.js";

export {
  validateParsedWorkflow,
  validateWorkflowFile,
  validateWorkflowString,
  renderWorkflowPrompt,
  dispatchPreflight,
  type ValidatedWorkflow,
  type WorkflowFlavor,
} from "./validator.js";

export {
  isRealitySource,
  validateRealitySourceString,
  validateRealitySourceFile,
  type RealitySourceValidation,
} from "./reality_source.js";