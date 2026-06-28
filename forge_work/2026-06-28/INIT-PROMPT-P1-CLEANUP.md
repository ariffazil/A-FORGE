<!-- SOT-MANIFEST
owner: Arif
forged: 2026-06-28
valid_from: 2026-06-28
valid_until: 2026-07-07
confidence: high
scope: GEOX + WEALTH + AAA + A-FORGE + WELL
epistemic_status: INIT_PROMPT — load after P0 fixes
load_order: 2 of 4
doctrine: DITEMPA BUKAN DIBERI
-->

# INIT PROMPT — P1 Cleanup & Bridge

> **Load AFTER P0-CRITICAL-FIXES are complete.**
> **These are the 4 high-priority cleanups. Clean surface, wire organs, verify identity.**
> **GEOX has 31 phantom tools. WEALTH has 4 broken. AAA+A-FORGE are off the MCP bridge. WELL has no identity.**

---

## P1-A: Delete 31 Phantom GEOX Tools from FastMCP Manifest

**Problem:** GEOX MCP server registers 31 tools in FastMCP that are NOT in the canonical surface of 30 tools. This pollutes the tool surface. Any MCP client sees tools that either don't work or shouldn't be public.

**What to do:**
1. Confirm the phantom count:
   ```bash
   curl -sf -X POST http://localhost:8081/mcp -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | python3 -c "
   import sys,json
   d=json.load(sys.stdin)
   tools=[t['name'] for t in d.get('result',{}).get('tools',[])]
   print(f'Total registered: {len(tools)}')
   "
   ```
2. Compare with canonical surface in:
   ```bash
   cat /root/geox/src/geox_mcp/registry.py | grep "SURFACE_TOOLS"
   ```
3. Identify the 31 non-canonical tools. These may be:
   - Internal tools mistakenly exposed
   - Legacy wrappers that still register
   - Tools registered in `server.py` outside the canonical manifest
4. **Delete registrations** for non-canonical tools OR mark them as `expose=False`.
5. Restart GEOX: `systemctl restart geox` (or docker restart)
6. Verify: tool count drops to canonical number (30).

**Success criteria:** GEOX MCP server returns exactly the canonical tool set. No phantom tools.

**Files likely touched:**
- `/root/geox/src/geox_mcp/server.py`
- `/root/geox/src/geox_mcp/registry.py`

---

## P1-B: Identify + Fix WEALTH 4-Tool Gap

**Problem:** WEALTH claims 28 tools, only 24 are callable. `wealth_emv_risk` + 3 others are phantom or schema-broken.

**What to do:**
1. Probe the gap:
   ```bash
   # List all registered tools
   curl -sf -X POST http://localhost:18082/mcp -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | python3 -c "
   import sys,json
   d=json.load(sys.stdin)
   tools=[t['name'] for t in d.get('result',{}).get('tools',[])]
   print('\n'.join(sorted(tools)))
   "
   ```
2. Cross-reference with the canonical tool list from the WEALTH manifest:
   ```bash
   grep -rn "CANONICAL_TOOLS\|SURFACE_TOOLS\|def wealth_" /root/WEALTH/ --include="*.py" | head -40
   ```
3. For each of the 4 broken tools:
   - If phantom (registered but no implementation): **delete registration.**
   - If schema-broken (implementation exists but outputSchema mismatch): **fix schema or fix output.**
   - If genuinely missing: **implement or remove from manifest.**
4. Verify: all 28 claimed tools are callable or reduce claim to match actual.

**Success criteria:** WEALTH tool list matches claimed vs actual. No phantom tools on surface.

**Files likely touched:**
- `/root/WEALTH/server.py`
- `/root/WEALTH/server_federated.py`
- `/root/WEALTH/wealth_mcp/`

---

## P1-C: Wire AAA + A-FORGE into MCP Bridge

**Problem:** AAA (control plane) and A-FORGE (execution shell) are not accessible via the MCP mesh. This means OpenCode connects to arifOS/GEOX/WEALTH/WELL but NOT to AAA or A-FORGE through the primary MCP gateway.

**What to do:**
1. Check current MCP bridge config:
   ```bash
   grep -rn "mcp\|MCP\|bridge\|BRIDGE" /root/AAA/src/gateway/ --include="*.ts" | head -20
   grep -rn "mcp\|MCP" /root/A-FORGE/ --include="*.py" | grep -v forge_work | head -20
   ```
2. AAA needs an MCP server endpoint. Check if one exists:
   ```bash
   curl -sf http://localhost:3001/mcp 2>&1 | head -5
   ```
3. Wire AAA's A2A gateway to also speak MCP (or add a sidecar MCP server).
4. Wire A-FORGE's forge_* tools into the main MCP mesh (they are stdio-only currently).
5. Verify: `curl http://localhost:3001/mcp` returns MCP JSON-RPC handshake.

**Success criteria:** Both AAA and A-FORGE respond to MCP `tools/list` requests.

**Files likely touched:**
- `/root/AAA/src/gateway/` (TypeScript)
- `/root/A-FORGE/` (Python MCP server)

---

## P1-D: Fix WELL `identity_valid=False`

**Problem:** WELL reports `identity_valid=False`. ADAM (Ω Heart) has no verified identity to regulate from. The heart is beating without a name.

**What to do:**
1. Find where identity_valid is computed:
   ```bash
   grep -rn "identity_valid\|identity_check\|verify_identity" /root/WELL/server.py | head -20
   ```
2. Trace the identity verification chain. It likely fails because:
   - No verified session bound
   - No biometric telemetry
   - Operator identity not resolved
3. Fix the verification path. If biometric telemetry is unavailable, fall back to session-based identity.
4. Verify: `well_health_check()` returns `identity_valid=True`.

**Success criteria:** WELL identity_valid=True. ADAM (Ω Heart) beats with a name.

**Files likely touched:**
- `/root/WELL/server.py`
- `/root/WELL/compatibility.py`

---

## Verification Protocol

```bash
# P1-A: GEOX tool count
TOOLS=$(curl -sf -X POST http://localhost:8081/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | python3 -c "import sys,json; print(len(json.load(sys.stdin)['result']['tools']))")
echo "GEOX tools: $TOOLS (expect 30)"

# P1-B: WEALTH tool count
TOOLS=$(curl -sf -X POST http://localhost:18082/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | python3 -c "import sys,json; print(len(json.load(sys.stdin)['result']['tools']))")
echo "WEALTH tools: $TOOLS (expect 28, all callable)"

# P1-C: AAA MCP
curl -sf http://localhost:3001/mcp >/dev/null && echo "✅ AAA MCP" || echo "❌ AAA MCP"

# P1-D: WELL identity
echo "WELL identity_valid: check via well_health_check"
```

---

*DITEMPA BUKAN DIBERI. Clean the surface. Wire the bridge. Name the heart.* 🔥⚒️
