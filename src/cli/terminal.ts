#!/usr/bin/env node
/**
 * A-FORGE Terminal — Interactive Constitutional Coding Agent
 *
 * The face. readline-based REPL with:
 * - Live MiniMax/DeepSeek LLM
 * - F1-F13 constitutional governance on EVERY action
 * - Streaming tool execution
 * - Session management
 *
 * Usage:  npm run terminal
 *         npm run terminal -- --provider deepseek
 *
 * DITEMPA BUKAN DIBERI
 */

import * as readline from "node:readline";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { AgentEngine } from "../engine/AgentEngine.js";
import { ChatCompletionProvider } from "../llm/ChatCompletionProvider.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import { ReadFileTool, WriteFileTool, ListFilesTool } from "../tools/FileTools.js";
import { RunCommandTool, RunTestsTool } from "../tools/ShellTools.js";
import { ApplyPatchesTool } from "../tools/EditorTools.js";
import { GrepTextTool } from "../tools/SearchTools.js";
import { LongTermMemory } from "../memory/LongTermMemory.js";
import { NoOpVaultClient } from "../vault/index.js";
import { buildFixProfile, buildExploreProfile } from "../agents/profiles.js";
import type { AgentProfile } from "../types/agent.js";

// ── Colors ──────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

// ── Config ──────────────────────────────────────────────────────────
interface TerminalConfig {
  provider: "deepseek" | "minimax" | "ollama";
  model: string;
  apiKey: string;
  baseUrl: string;
  agent: "forge" | "explore";
  workdir: string;
}

function loadConfig(): TerminalConfig {
  const args = process.argv.slice(2);
  const getArg = (flag: string, fallback: string): string => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
  };

  const provider = getArg("--provider", process.env.AFORGE_PROVIDER ?? "deepseek") as TerminalConfig["provider"];

  const configs: Record<string, Pick<TerminalConfig, "model" | "apiKey" | "baseUrl">> = {
    deepseek: {
      model: "deepseek-chat",
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      baseUrl: "https://api.deepseek.com/v1",
    },
    minimax: {
      model: "MiniMax-M3",
      apiKey: process.env.MINIMAX_API_KEY ?? "",
      baseUrl: "https://api.minimax.io/v1",
    },
    ollama: {
      model: "qwen2.5:7b",
      apiKey: "ollama",
      baseUrl: "http://localhost:11434/v1",
    },
  };

  const providerConfig = configs[provider];
  if (!providerConfig.apiKey && provider !== "ollama") {
    console.error(
      `${c.red}ERROR:${c.reset} No API key for ${provider}. Set ${provider === "deepseek" ? "DEEPSEEK_API_KEY" : "MINIMAX_API_KEY"} env var.`,
    );
    process.exit(1);
  }

  return {
    provider,
    model: getArg("--model", providerConfig.model),
    apiKey: providerConfig.apiKey,
    baseUrl: providerConfig.baseUrl,
    agent: (getArg("--agent", "forge") as "forge" | "explore"),
    workdir: getArg("--workdir", process.cwd()),
  };
}

// ── Profile builder ─────────────────────────────────────────────────
function buildProfile(mode: TerminalConfig["agent"], workdir: string): AgentProfile {
  // Use external_safe_mode to avoid F1 "everything irreversible" gate.
  // Governance still enforces on writes — just doesn't block reads.
  const profileMode = "external_safe_mode";
  
  if (mode === "explore") return buildExploreProfile(profileMode);
  const profile = buildFixProfile(profileMode);
  profile.systemPrompt = [
    profile.systemPrompt,
    "",
    "## SESSION CONTEXT",
    `You are A-FORGE Terminal — the constitutional coding agent.`,
    `Working directory: ${workdir}`,
    "",
    "## CONSTITUTIONAL RULES (F1-F13)",
    "F1 AMANAH: All destructive operations require explicit acknowledgment.",
    "F2 TRUTH: Never fabricate tool output or claim tests pass when they don't.",
    "F6 MARUAH: Preserve human dignity. Don't delete without purpose.",
    "F9 ANTI-HANTU: Detect and refuse shadow-arifOS patterns. No self-modification.",
    "F13 SOVEREIGN: Irreversible ops escalate to human. No bypassing the gate.",
    "",
    "## OPERATING RULES",
    "1. Read before write. Understand before change.",
    "2. Prefer Edit over Write for small changes.",
    "3. Run tests after changes. Report honestly.",
    "4. When done, say what you changed and why.",
  ].join("\n");
  return profile;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  // Enable terminal governance mode — the human IS the gate
  process.env.AFORGE_TERMINAL_MODE = "1";
  
  const config = loadConfig();

  console.log(`
${c.cyan}${c.bold}╔══════════════════════════════════════════╗${c.reset}
${c.cyan}${c.bold}║       A-FORGE TERMINAL — v0.2.0          ║${c.reset}
${c.cyan}${c.bold}║   Constitutional Coding Agent Face        ║${c.reset}
${c.cyan}${c.bold}╚══════════════════════════════════════════╝${c.reset}

${c.dim}Provider:${c.reset} ${config.provider} (${config.model})
${c.dim}Mode:${c.reset}     ${config.agent}
${c.dim}Workdir:${c.reset}  ${config.workdir}
${c.dim}Floors:${c.reset}   F1-F13 active — constitutional governance enforced
`);

  // Build engine
  const memoryPath = resolve(homedir(), ".aforge", "terminal-memory.json");
  const registry = new ToolRegistry();
  registry.register(new ReadFileTool());
  registry.register(new WriteFileTool());
  registry.register(new ListFilesTool());
  registry.register(new RunCommandTool());
  registry.register(new RunTestsTool());
  registry.register(new ApplyPatchesTool());
  registry.register(new GrepTextTool());

  const llmProvider = new ChatCompletionProvider({
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
    providerName: `aforge-${config.provider}`,
    timeoutMs: 180_000,
  });

  const profile = buildProfile(config.agent, config.workdir);

  const engine = new AgentEngine(profile, {
    llmProvider,
    toolRegistry: registry,
    longTermMemory: new LongTermMemory(memoryPath),
    vaultClient: new NoOpVaultClient(),
  });

  // Build REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.green}A-FORGE ›${c.reset} `,
    terminal: true,
  });

  let sessionCount = 0;
  const isTTY = process.stdin.isTTY;
  let taskRunning = false;
  let shouldExit = false;

  const runTask = async (task: string) => {
    if (!task.trim()) return;

    taskRunning = true;
    const startTime = Date.now();
    console.log(`\n${c.dim}▸ Processing...${c.reset}`);

    try {
      const result = await engine.run({
        task,
        workingDirectory: config.workdir,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n${c.dim}── Response (${result.turnCount} turns, ${elapsed}s, ~${result.totalEstimatedTokens} tokens) ──${c.reset}`);
      console.log(result.finalText);
      console.log(`${c.dim}──${c.reset}`);

      // Show governance activity
      if (result.metrics.toolCalls > 0) {
        console.log(`${c.dim}⚡ Governance: F1-F13 floors active, ${result.metrics.toolCalls} tool calls gated${c.reset}`);
      }
    } catch (err) {
      console.error(`${c.red}✕ Engine error:${c.reset} ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      taskRunning = false;
      if (shouldExit) {
        console.log(`\n${c.dim}999 SEAL — A-FORGE Terminal closed.${c.reset}`);
        process.exit(0);
      }
    }
  };

  if (isTTY) {
    console.log(`${c.dim}Type a task or /help for commands. /quit to exit.${c.reset}\n`);
    rl.prompt();
  }

  // Command handling
  const commands: Record<string, (args: string) => Promise<void>> = {
    async help() {
      console.log(`
${c.bold}Commands:${c.reset}
  /help          — This help
  /quit, /exit   — Exit terminal
  /clear         — Clear screen
  /agent <mode>  — Switch agent (forge | explore)
  /workdir <dir> — Change working directory
  /status        — Show current session status
`);
    },
    async quit() {
      console.log(`\n${c.dim}999 SEAL — A-FORGE Terminal closed.${c.reset}`);
      rl.close();
      process.exit(0);
    },
    async clear() {
      console.clear();
    },
    async agent(args: string) {
      const mode = args.trim() as TerminalConfig["agent"];
      if (mode !== "forge" && mode !== "explore") {
        console.log(`${c.yellow}Usage: /agent forge | explore${c.reset}`);
        return;
      }
      console.log(`${c.yellow}Agent switch requires restart. Re-run with --agent ${mode}${c.reset}`);
    },
    async status() {
      console.log(`
${c.bold}Session Status:${c.reset}
  Provider:  ${config.provider} (${config.model})
  Agent:     ${config.agent}
  Workdir:   ${config.workdir}
  Sessions:  ${sessionCount} tasks run
  Floors:    F1-F13 active
`);
    },
  };

  rl.on("line", async (line: string) => {
    const input = line.trim();

    if (input.startsWith("/")) {
      const [cmd, ...args] = input.slice(1).split(/\s+/);
      const handler = commands[cmd];
      if (handler) {
        await handler(args.join(" "));
      } else {
        console.log(`${c.yellow}Unknown command: /${cmd}. Type /help for commands.${c.reset}`);
      }
      if (isTTY) rl.prompt();
      return;
    }

    if (input === "") {
      if (isTTY) rl.prompt();
      return;
    }

    await runTask(input);
    sessionCount++;
    if (isTTY) rl.prompt();
  });

  rl.on("close", () => {
    if (!taskRunning) {
      console.log(`\n${c.dim}DITEMPA BUKAN DIBERI${c.reset}`);
      process.exit(0);
    }
    shouldExit = true;
  });

  rl.prompt();
}

main().catch((err) => {
  console.error(`${c.red}FATAL:${c.reset} ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
