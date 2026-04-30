/**
 * MiniMax MCP Client — Raw stdio subprocess bridge
 *
 * Spawns `minimax-coding-plan-mcp --transport stdio` and communicates
 * via JSON-RPC 2.0 over stdin/stdout.
 *
 * @module tools/MiniMaxMcpClient
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

const MINIMAX_MCP_CMD = process.env.MINIMAX_MCP_CMD || "minimax-coding-plan-mcp";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class MiniMaxMcpClient {
  private proc: ReturnType<typeof spawn> | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  private ready = false;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.ready) return;

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error("MINIMAX_API_KEY not set");

    const env = { ...process.env, MINIMAX_API_KEY: apiKey };

    this.proc = spawn(MINIMAX_MCP_CMD, ["--transport", "stdio"], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout = this.proc.stdout!;
    const stderr = this.proc.stderr!;

    // Collect stderr for logging
    let stderrData = "";
    stderr.on("data", (chunk) => { stderrData += chunk.toString(); });
    this.proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`MiniMax MCP exit code ${code}: ${stderrData}`);
      }
    });

    // Initialize handshake
    await this.sendRaw({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "A-FORGE", version: "2026.04.30" },
      },
    });

    // Send initialized notification
    await this.sendRaw({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    } as JsonRpcRequest);

    // Drain until we get the initialize response (server may print logs before JSON)
    let drain = "";
    const drainChunk = (chunk: Buffer) => { drain += chunk.toString(); };
    stdout.on("data", drainChunk);
    await this.recvRaw();
    stdout.removeListener("data", drainChunk);

    // Re-spawn clean now that we're initialized
    this.proc.kill();
    this.proc = spawn(MINIMAX_MCP_CMD, ["--transport", "stdio"], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const newStdout = this.proc.stdout!;
    const newStderr = this.proc.stderr!;
    let newStderrData = "";
    newStderr.on("data", (chunk) => { newStderrData += chunk.toString(); });
    this.proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`MiniMax MCP re-spawn exit code ${code}: ${newStderrData}`);
      }
    });

    // Re-initialize
    await this.sendRaw({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "A-FORGE", version: "2026.04.30" },
      },
    });

    await this.sendRaw({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    } as JsonRpcRequest);

    // Drain init response
    const initDrain = new Promise<void>((resolve) => {
      const listener = (chunk: Buffer) => {
        const line = chunk.toString();
        if (line.startsWith("{")) { newStdout.removeListener("data", listener); resolve(); }
      };
      newStdout.on("data", listener);
    });
    await initDrain;
    await this.recvRaw();

    // Wire up the actual response handler
    newStdout.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const resp: JsonRpcResponse = JSON.parse(line);
          const pending = this.pending.get(resp.id!);
          if (pending) {
            this.pending.delete(resp.id!);
            if (resp.error) pending.reject(new Error(`${resp.error.message}`));
            else pending.resolve(resp.result);
          }
        } catch { /* ignore non-JSON lines */ }
      }
    });

    this.ready = true;
  }

  private async sendRaw(req: JsonRpcRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = this.proc!;
      const data = JSON.stringify(req) + "\n";
      const ok = proc.stdin!.write(data, () => resolve());
      if (!ok) proc.stdin!.once("drain", resolve);
      proc.stdin!.on("error", reject);
    });
  }

  private async recvRaw(): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const proc = this.proc!;
      const chunks: Buffer[] = [];
      proc.stdout!.once("data", (chunk: Buffer) => {
        chunks.push(chunk);
        try {
          const line = chunk.toString().trim();
          if (line) resolve(JSON.parse(line));
          else reject(new Error("Empty response from MiniMax MCP"));
        } catch {
          reject(new Error(`Invalid JSON from MiniMax MCP: ${chunk.toString().slice(0, 100)}`));
        }
      });
      proc.stdout!.on("error", reject);
    });
  }

  private async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.initPromise) this.initPromise = this.init();
    await this.initPromise;

    if (!this.proc || this.proc.killed) {
      this.ready = false;
      this.initPromise = this.init();
      await this.initPromise;
    }

    const id = ++this.requestId;
    await this.sendRaw({ jsonrpc: "2.0", id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error("MiniMax MCP timeout")); }
      }, 60000);
    });
  }

  async webSearch(query: string): Promise<string> {
    const result = await this.call("tools/call", {
      name: "web_search",
      arguments: { query },
    }) as { content?: Array<{ type: string; text: string }> };

    if (!result?.content?.length) return JSON.stringify({ organic: [], status: "no content" });

    const text = result.content[0].text;
    try { return JSON.stringify(JSON.parse(text)); }
    catch { return JSON.stringify({ result: text, status: "ok" }); }
  }

  async understandImage(imageSource: string, prompt = ""): Promise<string> {
    const args: Record<string, unknown> = { image_source: imageSource };
    if (prompt) args.prompt = prompt;

    const result = await this.call("tools/call", { name: "understand_image", arguments: args }) as {
      content?: Array<{ type: string; text: string }>;
    };

    if (!result?.content?.length) return JSON.stringify({ result: "", status: "no content" });

    const text = result.content[0].text;
    try { return JSON.stringify(JSON.parse(text)); }
    catch { return JSON.stringify({ result: text, status: "ok" }); }
  }

  close(): void {
    this.proc?.kill();
    this.proc = null;
    this.ready = false;
    this.initPromise = null;
  }
}

// Singleton for A-FORGE runtime
let _client: MiniMaxMcpClient | null = null;

export function getMiniMaxClient(): MiniMaxMcpClient {
  if (!_client) _client = new MiniMaxMcpClient();
  return _client;
}
