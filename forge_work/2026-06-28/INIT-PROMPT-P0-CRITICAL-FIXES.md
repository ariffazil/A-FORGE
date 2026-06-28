<!-- SOT-MANIFEST
owner: Arif
forged: 2026-06-28
valid_from: 2026-06-28
valid_until: 2026-07-07 (target: within 9 days)
confidence: high
scope: /root/arifOS + /root/VAULT999 (Windows)
epistemic_status: INIT_PROMPT — load before acting
load_order: 1 of 4 (after AGENTS.md, before P1/P2)
doctrine: DITEMPA BUKAN DIBERI
-->

# INIT PROMPT — P0 Critical Fixes

> **Load this AFTER `/root/AGENTS.md` and `/root/CONTEXT.md`.**
> **These are the 4 blocking fixes. Without them, the federation is OBSERVE + ROUTE only.**
> **Target: complete P0-A through P0-C first. P0-D requires Windows access.**

---

## Federation State at Session Start

**6/6 organs alive.** But three critical links are broken:
- `actor_verified=False` → session stuck at OBSERVE_ONLY authority
- `arif_think` returns `LLM_UNAVAILABLE` → MIND stage produces nothing
- `hermes_vault_query` returns nothing → vault_replay fails
- `VAULT999` returns `WinError 10061` → cooling_ledger unreachable

**The federation is currently an OBSERVE + ROUTE router, not a REASON + JUDGE + ACT agent.**

---

## P0-A: Fix claude.ai Connector → `mcp.arif-fazil.com/mcp`

**Problem:** claude.ai connects to `arifos.arif-fazil.com/mcp` which is a deprecated endpoint. This causes `actor_verified=False`, locking sessions to `OBSERVE_ONLY`.

**What to do:**
1. Verify the Caddyfile routes for BOTH endpoints:
   ```bash
   grep -A10 "arifos.arif-fazil.com\|mcp.arif-fazil.com" /etc/caddy/Caddyfile
   grep -A10 "arifos.arif-fazil.com\|mcp.arif-fazil.com" /root/arifOS/Caddyfile
   ```
2. Make `arifos.arif-fazil.com/mcp` a **redirect** to `mcp.arif-fazil.com/mcp` — do NOT serve MCP from the deprecated endpoint.
3. Ensure `mcp.arif-fazil.com/mcp` is the canonical MCP endpoint with proper CORS and transport-security headers.
4. Verify: `curl -sf https://mcp.arif-fazil.com/mcp` returns MCP JSON-RPC handshake.
5. **888_HOLD before Caddyfile reload** — Caddy handles production traffic.

**Success criteria:** Next `arif_init` returns `actor_verified=True`, session authority escalates beyond OBSERVE_ONLY.

**Files likely touched:**
- `/root/arifOS/Caddyfile`
- `/etc/caddy/Caddyfile`
- Possibly `/root/arifOS/arifosmcp/runtime/rest_routes/rest_routes.py`

---

## P0-B: Fix `hermes_vault_query` outputSchema

**Problem:** `hermes_vault_query` declares an `outputSchema` but returns nothing. MCP handshake lies — promises structured output, delivers silence. This breaks `vault_replay` in the conformance spine.

**What to do:**
1. Find the tool implementation:
   ```bash
   grep -rn "hermes_vault_query\|def hermes_vault_query" /root/arifOS/ --include="*.py" | grep -v __pycache__
   ```
2. Debug: call the tool and capture the actual response. Compare with declared outputSchema.
3. If the tool genuinely has no data to return, return `{"vault_seals": [], "total": 0, "status": "empty"}` — a valid empty result, NOT silence.
4. If the data source is broken, trace the data path and fix.
5. Verify: call `hermes_vault_query` and confirm structured output matches schema.

**Success criteria:** `hermes_vault_query` returns valid JSON matching its declared outputSchema. `vault_replay` probe passes.

**Files likely touched:**
- `/root/arifOS/arifosmcp/runtime/tools.py` (or wherever hermes_vault_query is defined)

---

## P0-C: Wire Azure OpenAI into `arif_think` Hot Path

**Problem:** `arif_think` returns `LLM_UNAVAILABLE`, `confidence: 0.0`. Azure OpenAI is in config but not wired into the MIND reasoning hot path. This means the federation cannot REASON — only OBSERVE and ROUTE.

**What to do:**
1. Locate the `arif_think` implementation:
   ```bash
   grep -rn "def arif_think\|def _arif_think" /root/arifOS/ --include="*.py" | grep -v __pycache__
   ```
2. Check LLM client config:
   ```bash
   grep -rn "AZURE_OPENAI\|azure_openai\|_call_azure" /root/arifOS/arifosmcp/runtime/llm_client.py
   ```
3. Verify Azure OpenAI credentials exist:
   ```bash
   ls -la /root/.secrets/azure* 2>/dev/null
   env | grep AZURE
   ```
4. Wire the Azure OpenAI client into the `arif_think` hot path. The TokenRouter is already wired (from P1 hardening) — Azure may need similar treatment.
5. Test: call `arif_think` with a simple reasoning query. Confirm `reasoning_verdict != LLM_UNAVAILABLE` and `confidence > 0.0`.

**Success criteria:** `arif_think(mode="reason", query="What is 2+2?")` returns a reasoning result with confidence > 0.5.

**Files likely touched:**
- `/root/arifOS/arifosmcp/runtime/llm_client.py`
- `/root/arifOS/arifosmcp/runtime/mind_reason.py`
- `/root/arifOS/arifosmcp/runtime/tools.py`

---

## P0-D: Bring VAULT999 Service Up (Windows)

**Problem:** `vault_seals_total: 0`, `WinError 10061` — VAULT999 API actively refuses connection on Windows host. Cooling ledger is empty or unreachable.

**What to do:**
1. Verify VAULT999 Windows service status (requires Arif's Windows machine access).
2. Check if the service is running: `Get-Service VAULT999 | Select-Object Status`
3. Check if port is listening: `netstat -an | findstr :9999`
4. If down: `Start-Service VAULT999` or restart the Python process.
5. Verify from VPS: `curl http://<windows-ip>:<vault-port>/health`
6. **This requires 888_HOLD + Arif's Windows access.** Document the fix path but do not attempt without Arif present.

**Success criteria:** `vault_seals_total > 0`, cooling_ledger probe passes.

**Files likely touched:**
- Windows service config (not Linux)
- Possibly `/root/arifOS/arifosmcp/runtime/vault_postgres.py` (connection config)

---

## Verification Protocol

After ALL P0 fixes are applied:
```bash
# Reality check
for svc in "arifos:8088" "aforge:7071" "aaa:3001" "geox:8081" "wealth:18082" "well:18083"; do
  curl -sf "http://localhost:${svc##*:}/health" >/dev/null && echo "✅ $svc" || echo "❌ $svc"
done

# P0 verification
python3 -c "
# Verify arif_think works
# Verify hermes_vault_query returns data
# Verify actor_verified=True on next arif_init
print('P0 verification: run arif_init + arif_think + hermes_vault_query')
"
```

---

## Evidence to Produce

- [ ] `P0-A: actor_verified=True` — verified via arif_init
- [ ] `P0-B: hermes_vault_query structured output` — JSON matching schema
- [ ] `P0-C: arif_think reasoning_verdict != LLM_UNAVAILABLE` — confidence > 0.5
- [ ] `P0-D: vault_seals_total > 0` — cooling_ledger accessible (may be deferred)

---

*DITEMPA BUKAN DIBERI. The courthouse is built. Now wire the judge.* 🔥⚒️
