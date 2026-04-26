/**
 * Sentinel Stream — State Broadcast Bus (F4 Clarity)
 * =================================================
 * Asynchronous SSE pub/sub channel for inter-agent state broadcasts.
 * Every agent action fires a broadcast; other agents subscribe and
 * enter READ_ONLY when their target sector is affected.
 *
 * Server: POST /broadcast → SSE subscription → clients get events.
 * Ditempa Bukan Diberi.
 */

import { createServer, Server as HttpServer } from "http";
import { randomUUID } from "crypto";

export type BroadcastEventType =
  | "INFRA_MUTATION_IN_PROGRESS"
  | "INFRA_MUTATION_COMPLETE"
  | "AGENT_LOCK_ACQUIRED"
  | "AGENT_LOCK_RELEASED"
  | "AGENT_ACTION"
  | "READ_ONLY_ENTER"
  | "READ_ONLY_EXIT"
  | "SYSTEM_ALERT";

export interface BroadcastPayload {
  id: string;
  type: BroadcastEventType;
  agent_id: string;
  target?: string;           // affected file or sector
  intent?: string;
  ttl_ms?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

type Subscriber = (payload: BroadcastPayload) => void;

class SentinelStream {
  private subscribers: Map<string, Subscriber> = new Map();
  private server: HttpServer | null = null;
  private port: number;
  private sseClients: Map<string, (payload: BroadcastPayload) => void> = new Map();

  constructor(port = 7072) {
    this.port = port;
  }

  /** Start the SSE broadcast server */
  start(): void {
    if (this.server) return;

    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${this.port}`);

      // SSE subscription endpoint
      if (url.pathname === "/subscribe" && req.method === "GET") {
        const clientId = randomUUID();
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",  // disable nginx buffering
        });

        // Send keepalive every 30s
        const keepalive = setInterval(() => {
          res.write(": keepalive\n\n");
        }, 30_000);

        const unsubscribe = (payload: BroadcastPayload) => {
          try {
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          } catch {
            // client disconnected
          }
        };

        this.sseClients.set(clientId, unsubscribe);
        this.subscribers.set(clientId, unsubscribe);

        req.on("close", () => {
          clearInterval(keepalive);
          this.subscribers.delete(clientId);
          this.sseClients.delete(clientId);
        });

        // Send initial connection event
        res.write(`data: ${JSON.stringify({ type: "SYSTEM_ALERT", id: randomUUID(), agent_id: "sentinel", timestamp: new Date().toISOString(), message: "Sentinel Stream connected" })}\n\n`);
        return;
      }

      // Health check
      if (url.pathname === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", subscribers: this.subscribers.size }));
        return;
      }

      // 404
      res.writeHead(404);
      res.end();
    });

    this.server.listen(this.port, () => {
      process.stderr.write(`[SentinelStream] SSE server listening on port ${this.port}\n`);
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
    this.subscribers.clear();
    this.sseClients.clear();
  }

  /** Publish a broadcast event to all subscribers */
  publish(payload: BroadcastPayload): void {
    for (const [, callback] of this.subscribers) {
      try {
        callback(payload);
      } catch {
        // subscriber dead — will be cleaned up on close
      }
    }
  }

  /** Convenience: broadcast a structured event */
  broadcast(
    type: BroadcastEventType,
    agent_id: string,
    target?: string,
    intent?: string,
    ttl_ms?: number,
    metadata?: Record<string, unknown>
  ): BroadcastPayload {
    const payload: BroadcastPayload = {
      id: randomUUID(),
      type,
      agent_id,
      target,
      intent,
      ttl_ms,
      timestamp: new Date().toISOString(),
      metadata,
    };
    this.publish(payload);
    return payload;
  }

  /** Quick broadcast helpers for common scenarios */
  infraMutationStart(agent_id: string, target: string, intent: string, ttl_ms = 300_000): BroadcastPayload {
    return this.broadcast("INFRA_MUTATION_IN_PROGRESS", agent_id, target, intent, ttl_ms);
  }

  infraMutationComplete(agent_id: string, target: string): BroadcastPayload {
    return this.broadcast("INFRA_MUTATION_COMPLETE", agent_id, target);
  }

  lockAcquired(agent_id: string, filepath: string, intent: string): BroadcastPayload {
    return this.broadcast("AGENT_LOCK_ACQUIRED", agent_id, filepath, intent);
  }

  lockReleased(agent_id: string, filepath: string): BroadcastPayload {
    return this.broadcast("AGENT_LOCK_RELEASED", agent_id, filepath);
  }

  enterReadOnly(agent_id: string, reason: string): BroadcastPayload {
    return this.broadcast("READ_ONLY_ENTER", agent_id, undefined, reason);
  }

  exitReadOnly(agent_id: string): BroadcastPayload {
    return this.broadcast("READ_ONLY_EXIT", agent_id);
  }
}

// Singleton
export const sentinelStream = new SentinelStream(
  parseInt(process.env.SENTINEL_PORT ?? "7072")
);

// Auto-start in server context
if (process.env.SENTINEL_AUTO_START === "true") {
  sentinelStream.start();
}