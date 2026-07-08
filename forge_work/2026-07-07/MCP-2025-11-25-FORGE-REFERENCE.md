# MCP Protocol v2025-11-25 — Federation Forge Reference

**Date:** 2026-07-07  
**Source:** https://modelcontextprotocol.io/llms.txt  
**Spec version:** 2025-11-25  
**Forge by:** FORGE (000Ω) under F13 SOVEREIGN

---

## 1. Protocol Surface Index

| Surface | MCP Feature | arifOS Status |
|---------|-------------|---------------|
| Lifecycle | initialize → initialized → operation → shutdown | ✅ Custom impl (forge_session_init) |
| Transport | stdio, Streamable HTTP | ✅ Both supported |
| Auth | OAuth 2.1 + PKCE + resource param | ⚠️ Custom crypto_auth + session, not OAuth |
| Tools | list, call, list_changed, outputSchema | ✅ Full support (79 tools) |
| Resources | list, read, subscribe, list_changed | ✅ 5 forge:// resources |
| Prompts | list, get | ✅ 7 canonical loops |
| Elicitation | form mode, URL mode, -32042 error | ❌ NOT IMPLEMENTED — Item 2 gap |
| Tasks | submit, get, result, list, cancel | ⚠️ forge_job exists, not MCP-standard |
| Sampling | createMessage | ❌ Not implemented |
| Roots | list, list_changed | ❌ Not implemented |
| Logging | setLevel, notifications/message | ⚠️ Partial (syslog levels) |
| Completion | complete | ❌ Not implemented |
| Cancellation | notifications/cancelled | ⚠️ Partial |
| Progress | notifications/progress | ⚠️ Partial |

## 2. Elicitation — The Item 2 Fix

The MCP spec defines exactly what Arif's audit Item 2 asks for: **server-initiated requests for user input during tool execution.**

### Two modes:

**Form mode** — for structured data (non-sensitive):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "message": "Please provide your GitHub username",
    "requestedSchema": {
      "type": "object",
      "properties": { "name": { "type": "string" } },
      "required": ["name"]
    }
  }
}
```

**URL mode** — for sensitive/out-of-band (auth, payments, API keys):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "elicitationId": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://mcp.example.com/ui/set_api_key",
    "message": "Authorization is required to access your files."
  }
}
```

**Error code -32042** — `URLElicitationRequiredError` — server tells client a URL elicitation must complete before retrying the original request. This is exactly the "elicitation on trades/sends" pattern: when a tool needs user authorization mid-call, return -32042 with the elicitation details.

### Required client capability:
```json
{ "capabilities": { "elicitation": { "form": {}, "url": {} } } }
```

### Security rules:
- Form mode: MUST NOT request passwords, API keys, tokens
- URL mode: MUST use for sensitive data
- URL mode: MUST NOT auto-fetch the URL
- URL mode: MUST show full URL to user for consent
- Anti-phishing: server MUST verify the user who opens the URL is the same user who initiated the elicitation

## 3. Key Spec Details Relevant to arifOS

### Tool Names (SEP-986)
`[A-Za-z0-9_.-]`, 1-128 chars, case-sensitive, unique per server.  
✅ arifOS `forge_*` naming is compatible.

### inputSchema — JSON Schema 2020-12
Default dialect. `additionalProperties: false` recommended for empty schemas.  
✅ arifOS already enforces this (core.ts strictification guard).

### outputSchema (NEW in 2025-11-25)
Tools can declare output structure with JSON Schema. Structured content returned as `structuredContent` field alongside `content` for backwards compat.  
⚠️ arifOS tools don't declare outputSchema yet.

### Annotations on tools
`annotations.audience: ["user" | "assistant"]`  
`annotations.priority: 0.0-1.0`  
⚠️ arifOS has `_epistemic` tags which exceed this standard.

### Tasks extension
Long-running operations return `CreateTaskResult` immediately. Client polls `tasks/result`.  
Server sends `notifications/tasks/status` on state changes.  
⚠️ arifOS forge_job is similar but not MCP-standard.

### Authorization — OAuth 2.1
- PKCE required
- `resource` parameter (RFC 8707) required
- Client ID Metadata Documents (HTTPS URL as client_id)
- `WWW-Authenticate` with `resource_metadata` URL
- `insufficient_scope` → `HTTP 403` with scope hints
- Token passthrough FORBIDDEN

❌ arifOS uses custom crypto_auth + session model instead of OAuth. This is intentional — our model is simpler and constitutionally-governed, not standard OAuth.

## 4. Schema Types Reference (Key Ones)

| Type | Use | arifOS equivalent |
|------|-----|-------------------|
| TextContent | Text tool result | `_epistemic` + text |
| ImageContent | Base64 image | minimax-media |
| AudioContent | Base64 audio | minimax-media |
| EmbeddedResource | Resource in tool result | Not used |
| ResourceLink | URI reference in result | Not used |
| Annotations | audience, priority, lastModified | `_epistemic` superset |
| Implementation | name, version, icons, description | `serverInfo` |
| Icon | src, mimeType, sizes, theme | Not used |
| Task | taskId, status, ttl, pollInterval | forge_job |

## 5. Error Codes

| Code | Meaning | Used By |
|------|---------|---------|
| -32700 | Parse error | JSON-RPC |
| -32600 | Invalid Request | JSON-RPC |
| -32601 | Method not found | JSON-RPC |
| -32602 | Invalid params | JSON-RPC |
| -32603 | Internal error | JSON-RPC |
| -32000 to -32099 | Server error | Reserved |
| **-32042** | **URLElicitationRequiredError** | **Elicitation** |

## 6. Federation Audit — Items 1-6

| Item | MCP Spec Solution | Status |
|------|-------------------|--------|
| 1. Crypto identity | Ed25519 + nonce (spec defers to transport) | ✅ Fixed 2026-07-07 |
| 2. Elicitation on trades/sends | **`elicitation/create` + URL mode** + `-32042` error | ❌ Must implement |
| 3. Fail-closed on ambiguity | Auth: 401/403. Elicitation: decline/cancel | ✅ Partial — identity now fail-closed |
| 4. Single verdict location | Tool `outputSchema` + structured response | ⚠️ Scattered across core.ts |
| 5. Tool dedupe enforcement | SEP-986 (unique names per server) | ❌ No startup check |
| 6. Test harness | MCP conformance tests (SEP-2484) | ❌ Not implemented |

## 7. Key Pages for Reference

| Page | URL |
|------|-----|
| Spec index | https://modelcontextprotocol.io/specification/2025-11-25/index.md |
| Tools | https://modelcontextprotocol.io/specification/2025-11-25/server/tools.md |
| Elicitation | https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation.md |
| Authorization | https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization.md |
| Lifecycle | https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle.md |
| Transports | https://modelcontextprotocol.io/specification/2025-11-25/basic/transports.md |
| Schema | https://modelcontextprotocol.io/specification/2025-11-25/schema.md |
| Tasks | https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks.md |
| Security | https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices.md |

---

**DITEMPA BUKAN DIBERI — The protocol is forged, not assumed.**
