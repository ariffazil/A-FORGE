# Patch Request: GEOX Session Bootstrap Path

**version:** v0.1  
**created:** 2026-07-09  
**author:** Hermes-Prime  
**target:** GEOX maintainer  
**priority:** P1 — session/schema mismatch blocks cross-organ calls  

---

## Problem

GEOX tool surface is discoverable, but `geox_system_registry_status` returns:

```
SESSION_REQUIRED
```

The tool schema declares `session_id` as optional, but live behavior requires one. This is a **schema/runtime drift** — the contract says one thing, the implementation does another.

---

## Root Cause

GEOX has a session validation gate, but:
1. The schema doesn't reflect this (claims optional, enforces required)
2. There's no documented session bootstrap path for external agents
3. No `geox_session_init` endpoint exists

The gate is correct (GEOX should require authentication). The missing piece is the bootstrap path.

---

## Proposed Fix

### Option 1: Session Init Endpoint (Recommended)

```python
# geox_session_init endpoint
@app.post("/mcp/session/init")
async def session_init(request: GeoxSessionInitRequest):
    """
    Bootstrap a GEOX session for external agents.
    
    Requires:
    - arifOS session token (optional, for federation members)
    - actor_id (required, for audit trail)
    - intent (required, for scope validation)
    
    Returns:
    - session_id
    - valid_until
    - allowed_tools
    - authority_scope
    """
    pass
```

### Option 2: Schema/Runtime Alignment (Quick Fix)

Either:
- Make `session_id` truly optional in the implementation (with read-only access), OR
- Update the schema to mark `session_id` as required

Right now: schema says optional, runtime requires → drift → confusion

### Option 3: Anonymous Read-Only Mode (Fallback)

Allow registry discovery and health checks without session:

```python
@tool.requires_session(required=False)  # session optional for these tools
async def geox_system_registry_status(...):
    """Returns registry without requiring session."""
    pass
```

But require session for all domain compute tools.

---

## Implementation Priority

1. **Immediate:** Align schema and runtime — either both require session or both make it optional
2. **Short-term:** Add `geox_session_init` endpoint with arifOS integration
3. **Medium-term:** Implement progressive auth (read-only without session, full with session)
4. **Long-term:** Federation-wide session protocol (shared with WEALTH fix)

---

## Testing

Before deploying:
1. Test registry call without session → should work (if schema says optional)
2. Test registry call with session → should work
3. Test domain tool without session → should fail with clear error
4. Test domain tool with session → should work
5. Test session init with valid arifOS token → should succeed

---

## Impact

- **Current:** GEOX appears available but returns SESSION_REQUIRED → blocked cross-organ calls
- **After fix:** External agents can bootstrap sessions and call GEOX tools
- **Risk:** Low — session-based auth is standard, not removing security

---

## References

- GEOX health endpoint: `http://localhost:8081/health`
- Error message: `SESSION_REQUIRED`
- Related: WEALTH origin allowlist request (separate doc)
