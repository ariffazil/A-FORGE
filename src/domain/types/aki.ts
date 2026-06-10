/**
 * AKI Transport Contract Types
 *
 * Defines the constitutional envelope and error shapes for the
 * Arif Kernel Interface (AKI) between LLM clients, arifOS governance,
 * and FastMCP execution substrates.
 */

export type AkiIntentModel = "informational" | "advisory" | "execution" | "speculative";

export type AkiRiskLevel = "low" | "medium" | "high" | "critical";

export type AkiVerdict = "SEAL" | "COMPLY" | "CAUTION" | "HOLD" | "SABAR" | "VOID";

export type AkiActionType = "spawn" | "write" | "send" | "call";

export interface AkiToolContext {
  session_id: string;
  agent_name: string;
  intent_model: AkiIntentModel;
  risk_level: AkiRiskLevel;
}

export interface AkiOriginalRequest {
  id: string | number;
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, unknown>;
    context: AkiToolContext;
  };
}

export interface AkiGovernanceState {
  floors_checked: string[];
  tri_witness_W: number;
  vitality_Psi: number;
  genius_G: number;
  entropy_delta: number;
  harm_probability: number;
  verdict: AkiVerdict;
  verdict_code: number;
  floors_triggered: string[];
}

export interface AkiEnvelope {
  sessionId: string;
  original: AkiOriginalRequest;
  gov: AkiGovernanceState;
}

export interface AkiForgeManifest {
  judge_verdict: AkiVerdict;
  judge_signature: string;
  action_type: AkiActionType;
  target_tool: string;
  tool_arguments: Record<string, unknown>;
  constraints: {
    cpu?: string;
    memory?: string;
    timeout_seconds: number;
    network: boolean;
  };
  telemetry_snapshot: AkiTelemetrySnapshot;
}

export interface AkiTelemetrySnapshot {
  dS: number;
  peace2: number;
  psi_le: number;
  W3: number;
  G: number;
}

export interface AkiForgeReceipt {
  receipt_hash: string;
  status: "completed" | "failed";
  tool_response: unknown;
  telemetry?: AkiTelemetrySnapshot;
}

// JSON-RPC error codes for AKI boundary responses
export const AKI_ERROR_HOLD = -32001;
export const AKI_ERROR_SABAR = -32002;
export const AKI_ERROR_VOID = -32003;

export interface AkiJsonRpcError<T = unknown> {
  code: number;
  message: "HOLD" | "SABAR" | "VOID";
  data: T;
}

export interface AkiHoldErrorData {
  floor: string;
  reason: string;
  tri_witness_W: number;
  psi_le: number;
  required_action: string;
}

export interface AkiSabarErrorData {
  floor: string;
  reason: string;
  required_action: string;
}

export interface AkiVoidErrorData {
  floor: string;
  reason: string;
  tri_witness_W: number;
  psi_le: number;
}

export type MetabolicStage =
  | "000_INIT"
  | "111_SENSE"
  | "222_THINK"
  | "333_MIND"
  | "444_ROUTE"
  | "555_HEART"
  | "666_ALIGN"
  | "777_FORGE"
  | "888_JUDGE"
  | "999_VAULT";
