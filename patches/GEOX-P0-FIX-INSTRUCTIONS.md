# GEOX P0 Containment — Execution Instructions

> **Status:** READY FOR DEPLOYMENT
> **Risk:** ONE env var change + service restart
> **Rollback:** Remove env var + restart

## The Fix

GEOX uses FastMCP 3.4.6 which has `stateless_http` setting. When `True`, FastMCP uses true stateless mode (new transport per request) — no `Mcp-Session-Id` minted.

**One line fix:**

```bash
# Add to GEOX systemd service environment
echo 'FASTMCP_STATELESS_HTTP=true' >> /etc/geox-mcp.env
systemctl restart geox-mcp.service
```

**Or in code** (if env var doesn't work):

In `/root/GEOX/src/geox_mcp/server.py`, change:
```python
_mcp_kwargs: dict[str, Any] = {
    "name": "GEOX",
    "version": GEOX_VERSION,
    ...
}
```

To:
```python
_mcp_kwargs: dict[str, Any] = {
    "name": "GEOX",
    "version": GEOX_VERSION,
    ...
    "stateless_http": True,  # P0: MCP 2026-07-28 stateless compliance
}
```

## Verification

```bash
# After restart, verify no session minting
curl -sI -X POST http://127.0.0.1:8081/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2026-07-28" \
  -H "Mcp-Method: server/discover" \
  -d '{"jsonrpc":"2.0","id":"test","method":"server/discover","params":{}}' \
  | grep -i "mcp-session-id"
# Should return NOTHING (no session header)
```

## Impact

- Modern clients (2026-07-28): No session minted ✅
- Legacy clients: May need session support — verify with legacy initialize test
- GEOX tools: Unchanged — tool logic is stateless already
- Performance: Slight improvement (no session management overhead)

## Rollback

```bash
# Remove env var and restart
sed -i '/FASTMCP_STATELESS_HTTP/d' /etc/geox-mcp.env
systemctl restart geox-mcp.service
```
