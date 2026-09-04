# Federation MCP Compatibility Kit

> **Date:** 2026-09-04 | **Purpose:** Shared implementation to prevent 6 divergent migrations
> **Status:** DESIGN (T2 — staging only)

---

## 1. Problem

Each organ independently implementing MCP 2026-07-28 will produce 6 different interpretations of:
- Protocol-version detection
- Stateless dispatch
- Cache envelopes
- Error mapping
- CORS policy
- Header validation

**This is the "6 divergent migrations" anti-pattern.**

---

## 2. Solution: Shared Compatibility Kit

A versioned internal package (not a library — a reference module) containing:

### 2.1 Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Protocol Detector** | Classify request as modern/legacy | `kit/protocol-detector.ts` |
| **Stateless Dispatcher** | Route modern requests without session | `kit/dispatcher.ts` |
| **Legacy Adapter** | Isolated session-based path | `kit/legacy-adapter.ts` |
| **Discover Handler** | `server/discover` response | `kit/discover.ts` |
| **Header Validator** | `Mcp-Method`/`Mcp-Name` vs body | `kit/header-validator.ts` |
| **Cache Envelope** | `ttlMs`/`cacheScope` decorator | `kit/cache-envelope.ts` |
| **Error Mapper** | MCP errors → HTTP + JSON-RPC | `kit/error-mapper.ts` |
| **CORS Policy** | Modern header allow-list | `kit/cors.ts` |
| **Test Fixtures** | 10-probe harness inputs/outputs | `kit/fixtures/` |
| **Observability Hooks** | Version, route, task ID, fallback | `kit/telemetry.ts` |

### 2.2 Usage Pattern

```typescript
import { 
  detectProtocol, 
  statelessDispatch, 
  withCacheEnvelope,
  validateHeaders,
  mcpError 
} from '@arifos/mcp-compat-kit';

// In organ server:
app.post('/mcp', (req, res) => {
  const version = detectProtocol(req);
  
  if (version.major === '2026-07-28') {
    // Modern path — stateless
    const error = validateHeaders(req);
    if (error) return res.status(400).json(mcpError(-32020, error));
    
    const result = statelessDispatch(req);
    return res.json(withCacheEnvelope(result, { ttlMs: 300000, scope: 'private' }));
  }
  
  // Legacy path — isolated
  legacyAdapter(req, res);
});
```

### 2.3 Versioning

```
@arifos/mcp-compat-kit@1.0.0  ← Initial release (2026-07-28 spec)
@arifos/mcp-compat-kit@1.0.1  ← Bug fixes
@arifos/mcp-compat-kit@2.0.0  ← Breaking spec changes
```

Each organ pins to a specific version. Upgrades are coordinated, not independent.

---

## 3. Cache Envelope Policy

| Response Type | Default `cacheScope` | Default `ttlMs` | Invalidation |
|---------------|---------------------|-----------------|--------------|
| `tools/list` | `private` | 300000 (5min) | Tool deploy |
| `resources/list` | `private` | 120000 (2min) | Resource ACL change |
| `prompts/list` | `private` | 300000 (5min) | Prompt catalog deploy |
| `resources/templates/list` | `private` | 300000 (5min) | Template deploy |
| Sensitive tenant catalogs | `private` | 60000 (1min) | Any entitlement change |
| Public safe catalogs | `public` | 300000 (5min) | Capability change |

**Rule:** Never label `public` if catalog discloses internal operations, well names, capital workflows, credentials, infrastructure topology, or tenant existence.

---

## 4. Error Mapping

| MCP Error | HTTP Status | JSON-RPC Code | When |
|-----------|-------------|---------------|------|
| Method not found | 404 | -32601 | Unknown method |
| Header/body mismatch | 400 | -32020 | Mcp-Method ≠ body.method |
| Unsupported version | 400 | -32600 | Invalid protocol version |
| Tool execution error | 500 | -32000 | Tool failed |
| Auth required | 401 | -32007 | Missing/invalid token |
| Rate limited | 429 | -32000 | Too many requests |

---

## 5. Observability

Every modern request logs:

```json
{
  "timestamp": "...",
  "organ": "geox",
  "protocol_version": "2026-07-28",
  "route": "modern",
  "method": "tools/call",
  "tool_name": "geox_basin",
  "request_id": "...",
  "trace_id": "...",
  "session_minted": false,
  "cache_hit": false,
  "duration_ms": 42,
  "status": 200
}
```

---

## 6. Migration Checklist (Per Organ)

- [ ] Import `@arifos/mcp-compat-kit`
- [ ] Add protocol detector to ingress
- [ ] Wire stateless dispatcher for modern path
- [ ] Wire legacy adapter for old path
- [ ] Add `server/discover` handler
- [ ] Add header validation
- [ ] Add cache envelopes
- [ ] Add CORS policy
- [ ] Add regression tests from fixtures
- [ ] Run conformance harness
- [ ] Verify no session leakage on modern path
- [ ] Verify legacy path isolation
- [ ] Deploy to staging
- [ ] Canary production
- [ ] Full production

---

*Shared compatibility kit. Prevents 6 divergent migrations.*
