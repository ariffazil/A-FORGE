# Code Mode MCP Blueprint
## Native "Code Mode" Integration for MCP Efficiency

> **Status:** IMPLEMENTATION BLUEPRINT v1.0  
> **Epoch:** 2026-04-19  
> **Priority:** P0 — Next Forge Target  
> **ETA:** 2 weeks (sprint)

---

## 1. Problem Statement

Loading comprehensive JSON schemas for hundreds of MCP tools directly into an LLM's context window causes:
- **Severe token inefficiency** (upward of 55,000 tokens consumed before a single action)
- **Context window exhaustion** in smaller models
- **Degraded reasoning capabilities** due to noise-to-signal ratio collapse
- **Tool poisoning vulnerability** — malicious instructions in retrieved documents can trigger unauthorized commands

## 2. Solution: Code Mode Execution

Instead of pushing full JSON schemas into the model, A-FORGE provides the LLM with a **secure, containerized execution sandbox**. The model dynamically writes and executes scripts to interact with MCP gateways, filters data programmatically within the sandbox, and returns only the necessary, highly dense intelligence back to the active context window.

### 2.1 Architectural Shift

```
BEFORE (Schema Mode):
LLM ←── [50K tokens of JSON schemas] ←── MCP Registry
LLM →── tool_call(name="fetch", args={...}) →── External API

AFTER (Code Mode):
LLM ←── [500 tokens: "You have a sandbox with mcp client imported"]
LLM →── code_execution(script="const res = await mcp.fetch(...); return res.filter(...)")
       ↓
   [Sandboxed Execution]
       ↓
LLM ←── [2K tokens: filtered, dense result]
```

## 3. Implementation Plan

### 3.1 New Components

#### `src/code-mode/CodeModeExecutor.ts`
The central orchestrator for code-mode tool interactions.

```typescript
interface CodeModeExecutor {
  // Execute a user-provided script in a sandboxed environment
  executeScript(
    script: string,
    context: ExecutionContext,
    mcpGateways: McpGateway[],
  ): Promise<ScriptResult>;

  // Pre-flight security analysis of the script
  analyzeScript(script: string): Promise<SecurityAnalysis>;

  // Inject only the necessary MCP bindings (not full schemas)
  getMinimalBindings(gatewayNames: string[]): string;
}

interface ScriptResult {
  output: unknown;
  stdout: string;
  stderr: string;
  exitCode: number;
  tokensConsumed: number;  // Estimated tokens of the returned data
  executionTimeMs: number;
  floorsTriggered: string[];
}

interface SecurityAnalysis {
  riskLevel: "safe" | "caution" | "dangerous";
  disallowedImports: string[];
  networkCalls: string[];
  fileSystemAccess: string[];
  shellCommands: string[];
  recommendedFloors: string[];
}
```

#### `src/code-mode/sandbox/NodeSandbox.ts`
A lightweight Node.js sandbox using `vm2` (or isolated `worker_threads` + strict policy).

Requirements:
- **No network access** except to pre-registered MCP gateway URLs
- **No file system access** outside a temporary workspace directory
- **No child_process, cluster, or worker_threads spawning**
- **Timeout:** 30 seconds max execution
- **Memory limit:** 128MB per script

#### `src/code-mode/sandbox/McpBinding.ts`
A minimal, typed binding layer that exposes only the methods the LLM needs:

```typescript
// Instead of 50K tokens of schemas, inject ~500 tokens:
interface McpClient {
  call(toolName: string, params: Record<string, unknown>): Promise<unknown>;
  listResources(): Promise<string[]>;
  readResource(uri: string): Promise<unknown>;
}

// Pre-bound instances available in sandbox global scope:
declare const mcp: {
  arifos: McpClient;
  geox: McpClient;
  wealth: McpClient;
};
```

### 3.2 Tool Registry Integration

Modify `src/tools/ToolRegistry.ts` to support a new tool: `execute_code_mode`.

```typescript
// In ToolRegistry.listForModel():
// When Code Mode is enabled, replace individual MCP tool schemas
// with a single "execute_code_mode" tool definition

const codeModeTool: ToolDefinitionForModel = {
  name: "execute_code_mode",
  description: `Execute TypeScript code in a sandboxed environment with access to MCP gateways.
  Use this when you need to interact with multiple tools, filter large datasets,
  or perform complex data transformations before returning results.
  Available gateways: ${gatewayNames.join(", ")}`,
  parameters: {
    type: "object",
    properties: {
      script: {
        type: "string",
        description: "TypeScript code to execute. Use 'await mcp.<gateway>.call(...)' to invoke tools.",
      },
      expectedReturnType: {
        type: "string",
        enum: ["object", "array", "string", "number"],
        description: "Expected return type for validation",
      },
    },
    required: ["script"],
  },
};
```

### 3.3 Engine Integration

In `src/engine/AgentEngine.ts`, add a Code Mode branch in `executeToolCalls()`:

```typescript
// Inside executeToolCalls loop:
if (call.toolName === "execute_code_mode") {
  // 1. Security analysis (F12 Defense)
  const analysis = await codeModeExecutor.analyzeScript(call.args.script);
  if (analysis.riskLevel === "dangerous") {
    floorsTriggered.push("F12");
    // Return VOID
  }

  // 2. Thermodynamic cost estimation (OPS/777)
  const thermoCheck = thermo.estimateCodeMode(analysis);
  if (thermoCheck.verdict !== "SEAL") {
    floorsTriggered.push("OPS");
    // Return HOLD
  }

  // 3. Execute in sandbox
  const result = await codeModeExecutor.executeScript(
    call.args.script,
    executionContext,
    availableGateways,
  );

  // 4. Return compressed result to LLM
  toolMessage = {
    role: "tool",
    toolCallId: call.id,
    toolName: call.toolName,
    content: JSON.stringify(result.output, null, 2).slice(0, 8000), // Hard cap
  };
}
```

### 3.4 Files to Create

| File | Purpose |
|------|---------|
| `src/code-mode/CodeModeExecutor.ts` | Main orchestrator |
| `src/code-mode/sandbox/NodeSandbox.ts` | VM-based sandbox |
| `src/code-mode/sandbox/McpBinding.ts` | MCP gateway bindings |
| `src/code-mode/sandbox/SecurityScanner.ts` | Static analysis for malicious code |
| `src/code-mode/sandbox/ResourceLimiter.ts` | Memory/CPU/time limits |
| `src/code-mode/__tests__/CodeModeExecutor.test.ts` | Unit tests |
| `src/code-mode/__tests__/sandbox.test.ts` | Security tests |

### 3.5 Files to Modify

| File | Change |
|------|--------|
| `src/engine/AgentEngine.ts` | Add code-mode branch in tool execution loop |
| `src/tools/ToolRegistry.ts` | Register `execute_code_mode` tool |
| `src/types/tool.ts` | Add `CodeModePermissionContext` |
| `src/ops/ThermodynamicCostEstimator.ts` | Add code-mode cost estimation |

## 4. Security Architecture

### 4.1 Defense in Depth

1. **Static Analysis** (`SecurityScanner.ts`): Parse AST, block `require("fs")`, `child_process`, `eval`, `Function constructor`
2. **VM Isolation** (`NodeSandbox.ts`): Run in `vm.Script` with frozen context, no global access
3. **Network Policy**: Whitelist-only outbound to registered MCP gateway hosts
4. **File System Jail**: `chroot`-style temporary directory, cleaned after execution
5. **Resource Caps**: 30s timeout, 128MB RAM, 1 vCPU
6. **F12 Injection Check**: Scan script for prompt injection patterns before execution

### 4.2 Constitutional Floors for Code Mode

| Floor | Enforcement Point |
|-------|------------------|
| F1 Amanah | Script execution is logged; `rm -rf` patterns blocked by static analysis |
| F2 Truth | Script output must include evidence markers if making claims |
| F3 Tri-Witness | High-risk scripts require human ticket approval |
| F4 Clarity | Output is hard-capped at 8K tokens to prevent entropy injection |
| F5 Peace² | Network requests to non-whitelisted hosts → VOID |
| F6 Empathy | Scripts touching "dangerous" MCP tools → 888_HOLD |
| F9 Anti-Hantu | Scripts claiming sentience/consciousness → VOID |
| F12 Defense | AST-based injection scan before every execution |
| F13 Sovereign | `execute_code_mode` is a dangerous tool → requires `holdEnabled` |

## 5. Rollout Plan

1. **Week 1:** Implement sandbox + security scanner + MCP bindings
2. **Week 2:** Integrate into `AgentEngine`, add thermodynamic cost estimation, write tests
3. **Week 3:** Deploy to staging, run conformance tests, monitor for escapes
4. **Week 4:** Gradual rollout (10% → 50% → 100% of tool calls)

## 6. Success Metrics

- Token consumption per MCP interaction: **↓ 80%** (target: < 10K tokens vs 50K+ baseline)
- Tool call latency: **↓ 40%** (filtered data reduces LLM re-processing)
- Security incidents (sandbox escapes): **0**
- Constitutional floor pass rate: **≥ 99%**

---

*DITEMPA BUKAN DIBERI — Forged, Not Given*
