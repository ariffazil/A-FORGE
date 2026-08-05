# Hermes Adapter Timer Fix — Q3-B Permanent Resolution
## Forged: 2026-08-05 | Session: SEAL-555ad2dbc230409a

### Root Cause
`_await_with_thread_deadline()` in `hermes-agent 0.18.2` 
(`plugins/platforms/telegram/adapter.py:48-107`) creates a 
`threading.Timer` whose callback calls `loop.call_soon_threadsafe()` 
to signal a deadline future. Under Python 3.13 + anyio cancellation-shielded 
scopes inside `Application.initialize()`, the `call_soon_threadsafe` 
callback is queued but never processed by the event loop, causing 
the `asyncio.wait({task, deadline})` to hang forever.

### Immediate Workaround (Applied 2026-08-05)
```
HERMES_TELEGRAM_INIT_TIMEOUT=5
HERMES_TELEGRAM_DISABLE_FALLBACK_IPS=1
HERMES_TELEGRAM_HTTP_CONNECT_TIMEOUT=2
HERMES_TELEGRAM_HTTP_POOL_TIMEOUT=2
HERMES_TELEGRAM_HTTP_READ_TIMEOUT=3
```
Short timeouts + disabling unreachable fallback IPs allows `Application.initialize()` 
to complete before the Timer mechanism is needed. This mirrors Hermes ASI's 
working config. Applied to: `/root/.forge/.env` + systemd override.

### Permanent Fix (Code Patch)
Replace the `threading.Timer` + `asyncio.wait` pattern with `asyncio.wait_for` 
wrapped in a task that properly handles the anyio cancellation shield:

```python
async def _await_with_thread_deadline(awaitable, timeout, *, on_abandon=None):
    """Fixed: use asyncio.wait_for instead of threading.Timer bridge."""
    try:
        return await asyncio.wait_for(awaitable, timeout=timeout)
    except asyncio.TimeoutError:
        if on_abandon is not None:
            cleanup = asyncio.ensure_future(_run_abandon_cleanup(on_abandon))
            cleanup.add_done_callback(_consume_abandoned_task)
        raise
```

### Why This Works
- `asyncio.wait_for` uses the event loop's internal timer, not an OS thread
- No cross-thread bridge needed — everything stays on the event loop
- Properly handles Python 3.13's anyio cancellation semantics
- Same behavior: raises `TimeoutError`, runs `on_abandon` cleanup

### Affected Files
- `/usr/local/lib/hermes-agent/plugins/platforms/telegram/adapter.py` (lines 48-107)
- Same file used by BOTH Hermes ASI and FORGE gateways

### Deployment Path
1. Apply patch to installed location (temporary — survives until `pip upgrade`)
2. Fork the adapter into `/root/A-FORGE/patches/hermes-adapter-patched.py`
3. Upstream PR to hermes-agent repo (https://github.com/...)
4. Pin fork in requirements until upstream merges

### Rollback
Restore from `/root/.forge/.env.bak-20260805` (created before env changes)
or revert systemd override: `rm /etc/systemd/system/forge-gateway.service.d/init-timeout.conf`
