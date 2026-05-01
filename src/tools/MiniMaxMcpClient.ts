/**
 * MiniMax MCP Client — Raw stdio subprocess bridge
 *
 * Spawns `minimax-coding-plan-mcp --transport stdio` and communicates
 * via JSON-RPC 2.0 over stdin/stdout.
 *
 * @module tools/MiniMaxMcpClient
 */

import { spawn } from "node:child_process";

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
  private buf = "";

  private async init(): Promise<void> {
    if (this.ready) return;

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error("MINIMAX_API_KEY not set");

    const env = { ...process.env, MINIMAX_API_KEY: apiKey };

    this.proc = spawn(MINIMAX_MCP_CMD, ["--transport", "stdio"], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdin = this.proc.stdin!;
    const stdout = this.proc.stdout!;
    const stderr = this.proc.stderr!;

    let stderrData = "";
    stderr.on("data", (chunk) => { stderrData += chunk.toString(); });
    this.proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`MiniMax MCP exit code ${code}: ${stderrData.slice(0, 200)}`);
      }
    });

    // Wire up response handler — collect lines and resolve pending requests
    stdout.on("data", (chunk) => {
      this.buf += chunk.toString();
      const lines = this.buf.split("\n");
      this.buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const resp: JsonRpcResponse = JSON.parse(line);
          if (resp.id !== undefined) {
            const p = this.pending.get(resp.id);
            if (p) {
              this.pending.delete(resp.id);
              if (resp.error) p.reject(new Error(`${resp.error.message}`));
              else p.resolve(resp.result);
            }
          }
        } catch { /* ignore non-JSON lines */ }
      }
    });

    // Send initialize and wait for response
    const initId = ++this.requestId;
    const initPromise = new Promise<void>((resolve, reject) => {
      this.pending.set(initId, {
        resolve: () => { resolve(); },
        reject,
      });
    });

    stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: initId,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "A-FORGE", version: "2026.04.30" },
      },
    }) + "\n");

    // Wait with timeout
    await Promise.race([
      initPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("MiniMax init timeout")), 10000)),
    ]);

    // Send notifications/initialized
    stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }) + "\n");

    this.ready = true;
  }

  async webSearch(query: string): Promise<string> {
    await this.init();

    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (result) => {
          try {
            const r = result as { content?: Array<{ type: string; text: string }> };
            if (!r?.content?.length) {
              resolve(JSON.stringify({ organic: [], status: "no content" }));
              return;
            }
            const text = r.content[0].text;
            try { resolve(JSON.stringify(JSON.parse(text))); }
            catch { resolve(JSON.stringify({ result: text, status: "ok" })); }
          } catch (e) { reject(e); }
        },
        reject,
      });

      this.proc!.stdin!.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: "web_search", arguments: { query } },
      }) + "\n");

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("web_search timeout"));
        }
      }, 60000);
    });
  }

  async understandImage(imageSource: string, prompt = ""): Promise<string> {
    await this.init();

    const args: Record<string, unknown> = { image_source: imageSource };
    if (prompt) args.prompt = prompt;

    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (result) => {
          try {
            const r = result as { content?: Array<{ type: string; text: string }> };
            if (!r?.content?.length) {
              resolve(JSON.stringify({ result: "", status: "no content" }));
              return;
            }
            const text = r.content[0].text;
            try { resolve(JSON.stringify(JSON.parse(text))); }
            catch { resolve(JSON.stringify({ result: text, status: "ok" })); }
          } catch (e) { reject(e); }
        },
        reject,
      });

      this.proc!.stdin!.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: "understand_image", arguments: args },
      }) + "\n");

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("understand_image timeout"));
        }
      }, 60000);
    });
  }

  close(): void {
    this.proc?.kill();
    this.proc = null;
    this.ready = false;
    this.pending.clear();
    this.buf = "";
  }
}

// Singleton for A-FORGE runtime
let _client: MiniMaxMcpClient | null = null;

export function getMiniMaxClient(): MiniMaxMcpClient {
  if (!_client) _client = new MiniMaxMcpClient();
  return _client;
}
