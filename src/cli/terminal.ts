#!/usr/bin/env node
/**
 * A-FORGE Terminal — Constitutional Coding Agent Face
 *
 * Streaming REPL with:
 * - Real-time token streaming (SSE from DeepSeek/MiniMax/Ollama)
 * - Spinner animation during LLM thinking
 * - F1-F13 constitutional governance on EVERY action
 * - Federation MCP tool auto-discovery
 * - Session persistence (save/load)
 *
 * Usage:  npm run terminal
 *         npm run terminal -- --provider deepseek --agent forge
 *
 * DITEMPA BUKAN DIBERI
 */

import * as readline from "node:readline";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  italic: "\x1b[3m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
};
const B = c.bold;
const D = c.dim;
const R = c.reset;

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
      `${c.red}ERROR:${R} No API key for ${provider}. Set ${provider === "deepseek" ? "DEEPSEEK_API_KEY" : "MINIMAX_API_KEY"} env var.`,
    );
    process.exit(1);
  }

  return {
    provider,
    model: getArg("--model", providerConfig.model),
    apiKey: providerConfig.apiKey,
    baseUrl: providerConfig.baseUrl,
    agent: getArg("--agent", "forge") as "forge" | "explore",
    workdir: getArg("--workdir", process.cwd()),
  };
}

// ── Spinner ─────────────────────────────────────────────────────────
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerInterval: ReturnType<typeof setInterval> | null = null;

function startSpinner(msg: string) {
  let i = 0;
  process.stdout.write(`${c.cyan}${spinnerFrames[0]}${R} ${msg}`);
  spinnerInterval = setInterval(() => {
    i = (i + 1) % spinnerFrames.length;
    process.stdout.write(`\r${c.cyan}${spinnerFrames[i]}${R} ${msg}`);
  }, 80);
}

function stopSpinner() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    process.stdout.write("\r\x1b[K"); // Clear spinner line
  }
}

// ── Session persistence ─────────────────────────────────────────────
const SESSION_DIR = resolve(homedir(), ".aforge", "sessions");

function ensureSessionDir() {
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });
}

function saveSession(id: string, history: string[]) {
  ensureSessionDir();
  writeFileSync(join(SESSION_DIR, `${id}.json`), JSON.stringify({ id, history, savedAt: new Date().toISOString() }, null, 2));
}

function loadSession(id: string): string[] | null {
  const path = join(SESSION_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return data.history ?? [];
  } catch {
    return null;
  }
}

function listSessions(): string[] {
  ensureSessionDir();
  try {
    return require("node:fs").readdirSync(SESSION_DIR)
      .filter((f: string) => f.endsWith(".json"))
      .map((f: string) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

// ── Federation tool discovery ───────────────────────────────────────
interface FederationTool {
  name: string;
  organ: string;
  description: string;
  port: number;
}

const FEDERATION_ORGANS: Array<{ name: string; port: number; health: string }> = [
  { name: "arifOS", port: 8088, health: "/health" },
  { name: "GEOX", port: 8081, health: "/health" },
  { name: "WEALTH", port: 18082, health: "/health" },
  { name: "WELL", port: 18083, health: "/health" },
  { name: "A-FORGE", port: 7071, health: "/health" },
];

async function discoverFederationTools(): Promise<FederationTool[]> {
  const tools: FederationTool[] = [];
  for (const organ of FEDERATION_ORGANS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(`http://127.0.0.1:${organ.port}${organ.health}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      // Try to get tool list
      try {
        const tCtrl = new AbortController();
        const tTimeout = setTimeout(() => tCtrl.abort(), 2000);
        const tResp = await fetch(`http://127.0.0.1:${organ.port}/tools`, { signal: tCtrl.signal });
        clearTimeout(tTimeout);
        if (tResp.ok) {
          const body = await tResp.text();
          // Simple extraction of tool names from JSON response
          const matches = body.matchAll(/"name"\s*:\s*"([^"]+)"/g);
          for (const m of matches) {
            tools.push({ name: m[1], organ: organ.name, description: "", port: organ.port });
          }
        }
      } catch {
        // Tool list not available — organ is up but doesn't expose /tools
      }
    } catch {
      // Organ unreachable — skip
    }
  }
  return tools;
}

// ── Profile builder ─────────────────────────────────────────────────
function buildProfile(mode: TerminalConfig["agent"], workdir: string, federationTools: FederationTool[]): AgentProfile {
  const profileMode = "external_safe_mode";
  
  if (mode === "explore") return buildExploreProfile(profileMode);
  const profile = buildFixProfile(profileMode);
  
  const toolList = federationTools.length > 0
    ? federationTools.map(t => `  - ${t.name} (${t.organ} @ port ${t.port})`).join("\n")
    : "  (no federation tools discovered — local tools only)";

  profile.systemPrompt = [
    profile.systemPrompt,
    "",
    "## SESSION CONTEXT",
    `You are A-FORGE Terminal v0.3.0 — the constitutional coding agent.`,
    `Working directory: ${workdir}`,
    "",
    "## FEDERATION TOOLS AVAILABLE",
    "You have access to these federation MCP tools:",
    toolList,
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
    "5. Be concise. Arif is a geologist, not a coder.",
  ].join("\n");
  return profile;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  process.env.AFORGE_TERMINAL_MODE = "1";
  const config = loadConfig();
  const sessionId = randomUUID().slice(0, 8);

  // Discover federation tools
  console.log(`${D}Discovering federation tools...${R}`);
  const federationTools = await discoverFederationTools();
  const toolCount = federationTools.length;

  console.log(`
${c.cyan}${B}╔══════════════════════════════════════════╗${R}
${c.cyan}${B}║       A-FORGE TERMINAL — v0.3.0          ║${R}
${c.cyan}${B}║   Constitutional Coding Agent Face        ║${R}
${c.cyan}${B}╚══════════════════════════════════════════╝${R}

${D}Provider:${R}   ${config.provider} (${config.model})
${D}Mode:${R}       ${config.agent}
${D}Workdir:${R}    ${config.workdir}
${D}Federation:${R} ${toolCount} tools discovered across ${FEDERATION_ORGANS.length} organs
${D}Floors:${R}     F1-F13 active — constitutional governance enforced
${D}Session:${R}    ${sessionId}
`);

  // Build engine
  const memoryPath = resolve(homedir(), ".aforge", "terminal-memory.json");
  const aforgeDir = resolve(homedir(), ".aforge");
  if (!existsSync(aforgeDir)) mkdirSync(aforgeDir, { recursive: true });

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

  const profile = buildProfile(config.agent, config.workdir, federationTools);

  const engine = new AgentEngine(profile, {
    llmProvider,
    toolRegistry: registry,
    longTermMemory: new LongTermMemory(memoryPath),
    vaultClient: new NoOpVaultClient(),
  });

  // ── Enhanced REPL ─────────────────────────────────────────────────
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.green}A-FORGE ›${R} `,
    terminal: true,
    historySize: 100,
  });

  let sessionCount = 0;
  const history: string[] = [];
  const isTTY = process.stdin.isTTY;
  let taskRunning = false;
  let shouldExit = false;

  const runTask = async (task: string) => {
    if (!task.trim()) return;
    history.push(task);

    taskRunning = true;
    const startTime = Date.now();

    // Start spinner
    startSpinner("Thinking...");

    // Streaming callbacks
    let firstToken = true;
    let streamedContent = "";

    const streamCallbacks = {
      onThinking: () => {
        stopSpinner();
        process.stdout.write(`\n${c.dim}▸ Streaming...${R}\n\n`);
      },
      onToken: (token: string) => {
        if (firstToken) {
          firstToken = false;
        }
        streamedContent += token;
        process.stdout.write(token);
      },
      onComplete: () => {
        process.stdout.write("\n");
      },
    };

    try {
      const result = await engine.run({
        task,
        workingDirectory: config.workdir,
        streamCallbacks,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // If streaming worked, we already printed content
      if (streamedContent.length === 0) {
        console.log(`\n${D}── Response (${result.turnCount} turns, ${elapsed}s, ~${result.totalEstimatedTokens} tokens) ──${R}`);
        console.log(result.finalText);
      }

      console.log(`${D}── ${result.turnCount} turns · ${elapsed}s · ~${result.totalEstimatedTokens} tokens${R}`);

      // Show governance activity
      if (result.metrics.toolCalls > 0) {
        console.log(`${D}⚡ Governance: ${result.metrics.toolCalls} tool calls gated through F1-F13${R}`);
      }

      // Track verdict
      const verdictTag = result.metrics.taskSuccess ? `${c.green}SEAL${R}` : `${c.yellow}HOLD${R}`;
      console.log(`${D}🔒 Verdict: ${verdictTag}${R}`);
    } catch (err) {
      stopSpinner();
      console.error(`\n${c.red}✕ Engine error:${R} ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      stopSpinner();
      taskRunning = false;
      if (shouldExit) {
        console.log(`\n${D}999 SEAL — A-FORGE Terminal closed.${R}`);
        process.exit(0);
      }
    }
  };

  // Auto-save on exit
  process.on("SIGINT", () => {
    stopSpinner();
    if (taskRunning) {
      shouldExit = true;
      console.log(`\n${D}Finishing current task... (Ctrl+C again to force quit)${R}`);
      return;
    }
    saveSession(sessionId, history);
    console.log(`\n${D}999 SEAL — Session ${sessionId} saved. DITEMPA BUKAN DIBERI${R}`);
    process.exit(0);
  });

  if (isTTY) {
    console.log(`${D}Type a task or /help for commands. Ctrl+C to save & quit.${R}\n`);
    rl.prompt();
  }

  // ── Commands ──────────────────────────────────────────────────────
  const commands: Record<string, (args: string) => Promise<void>> = {
    async help() {
      console.log(`
${B}Commands:${R}
  /help          — This help
  /quit, /exit   — Save session and exit
  /clear         — Clear screen
  /agent <mode>  — Switch agent (forge | explore)
  /workdir <dir> — Change working directory
  /status        — Show current session status
  /tools         — List available tools (local + federation)
  /federation    — Federation health check
  /save [name]   — Save session
  /load <name>   — Load a saved session
  /sessions      — List saved sessions
`);
    },
    async quit() {
      saveSession(sessionId, history);
      console.log(`\n${D}999 SEAL — Session ${sessionId} saved.${R}`);
      rl.close();
      process.exit(0);
    },
    async clear() {
      console.clear();
    },
    async agent(args: string) {
      const mode = args.trim() as TerminalConfig["agent"];
      if (mode !== "forge" && mode !== "explore") {
        console.log(`${c.yellow}Usage: /agent forge | explore${R}`);
        return;
      }
      console.log(`${c.yellow}Agent switch requires restart. Re-run with --agent ${mode}${R}`);
    },
    async status() {
      const memPath = resolve(homedir(), ".aforge", "terminal-memory.json");
      const memSize = existsSync(memPath) ? `${(require("node:fs").statSync(memPath).size / 1024).toFixed(1)} KB` : "empty";
      console.log(`
${B}Session Status:${R}
  Provider:    ${config.provider} (${config.model})
  Agent:       ${config.agent}
  Workdir:     ${config.workdir}
  Session:     ${sessionId}
  Tasks:       ${sessionCount} run
  History:     ${history.length} entries
  Memory:      ${memSize}
  Federation:  ${federationTools.length} tools available
  Floors:      F1-F13 active
`);
    },
    async tools() {
      const localTools = registry.listForModel({ enabledTools: new Set<string>(), dangerousToolsEnabled: false, experimentalToolsEnabled: false, holdEnabled: false }).map(t => t.name);
      console.log(`
${B}Local Tools:${R} ${localTools.join(", ")}

${B}Federation Tools:${R}
${federationTools.length > 0
  ? federationTools.map(t => `  ${c.cyan}${t.name}${R} ← ${t.organ} (:${t.port})`).join("\n")
  : `  ${D}(none discovered)${R}`}
`);
    },
    async federation() {
      startSpinner("Probing federation...");
      const results: string[] = [];
      for (const organ of FEDERATION_ORGANS) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 2000);
          const resp = await fetch(`http://127.0.0.1:${organ.port}${organ.health}`, { signal: ctrl.signal });
          clearTimeout(t);
          results.push(resp.ok
            ? `${c.green}●${R} ${organ.name.padEnd(10)} :${organ.port} ${D}UP${R}`
            : `${c.yellow}●${R} ${organ.name.padEnd(10)} :${organ.port} ${D}HTTP ${resp.status}${R}`);
        } catch {
          results.push(`${c.red}●${R} ${organ.name.padEnd(10)} :${organ.port} ${D}DOWN${R}`);
        }
      }
      stopSpinner();
      console.log(`\n${B}Federation Health:${R}\n${results.join("\n")}\n`);
    },
    async save(args: string) {
      const name = args.trim() || sessionId;
      saveSession(name, history);
      console.log(`${c.green}✓${R} Session saved as "${name}" (${history.length} entries)\n`);
    },
    async load(args: string) {
      const name = args.trim();
      if (!name) {
        console.log(`${c.yellow}Usage: /load <session-name>${R}`);
        return;
      }
      const data = loadSession(name);
      if (!data) {
        console.log(`${c.red}Session "${name}" not found.${R} Use /sessions to list.`);
        return;
      }
      console.log(`${c.green}✓${R} Loaded session "${name}" (${data.length} entries). Replay with /replay.`);
    },
    async sessions() {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log(`${D}No saved sessions.${R}`);
        return;
      }
      console.log(`\n${B}Saved Sessions:${R}`);
      for (const s of sessions) {
        const path = join(SESSION_DIR, `${s}.json`);
        const stat = require("node:fs").statSync(path);
        const entries = loadSession(s)?.length ?? 0;
        console.log(`  ${c.cyan}${s}${R} — ${entries} entries, ${stat.mtime.toISOString().slice(0, 16)}`);
      }
      console.log("");
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
        console.log(`${c.yellow}Unknown command: /${cmd}. Type /help for commands.${R}`);
      }
      if (isTTY && !taskRunning) rl.prompt();
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
    stopSpinner();
    if (!taskRunning) {
      saveSession(sessionId, history);
      console.log(`\n${D}DITEMPA BUKAN DIBERI${R}`);
      process.exit(0);
    }
    shouldExit = true;
  });

  rl.prompt();
}

main().catch((err) => {
  console.error(`${c.red}FATAL:${R} ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
