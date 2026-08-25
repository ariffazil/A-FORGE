export type ToolRiskLevel = "safe" | "guarded" | "dangerous";

export type ToolSchemaProperty = {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  items?: ToolSchemaProperty;
  properties?: Record<string, ToolSchemaProperty>;
};

export type ToolSchema = {
  type: "object";
  properties: Record<string, ToolSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolPermissionContext = {
  enabledTools: Set<string>;
  dangerousToolsEnabled: boolean;
  experimentalToolsEnabled: boolean;
  /** F13 Sovereign: when false, dangerous tools return 888_HOLD instead of executing */
  holdEnabled: boolean;
  /** Risk level drives adaptive thresholds for F13 and other floors */
  riskLevel?: "low" | "medium" | "high" | "critical";
  /** Human override from approved ticket — bypasses f13ForceHold for replay */
  humanOverride?: boolean;
};

export type ToolExecutionContext = {
  sessionId: string;
  workingDirectory: string;
  modeName: string;
  abortSignal?: AbortSignal;
  /** Agent's expected output BEFORE execution — used for world model surprise scoring */
  expectedOutput?: string;
  intent?: string;
  assumptions_declared?: string[];
  unknowns_declared?: string[];
  policy?: {
    commandTimeoutMs: number;
    maxFileBytes: number;
    allowedCommandPrefixes: string[];
    blockedCommandPatterns: string[];
    allowedTools?: string[];
    blockedTools?: string[];
  };
};

export type ToolResult = {
  ok: boolean;
  output: string;
  metadata?: Record<string, unknown>;
  /** World model metadata — action→observation instrumentation (L1-L5) */
  wm?: {
    tool_priority: number;
    action_hash: string;
    observation_hash: string;
    agent_confidence: number;
    observation_entropy: number;
    surprise_score: number;
    wm_eligible: boolean;
    evidence_gap?: string;
  };
};
