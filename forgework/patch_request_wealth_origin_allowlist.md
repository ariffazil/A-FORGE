# Patch Request: WEALTH MCP Origin Allowlist + Healthcheck Origin

**version:** v0.1  
**created:** 2026-07-09  
**author:** Hermes-Prime  
**target:** WEALTH maintainer  
**priority:** P0 — blocks domain computation from external sessions  

---

## Problem

WEALTH MCP tools are discoverable (`tools/list` works) but fail at runtime with:

```
403 DNS rebinding protection / Invalid Origin
```

This affects all domain compute calls:
- `wealth_agent_path`
- `wealth_boundary_governance`
- `wealth_entropy_risk`
- Any other WEALTH domain tool

The registry is visible but execution is blocked. This creates false confidence — tools appear available but cannot be called.

---

## Root Cause

The WEALTH MCP server has DNS rebinding protection enabled (correctly), but the origin allowlist does not include the MCP client origins used by:
- External AI sessions (ChatGPT, Claude, etc.)
- Federation organ-to-organ calls
- A2A mesh connections

The protection is correct — the allowlist is incomplete.

---

## Proposed Fix

### Option 1: Origin Allowlist (Recommended)

Add a configuration parameter to WEALTH's MCP server:

```yaml
# wealth_mcp_config.yaml
mcp_server:
  origin_policy:
    allowed_origins:
      - "http://localhost:*"        # local federation
      - "https://arif-fazil.com"   # sovereign domain
      - "https://*.openai.com"     # OpenAI sessions
      - "https://*.anthropic.com"  # Claude sessions
      - "https://*.google.com"     # Gemini sessions
    allow_signed_sessions: true    # accept sessions with valid arifOS signatures
```

### Option 2: Session-Based Auth (Better Long-Term)

Instead of origin-based allowlisting, use session tokens:

```python
# wealth_session_init endpoint
@app.post("/mcp/session/init")
async def session_init(request: SessionInitRequest):
    """Validate arifOS session token before allowing domain calls."""
    # 1. Verify arifOS session signature
    # 2. Issue WEALTH session token
    # 3. Return session_id for subsequent calls
    pass

# All domain tools check session before executing
@tool.requires_session()
async def wealth_boundary_governance(session_id: str, ...):
    """Requires valid WEALTH session token."""
    pass
```

### Option 3: Three-Layer Architecture (Best)

Separate the concerns:

```
Layer 1: Registry Discovery (no auth required)
  - tools/list
  - tool schema
  - health check

Layer 2: Session/Origin Validation (light auth)
  - session_init
  - origin validation
  - healthcheck_origin

Layer 3: Domain Compute (full auth)
  - wealth_agent_path
  - wealth_boundary_governance
  - wealth_entropy_risk
  - All other domain tools
```

This way:
- Discovery always works (proves tools exist)
- Session validation happens before compute (proves identity)
- Domain compute only runs with valid session (proves authority)

---

## Implementation Priority

1. **Immediate:** Add `wealth_healthcheck_origin` endpoint that tests origin/session validity without running domain logic
2. **Short-term:** Expand origin allowlist to include federation organ domains
3. **Medium-term:** Implement session-based auth with arifOS integration
4. **Long-term:** Three-layer architecture with progressive auth

---

## Testing

Before deploying:
1. Test from localhost (should always work)
2. Test from external AI session (should work with valid session/origin)
3. Test with invalid origin (should fail with clear error, not 403)
4. Test registry discovery (should always work)
5. Test session init (should succeed with valid arifOS token)

---

## Impact

- **Current:** WEALTH tools appear available but fail at runtime → false confidence
- **After fix:** Tools either work or fail with clear, actionable error messages
- **Risk:** Low — origin/session validation is additive, not removing existing security

---

## References

- WEALTH health endpoint: `http://localhost:18082/health` (ALIVE)
- Error message: `403 DNS rebinding protection / Invalid Origin`
- Related: GEOX session bootstrap request (separate doc)
