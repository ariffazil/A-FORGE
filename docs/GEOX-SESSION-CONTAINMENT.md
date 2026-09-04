# GEOX Session Minting Containment — P0 Fix Design

> **Date:** 2026-09-04 | **Severity:** P0 SECURITY/COMPLIANCE
> **Evidence:** Conformance harness P06 — GEOX mints `Mcp-Session-Id: 664ad2834d874cd2aa6b78139e65e9ee` on modern path
> **Risk:** Client thinks stateless; server retains state → cross-context data leakage

---

## 1. Problem

GEOX receives a request with `MCP-Protocol-Version: 2026-07-28` (modern, stateless) but:
- Creates server-side session state
- Returns `Mcp-Session-Id` header
- Routes modern traffic into `initialize`-based transport factory

This is not a feature gap. It's a **confused state model**: the client declares stateless intent, the server creates stateful authority. The session ID becomes an unscoped bearer token visible to the model.

**Worst case:** A GEOX session created for one context (e.g., basin analysis) could be reused by a different request (e.g., well log query), leaking project data across contexts.

---

## 2. Containment (Immediate, Non-Production)

### 2.1 Detection

```typescript
// Add to GEOX ingress
function detectModernPath(req: Request): boolean {
  const headerVersion = req.headers['mcp-protocol-version'];
  const metaVersion = req.body?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  return headerVersion === '2026-07-28' || metaVersion === '2026-07-28';
}
```

### 2.2 Containment Rules

```
IF modern path detected:
  ├─ DO NOT emit Mcp-Session-Id header
  ├─ DO NOT create server-side session object
  ├─ DO NOT route to initialize-based transport factory
  ├─ DO NOT depend on process-global _initialized state
  ├─ LOG structured event: modern_session_mint_attempt
  └─ IF stateless dispatch not ready → return safe error, not silent fallback

IF legacy path detected:
  └─ Existing behavior preserved (isolated adapter)
```

### 2.3 Structured Logging

```json
{
  "event": "modern_session_mint_attempt",
  "organ": "geox",
  "timestamp": "2026-09-04T14:00:00Z",
  "request_id": "...",
  "mcp_protocol_version": "2026-07-28",
  "action_taken": "blocked",
  "fallback": "safe_error_response",
  "trace_id": "trc-..."
}
```

---

## 3. Fix Architecture

```
GEOX Ingress /mcp
  │
  ├─ Protocol-Version Detector
  │    ├─ MCP-Protocol-Version: 2026-07-28 → MODERN
  │    ├─ Body._meta protocolVersion → MODERN
  │    ├─ method == "initialize" → LEGACY
  │    └─ none → LEGACY (backward compat)
  │
  ├─ MODERN PATH
  │    ├─ Stateless dispatcher (no session)
  │    ├─ server/discover handler
  │    ├─ Header/body validation (-32020)
  │    ├─ Cache envelope (ttlMs, cacheScope)
  │    ├─ Auth from bearer token (per-request)
  │    └─ NO session creation, NO _initialized flag
  │
  └─ LEGACY PATH (isolated)
       ├─ initialize lifecycle
       ├─ Mcp-Session-Id (isolated)
       ├─ Legacy tools/list
       └─ Sunset telemetry
```

---

## 4. Regression Test

```python
def test_geox_no_session_on_modern_path():
    """GEOX must NOT mint sessions on modern (2026-07-28) requests."""
    resp = requests.post(
        "http://localhost:8081/mcp",
        json={"jsonrpc": "2.0", "id": "test-1", "method": "server/discover", "params": {
            "_meta": {"io.modelcontextprotocol/protocolVersion": "2026-07-28"}
        }},
        headers={
            "Content-Type": "application/json",
            "MCP-Protocol-Version": "2026-07-28",
            "Mcp-Method": "server/discover",
        }
    )
    assert "mcp-session-id" not in {k.lower(): v for k, v in resp.headers.items()}, \
        "GEOX minted session on modern path — P0 violation"
    assert resp.status_code in (200, 400, 405), \
        f"Unexpected status: {resp.status_code}"
```

---

## 5. Deployment

| Step | Action | Tier |
|------|--------|------|
| 1 | Add detection + logging (no behavior change) | T1 |
| 2 | Add regression test in CI | T1 |
| 3 | Block modern session minting in staging | T2 |
| 4 | Verify no legacy path regression | T2 |
| 5 | Deploy containment to production | T3 (888_HOLD) |
| 6 | Full modern path implementation | T3 (888_HOLD) |

---

*Containment design. No production mutation until 888 approval.*
