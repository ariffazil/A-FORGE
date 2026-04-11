export type ToolRiskLevel = "safe" | "guarded" | "dangerous";

export type ToolSchemaProperty = {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
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
};

export type ToolExecutionContext = {
  sessionId: string;
  workingDirectory: string;
  modeName: string;
  abortSignal?: AbortSignal;
  policy?: {
    commandTimeoutMs: number;
    maxFileBytes: number;
    allowedCommandPrefixes: string[];
    blockedCommandPatterns: string[];
  };
};

export type ToolResult = {
  ok: boolean;
  output: string;
  metadata?: Record<string, unknown>;
};
