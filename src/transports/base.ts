/**
 * Multi-Transport Abstraction Layer — Forged 2026-08-05
 * 333-AGI Δ MIND | EUREKA #5 from ContextForge absorption
 *
 * Standardized transport lifecycle for SSE, WebSocket, stdio, streamable HTTP.
 * Each transport has: start → connect → send/receive → stop → disconnect.
 *
 * Pattern absorbed from: IBM/mcp-context-forge transports/
 */

/** Standardized transport states */
export enum TransportState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  CLOSING = "closing",
  CLOSED = "closed",
  ERROR = "error",
}

/** Configuration shared across all transports */
export interface TransportConfig {
  /** Maximum message size in bytes */
  maxMessageSize: number;
  /** Connection timeout in milliseconds */
  connectTimeoutMs: number;
  /** Request timeout in milliseconds */
  requestTimeoutMs: number;
  /** Keep-alive interval in milliseconds */
  keepAliveMs: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts: number;
  /** Reconnection backoff multiplier */
  reconnectBackoffMs: number;
  /** Transport-specific headers */
  headers: Record<string, string>;
  /** Whether to enable compression */
  compression: boolean;
}

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  maxMessageSize: 16 * 1024 * 1024, // 16 MB
  connectTimeoutMs: 10_000,
  requestTimeoutMs: 30_000,
  keepAliveMs: 30_000,
  maxReconnectAttempts: 5,
  reconnectBackoffMs: 1_000,
  headers: {},
  compression: true,
};

/** Message envelope for transport-agnostic send/receive */
export interface TransportMessage {
  /** Unique message ID */
  id: string | number;
  /** JSON-RPC method or message type */
  method?: string;
  /** Message payload */
  params?: Record<string, unknown>;
  /** Result data (for responses) */
  result?: unknown;
  /** Error data */
  error?: { code: number; message: string; data?: unknown };
  /** Raw message for pass-through */
  raw?: string;
}

/** Event emitted by transports */
export interface TransportEvent {
  type: "message" | "error" | "state_change" | "close" | "reconnect";
  transportId: string;
  data?: unknown;
  timestamp: number;
}

type TransportEventHandler = (event: TransportEvent) => void;

/**
 * Base transport interface — all transports implement this.
 *
 * EUREKA: Every transport (SSE, WS, stdio, HTTP) follows the same contract.
 * Swap transports without changing business logic.
 */
export interface Transport {
  readonly id: string;
  readonly type: string;
  readonly state: TransportState;

  /** Lifecycle */
  start(): Promise<void>;
  stop(): Promise<void>;

  /** Communication */
  send(message: TransportMessage): Promise<void>;
  sendRaw(raw: string): Promise<void>;

  /** Health */
  ping(): Promise<boolean>;

  /** Events */
  onMessage(handler: (message: TransportMessage) => void): void;
  onEvent(handler: TransportEventHandler): void;
  onError(handler: (error: Error) => void): void;
}

/**
 * Abstract base class implementing shared transport logic.
 */
export abstract class BaseTransport implements Transport {
  public readonly id: string;
  public abstract readonly type: string;

  protected _state: TransportState = TransportState.DISCONNECTED;
  protected _messageHandlers: Array<(message: TransportMessage) => void> = [];
  protected _eventHandlers: TransportEventHandler[] = [];
  protected _errorHandlers: Array<(error: Error) => void> = [];
  protected _config: TransportConfig;
  protected _reconnectAttempts = 0;
  protected _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(id: string, config?: Partial<TransportConfig>) {
    this.id = id;
    this._config = { ...DEFAULT_TRANSPORT_CONFIG, ...config };
  }

  get state(): TransportState {
    return this._state;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(message: TransportMessage): Promise<void>;
  abstract sendRaw(raw: string): Promise<void>;
  abstract ping(): Promise<boolean>;

  // ── Event handlers ──────────────────────────────────────

  onMessage(handler: (message: TransportMessage) => void): void {
    this._messageHandlers.push(handler);
  }

  onEvent(handler: TransportEventHandler): void {
    this._eventHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this._errorHandlers.push(handler);
  }

  // ── Shared utilities ────────────────────────────────────

  protected emitMessage(message: TransportMessage): void {
    for (const handler of this._messageHandlers) {
      try {
        handler(message);
      } catch (e) {
        // Handler errors must not break the transport
      }
    }
  }

  protected emitEvent(
    type: TransportEvent["type"],
    data?: unknown,
  ): void {
    const event: TransportEvent = {
      type,
      transportId: this.id,
      data,
      timestamp: Date.now(),
    };
    for (const handler of this._eventHandlers) {
      try {
        handler(event);
      } catch {
        // swallow
      }
    }
  }

  protected emitError(error: Error): void {
    for (const handler of this._errorHandlers) {
      try {
        handler(error);
      } catch {
        // swallow
      }
    }
    this.emitEvent("error", { message: error.message });
  }

  protected setState(state: TransportState): void {
    const previous = this._state;
    this._state = state;
    if (previous !== state) {
      this.emitEvent("state_change", { from: previous, to: state });
    }
  }

  protected async attemptReconnect(): Promise<void> {
    if (this._reconnectAttempts >= this._config.maxReconnectAttempts) {
      this.setState(TransportState.ERROR);
      this.emitError(
        new Error(
          `Max reconnect attempts (${this._config.maxReconnectAttempts}) exceeded`,
        ),
      );
      return;
    }

    this._reconnectAttempts++;
    this.setState(TransportState.RECONNECTING);
    this.emitEvent("reconnect", { attempt: this._reconnectAttempts });

    const delay =
      this._config.reconnectBackoffMs *
      Math.pow(2, this._reconnectAttempts - 1);

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.start();
      this._reconnectAttempts = 0;
    } catch (e) {
      this.emitError(e as Error);
      await this.attemptReconnect();
    }
  }
}

/**
 * SSE Transport implementation.
 *
 * Uses Server-Sent Events for receiving messages and
 * HTTP POST for sending messages back.
 */
export class SSETransport extends BaseTransport {
  public readonly type = "sse";

  private _eventSource: EventSource | null = null;
  private _endpoint: string;
  private _abortController: AbortController | null = null;

  constructor(
    id: string,
    endpoint: string,
    config?: Partial<TransportConfig>,
  ) {
    super(id, config);
    this._endpoint = endpoint;
  }

  async start(): Promise<void> {
    this.setState(TransportState.CONNECTING);

    this._abortController = new AbortController();

    return new Promise((resolve, reject) => {
      this._eventSource = new EventSource(this._endpoint);

      this._eventSource.onopen = () => {
        this.setState(TransportState.CONNECTED);
        this.emitEvent("state_change", {
          to: TransportState.CONNECTED,
        });
        resolve();
      };

      this._eventSource.onmessage = (event: MessageEvent) => {
        try {
          const message: TransportMessage = JSON.parse(event.data);
          this.emitMessage(message);
        } catch {
          this.emitMessage({
            id: crypto.randomUUID(),
            raw: event.data,
          });
        }
      };

      this._eventSource.onerror = () => {
        this.setState(TransportState.ERROR);
        this.emitError(new Error("SSE connection error"));
        reject(new Error("SSE connection failed"));
      };
    });
  }

  async stop(): Promise<void> {
    this.setState(TransportState.CLOSING);
    this._abortController?.abort();
    this._eventSource?.close();
    this._eventSource = null;
    this.setState(TransportState.CLOSED);
  }

  async send(message: TransportMessage): Promise<void> {
    await this.sendRaw(JSON.stringify(message));
  }

  async sendRaw(raw: string): Promise<void> {
    const response = await fetch(this._endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this._config.headers,
      },
      body: raw,
      signal: this._abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(
        `SSE send failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(this._endpoint, {
        method: "HEAD",
        signal: AbortSignal.timeout(this._config.requestTimeoutMs),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * WebSocket Transport implementation.
 */
export class WebSocketTransport extends BaseTransport {
  public readonly type = "websocket";

  private _ws: WebSocket | null = null;
  private _url: string;

  constructor(
    id: string,
    url: string,
    config?: Partial<TransportConfig>,
  ) {
    super(id, config);
    this._url = url;
  }

  async start(): Promise<void> {
    this.setState(TransportState.CONNECTING);

    return new Promise((resolve, reject) => {
      this._ws = new WebSocket(this._url);

      this._ws.onopen = () => {
        this.setState(TransportState.CONNECTED);
        resolve();
      };

      this._ws.onmessage = (event: MessageEvent) => {
        try {
          const message: TransportMessage = JSON.parse(
            event.data as string,
          );
          this.emitMessage(message);
        } catch {
          this.emitMessage({
            id: crypto.randomUUID(),
            raw: event.data as string,
          });
        }
      };

      this._ws.onerror = () => {
        this.emitError(new Error("WebSocket error"));
      };

      this._ws.onclose = () => {
        this.setState(TransportState.CLOSED);
        this.emitEvent("close");
        // Auto-reconnect
        this.attemptReconnect();
      };

      // Timeout
      setTimeout(() => {
        if (this._state === TransportState.CONNECTING) {
          reject(new Error("WebSocket connection timeout"));
        }
      }, this._config.connectTimeoutMs);
    });
  }

  async stop(): Promise<void> {
    this.setState(TransportState.CLOSING);
    this._ws?.close(1000, "Client closing");
    this._ws = null;
    this.setState(TransportState.CLOSED);
  }

  async send(message: TransportMessage): Promise<void> {
    await this.sendRaw(JSON.stringify(message));
  }

  async sendRaw(raw: string): Promise<void> {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this._ws.send(raw);
  }

  async ping(): Promise<boolean> {
    return (
      this._ws !== null &&
      this._ws.readyState === WebSocket.OPEN
    );
  }
}

/**
 * Transport Factory — creates transports from configuration.
 */
export class TransportFactory {
  /**
   * Create a transport instance based on URL scheme.
   *
   * ws:// or wss:// → WebSocket
   * http:// or https:// with SSE → SSE
   * file:// or stdio:// → Stdio (falls back to SSE)
   */
  static create(
    id: string,
    url: string,
    config?: Partial<TransportConfig>,
  ): Transport {
    const scheme = url.split("://")[0]?.toLowerCase();

    switch (scheme) {
      case "ws":
      case "wss":
        return new WebSocketTransport(id, url, config);
      case "http":
      case "https":
      default:
        return new SSETransport(id, url, config);
    }
  }
}
