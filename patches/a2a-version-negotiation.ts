/**
 * A2A Version Negotiation Middleware
 * ====================================
 * Enforces A2A-Version header per A2A v1.0 spec.
 * 
 * KEY RULE: Empty A2A-Version = 0.3 (the trap!)
 * Federation policy: transitional mode — reject at federation endpoint.
 * 
 * STATUS: STAGING-READY (not deployed)
 */

const VALID_VERSIONS = ['1.0', '1.0.0', '1.0.1'];
const LEGACY_VERSION = '0.3';
const DEFAULT_VERSION = LEGACY_VERSION; // Per spec: empty = 0.3

interface VersionNegotiationResult {
  accepted: boolean;
  version: string | null;
  error?: {
    code: number;
    message: string;
  };
  headers: Record<string, string>;
}

/**
 * Negotiate A2A version from request header.
 * 
 * Modes:
 * - compatibility: empty header → serve 0.3 (broadest compat)
 * - strict: empty header → reject with -32009
 * - transitional: empty header → reject at federation endpoint, accept at legacy endpoint
 */
export function negotiateVersion(
  req: {
    headers: Record<string, string | undefined>;
  },
  mode: 'compatibility' | 'strict' | 'transitional' = 'transitional'
): VersionNegotiationResult {
  const headerValue = req.headers['a2a-version'];

  // Missing header — THE TRAP
  if (headerValue === undefined || headerValue === null || headerValue === '') {
    switch (mode) {
      case 'compatibility':
        return {
          accepted: true,
          version: DEFAULT_VERSION,
          headers: { 'Vary': 'A2A-Version' },
        };
      case 'strict':
      case 'transitional':
        return {
          accepted: false,
          version: null,
          error: {
            code: -32009,
            message: 'A2A-Version header required. Empty version interpreted as 0.3 which is not accepted at this endpoint.',
          },
          headers: { 'Vary': 'A2A-Version' },
        };
    }
  }

  // Version present — validate
  const majorMinor = headerValue!.split('.').slice(0, 2).join('.');
  
  if (!VALID_VERSIONS.includes(majorMinor) && !VALID_VERSIONS.includes(headerValue!)) {
    return {
      accepted: false,
      version: headerValue!,
      error: {
        code: -32009,
        message: `Version not supported: ${headerValue}. Supported: ${VALID_VERSIONS.join(', ')}`,
      },
      headers: { 'Vary': 'A2A-Version' },
    };
  }

  return {
    accepted: true,
    version: headerValue!,
    headers: { 'Vary': 'A2A-Version' },
  };
}

/**
 * Agent Card version-specific response.
 * Serves different card shapes based on negotiated version.
 */
export function serveVersionedCard(
  version: string,
  v1Card: object,
  v03Card?: object
): { status: number; body: object; headers: Record<string, string> } {
  const headers = {
    'Content-Type': 'application/a2a+json',
    'Vary': 'A2A-Version',
    'Cache-Control': 'private, max-age=300',
  };

  if (version.startsWith('1.')) {
    return { status: 200, body: v1Card, headers };
  }

  if (version === '0.3' && v03Card) {
    return { status: 200, body: v03Card, headers };
  }

  return {
    status: 400,
    body: {
      jsonrpc: '2.0',
      error: {
        code: -32009,
        message: `Version ${version} not supported at this endpoint`,
      },
    },
    headers,
  };
}

/**
 * Integration example:
 * 
 * app.get('/.well-known/agent-card.json', (req, res) => {
 *   const negotiation = negotiateVersion(req, 'transitional');
 *   if (!negotiation.accepted) {
 *     return res.status(400).set(negotiation.headers).json(negotiation.error);
 *   }
 *   const response = serveVersionedCard(negotiation.version!, v1Card, v03Card);
 *   return res.status(response.status).set(response.headers).json(response.body);
 * });
 */
