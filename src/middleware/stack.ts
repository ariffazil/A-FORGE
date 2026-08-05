/**
 * Composable Middleware Stack — Forged 2026-08-05
 * 333-AGI Δ MIND | EUREKA #4 from ContextForge absorption
 *
 * 16-layer composable middleware pipeline for MCP request processing.
 * Each middleware is independently testable, composable, and stateless.
 *
 * Pattern absorbed from: IBM/mcp-context-forge middleware/
 */

// ═══════════════════════════════════════════════════════════
// Core Types
// ═══════════════════════════════════════════════════════════

/** Context passed through the middleware chain */
export interface MiddlewareContext {
  /** Unique request ID */
  requestId: string;
  /** Session identifier */
  sessionId?: string;
  /** Authenticated actor */
  actorId?: string;
  /** MCP method being called */
  method?: string;
  /** Tool name being invoked */
  toolName?: string;
  /** Request timestamp */
  startTime: number;
  /** Custom metadata injected by middleware */
  metadata: Record<string, unknown>;
  /** Whether the request has been blocked */
  blocked: boolean;
  /** Block reason if blocked */
  blockReason?: string;
}

/** Result of middleware execution */
export interface MiddlewareResult {
  /** Whether to continue processing */
  continue: boolean;
  /** Modified context (if any) */
  context: MiddlewareContext;
  /** Error to return (if any) */
  error?: { code: number; message: string };
}

/** A middleware function */
export type MiddlewareFunc = (
  ctx: MiddlewareContext,
  next: () => Promise<MiddlewareResult>,
) => Promise<MiddlewareResult>;

// ═══════════════════════════════════════════════════════════
// Middleware Builder
// ═══════════════════════════════════════════════════════════

export class MiddlewareStack {
  private _middlewares: Array<{
    name: string;
    handler: MiddlewareFunc;
    enabled: boolean;
  }> = [];

  /** Register a middleware at the end of the stack */
  use(name: string, handler: MiddlewareFunc): this {
    this._middlewares.push({ name, handler, enabled: true });
    return this;
  }

  /** Register a middleware at a specific position */
  useAt(
    index: number,
    name: string,
    handler: MiddlewareFunc,
  ): this {
    this._middlewares.splice(index, 0, {
      name,
      handler,
      enabled: true,
    });
    return this;
  }

  /** Disable a middleware by name */
  disable(name: string): void {
    const mw = this._middlewares.find((m) => m.name === name);
    if (mw) mw.enabled = false;
  }

  /** Enable a middleware by name */
  enable(name: string): void {
    const mw = this._middlewares.find((m) => m.name === name);
    if (mw) mw.enabled = true;
  }

  /** Remove a middleware by name */
  remove(name: string): void {
    this._middlewares = this._middlewares.filter(
      (m) => m.name !== name,
    );
  }

  /** Execute the full middleware stack */
  async execute(
    ctx: MiddlewareContext,
  ): Promise<MiddlewareResult> {
    const active = this._middlewares.filter((m) => m.enabled);

    if (active.length === 0) {
      return { continue: true, context: ctx };
    }

    let index = 0;

    const dispatch = async (): Promise<MiddlewareResult> => {
      if (index >= active.length) {
        return { continue: true, context: ctx };
      }

      const current = active[index++];
      const start = performance.now();

      try {
        const result = await current.handler(ctx, dispatch);
        const elapsed = performance.now() - start;

        // Log slow middleware (> 100ms)
        if (elapsed > 100) {
          console.warn(
            `[Middleware] ${current.name} took ${elapsed.toFixed(1)}ms`,
          );
        }

        return result;
      } catch (e) {
        console.error(
          `[Middleware] ${current.name} threw:`,
          e,
        );
        return {
          continue: false,
          context: ctx,
          error: {
            code: -32603,
            message: `Middleware error: ${(e as Error).message}`,
          },
        };
      }
    };

    return dispatch();
  }

  /** List all registered middleware */
  list(): Array<{ name: string; enabled: boolean }> {
    return this._middlewares.map((m) => ({
      name: m.name,
      enabled: m.enabled,
    }));
  }

  get count(): number {
    return this._middlewares.filter((m) => m.enabled).length;
  }
}

/** Create default context */
export function createContext(
  overrides?: Partial<MiddlewareContext>,
): MiddlewareContext {
  return {
    requestId: crypto.randomUUID(),
    startTime: performance.now(),
    metadata: {},
    blocked: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// Built-in Middleware Functions (16 layers)
// ═══════════════════════════════════════════════════════════

/**
 * 1. CORRELATION ID
 * Ensures every request has a unique correlation ID for tracing.
 */
export const correlationId: MiddlewareFunc = async (ctx, next) => {
  ctx.metadata["x-correlation-id"] =
    ctx.metadata["x-correlation-id"] || ctx.requestId;
  return next();
};

/**
 * 2. REQUEST LOGGING
 * Logs incoming requests with method, tool, and timing.
 */
export const requestLogging: MiddlewareFunc = async (ctx, next) => {
  console.log(
    `[REQ] ${ctx.requestId} | ${ctx.method || "?"} | ${ctx.toolName || "?"}`,
  );
  const result = await next();
  const elapsed = performance.now() - ctx.startTime;
  console.log(
    `[RES] ${ctx.requestId} | ${elapsed.toFixed(1)}ms | ${result.continue ? "OK" : "BLOCKED"}`,
  );
  return result;
};

/**
 * 3. AUTH
 * Validates session tokens / API keys.
 */
export const auth = (
  validateToken: (token: string) => boolean,
): MiddlewareFunc => {
  return async (ctx, next) => {
    const token = (ctx.metadata["authorization"] as string) || "";
    if (!token) {
      return {
        continue: false,
        context: ctx,
        error: { code: -32001, message: "Missing authorization" },
      };
    }
    if (!validateToken(token)) {
      return {
        continue: false,
        context: ctx,
        error: { code: -32002, message: "Invalid authorization" },
      };
    }
    return next();
  };
};

/**
 * 4. RBAC
 * Checks role-based access control for the requested tool.
 */
export const rbac = (
  checkAccess: (actorId: string, toolName: string) => boolean,
): MiddlewareFunc => {
  return async (ctx, next) => {
    if (!ctx.toolName || !ctx.actorId) return next();
    if (!checkAccess(ctx.actorId, ctx.toolName)) {
      return {
        continue: false,
        context: ctx,
        error: {
          code: -32003,
          message: `Access denied to tool '${ctx.toolName}'`,
        },
      };
    }
    return next();
  };
};

/**
 * 5. RATE LIMIT
 * Enforces rate limiting per actor/tool.
 */
export const rateLimit = (
  limit: number,
  windowMs: number,
  store: Map<string, { count: number; resetAt: number }>,
): MiddlewareFunc => {
  return async (ctx, next) => {
    const key = `${ctx.actorId || "anon"}:${ctx.toolName || "all"}`;
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > limit) {
      return {
        continue: false,
        context: ctx,
        error: {
          code: -32004,
          message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s`,
        },
      };
    }

    ctx.metadata["x-rate-limit-remaining"] =
      limit - entry.count;
    return next();
  };
};

/**
 * 6. INPUT VALIDATION
 * Validates JSON-RPC input structure.
 */
export const inputValidation: MiddlewareFunc = async (ctx, next) => {
  if (!ctx.method) {
    return {
      continue: false,
      context: ctx,
      error: {
        code: -32600,
        message: "Invalid Request: missing method",
      },
    };
  }
  return next();
};

/**
 * 7. COMPRESSION
 * Handles request/response compression headers.
 */
export const compression: MiddlewareFunc = async (ctx, next) => {
  ctx.metadata["accept-encoding"] =
    ctx.metadata["accept-encoding"] || "gzip, br";
  return next();
};

/**
 * 8. PROTOCOL VERSION
 * Validates MCP protocol version negotiation.
 */
export const protocolVersion = (
  supportedVersions: string[],
): MiddlewareFunc => {
  return async (ctx, next) => {
    const requestedVersion = ctx.metadata[
      "mcp-protocol-version"
    ] as string;
    if (
      requestedVersion &&
      !supportedVersions.includes(requestedVersion)
    ) {
      return {
        continue: false,
        context: ctx,
        error: {
          code: -32005,
          message: `Unsupported MCP protocol version: ${requestedVersion}`,
        },
      };
    }
    return next();
  };
};

/**
 * 9. SECURITY HEADERS
 * Injects security headers into responses.
 */
export const securityHeaders: MiddlewareFunc = async (ctx, next) => {
  const result = await next();
  ctx.metadata["x-content-type-options"] = "nosniff";
  ctx.metadata["x-frame-options"] = "DENY";
  ctx.metadata["strict-transport-security"] =
    "max-age=31536000";
  return result;
};

/**
 * 10. CSRF PROTECTION
 * Validates CSRF tokens for state-changing operations.
 */
export const csrfProtection: MiddlewareFunc = async (ctx, next) => {
  const isReadOnly =
    ctx.method?.startsWith("tools/list") ||
    ctx.method?.startsWith("resources/read");
  if (
    !isReadOnly &&
    !ctx.metadata["x-csrf-token"]
  ) {
    return {
      continue: false,
      context: ctx,
      error: {
        code: -32006,
        message: "CSRF token required for state-changing operations",
      },
    };
  }
  return next();
};

/**
 * 11. DEPRECATION NOTICE
 * Warns when deprecated tools are called.
 */
export const deprecation = (
  deprecatedTools: Map<string, string>,
): MiddlewareFunc => {
  return async (ctx, next) => {
    if (ctx.toolName && deprecatedTools.has(ctx.toolName)) {
      const alternative = deprecatedTools.get(ctx.toolName);
      ctx.metadata["x-deprecation-warning"] =
        `Tool '${ctx.toolName}' is deprecated. Use '${alternative}' instead.`;
    }
    return next();
  };
};

/**
 * 12. OBSERVABILITY
 * Emits OpenTelemetry spans for requests.
 */
export const observability: MiddlewareFunc = async (ctx, next) => {
  // In production, this would create OTel spans
  ctx.metadata["trace-start"] = performance.now();
  const result = await next();
  ctx.metadata["trace-duration"] =
    performance.now() -
    (ctx.metadata["trace-start"] as number);
  return result;
};

/**
 * 13. PATH FILTER
 * Blocks or allows requests based on path patterns.
 */
export const pathFilter = (
  allowList: string[],
  denyList: string[],
): MiddlewareFunc => {
  return async (ctx, next) => {
    if (ctx.toolName && denyList.includes(ctx.toolName)) {
      return {
        continue: false,
        context: ctx,
        error: {
          code: -32007,
          message: `Tool '${ctx.toolName}' is blocked`,
        },
      };
    }
    if (
      allowList.length > 0 &&
      ctx.toolName &&
      !allowList.includes(ctx.toolName)
    ) {
      return {
        continue: false,
        context: ctx,
        error: {
          code: -32007,
          message: `Tool '${ctx.toolName}' is not in allow list`,
        },
      };
    }
    return next();
  };
};

/**
 * 14. HEADER SIZE LIMIT
 * Rejects requests with oversized headers.
 */
export const headerSizeLimit = (
  maxBytes: number = 8192,
): MiddlewareFunc => {
  return async (ctx, next) => {
    const headerSize = JSON.stringify(ctx.metadata).length;
    if (headerSize > maxBytes) {
      return {
        continue: false,
        context: ctx,
        error: {
          code: -32008,
          message: `Header size (${headerSize} bytes) exceeds limit (${maxBytes} bytes)`,
        },
      };
    }
    return next();
  };
};

/**
 * 15. BAGGAGE PROPAGATION
 * Propagates W3C Baggage context across service boundaries.
 */
export const baggage: MiddlewareFunc = async (ctx, next) => {
  // Extract baggage from incoming request
  const incomingBaggage = ctx.metadata["baggage"] as
    | string
    | undefined;
  if (incomingBaggage) {
    const entries = incomingBaggage.split(",");
    for (const entry of entries) {
      const [key, value] = entry.split("=");
      if (key && value) {
        ctx.metadata[`baggage:${key.trim()}`] =
          value.trim();
      }
    }
  }
  return next();
};

/**
 * 16. TOKEN SCOPING
 * Ensures the auth token has the required scope for the operation.
 */
export const tokenScoping = (
  requiredScopes: string[],
): MiddlewareFunc => {
  return async (ctx, next) => {
    const tokenScopes = (
      (ctx.metadata["token-scopes"] as string) || ""
    ).split(" ");
    const hasAllScopes = requiredScopes.every((scope) =>
      tokenScopes.includes(scope),
    );
    if (!hasAllScopes) {
      return {
        continue: false,
        context: ctx,
        error: {
          code: -32009,
          message: `Missing required scope(s): ${requiredScopes.join(", ")}`,
        },
      };
    }
    return next();
  };
};

// ═══════════════════════════════════════════════════════════
// Pre-built Stack Factory
// ═══════════════════════════════════════════════════════════

/**
 * Create a standard 16-layer middleware stack for A-FORGE.
 *
 * EUREKA: One factory call → fully configured pipeline.
 * Each layer is independently toggleable.
 */
export function createForgeMiddlewareStack(options: {
  validateToken?: (token: string) => boolean;
  checkAccess?: (actorId: string, toolName: string) => boolean;
  rateLimitStore?: Map<
    string,
    { count: number; resetAt: number }
  >;
  deprecatedTools?: Map<string, string>;
  allowList?: string[];
  denyList?: string[];
  supportedProtocolVersions?: string[];
}): MiddlewareStack {
  const stack = new MiddlewareStack();

  // Layer 1: Correlation ID
  stack.use("correlation-id", correlationId);

  // Layer 2: Request Logging
  stack.use("request-logging", requestLogging);

  // Layer 3: Auth
  if (options.validateToken) {
    stack.use("auth", auth(options.validateToken));
  }

  // Layer 4: RBAC
  if (options.checkAccess) {
    stack.use("rbac", rbac(options.checkAccess));
  }

  // Layer 5: Rate Limit
  if (options.rateLimitStore) {
    stack.use(
      "rate-limit",
      rateLimit(60, 60_000, options.rateLimitStore),
    );
  }

  // Layer 6: Input Validation
  stack.use("input-validation", inputValidation);

  // Layer 7: Compression
  stack.use("compression", compression);

  // Layer 8: Protocol Version
  stack.use(
    "protocol-version",
    protocolVersion(
      options.supportedProtocolVersions || [
        "2024-11-05",
        "2025-03-26",
        "2025-06-18",
      ],
    ),
  );

  // Layer 9: Security Headers
  stack.use("security-headers", securityHeaders);

  // Layer 10: CSRF
  stack.use("csrf-protection", csrfProtection);

  // Layer 11: Deprecation
  if (options.deprecatedTools?.size) {
    stack.use(
      "deprecation",
      deprecation(options.deprecatedTools),
    );
  }

  // Layer 12: Observability
  stack.use("observability", observability);

  // Layer 13: Path Filter
  if (options.allowList || options.denyList) {
    stack.use(
      "path-filter",
      pathFilter(
        options.allowList || [],
        options.denyList || [],
      ),
    );
  }

  // Layer 14: Header Size
  stack.use("header-size-limit", headerSizeLimit());

  // Layer 15: Baggage
  stack.use("baggage", baggage);

  // Layer 16: Token Scoping
  stack.use(
    "token-scoping",
    tokenScoping(["mcp:tools:invoke"]),
  );

  return stack;
}
