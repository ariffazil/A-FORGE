# INIT PROMPT — GEOX End-to-End MCP Test
**SEAL-ID:** `SEAL-2026-07-01-GEOX-ROUTING-FIX`
**Spawned by:** FORGE-000Ω
**Purpose:** Verify GEOX MCP is fully operational for future agentic use, with arifOS kernel in the routing chain.

---

## WHAT THIS TEST PROVES

1. `https://geox.arif-fazil.com/mcp` terminates at GEOX (not arifOS), organ identity preserved
2. GEOX MCP initialize + tools/list works from a clean HTTP client perspective
3. arifOS kernel can route to GEOX as a downstream organ (if applicable)
4. Session management works (MCP session IDs are created and returned)

This is a **SERVICE PROVE**, not a stress test. Do not loop. One pass per test.

---

## PREFLIGHT (run these first — must all pass)

```bash
# 1. GEOX local health
curl -sf http://localhost:8081/health | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='healthy', 'GEOX local down'"
echo "✅ GEOX local"

# 2. arifOS local health
curl -sf http://localhost:8088/health | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok', 'arifOS local down'"
echo "✅ arifOS local"

# 3. GEOX public routing (THIS is the main proof)
curl -sf "https://geox.arif-fazil.com/mcp" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -X POST \
  --data '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"e2e-test","version":"1.0"}},"id":1}' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('result',{})
name=r.get('serverInfo',{}).get('name','?')
assert name=='GEOX', f'Wrong organ: {name}'
print(f'✅ GEOX public routing OK — serverInfo.name={name}')
"
```

**If any preflight fails → STOP. Report. Do not proceed to deeper tests.**

---

## PHASE 1 — GEOX Standalone MCP (the primary test)

### Test 1.1: Initialize (already done in preflight, record the result)
- Extract `mcp-session-id` from response headers
- Extract `serverInfo.name`, `protocolVersion`, `instructions`
- Record in evidence dict

### Test 1.2: tools/list via same session
```bash
# Use the mcp-session-id from Test 1.1
SESSION_ID="<from 1.1>"
curl -sf "https://geox.arif-fazil.com/mcp" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -X POST \
  --data '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
tools=d.get('result',{}).get('tools',[])
print(f'Tools available: {len(tools)}')
for t in tools[:10]:
    print(f'  - {t[\"name\"]}')
"
```
- Count must be > 0 (31 canonical tools per GEOX Phase 2.2)

### Test 1.3: Call one tool (pick the safest — `geox_surface_status`)
```bash
SESSION_ID="<from 1.1>"
curl -sf "https://geox.arif-fazil.com/mcp" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -X POST \
  --data '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"geox_surface_status",
      "arguments":{"mode":"health"}
    },
    "id":3
  }' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(json.dumps(d.get('result',d.get('error',{})), indent=2)[:500])
"
```

---

## PHASE 2 — arifOS Kernel Routing to GEOX

> **⚠️ GÖDEL-LOCK (F7 HUMILITY):** arifOS routes to GEOX internally. If this fails, it may be an arifOS configuration issue — not a GEOX issue. GEOX is already proven working in Phase 1. Do not conflate the two. Label this INT/SPEC, not OBS.

### Test 2.1: arifOS organ attest for GEOX
```bash
# Via arifOS kernel — attest GEOX organ
curl -sf "http://localhost:8088/mcp" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -X POST \
  --data '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"arif_organ_attest",
      "arguments":{"organ_id":"geox"}
    },
    "id":10
  }' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('result',{})
print(json.dumps(r, indent=2)[:800])
"
```

### Test 2.2: arifOS route to GEOX (if GEOX is registered as downstream)
```bash
# Check if arifOS can route a GEOX-domain intent
curl -sf "http://localhost:8088/mcp" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -X POST \
  --data '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"arif_route",
      "arguments":{"intent":"assess basin prospectivity"}
    },
    "id":11
  }' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(json.dumps(d.get('result',d.get('error',{})), indent=2)[:800])
"
```

---

## PHASE 3 — Strange Loop Detection (STOP CONDITIONS)

> **Strange Loop definition:** If any test's success condition requires another test to succeed first, and that test requires the first to succeed — you are in a loop. STOP.

**Stop conditions — any of these means HALT and report:**
1. Phase 1 (GEOX standalone) fails → GEOX is broken, do not test routing
2. Phase 2 tests require Phase 1 to be working (this is NOT a strange loop — it's a dependency chain, proceed)
3. Any infinite loop detected (same test repeated 3x with same result) → break and report
4. arifOS returns an error that GEOX is not a registered organ → this is a configuration gap, not a GEOX failure. Report it.

**Anti-infinite-loop pattern used:**
- Each test has a unique `id` field (1, 2, 3, 10, 11)
- No test calls itself
- Phase ordering is strictly linear (Phase 1 before Phase 2)
- Loop counter: if any test repeats, increment counter. At 3 repeats → HALT

---

## OUTPUT FORMAT

Report as a single structured receipt:

```
GEOX E2E TEST RECEIPT
======================
Timestamp: <ISO>
Phase 1 — GEOX Standalone
  Initialize: <PASS/FAIL> — serverInfo.name=<X>, protocolVersion=<Y>
  tools/list: <PASS/FAIL> — <N> tools found
  geox_surface_status: <PASS/FAIL> — <error or output snippet>
Phase 2 — arifOS → GEOX Routing
  arif_organ_attest: <PASS/FAIL/INT/SPEC> — <output snippet>
  arif_route: <PASS/FAIL/INT/SPEC> — <output snippet>
Strange Loop: NONE DETECTED / HALTED (reason: ...)
Overall: <PASS/FAIL/CONDITIONAL>
Evidence files: <paths written>
```

---

## WHAT TO WRITE TO DISK

Write the receipt to:
```
/root/A-FORGE/forge_work/GEOX-E2E-TEST-<YYYYMMDD-HHMMSS>.md
```

Then seal the receipt path to VAULT999 using `forge_vault` mode=seal.

---

## GOPHER提醒

- This is ONE agent session. Not a loop. Not a cron.
- If GEOX is confirmed working → done. Write receipt. Seal. Exit.
- If GEOX fails → report exactly what failed, with error messages. Do not guess.
- "Jalan terus" only if all preflights pass.

---

*DITEMPA BUKAN DIBERI — This prompt forged 2026-07-01 by FORGE-000Ω*
*SKILL LOAD ORDER: 000-init-intent-classify → 111-sense-evidence-observe → this test*
