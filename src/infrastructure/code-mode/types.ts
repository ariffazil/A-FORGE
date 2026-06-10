/**
 * src/code-mode/types.ts — Code Mode Shared Contracts
 *
 * Type definitions for the sovereign Code Mode execution fabric.
 * Code Mode replaces JSON-schema-bloated tool calls with sandboxed
 * script execution, reducing token entropy (F4) and hardening
 * injection defense (F12).
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

export type SecurityRiskLevel = "safe" | "caution" | "dangerous";

export interface SecurityAnalysis {
  riskLevel: SecurityRiskLevel;
  disallowedImports: string[];
  networkCalls: string[];
  fileSystemAccess: string[];
  shellCommands: string[];
  recommendedFloors: string[];
  rawFlags: string[];
}

export interface McpGatewayBinding {
  name: string;
  toolNames: string[];
  resourceUris: string[];
}

export interface ExecutionContext {
  sessionId: string;
  workingDirectory: string;
  modeName: string;
  allowedGateways: string[];
}

export interface ScriptResult {
  output: unknown;
  stdout: string;
  stderr: string;
  exitCode: number;
  tokensConsumed: number;
  executionTimeMs: number;
  floorsTriggered: string[];
  /** T0-T3 risk tier from GovernanceBridge (if bridge was active) */
  riskTier?: string;
}

export interface SandboxOptions {
  script: string;
  bindings: Record<string, unknown>;
  timeoutMs: number;
  memoryLimitMb: number;
  workingDirectory: string;
  allowedNetworkHosts: string[];
}

export interface SandboxWorkerMessage {
  type: "execute";
  options: SandboxOptions;
}

export interface SandboxWorkerResult {
  type: "result";
  result: ScriptResult;
}

export interface SandboxWorkerError {
  type: "error";
  error: string;
  floorsTriggered: string[];
}
