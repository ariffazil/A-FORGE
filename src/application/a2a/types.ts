export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: T;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: Record<string, unknown>;
  };
}

export interface A2APart {
  text?: string;
  raw?: string;
  url?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
  filename?: string;
  mediaType?: string;
}

export interface A2AMessage {
  messageId: string;
  contextId?: string;
  taskId?: string;
  role: "ROLE_USER" | "ROLE_AGENT";
  parts: A2APart[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
  referenceTaskIds?: string[];
}

export interface A2AArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
}

export type A2ATaskState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_CANCELED"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_REJECTED"
  | "TASK_STATE_AUTH_REQUIRED";

export interface A2ATaskStatus {
  state: A2ATaskState;
  message?: A2AMessage;
  timestamp?: string;
}

export interface A2ATask {
  id: string;
  contextId?: string;
  status: A2ATaskStatus;
  artifacts?: A2AArtifact[];
  history?: A2AMessage[];
  metadata?: Record<string, unknown>;
}

export interface A2ASendMessageParams {
  message: A2AMessage;
  configuration?: {
    acceptedOutputModes?: string[];
    historyLength?: number;
    returnImmediately?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface A2AGetTaskParams {
  id: string;
  historyLength?: number;
}

export interface A2AListTasksParams {
  contextId?: string;
  status?: A2ATaskState;
  pageSize?: number;
  pageToken?: string;
  historyLength?: number;
  includeArtifacts?: boolean;
}

export interface A2ACancelTaskParams {
  id: string;
  metadata?: Record<string, unknown>;
}
