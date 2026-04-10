/**
 * AF-FORGE MCP Server (stdio)
 *
 * Exposes AF-FORGE governance and agent capabilities as MCP tools.
 * Implements the Model Context Protocol so any MCP-compatible host
 * (Claude Desktop, Cursor, OpenCode, Gemini, Smithery) can invoke
 * AF-FORGE constitutional checks without running the full CLI.
 *
 * Tools:
 *   forge_check_governance  — Run F3/F6/F9 checks on a task string
 *   forge_health            — Return server health + governance floor status
 *   forge_run               — Run a full agent task (explore profile, mock provider)
 *
 * Resources:
 *   forge://governance/floors  — Constitutional floor definitions (F1–F13)
 *   forge://governance/status  — Live floor implementation status
 *
 * Transport: stdio (pipe)
 *
 * @module mcp/server
 * @constitutional F1 Amanah — no irreversible action without VAULT999 seal
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { validateInputClarity } from "../governance/f3InputClarity.js";
import { checkHarmDignity } from "../governance/f6HarmDignity.js";
import { checkInjection } from "../governance/f9Injection.js";

// ── Server bootstrap ────────────────────────────────────────────────────────

const server = new McpServer({
  name: "af-forge",
  version: "0.1.0",
});

// ── Tools ───────────────────────────────────────────────────────────────────

/**
 * forge_check_governance
 * Run all three constitutional floor checks (F3, F6, F9) against a task string.
 * Returns a structured verdict for each floor plus an overall pass/block decision.
 */
server.tool(
  "forge_check_governance",
  "Run AF-FORGE constitutional governance checks (F3 InputClarity, F6 HarmDignity, F9 Injection) against a task string. Returns per-floor verdicts and an overall PASS/BLOCK decision.",
  {
    task: z.string().describe("The task or prompt text to evaluate"),
  },
  async ({ task }) => {
    const f3 = validateInputClarity(task);
    const f6 = checkHarmDignity(task);
    const f9 = checkInjection(task);

    const blocked =
      f3.verdict === "SABAR" || f6.verdict === "VOID" || f9.verdict === "VOID";

    const floors: Record<string, unknown> = {
      F3_InputClarity: {
        verdict: f3.verdict,
        reason: f3.reason ?? null,
        message: f3.message ?? null,
      },
      F6_HarmDignity: {
        verdict: f6.verdict,
        reason: f6.reason ?? null,
        evidence: f6.evidence ?? [],
        message: f6.message ?? null,
      },
      F9_Injection: {
        verdict: f9.verdict,
        reason: f9.reason ?? null,
        triggeredPatterns: f9.triggeredPatterns ?? [],
        message: f9.message ?? null,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              overall: blocked ? "BLOCK" : "PASS",
              blocked,
              floors,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

/**
 * forge_health
 * Return server health and constitutional floor implementation status.
 */
server.tool(
  "forge_health",
  "Return AF-FORGE server health and constitutional floor (F1–F13) implementation status.",
  {},
  async () => {
    const floors: Record<string, { implemented: boolean; gate: string }> = {
      F1_Amanah: { implemented: true, gate: "888_HOLD" },
      F2_Truth: { implemented: true, gate: "τ≥0.99 evidence links" },
      F3_InputClarity: { implemented: true, gate: "SABAR on vague input" },
      F4_Entropy: { implemented: true, gate: "budget.tokenCeiling" },
      F5_Continuity: { implemented: true, gate: "LongTermMemory" },
      F6_HarmDignity: { implemented: true, gate: "VOID on harm patterns" },
      F7_Confidence: { implemented: true, gate: "F7 confidence bands" },
      F8_Grounding: { implemented: true, gate: "evidence required" },
      F9_Injection: { implemented: true, gate: "VOID on injection patterns" },
      F10_Privacy: { implemented: false, gate: "pending" },
      F11_Coherence: { implemented: true, gate: "summarizeGovernance()" },
      F12_Stewardship: { implemented: false, gate: "pending" },
      F13_Sovereign: { implemented: true, gate: "888_HOLD blocks, no auto-approve" },
    };

    const implemented = Object.values(floors).filter((f) => f.implemented).length;
    const total = Object.keys(floors).length;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "healthy",
              version: "0.1.0",
              constitutional_floors: {
                implemented,
                total,
                coverage: `${Math.round((implemented / total) * 100)}%`,
                floors,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

/**
 * forge_run
 * Run a governed agent task using the explore profile and mock provider.
 * Governance checks run first — blocked tasks never reach the LLM.
 */
server.tool(
  "forge_run",
  "Run a full AF-FORGE agent task (explore profile, mock LLM). Governance floors F3/F6/F9 run first — blocked tasks return immediately with SABAR or VOID. Returns finalText, turnCount, and governance outcome.",
  {
    task: z.string().describe("The task to execute"),
    mode: z
      .enum(["internal_mode", "external_safe_mode"])
      .optional()
      .default("external_safe_mode")
      .describe("Agent execution mode"),
  },
  async ({ task, mode }) => {
    // Lazy imports to keep startup fast
    const { AgentEngine } = await import("../engine/AgentEngine.js");
    const { LongTermMemory } = await import("../memory/LongTermMemory.js");
    const { ToolRegistry } = await import("../tools/ToolRegistry.js");
    const { ReadFileTool, ListFilesTool } = await import("../tools/FileTools.js");
    const { MockLlmProvider } = await import("../llm/MockLlmProvider.js");
    const { buildExploreProfile } = await import("../agents/profiles.js");
    const { tmpdir } = await import("node:os");
    const { resolve } = await import("node:path");

    const root = resolve(tmpdir(), `af-forge-mcp-${Date.now()}`);
    const { mkdir, rm } = await import("node:fs/promises");
    await mkdir(root, { recursive: true });

    try {
      const registry = new ToolRegistry();
      registry.register(new ReadFileTool());
      registry.register(new ListFilesTool());

      const engine = new AgentEngine(buildExploreProfile(mode ?? "external_safe_mode"), {
        llmProvider: new MockLlmProvider(),
        longTermMemory: new LongTermMemory(resolve(root, "mem.json")),
        toolRegistry: registry,
        featureFlags: {
          ENABLE_DANGEROUS_TOOLS: false,
          ENABLE_BACKGROUND_JOBS: false,
          ENABLE_EXPERIMENTAL_TOOLS: false,
        },
        toolPolicy: {
          commandTimeoutMs: 10_000,
          maxFileBytes: 512 * 1024,
          allowedCommandPrefixes: [],
          blockedCommandPatterns: [],
        },
      });

      const result = await engine.run({ task });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                finalText: result.finalText,
                turnCount: result.turnCount,
                transcriptLength: result.transcript.length,
                blocked: result.finalText.includes("VOID") || result.finalText.includes("SABAR"),
              },
              null,
              2
            ),
          },
        ],
      };
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
);

// ── Resources ───────────────────────────────────────────────────────────────

server.resource(
  "forge://governance/floors",
  "forge://governance/floors",
  { mimeType: "application/json" },
  async () => ({
    contents: [
      {
        uri: "forge://governance/floors",
        mimeType: "application/json",
        text: JSON.stringify(
          {
            floors: [
              { id: "F1", name: "Amanah", principle: "No irreversible action without VAULT999 seal", gate: "888_HOLD" },
              { id: "F2", name: "Truth", principle: "No ungrounded claims (τ ≥ 0.99)", gate: "evidence links required" },
              { id: "F3", name: "InputClarity", principle: "Reject vague or empty input", gate: "SABAR" },
              { id: "F4", name: "Entropy", principle: "Respect token/turn budgets", gate: "budget ceiling" },
              { id: "F5", name: "Continuity", principle: "Persist context across sessions", gate: "LongTermMemory" },
              { id: "F6", name: "HarmDignity", principle: "No harmful execution patterns", gate: "VOID" },
              { id: "F7", name: "Confidence", principle: "Signal uncertainty explicitly", gate: "confidence bands" },
              { id: "F8", name: "Grounding", principle: "Claims need evidence", gate: "evidence required" },
              { id: "F9", name: "Injection", principle: "Reject prompt injection and manipulation", gate: "VOID" },
              { id: "F10", name: "Privacy", principle: "Protect personal data", gate: "pending" },
              { id: "F11", name: "Coherence", principle: "Summarise governance state", gate: "summarizeGovernance()" },
              { id: "F12", name: "Stewardship", principle: "Long-horizon resource care", gate: "pending" },
              { id: "F13", name: "Sovereign", principle: "Human holds final authority", gate: "888_HOLD no auto-approve" },
            ],
          },
          null,
          2
        ),
      },
    ],
  })
);

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[af-forge-mcp] Server started on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[af-forge-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
