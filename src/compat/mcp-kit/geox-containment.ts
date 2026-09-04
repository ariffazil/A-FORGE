/**
 * GEOX Modern-Path Containment Patch
 * ====================================
 * P0 FIX: Block session minting on MCP 2026-07-28 requests.
 * 
 * STATUS: STAGING-READY (not deployed — 888_HOLD for production)
 * 
 * This patch adds a protocol-version detector to GEOX ingress
 * and blocks session creation on modern requests.
 * 
 * Integration: Apply to GEOX MCP server ingress handler.
 */

const MCP_MODERN_VERSION = '2026-07-28';

interface McpRequest {
  headers: Record<string, string | undefined>;
  body?: {
    method?: string;
    params?: {
      _meta?: Record<string, unknown>;
    };
  };
}

interface ProtocolDetection {
  isModern: boolean;
  version: string | null;
  source: 'header' | 'body-meta' | 'legacy' | 'unknown';
}

/**
 * Detect if a request is on the modern (2026-07-28) path.
 */
export function detectModernPath(req: McpRequest): ProtocolDetection {
  // 1. Check MCP-Protocol-Version header (highest priority)
  const headerVersion = req.headers['mcp-protocol-version'];
  if (headerVersion === MCP_MODERN_VERSION) {
    return { isModern: true, version: headerVersion, source: 'header' };
  }

  // 2. Check body._meta protocolVersion
  const metaVersion = req.body?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  if (metaVersion === MCP_MODERN_VERSION) {
    return { isModern: true, version: String(metaVersion), source: 'body-meta' };
  }

  // 3. Check for initialize method (legacy indicator)
  if (req.body?.method === 'initialize') {
    return { isModern: false, version: null, source: 'legacy' };
  }

  // 4. Unknown — treat as legacy for backward compat
  return { isModern: false, version: null, source: 'unknown' };
}

/**
 * Containment guard: block session minting on modern path.
 * Call this BEFORE any session creation logic.
 * 
 * Returns null if safe to proceed with session creation (legacy path).
 * Returns error response if modern path detected and session would be minted.
 */
export function blockModernSessionMint(
  detection: ProtocolDetection,
  requestId: string
): { blocked: true; log: object } | { blocked: false } {
  if (!detection.isModern) {
    return { blocked: false };
  }

  // Modern path detected — BLOCK session creation
  const log = {
    event: 'modern_session_mint_blocked',
    organ: 'geox',
    timestamp: new Date().toISOString(),
    request_id: requestId,
    mcp_protocol_version: detection.version,
    detection_source: detection.source,
    action: 'blocked_stateless_required',
    severity: 'P0',
  };

  // Structured logging
  console.error(JSON.stringify(log));

  return { blocked: true, log };
}

/**
 * Modern-path dispatcher (stateless).
 * Routes modern requests without creating session state.
 */
export function modernStatelessDispatch(req: McpRequest): {
  status: number;
  body: object;
  headers: Record<string, string>;
} {
  const method = req.body?.method;

  switch (method) {
    case 'server/discover':
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id: req.body?.method ?? null,
          result: {
            resultType: 'complete',
            supportedVersions: ['2026-07-28', '2025-11-25'],
            capabilities: ['extensions', 'tools', 'resources'],
            ttlMs: 3600000,
            cacheScope: 'public',
          },
        },
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2026-07-28',
          'Vary': 'A2A-Version, MCP-Protocol-Version',
        },
      };

    case 'tools/list':
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id: req.body?.method ?? null,
          result: {
            resultType: 'complete',
            tools: [], // Populate from GEOX tool registry
            ttlMs: 300000,
            cacheScope: 'private',
          },
        },
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2026-07-28',
          'Vary': 'MCP-Protocol-Version',
        },
      };

    default:
      return {
        status: 400,
        body: {
          jsonrpc: '2.0',
          id: req.body?.method ?? null,
          error: { code: -32601, message: `Method not found: ${method}` },
        },
        headers: { 'Content-Type': 'application/json' },
      };
  }
}

/**
 * Integration example for GEOX MCP server:
 * 
 * app.post('/mcp', (req, res) => {
 *   const detection = detectModernPath(req);
 *   
 *   if (detection.isModern) {
 *     // Modern path — stateless, no session
 *     const result = modernStatelessDispatch(req);
 *     return res.status(result.status).set(result.headers).json(result.body);
 *   }
 *   
 *   // Legacy path — existing session-based handling
 *   legacyAdapter(req, res);
 * });
 */
