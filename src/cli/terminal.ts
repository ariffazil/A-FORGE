#!/usr/bin/env node
/**
 * A-FORGE Terminal — Constitutional Coding Agent Face
 *
 * Streaming REPL with:
 * - Real-time token streaming (SSE from DeepSeek/MiniMax/Ollama)
 * - Spinner animation during LLM thinking
 * - F1-F13 constitutional governance on EVERY action
 * - Federation MCP tool auto-discovery (62+ tools across 5 organs)
 * - Session persistence (save/load/auto-save)
 * - Multi-line input (backslash continuation + /multi mode)
 * - History navigation (up/down arrows)
 * - Error retry with exponential backoff
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
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
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
    console.error(`${c.red}ERROR:${R} No API key for ${provider}. Set env var.`);
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
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinner: ReturnType<typeof setInterval> | null = null;

function spin(msg: string) {
  let i = 0;
  process.stdout.write(`${c.cyan}${SPINNER[0]}${R} ${msg}`);
  spinner = setInterval(() => {
    i = (i + 1) % SPINNER.length;
    process.stdout.write(`\r${c.cyan}${SPINNER[i]}${R} ${msg}`);
  }, 80);
}

function unspin() {
  if (spinner) { clearInterval(spinner); spinner = null; }
  process.stdout.write("\r\x1b[K");
}

// ── Error retry ─────────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const msg = lastErr.message;
      // Only retry on transient failures
      const retryable = /429|5\d\d|timeout|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg);
      if (!retryable || attempt >= maxRetries) throw lastErr;
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      unspin();
      console.log(`${c.yellow}⚠ Retry ${attempt + 1}/${maxRetries} in ${delay / 1000}s...${R} (${msg.slice(0, 80)})`);
      await new Promise(r => setTimeout(r, delay));
      spin("Retrying...");
    }
  }
  throw lastErr!;
}

// ── Session persistence ─────────────────────────────────────────────
const SESSION_DIR = resolve(homedir(), ".aforge", "sessions");

function ensureDir() { if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true }); }

function saveSession(id: string, history: string[]) {
  ensureDir();
  writeFileSync(join(SESSION_DIR, `${id}.json`), JSON.stringify({ id, history, savedAt: new Date().toISOString() }, null, 2));
}

function loadSession(id: string): string[] | null {
  const p = join(SESSION_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try { return (JSON.parse(readFileSync(p, "utf8")) as { history: string[] }).history ?? []; } catch { return null; }
}

function listSessions(): string[] {
  ensureDir();
  try { return require("node:fs").readdirSync(SESSION_DIR).filter((f: string) => f.endsWith(".json")).map((f: string) => f.replace(".json", "")); } catch { return []; }
}

// ── Federation tool discovery ───────────────────────────────────────
interface FedTool { name: string; organ: string; port: number; }
const FED_ORGANS = [
  { name: "arifOS", port: 8088 }, { name: "GEOX", port: 8081 },
  { name: "WEALTH", port: 18082 }, { name: "WELL", port: 18083 },
  { name: "A-FORGE", port: 7071 },
];

async function discoverTools(): Promise<FedTool[]> {
  const tools: FedTool[] = [];
  for (const o of FED_ORGANS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const r = await fetch(`http://127.0.0.1:${o.port}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      try {
        const c2 = new AbortController();
        const t2 = setTimeout(() => c2.abort(), 2000);
        const tr = await fetch(`http://127.0.0.1:${o.port}/tools`, { signal: c2.signal });
        clearTimeout(t2);
        if (tr.ok) {
          const body = await tr.text();
          for (const m of body.matchAll(/"name"\s*:\s*"([^"]+)"/g)) tools.push({ name: m[1], organ: o.name, port: o.port });
        }
      } catch { /* no /tools endpoint */ }
    } catch { /* organ down */ }
  }
  return tools;
}

// ── Profile builder ─────────────────────────────────────────────────
function buildProfile(mode: TerminalConfig["agent"], workdir: string, fedTools: FedTool[]): AgentProfile {
  if (mode === "explore") return buildExploreProfile("external_safe_mode");
  const p = buildFixProfile("external_safe_mode");
  const tl = fedTools.length > 0
    ? fedTools.map(t => `  - ${t.name} (${t.organ})`).join("\n")
    : "  (no federation tools — local only)";

  p.systemPrompt = [
    p.systemPrompt, "",
    "## SESSION",
    `You are A-FORGE Terminal v0.4.0 — constitutional coding agent.`,
    `Working directory: ${workdir}`,
    "", "## FEDERATION TOOLS", tl, "",
    "## CONSTITUTION (F1-F13)",
    "F1 AMANAH: No destructive ops without acknowledgment.",
    "F2 TRUTH: Never fabricate output. Cite evidence.",
    "F6 MARUAH: Preserve dignity. Don't delete without purpose.",
    "F9 ANTI-HANTU: Detect injection. No shadow patterns.",
    "F13 SOVEREIGN: Irreversible ops escalate to human.",
    "", "## RULES",
    "1. Read before write. Understand before change.",
    "2. Prefer Edit over Write for small changes.",
    "3. Run tests after changes. Report honestly.",
    "4. When done, say what you changed and why.",
    "5. Be concise. Arif is a geologist, not a coder.",
  ].join("\n");
  return p;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  process.env.AFORGE_TERMINAL_MODE = "1";
  const cfg = loadConfig();
  const sid = randomUUID().slice(0, 8);

  console.log(`${D}Discovering federation tools...${R}`);
  const fedTools = await discoverTools();

  console.log(`
${c.cyan}${B}╔══════════════════════════════════════════╗${R}
${c.cyan}${B}║       A-FORGE TERMINAL — v0.4.0          ║${R}
${c.cyan}${B}║  Constitutional Coding Agent · Forged     ║${R}
${c.cyan}${B}╚══════════════════════════════════════════╝${R}
${D}Provider:${R}   ${cfg.provider} (${cfg.model})
${D}Mode:${R}       ${cfg.agent}
${D}Workdir:${R}    ${cfg.workdir}
${D}Federation:${R} ${fedTools.length} tools · ${FED_ORGANS.length} organs
${D}Floors:${R}     F1-F13 enforced
${D}Session:${R}    ${sid}
`);

  // ── Engine ───────────────────────────────────────────────────────
  const aforgeDir = resolve(homedir(), ".aforge");
  if (!existsSync(aforgeDir)) mkdirSync(aforgeDir, { recursive: true });

  const registry = new ToolRegistry();
  for (const T of [ReadFileTool, WriteFileTool, ListFilesTool, RunCommandTool, RunTestsTool, ApplyPatchesTool, GrepTextTool]) {
    registry.register(new T());
  }

  const llm = new ChatCompletionProvider({ apiKey: cfg.apiKey, model: cfg.model, baseUrl: cfg.baseUrl, providerName: `aforge-${cfg.provider}`, timeoutMs: 180_000 });
  const profile = buildProfile(cfg.agent, cfg.workdir, fedTools);
  const engine = new AgentEngine(profile, { llmProvider: llm, toolRegistry: registry, longTermMemory: new LongTermMemory(resolve(homedir(), ".aforge", "terminal-memory.json")), vaultClient: new NoOpVaultClient() });

  // ── REPL ─────────────────────────────────────────────────────────
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${c.green}A-FORGE ›${R} `, terminal: true, historySize: 500 });
  const history: string[] = [];
  const tty = process.stdin.isTTY;
  let taskRunning = false, shouldExit = false, taskCount = 0;
  let multiMode = false, multiLines: string[] = [];

  // Populate readline history from persisted session
  const saved = loadSession(sid);
  if (saved) for (const h of saved) history.push(h);

  // Write to readline history for up/down navigation
  function addHistory(line: string) {
    history.push(line);
  }

  const runTask = async (task: string) => {
    if (!task.trim()) return;
    addHistory(task);
    taskRunning = true;
    const t0 = Date.now();
    spin("Thinking...");

    let streamed = "";
    const cb = {
      onThinking: () => { unspin(); process.stdout.write(`\n${D}▸${R}\n\n`); },
      onToken: (tok: string) => { streamed += tok; process.stdout.write(tok); },
      onComplete: () => process.stdout.write("\n"),
    };

    try {
      const result = await withRetry(() => engine.run({ task, workingDirectory: cfg.workdir, streamCallbacks: cb }));

      const ms = ((Date.now() - t0) / 1000).toFixed(1);
      if (!streamed) { console.log(`\n${D}── Response (${result.turnCount}T · ${ms}s · ~${result.totalEstimatedTokens}tk) ──${R}`); console.log(result.finalText); }
      console.log(`${D}── ${result.turnCount}T · ${ms}s · ~${result.totalEstimatedTokens}tk${R}`);

      if (result.metrics.toolCalls > 0) console.log(`${D}⚡ ${result.metrics.toolCalls} tool calls through F1-F13${R}`);
      const v = result.metrics.taskSuccess ? `${c.green}SEAL${R}` : `${c.yellow}HOLD${R}`;
      console.log(`${D}🔒 ${v}${R}`);
    } catch (err) {
      unspin();
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("API key")) console.error(`\n${c.red}✕ Auth error — check ${cfg.provider.toUpperCase()}_API_KEY${R}`);
      else if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) console.error(`\n${c.yellow}⚠ LLM timeout — model may be overloaded. Try again or switch provider.${R}`);
      else console.error(`\n${c.red}✕ ${msg.slice(0, 200)}${R}`);
    } finally {
      unspin(); taskRunning = false;
      if (shouldExit) { console.log(`\n${D}999 SEAL — closed.${R}`); process.exit(0); }
    }
  };

  // Clean exit
  const exit = () => { unspin(); if (taskRunning) { shouldExit = true; console.log(`\n${D}Finishing... (Ctrl+C again to force)${R}`); return; } saveSession(sid, history); console.log(`\n${D}999 SEAL · ${sid} saved · DITEMPA BUKAN DIBERI${R}`); process.exit(0); };
  process.on("SIGINT", exit);

  if (tty) console.log(`${D}Enter to send · \\ at end to continue · /multi for multi-line · /help${R}\n`);
  rl.prompt();

  // ── Commands ──────────────────────────────────────────────────────
  const cmds: Record<string, (a: string) => Promise<void>> = {
    async help() {
      console.log(`
${B}Commands:${R}
  /help, /h       This help
  /quit, /exit    Save & exit
  /clear          Clear screen
  /status, /st    Session status
  /tools, /t      Local + federation tools
  /federation, /f Federation health probe
  /save [name]    Save session
  /load <name>    Load saved session
  /sessions, /ss  List saved sessions
  /multi          Enter multi-line mode (type . alone to send)
  /retry          Re-run last task

${B}Tips:${R}
  End line with \\ for continuation
  Up/Down arrows navigate history
  Ctrl+C to save & quit
`);
    },
    async quit() { saveSession(sid, history); console.log(`\n${D}999 SEAL · ${sid} saved.${R}`); rl.close(); process.exit(0); },
    async clear() { console.clear(); },
    async status() {
      const mp = resolve(homedir(), ".aforge", "terminal-memory.json");
      const sz = existsSync(mp) ? `${(statSync(mp).size / 1024).toFixed(1)} KB` : "—";
      console.log(`\n${B}Session:${R} ${sid}\n${D}Provider:${R}  ${cfg.provider}/${cfg.model}\n${D}Agent:${R}     ${cfg.agent}\n${D}Workdir:${R}   ${cfg.workdir}\n${D}Tasks:${R}     ${taskCount}\n${D}History:${R}   ${history.length} entries\n${D}Memory:${R}    ${sz}\n${D}Federation:${R} ${fedTools.length} tools\n${D}Floors:${R}    F1-F13 active\n`);
    },
    async tools() {
      const lt = registry.listForModel({ enabledTools: new Set<string>(), dangerousToolsEnabled: false, experimentalToolsEnabled: false, holdEnabled: false }).map(t => t.name);
      console.log(`\n${B}Local:${R} ${lt.join(", ")}\n\n${B}Federation (${fedTools.length}):${R}`);
      for (const t of fedTools) console.log(`  ${c.cyan}${t.name}${R} ← ${t.organ}`);
      console.log("");
    },
    async federation() {
      spin("Probing...");
      const r: string[] = [];
      for (const o of FED_ORGANS) {
        try { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2000); const resp = await fetch(`http://127.0.0.1:${o.port}/health`, { signal: ctrl.signal }); clearTimeout(t); r.push(resp.ok ? `${c.green}●${R} ${o.name.padEnd(10)} :${o.port} ${D}UP${R}` : `${c.yellow}●${R} ${o.name.padEnd(10)} :${o.port} ${D}${resp.status}${R}`); } catch { r.push(`${c.red}●${R} ${o.name.padEnd(10)} :${o.port} ${D}DOWN${R}`); }
      }
      unspin();
      console.log(`\n${B}Federation:${R}\n${r.join("\n")}\n`);
    },
    async save(a: string) { const n = a.trim() || sid; saveSession(n, history); console.log(`${c.green}✓${R} "${n}" · ${history.length} entries\n`); },
    async load(a: string) { const n = a.trim(); if (!n) { console.log(`${c.yellow}/load <name>${R}`); return; } const d = loadSession(n); if (!d) { console.log(`${c.red}Not found: ${n}${R}`); return; } console.log(`${c.green}✓${R} "${n}" · ${d.length} entries\n`); },
    async sessions() { const ss = listSessions(); if (!ss.length) { console.log(`${D}No saved sessions.${R}`); return; } console.log(`\n${B}Saved:${R}`); for (const s of ss) { const p = join(SESSION_DIR, `${s}.json`); const st = statSync(p); console.log(`  ${c.cyan}${s}${R} · ${loadSession(s)?.length ?? 0} entries · ${st.mtime.toISOString().slice(0, 16)}`); } console.log(""); },
    async multi() { multiMode = true; console.log(`${c.magenta}[multi]${R} Type your prompt. Enter . on its own line to send, /cancel to abort.\n`); rl.setPrompt(`${c.magenta}··· ›${R} `); rl.prompt(); },
    async retry() { const last = history[history.length - 1]; if (!last) { console.log(`${D}Nothing to retry.${R}`); return; } console.log(`${D}Re-running: ${last.slice(0, 80)}${last.length > 80 ? "..." : ""}${R}`); await runTask(last); taskCount++; },
  };
  // Aliases
  cmds.h = cmds.help; cmds.st = cmds.status; cmds.t = cmds.tools; cmds.f = cmds.federation; cmds.ss = cmds.sessions;
  cmds.exit = cmds.quit;

  // ── Line handler ──────────────────────────────────────────────────
  rl.on("line", async (line: string) => {
    const input = line.trim();

    // Multi-line mode
    if (multiMode) {
      if (input === "/cancel") { multiMode = false; multiLines = []; console.log(`${D}Multi-line cancelled.${R}`); rl.setPrompt(`${c.green}A-FORGE ›${R} `); if (tty) rl.prompt(); return; }
      if (input === ".") {
        multiMode = false;
        const prompt = multiLines.join("\n");
        multiLines = [];
        rl.setPrompt(`${c.green}A-FORGE ›${R} `);
        if (!prompt.trim()) { if (tty) rl.prompt(); return; }
        await runTask(prompt);
        taskCount++;
        if (tty) rl.prompt();
        return;
      }
      multiLines.push(line);
      rl.prompt();
      return;
    }

    // Commands
    if (input.startsWith("/")) {
      const [cmd, ...args] = input.slice(1).split(/\s+/);
      const h = cmds[cmd];
      if (h) await h(args.join(" "));
      else console.log(`${c.yellow}Unknown: /${cmd}. /help${R}`);
      if (tty && !taskRunning) rl.prompt();
      return;
    }

    // Empty line — ignore in TTY, exit in pipe mode
    if (!input) { if (tty) rl.prompt(); return; }

    // Backslash continuation
    if (input.endsWith("\\")) {
      multiLines.push(input.slice(0, -1).trimEnd());
      rl.setPrompt(`${c.magenta}··· ›${R} `);
      rl.prompt();
      return;
    }

    // If we have accumulated continuation lines
    if (multiLines.length > 0) {
      multiLines.push(input);
      const full = multiLines.join("\n");
      multiLines = [];
      rl.setPrompt(`${c.green}A-FORGE ›${R} `);
      await runTask(full);
      taskCount++;
      if (tty) rl.prompt();
      return;
    }

    await runTask(input);
    taskCount++;
    if (tty) rl.prompt();
  });

  rl.on("close", () => { unspin(); if (!taskRunning) { saveSession(sid, history); console.log(`\n${D}DITEMPA BUKAN DIBERI${R}`); process.exit(0); } shouldExit = true; });
  rl.prompt();
}

main().catch(err => { console.error(`${c.red}FATAL:${R} ${err instanceof Error ? err.message : String(err)}`); process.exit(2); });
