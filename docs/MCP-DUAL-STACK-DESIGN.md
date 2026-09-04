# A-FORGE Dual-Stack MCP Architecture

> **Date:** 2026-09-04 | **Author:** 333-AGI | **Status:** DESIGN (888_HOLD before implementation)
> **Conformance evidence:** `/root/A-FORGE/tests/mcp-conformance/mcp_conformance.py`

---

## 1. Problem

A-FORGE server (`/root/A-FORGE/src/interfaces/server.ts`) is hardcoded for legacy MCP:
- `validateSession` dependency
- `Mcp-Session-Id` injection on every POST
- `initialize` method detection
- `_initialized` global flag
- No `server/discover`
- No cache envelope

Per MCP 2026-07-28: servers MUST support stateless core. But deprecation window is 12 months. Solution: **dual-stack by protocol version**.

---

## 2. Architecture

```
POST /mcp
  │
  ├─ Detect protocol version:
  │    ├─ Header: MCP-Protocol-Version: 2026-07-28 → MODERN PATH
  │    ├─ Body._meta.io.modelcontextprotocol/protocolVersion → MODERN PATH
  │    ├─ Body.method == "initialize" → LEGACY PATH
  │    └─ No version indicators → LEGACY PATH (backward compat)
  │
  ├─ MODERN PATH (2026-07-28)
  │    │
  │    ├─ Validate Mcp-Method header vs body.method
  │    │    └─ Mismatch → HTTP 400, MCP error -32020
  │    │
  │    ├─ Validate Mcp-Name header (for tools/call, resources/read, prompts/get)
  │    │    └─ Missing → HTTP 400, MCP error -32020
  │    │
  │    ├─ server/discover → return capabilities, supportedVersions, ttlMs, cacheScope
  │    │
  │    ├─ Stateless dispatcher (no session required)
  │    │    ├─ Extract actor from auth token (DPoP / Bearer)
  │    │    ├─ Extract capabilities from _meta
  │    │    ├─ Route to tool handler
  │    │    └─ Return result with resultType, ttlMs, cacheScope
  │    │
  │    ├─ MRTR support
  │    │    ├─ If tool needs user input → return resultType: "input_required"
  │    │    ├─ Include requests in result
  │    │    └─ Client retries with inputResponses
  │    │
  │    └─ Workflow handles
  │         ├─ Server-minted, opaque, signed, scoped, expiring
  │         ├─ Passed as tool arguments (model-visible)
  │         └─ Validated per-request against handle ledger
  │
  └─ LEGACY PATH (pre-2026-07-28)
       │
       ├─ initialize → create transport, mint session
       ├─ Mcp-Session-Id on subsequent requests
       ├─ Legacy tools/list (no cache envelope)
       ├─ Legacy elicitation/sampling (bidirectional)
       └─ Sunset telemetry: count legacy requests by client version
```

---

## 3. Implementation Plan

### 3.1 Protocol-Version Router

```typescript
// New file: /root/A-FORGE/src/interfaces/mcp/protocolRouter.ts

interface ProtocolVersion {
  major: 'legacy' | '2026-07-28';
  detectedFrom: 'header' | 'body-meta' | 'method-initialize' | 'unknown';
}

function detectProtocol(req: Request): ProtocolVersion {
  // 1. Check MCP-Protocol-Version header
  const headerVersion = req.headers['mcp-protocol-version'];
  if (headerVersion === '2026-07-28') {
    return { major: '2026-07-28', detectedFrom: 'header' };
  }

  // 2. Check body._meta
  const body = req.body;
  const metaVersion = body?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  if (metaVersion === '2026-07-28') {
    return { major: '2026-07-28', detectedFrom: 'body-meta' };
  }

  // 3. Check for initialize method (legacy indicator)
  if (body?.method === 'initialize') {
    return { major: 'legacy', detectedFrom: 'method-initialize' };
  }

  // 4. Default to legacy for backward compat
  return { major: 'legacy', detectedFrom: 'unknown' };
}
```

### 3.2 Modern Stateless Dispatcher

```typescript
// New file: /root/A-FORGE/src/interfaces/mcp/modernDispatcher.ts

async function handleModernRequest(req: Request, res: Response) {
  // Validate headers vs body
  const mcpMethod = req.headers['mcp-method'];
  const mcpName = req.headers['mcp-name'];
  const bodyMethod = req.body?.method;

  if (mcpMethod && mcpMethod !== bodyMethod) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32020, message: 'Header/body method mismatch' },
      id: req.body?.id,
    });
  }

  // Route by method
  switch (bodyMethod) {
    case 'server/discover':
      return handleDiscover(req, res);
    case 'tools/list':
      return handleToolsList(req, res);
    case 'tools/call':
      return handleToolsCall(req, res, mcpName);
    // ... other methods
    default:
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Unknown method: ${bodyMethod}` },
        id: req.body?.id,
      });
  }
}
```

### 3.3 Cache Envelope

```typescript
function withCacheEnvelope(result: any, ttlMs: number = 300000, scope: string = 'private') {
  return {
    ...result,
    resultType: 'complete',
    ttlMs,
    cacheScope: scope,
  };
}
```

### 3.4 Handle Ledger

```typescript
// New file: /root/A-FORGE/src/domain/handles/HandleLedger.ts

interface WorkflowHandle {
  handleId: string;          // wf.v1.<opaque>.<signature>
  handleHash: string;        // SHA-256 of handleId
  issuerOrgan: string;       // Who minted
  audienceOrgan: string;     // Who can consume
  principal: string;         // Authenticated actor
  scope: string[];           // Capability grants
  expiresAt: Date;           // TTL
  replayPolicy: 'single-use' | 'multi-use';
  requestStateHash: string;  // Integrity
  approvalState: string;     // 888 gate status
  revoked: boolean;          // Revocation
  correlationTraceId: string; // OTel linkage
}
```

---

## 4. Migration Steps (888_HOLD before each)

| Step | Action | Tier | Status |
|------|--------|------|--------|
| 1 | Create protocol-version router | T2 (code only) | PENDING |
| 2 | Create modern stateless dispatcher | T2 (code only) | PENDING |
| 3 | Implement `server/discover` | T2 (code only) | PENDING |
| 4 | Add cache envelope to list responses | T2 (code only) | PENDING |
| 5 | Implement handle ledger | T2 (code only) | PENDING |
| 6 | Add header/body validation | T2 (code only) | PENDING |
| 7 | Feature-flag modern path (disabled) | T2 | PENDING |
| 8 | Unit tests for both paths | T2 | PENDING |
| 9 | Deploy to staging (no traffic) | T3 | 888_HOLD |
| 10 | Enable modern path for internal traffic | T3 | 888_HOLD |
| 11 | Measure legacy traffic by client/version | T2 | PENDING |
| 12 | Declare sunset condition | T3 | 888_HOLD |
| 13 | Retire legacy code | T3 | 888_HOLD |

---

## 5. Invariants

1. **Never allow legacy adapter to contaminate modern execution path**
2. **No global `_initialized` flag** — stateless per-request
3. **No implicit process session** — auth token per-request
4. **Modern endpoint behavior never depends on connection affinity**
5. **Legacy adapter has fixed sunset telemetry** — not calendar-based

---

*Design only. No production mutation. 888_HOLD before implementation.*
