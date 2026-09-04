/**
 * @arifos/mcp-compat-kit — Federation MCP 2026-07-28 Compatibility Kit
 * 
 * Shared implementation to prevent 6 divergent transport migrations.
 * Version: 1.0.0
 * Spec: https://modelcontextprotocol.io/specification/2026-07-28
 * 
 * DITEMPA BUKAN DIBERI
 */

export const MCP_VERSION = '2026-07-28';
export const SUPPORTED_VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18'];

export interface ProtocolVersion {
  major: 'modern' | 'legacy' | 'unknown';
  version: string | null;
  detectedFrom: 'header' | 'body-meta' | 'method-initialize' | 'unknown';
}

/**
 * Detect protocol version from request headers and body.
 * Per spec: MCP-Protocol-Version header takes precedence.
 */
export function detectProtocol(req: {
  headers: Record<string, string | undefined>;
  body?: { method?: string; params?: { _meta?: Record<string, unknown> } };
}): ProtocolVersion {
  const headerVersion = req.headers['mcp-protocol-version'];
  if (headerVersion === MCP_VERSION) {
    return { major: 'modern', version: headerVersion, detectedFrom: 'header' };
  }

  const metaVersion = req.body?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  if (metaVersion === MCP_VERSION) {
    return { major: 'modern', version: String(metaVersion), detectedFrom: 'body-meta' };
  }

  if (req.body?.method === 'initialize') {
    return { major: 'legacy', version: null, detectedFrom: 'method-initialize' };
  }

  return { major: 'unknown', version: null, detectedFrom: 'unknown' };
}

/**
 * Validate Mcp-Method and Mcp-Name headers against JSON-RPC body.
 * Returns error code if mismatch, null if valid.
 * Per spec: mismatch → HTTP 400 / -32020
 */
export function validateHeaders(req: {
  headers: Record<string, string | undefined>;
  body?: { method?: string };
}): { valid: false; error: string; code: number } | { valid: true } {
  const mcpMethod = req.headers['mcp-method'];
  const bodyMethod = req.body?.method;

  if (mcpMethod && bodyMethod && mcpMethod !== bodyMethod) {
    return {
      valid: false,
      error: `Header/body method mismatch: Mcp-Method=${mcpMethod}, body.method=${bodyMethod}`,
      code: -32020,
    };
  }

  return { valid: true };
}

export interface CacheEnvelope {
  resultType: 'complete';
  ttlMs: number;
  cacheScope: 'public' | 'private';
}

/**
 * Wrap a result with cache envelope fields.
 * Per spec: tools/list, prompts/list, resources/list, resources/read
 * must include ttlMs and cacheScope.
 */
export function withCacheEnvelope<T>(
  result: T,
  options: { ttlMs?: number; cacheScope?: 'public' | 'private' } = {}
): T & CacheEnvelope {
  return {
    ...result,
    resultType: 'complete',
    ttlMs: options.ttlMs ?? 300_000,  // Default 5 minutes
    cacheScope: options.cacheScope ?? 'private',
  };
}

export interface McpError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Create a JSON-RPC error response.
 */
export function mcpError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): McpError {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}

/**
 * Standard MCP error codes.
 */
export const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  HeaderBodyMismatch: -32020,
  // A2A error codes (for bridge mapping)
  TaskNotFound: -32001,
  VersionNotSupported: -32009,
} as const;

/**
 * Detect if a request is on the modern (2026-07-28) path.
 * If modern, must NOT mint sessions.
 */
export function isModernPath(req: {
  headers: Record<string, string | undefined>;
  body?: { params?: { _meta?: Record<string, unknown> } };
}): boolean {
  const version = detectProtocol(req);
  return version.major === 'modern';
}

/**
 * CORS policy for modern MCP headers.
 */
export const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Headers': [
    'Accept', 'Authorization', 'Content-Type',
    'MCP-Protocol-Version', 'Mcp-Method', 'Mcp-Name',
    'Origin', 'X-Requested-With',
  ].join(', '),
  'Access-Control-Expose-Headers': [
    'MCP-Protocol-Version', 'Mcp-Method', 'Mcp-Name',
  ].join(', '),
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
} as const;
