/**
 * F13HaltChannel — Sovereign veto channel.
 *
 * Authority: Telegram bot (verified Arif) + AAA/A2A bridge (verified Arif session) + local emergency file.
 *
 * Production uses Redis pub/sub on `arifos:halt`. For local/testing or
 * when Redis is unavailable, falls back to in-process EventEmitter.
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 * @constitutional F13 SOVEREIGN — absolute halt authority
 */

import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Default file path for cross-process halt channel ─────────────────

const DEFAULT_HALT_FILE = "/var/lib/aforge/f13_halts.jsonl";

// ─── Halt message shape ───────────────────────────────────────────────

export type F13Source = "telegram" | "aaa_a2a" | "local";

export type F13Scope = "action" | "tool" | "organ" | "federation";

export interface F13HaltMessage {
  type: "F13_HALT";
  issued_by: string;
  source: F13Source;
  scope: F13Scope;
  /** Target identifier (action_id, tool_name, organ name, or "all"). */
  target: string;
  reason: string;
  issued_at: string;
  nonce: string;
  signature_or_token: string;
}

// ─── Channel interface ────────────────────────────────────────────────

export interface F13HaltChannel {
  publish(msg: F13HaltMessage): Promise<void>;
  subscribe(handler: (msg: F13HaltMessage) => void): () => void;
  isActive(scope: F13Scope, target: string): boolean;
  /** Test-only: clear all halts. */
  reset(): void;
}

// ─── In-process implementation (default for now) ──────────────────────

class InProcessHaltChannel implements F13HaltChannel {
  private readonly emitter = new EventEmitter();
  private readonly activeHalts = new Map<string, F13HaltMessage>();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  async publish(msg: F13HaltMessage): Promise<void> {
    if (!isValidHaltMessage(msg)) {
      // Invalid halt: log but ignore (per canon rule)
      // eslint-disable-next-line no-console
      console.warn(`[F13_HALT] invalid message ignored: ${JSON.stringify(msg)}`);
      return;
    }
    const key = `${msg.scope}:${msg.target}`;
    this.activeHalts.set(key, msg);
    this.emitter.emit("halt", msg);
  }

  subscribe(handler: (msg: F13HaltMessage) => void): () => void {
    this.emitter.on("halt", handler);
    return () => this.emitter.off("halt", handler);
  }

  isActive(scope: F13Scope, target: string): boolean {
    // Federation-scope halts affect everything
    if (this.activeHalts.has(`federation:all`)) return true;
    // Specific scope/target
    if (this.activeHalts.has(`${scope}:${target}`)) return true;
    // "all" target within scope
    if (this.activeHalts.has(`${scope}:all`)) return true;
    return false;
  }

  reset(): void {
    this.activeHalts.clear();
  }
}

// ─── File-backed cross-process implementation ────────────────────────

export class FileBackedHaltChannel implements F13HaltChannel {
  private readonly emitter = new EventEmitter();
  private readonly activeHalts = new Map<string, F13HaltMessage>();
  private readonly haltFile: string;
  private watching: boolean = false;

  constructor(haltFile?: string) {
    this.haltFile = haltFile ?? process.env.ARIFOS_F13_HALT_FILE ?? DEFAULT_HALT_FILE;
    this.emitter.setMaxListeners(100);
    this.loadFromFile();
    this.startWatching();
  }

  private ensureDir(): void {
    const dir = path.dirname(this.haltFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadFromFile(): void {
    try {
      if (!fs.existsSync(this.haltFile)) return;
      const lines = fs.readFileSync(this.haltFile, "utf-8").trim().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as F13HaltMessage;
          if (isValidHaltMessage(msg)) {
            const key = `${msg.scope}:${msg.target}`;
            this.activeHalts.set(key, msg);
          }
        } catch {
          // Skip malformed lines — don't block startup on corrupt halt file
        }
      }
    } catch (err) {
      // File may not exist or be unreadable — proceed with empty state
      // eslint-disable-next-line no-console
      console.warn(`[F13_HALT] Could not load halt file ${this.haltFile}: ${err}`);
    }
  }

  private startWatching(): void {
    try {
      this.ensureDir();
      if (!fs.existsSync(this.haltFile)) {
        fs.writeFileSync(this.haltFile, "", "utf-8");
      }
      fs.watchFile(this.haltFile, { interval: 2000 }, () => {
        this.reloadFromFile();
      });
      this.watching = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[F13_HALT] Could not watch halt file ${this.haltFile}: ${err}`);
    }
  }

  private reloadFromFile(): void {
    try {
      if (!fs.existsSync(this.haltFile)) return;
      const content = fs.readFileSync(this.haltFile, "utf-8").trim();
      const lines = content.split("\n");
      const loaded = new Map<string, F13HaltMessage>();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as F13HaltMessage;
          if (isValidHaltMessage(msg)) {
            const key = `${msg.scope}:${msg.target}`;
            loaded.set(key, msg);
          }
        } catch {
          // Skip
        }
      }

      // Detect new halts (in file but not in memory) and fire them
      for (const [key, msg] of loaded) {
        if (!this.activeHalts.has(key)) {
          this.activeHalts.set(key, msg);
          this.emitter.emit("halt", msg);
        }
      }

      // Detect removed halts (in memory but not in file) and clear them
      for (const key of this.activeHalts.keys()) {
        if (!loaded.has(key)) {
          this.activeHalts.delete(key);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[F13_HALT] Error reloading halt file: ${err}`);
    }
  }

  async publish(msg: F13HaltMessage): Promise<void> {
    if (!isValidHaltMessage(msg)) {
      // eslint-disable-next-line no-console
      console.warn(`[F13_HALT] invalid message ignored: ${JSON.stringify(msg)}`);
      return;
    }
    const key = `${msg.scope}:${msg.target}`;
    this.activeHalts.set(key, msg);

    // Append to file for cross-process visibility
    try {
      this.ensureDir();
      fs.appendFileSync(this.haltFile, JSON.stringify(msg) + "\n", "utf-8");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[F13_HALT] Could not write halt to file ${this.haltFile}: ${err}`);
      // Still fire in-process — partial degradation
    }

    this.emitter.emit("halt", msg);
  }

  subscribe(handler: (msg: F13HaltMessage) => void): () => void {
    this.emitter.on("halt", handler);
    return () => this.emitter.off("halt", handler);
  }

  isActive(scope: F13Scope, target: string): boolean {
    if (this.activeHalts.has(`federation:all`)) return true;
    if (this.activeHalts.has(`${scope}:${target}`)) return true;
    if (this.activeHalts.has(`${scope}:all`)) return true;
    return false;
  }

  reset(): void {
    this.activeHalts.clear();
    if (this.watching) {
      try {
        fs.unwatchFile(this.haltFile);
      } catch {
        // Best effort
      }
      this.watching = false;
    }
    try {
      if (fs.existsSync(this.haltFile)) {
        fs.writeFileSync(this.haltFile, "", "utf-8");
      }
    } catch {
      // Best effort
    }
  }
}

// ─── Message validation ──────────────────────────────────────────────

export function isValidHaltMessage(msg: unknown): msg is F13HaltMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  if (m.type !== "F13_HALT") return false;
  if (typeof m.issued_by !== "string" || m.issued_by.length === 0) return false;
  if (m.source !== "telegram" && m.source !== "aaa_a2a" && m.source !== "local") return false;
  if (m.scope !== "action" && m.scope !== "tool" && m.scope !== "organ" && m.scope !== "federation") return false;
  if (typeof m.target !== "string" || m.target.length === 0) return false;
  if (typeof m.reason !== "string" || m.reason.length === 0) return false;
  if (typeof m.issued_at !== "string") return false;
  if (typeof m.nonce !== "string" || m.nonce.length === 0) return false;
  if (typeof m.signature_or_token !== "string" || m.signature_or_token.length === 0) return false;
  return true;
}

// ─── Singleton (channel selection by env) ────────────────────────────

let _channel: F13HaltChannel | null = null;

/**
 * Get the F13 halt channel.
 *
 * Channel selection (via ARIFOS_F13_CHANNEL env var):
 *   "file"  — FileBackedHaltChannel (production cross-process, default path /var/lib/aforge/f13_halts.jsonl)
 *   "redis" — (reserved for future Redis implementation, falls back to file)
 *   unset   — InProcessHaltChannel (development/testing, dies with process)
 *
 * File path override: ARIFOS_F13_HALT_FILE
 */
export function getF13HaltChannel(): F13HaltChannel {
  if (_channel) return _channel;

  const channelType = process.env.ARIFOS_F13_CHANNEL?.toLowerCase();

  switch (channelType) {
    case "file":
    case "redis":  // Redis not yet implemented — fall through to file
      _channel = new FileBackedHaltChannel();
      break;
    default:
      _channel = new InProcessHaltChannel();
      break;
  }

  return _channel;
}

/**
 * Reset the channel (test-only).
 */
export function resetF13HaltChannel(): void {
  if (_channel) _channel.reset();
}

// ─── Publisher helpers ───────────────────────────────────────────────

/**
 * Issue an F13 halt. For local/testing use. Production should use
 * the Telegram bot or AAA/A2A bridge.
 */
export async function issueF13Halt(
  source: F13Source,
  scope: F13Scope,
  target: string,
  reason: string,
  issuedBy: string = "arif",
): Promise<void> {
  await getF13HaltChannel().publish({
    type: "F13_HALT",
    issued_by: issuedBy,
    source,
    scope,
    target,
    reason,
    issued_at: new Date().toISOString(),
    nonce: crypto.randomUUID(),
    signature_or_token: "local-test-token",
  });
}
