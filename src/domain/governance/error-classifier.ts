/**
 * MCP Error Classifier — Federation-Wide Error Taxonomy
 * 
 * Q1: Distinguishes "agent made bad call" from "server broke downstream."
 * Every MCP tool in the federation SHOULD return structured errors via this
 * module instead of raw strings.
 * 
 * Constitutional alignment:
 *   F2 TRUTH — errors carry epistemic labels (OBS/DER)
 *   F4 CLARITY — structured, machine-parseable
 *   F11 AUDIT — every error leaves a trace
 * 
 * FORGED: 2026-07-03
 * VERDICT: PROCEED_TO_SURFACE_GUARD_BUILD
 */

// ─── Error Classification ──────────────────────────────────────────

/**
 * Error classes for the federation.
 * All use MCP isError=true (execution channel) for structured delivery.
 * Protocol-level errors (JSON-RPC codes) are separate and handled by transport.
 */
export enum ErrorClass {
  /** Agent sent structurally invalid request (missing required fields, wrong types). isError channel. */
  BAD_INPUT_SHAPE = 'BAD_INPUT_SHAPE',

  /** Agent sent valid structure but semantically wrong values. isError channel. */
  BAD_INPUT_VALUE = 'BAD_INPUT_VALUE',

  /** Agent sent valid request but a required field is missing. isError channel. */
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  /** Server processed request but external dependency failed. isError channel. */
  DOWNSTREAM_FAILURE = 'DOWNSTREAM_FAILURE',

  /** External parser (LAS, SEG-Y, CSV) failed to process input. isError channel. */
  DOWNSTREAM_PARSER_FAIL = 'DOWNSTREAM_PARSER_FAIL',

  /** Server ran out of resources (OOM, rate limit, timeout). isError channel. */
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',

  /** Server encountered an internal bug. isError channel. */
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  /** Constitutional authority blocked the action (lease, floor, judge). isError channel. */
  AUTHORITY_BLOCK = 'AUTHORITY_BLOCK',

  /** Constitutional floor violation (F1-F13). isError channel. */
  FLOOR_BLOCK = 'FLOOR_BLOCK',

  /** MCP tool surface drift detected — schema or tool list changed. isError channel. */
  TOOL_SURFACE_DRIFT = 'TOOL_SURFACE_DRIFT',
}

export enum ErrorSeverity {
  /** Agent can retry with different params */
  RECOVERABLE = 'RECOVERABLE',
  /** Agent should escalate to human or different organ */
  ESCALATE = 'ESCALATE',
  /** Hard failure — do not retry */
  FATAL = 'FATAL',
}

export type Recoverability =
  | 'AGENT_CAN_RETRY'        // Same tool, different params
  | 'AGENT_CAN_ROUTE'        // Try a different organ/tool
  | 'ESCALATE_TO_HUMAN'      // Human decision needed
  | 'ESCALATE_TO_888_HOLD'   // Constitutional hold
  | 'FATAL_DO_NOT_RETRY'     // Hard stop
  | 'RETRY_SAME_LATER';      // Transient — retry after delay

export type SuspectedLayer =
  | 'input_validation'   // Schema/type check failed before execution
  | 'argument_semantic'  // Values passed validation but are logically wrong
  | 'router'             // MCP router/proxy dropped or mangled the call
  | 'tool_execution'     // The tool handler itself failed
  | 'authority'          // Constitutional authority or lease check blocked the action
  | 'floor'              // Constitutional floor (F1-F13) blocked the action
  | 'external_dep'       // Database, API, file system, network
  | 'parser'             // External parser (LAS, SEG-Y, CSV) failed
  | 'surface_drift'      // MCP tool surface changed unexpectedly
  | 'resource'           // Memory, CPU, rate limit
  | 'unknown';

// ─── Structured Error Envelope ─────────────────────────────────────

export interface ErrorEnvelope {
  /** Machine-parseable error class */
  error_class: ErrorClass;
  /** Can the agent recover from this? */
  recoverability: Recoverability;
  /** Human-readable summary */
  message: string;
  /** Where in the stack the failure likely occurred */
  suspected_layer: SuspectedLayer;
  /** Severity for escalation decisions */
  severity: ErrorSeverity;
  /** Which input fields were problematic (for BAD_INPUT_*) */
  missing_fields?: string[];
  invalid_fields?: Array<{ field: string; expected: string; got: string }>;
  /** What the agent should do next */
  next_action?: string;
  /** Original error for traceability */
  original_error?: string;
  /** Epistemic label per F2 */
  epistemic_label: 'OBS' | 'DER';
  /** Timestamp */
  timestamp: string;
  /** Which organ/tool generated this error */
  source_tool?: string;
  source_organ?: string;
}

// ─── MCP Tool Result Shape ─────────────────────────────────────────

export interface MCPStructuredError {
  isError: true;
  structuredContent: ErrorEnvelope;
  content: Array<{ type: 'text'; text: string }>;
}

// ─── Error Builders ────────────────────────────────────────────────

function buildEnvelope(
  partial: Omit<ErrorEnvelope, 'timestamp' | 'epistemic_label'> & {
    epistemic_label?: 'OBS' | 'DER';
  }
): ErrorEnvelope {
  return {
    ...partial,
    epistemic_label: partial.epistemic_label ?? 'OBS',
    timestamp: new Date().toISOString(),
  };
}

function toResult(env: ErrorEnvelope): MCPStructuredError {
  return {
    isError: true,
    structuredContent: env,
    content: [{ type: 'text', text: JSON.stringify(env, null, 2) }],
  };
}

// ─── BAD_INPUT_SHAPE ───────────────────────────────────────────────

export function badInputShape(
  message: string,
  opts: {
    missing_fields?: string[];
    invalid_fields?: Array<{ field: string; expected: string; got: string }>;
    source_tool?: string;
    source_organ?: string;
  } = {}
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.BAD_INPUT_SHAPE,
      recoverability: 'AGENT_CAN_RETRY',
      message,
      suspected_layer: 'input_validation',
      severity: ErrorSeverity.RECOVERABLE,
      missing_fields: opts.missing_fields,
      invalid_fields: opts.invalid_fields,
      next_action: 'Fix input shape and retry',
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── BAD_INPUT_VALUE ───────────────────────────────────────────────

export function badInputValue(
  message: string,
  opts: {
    invalid_fields?: Array<{ field: string; expected: string; got: string }>;
    source_tool?: string;
    source_organ?: string;
  } = {}
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.BAD_INPUT_VALUE,
      recoverability: 'AGENT_CAN_RETRY',
      message,
      suspected_layer: 'argument_semantic',
      severity: ErrorSeverity.RECOVERABLE,
      invalid_fields: opts.invalid_fields,
      next_action: 'Fix input values and retry',
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── DOWNSTREAM_FAILURE ────────────────────────────────────────────

export function downstreamFailure(
  message: string,
  opts: {
    original_error?: string;
    source_tool?: string;
    source_organ?: string;
    can_retry?: boolean;
  } = {}
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.DOWNSTREAM_FAILURE,
      recoverability: opts.can_retry !== false ? 'AGENT_CAN_ROUTE' : 'ESCALATE_TO_HUMAN',
      message,
      suspected_layer: 'external_dep',
      severity: opts.can_retry !== false
        ? ErrorSeverity.RECOVERABLE
        : ErrorSeverity.ESCALATE,
      original_error: opts.original_error,
      next_action: opts.can_retry !== false
        ? 'Try different organ or retry later'
        : 'Escalate to human — downstream is persistently failing',
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── RESOURCE_EXHAUSTED ────────────────────────────────────────────

export function resourceExhausted(
  message: string,
  opts: {
    resource_type?: 'memory' | 'cpu' | 'rate_limit' | 'timeout' | 'disk';
    retry_after_ms?: number;
    source_tool?: string;
    source_organ?: string;
  } = {}
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.RESOURCE_EXHAUSTED,
      recoverability: 'RETRY_SAME_LATER',
      message,
      suspected_layer: 'resource',
      severity: ErrorSeverity.RECOVERABLE,
      next_action: opts.retry_after_ms
        ? `Wait ${opts.retry_after_ms}ms then retry`
        : 'Back off and retry with exponential delay',
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── INTERNAL_ERROR ────────────────────────────────────────────────

export function internalError(
  message: string,
  opts: {
    original_error?: string;
    source_tool?: string;
    source_organ?: string;
  } = {}
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.INTERNAL_ERROR,
      recoverability: 'ESCALATE_TO_888_HOLD',
      message,
      suspected_layer: 'tool_execution',
      severity: ErrorSeverity.FATAL,
      original_error: opts.original_error,
      next_action: 'Log to VAULT999 and escalate — server bug',
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── MISSING_REQUIRED_FIELD ────────────────────────────────────────

export function missingRequiredField(
  message: string,
  opts: {
    missing_fields: string[];
    source_tool?: string;
    source_organ?: string;
  }
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.MISSING_REQUIRED_FIELD,
      recoverability: 'AGENT_CAN_RETRY',
      message,
      suspected_layer: 'input_validation',
      severity: ErrorSeverity.RECOVERABLE,
      missing_fields: opts.missing_fields,
      next_action: `Provide missing fields: ${opts.missing_fields.join(', ')}`,
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── DOWNSTREAM_PARSER_FAIL ────────────────────────────────────────

export function downstreamParserFail(
  message: string,
  opts: {
    parser_name?: string;
    original_error?: string;
    source_tool?: string;
    source_organ?: string;
    can_retry?: boolean;
  } = {}
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.DOWNSTREAM_PARSER_FAIL,
      recoverability: opts.can_retry !== false ? 'AGENT_CAN_RETRY' : 'ESCALATE_TO_HUMAN',
      message,
      suspected_layer: 'parser',
      severity: opts.can_retry !== false
        ? ErrorSeverity.RECOVERABLE
        : ErrorSeverity.ESCALATE,
      original_error: opts.original_error,
      next_action: opts.can_retry !== false
        ? `Check file format (${opts.parser_name ?? 'unknown'} parser) and retry`
        : 'File may be corrupted — escalate to human',
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── AUTHORITY_BLOCK ───────────────────────────────────────────────

export function authorityBlock(
  message: string,
  opts: {
    lease_id?: string;
    required_action_class?: string;
    source_tool?: string;
    source_organ?: string;
  } = {}
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.AUTHORITY_BLOCK,
      recoverability: 'ESCALATE_TO_888_HOLD',
      message,
      suspected_layer: 'authority',
      severity: ErrorSeverity.ESCALATE,
      next_action: 'Request lease with correct action class, or escalate to 888_HOLD',
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── FLOOR_BLOCK ───────────────────────────────────────────────────

export function floorBlock(
  message: string,
  opts: {
    violated_floors?: string[];
    source_tool?: string;
    source_organ?: string;
  } = {}
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.FLOOR_BLOCK,
      recoverability: 'ESCALATE_TO_888_HOLD',
      message,
      suspected_layer: 'floor',
      severity: ErrorSeverity.FATAL,
      next_action: `Constitutional floor violation${opts.violated_floors?.length ? ` (${opts.violated_floors.join(', ')})` : ''} — escalate to arifOS judge`,
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── TOOL_SURFACE_DRIFT ────────────────────────────────────────────

export function toolSurfaceDrift(
  message: string,
  opts: {
    drift_details?: Array<{ tool_name: string; drift_type: string; severity: string }>;
    source_tool?: string;
    source_organ?: string;
  } = {}
): MCPStructuredError {
  return toResult(
    buildEnvelope({
      error_class: ErrorClass.TOOL_SURFACE_DRIFT,
      recoverability: 'ESCALATE_TO_888_HOLD',
      message,
      suspected_layer: 'surface_drift',
      severity: ErrorSeverity.FATAL,
      next_action: 'MCP tool surface changed — pin new snapshot or investigate drift cause',
      source_tool: opts.source_tool,
      source_organ: opts.source_organ,
    })
  );
}

// ─── Utility: Classify Unknown Error ───────────────────────────────

/**
 * Best-effort classification of an unknown error into our taxonomy.
 * Use when catching exceptions that weren't thrown through our builders.
 */
export function classifyUnknown(
  error: unknown,
  context?: { source_tool?: string; source_organ?: string }
): MCPStructuredError {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Heuristic classification (DER — derived, not observed)
  if (/missing|required|cannot be null|undefined/i.test(msg)) {
    return badInputShape(msg, { source_tool: context?.source_tool, source_organ: context?.source_organ });
  }
  if (/invalid|out of range|must be|expected/i.test(msg)) {
    return badInputValue(msg, { source_tool: context?.source_tool, source_organ: context?.source_organ });
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|rate.?limit|429/i.test(msg)) {
    return resourceExhausted(msg, { source_tool: context?.source_tool, source_organ: context?.source_organ });
  }
  if (/ECONNRESET|503|502|fetch failed|network/i.test(msg)) {
    return downstreamFailure(msg, { original_error: stack, source_tool: context?.source_tool, source_organ: context?.source_organ });
  }
  if (/parse|parser|LAS|SEG-Y|SEGY|CSV|corrupt|malform/i.test(msg)) {
    return downstreamParserFail(msg, { original_error: stack, source_tool: context?.source_tool, source_organ: context?.source_organ });
  }
  if (/lease|authority|forbidden|unauthorized|permission/i.test(msg)) {
    return authorityBlock(msg, { source_tool: context?.source_tool, source_organ: context?.source_organ });
  }
  if (/floor|F[0-9]+|constitution|amanah|truth|sovereign/i.test(msg)) {
    return floorBlock(msg, { source_tool: context?.source_tool, source_organ: context?.source_organ });
  }
  if (/drift|schema.?change|surface.?drift|tool.?removed/i.test(msg)) {
    return toolSurfaceDrift(msg, { source_tool: context?.source_tool, source_organ: context?.source_organ });
  }

  // Default: internal error (safest assumption)
  return internalError(msg, {
    original_error: stack,
    source_tool: context?.source_tool,
    source_organ: context?.source_organ,
  });
}

// ─── Utility: Is Structured Error? ─────────────────────────────────

export function isStructuredError(result: unknown): result is MCPStructuredError {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as any).isError === true &&
    typeof (result as any).structuredContent === 'object' &&
    'error_class' in (result as any).structuredContent
  );
}

export function getRecoveryStrategy(result: MCPStructuredError): {
  can_retry: boolean;
  can_route: boolean;
  escalate: boolean;
  hold: boolean;
} {
  const rc = result.structuredContent.recoverability;
  return {
    can_retry: rc === 'AGENT_CAN_RETRY' || rc === 'RETRY_SAME_LATER',
    can_route: rc === 'AGENT_CAN_ROUTE',
    escalate: rc === 'ESCALATE_TO_HUMAN' || rc === 'ESCALATE_TO_888_HOLD',
    hold: rc === 'ESCALATE_TO_888_HOLD',
  };
}
