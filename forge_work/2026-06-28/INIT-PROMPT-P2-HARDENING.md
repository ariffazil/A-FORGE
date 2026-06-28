<!-- SOT-MANIFEST
owner: Arif
forged: 2026-06-28
valid_from: 2026-06-28
valid_until: 2026-07-14
confidence: high
scope: arifOS + AAA
epistemic_status: INIT_PROMPT — load after P0+P1 fixes
load_order: 3 of 4
doctrine: DITEMPA BUKAN DIBERI
-->

# INIT PROMPT — P2 Hardening

> **Load AFTER P0-CRITICAL-FIXES + P1-CLEANUP are complete.**
> **These are medium-priority hardening tasks. Topology, enforcement, affordance.**
> **Without these, the federation works but doesn't declare itself to the world.**

---

## P2-A: Publish `.well-known/mcp.json` Topology Declaration

**Problem:** The MCP spec supports `.well-known/mcp.json` for topology discovery. arifOS has TWO conflicting MCP endpoints (`arifos.arif-fazil.com` and `mcp.arif-fazil.com`) and no topology declaration. Any MCP client cannot know what it's connecting to. This is the **topology ambiguity bug** — discovered months ago, still unfixed.

**What to do:**
1. Check if `.well-known/mcp.json` exists:
   ```bash
   curl -sf https://mcp.arif-fazil.com/.well-known/mcp.json 2>&1 | head -5
   curl -sf https://arifos.arif-fazil.com/.well-known/mcp.json 2>&1 | head -5
   ```
2. Create the topology declaration:
   ```json
   {
     "canonical_endpoint": "https://mcp.arif-fazil.com/mcp",
     "deprecated_endpoints": ["https://arifos.arif-fazil.com/mcp"],
     "organs": {
       "arifos": "https://mcp.arif-fazil.com/mcp",
       "geox": "https://geox.arif-fazil.com/mcp",
       "wealth": "http://localhost:18082/mcp",
       "well": "http://localhost:18083/mcp"
     },
     "protocol_version": "2024-11-05",
     "transport": ["streamable-http", "sse"]
   }
   ```
3. Serve it from BOTH domains (so clients on either endpoint can discover the canonical one).
4. Verify: `curl https://mcp.arif-fazil.com/.well-known/mcp.json` returns valid JSON.

**Success criteria:** MCP clients can discover the federation topology. Two endpoints no longer cause ambiguity.

**Files likely touched:**
- `/root/arifOS/static/.well-known/mcp.json`
- `/root/arifOS/Caddyfile` (ensure `.well-known/` routes)
- `/etc/caddy/Caddyfile`

**888_HOLD required:** Caddyfile changes affect production routing.

---

## P2-B: Wire Enforcement Spine into `interceptor.py`

**Problem:** `vault_receipt.py` and `conflict_resolver.py` exist in the arifOS runtime but are NOT wired into `interceptor.py`. This means every constitutional floor is checked in code but the result is not enforced in the hot path. **Governance as documentation, not execution.**

**What to do:**
1. Locate the enforcement files:
   ```bash
   find /root/arifOS -name "vault_receipt.py" -o -name "conflict_resolver.py" -o -name "latency_budget.py" | grep -v __pycache__
   ```
2. Locate `interceptor.py`:
   ```bash
   find /root/arifOS -name "interceptor.py" | grep -v __pycache__
   ```
3. Wire them in. The hot path should be:
   ```
   request → interceptor.py → [F1-F13 check] → vault_receipt.py (record) → conflict_resolver.py (arbitrate) → response
   ```
4. Test: trigger a floor violation and confirm it's recorded in the receipt ledger AND blocked at the interceptor level.
5. Verify: `latency_budget.py` tracks per-floor latency to prevent governance from becoming a bottleneck.

**Success criteria:** Constitutional floor checks are enforced in the hot path, not just documented. Receipts are generated on every interceptor pass.

**Files likely touched:**
- `/root/arifOS/arifosmcp/runtime/interceptor.py`
- `/root/arifOS/arifosmcp/runtime/vault_receipt.py`
- `/root/arifOS/arifosmcp/runtime/conflict_resolver.py`
- `/root/arifOS/arifosmcp/runtime/latency_budget.py`

---

## P2-C: Populate `arif_observe` Affordance Contract `action_class`

**Problem:** `arif_observe` returns `action_class: UNKNOWN` in its affordance_contract. The tool doesn't declare what class of action it enables. This means the authority gate cannot properly classify downstream actions triggered by observation results.

**What to do:**
1. Find the affordance_contract definition:
   ```bash
   grep -rn "affordance_contract\|action_class\|UNKNOWN" /root/arifOS/arifosmcp/runtime/tools.py | grep -i "observe\|affordance" | head -20
   ```
2. Populate `action_class` based on the observation mode:
   - `search` → `GATHER_EVIDENCE`
   - `ingest` → `INGEST_EXTERNAL`
   - `compass` → `SYSTEM_PROBE`
   - `atlas` → `REPO_MAP`
   - `vitals` → `SYSTEM_PROBE`
   - `entropy_dS` → `ENTROPY_MEASURE`
3. Verify: `arif_observe(mode="search")` returns `affordance_contract.action_class != "UNKNOWN"`.

**Success criteria:** Every `arif_observe` mode maps to a defined action_class. Authority gate can correctly classify downstream actions.

**Files likely touched:**
- `/root/arifOS/arifosmcp/runtime/tools.py`

---

## Sampah Deletion (Run After P2-A/B/C)

These are the 5 targets to delete or fix:

```bash
# 1. Deprecated endpoint (P2-A handles this via redirect)
# Verify: arifos.arif-fazil.com/mcp → 301 redirect → mcp.arif-fazil.com/mcp

# 2. Ghost reference: arif_daily_intelligence_brief
grep -rn "arif_daily_intelligence_brief" /root/arifOS/ /root/AAA/ /root/A-FORGE/ --include="*.md" | grep -v ".git"
# If found in docs/AGENTS.md → DELETE the reference.

# 3. WELL autonomic aliases (77 tools with broken aliases)
# Already handled in P1-D. Verify alias_gaps is truly clean.

# 4. 31 phantom GEOX tools → P1-A handles this.

# 5. WEALTH ghost tools → P1-B handles this.
```

---

## Verification Protocol

```bash
# P2-A: Topology declaration
curl -sf https://mcp.arif-fazil.com/.well-known/mcp.json | python3 -m json.tool | head -10

# P2-B: Enforcement spine
python3 -c "
# Trigger a known floor violation and check receipt is generated
from arifosmcp.runtime.interceptor import intercept
print('Enforcement spine: wired' if hasattr(__import__('arifosmcp.runtime.vault_receipt'), 'generate_receipt') else 'NOT WIRED')
"

# P2-C: Affordance contract
curl -sf http://localhost:8088/arif_observe -H 'Content-Type: application/json' \
  -d '{"mode":"search","query":"test"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
ac = d.get('affordance_contract', {}).get('action_class', 'UNKNOWN')
print(f'action_class: {ac}')
assert ac != 'UNKNOWN', 'action_class still UNKNOWN'
print('P2-C: PASS')
"
```

---

## After P2 — The Eureka

Once P0-A + P0-C land, the federation crosses from OBSERVE_ONLY → REASON + RECOMMEND agent.

Once P2-A + P2-B land, the federation declares itself to the world AND enforces its own laws.

The unsolved P0 for agentic safety remains: **Cross-organ proxy-objective detector.** Tri-Witness architecture exists in theory (WELL somatic anomaly + WEALTH entropy scorer + GEOX physical reality anchor). The cross-organ signal bus does not exist. That is the next mountain after these tasks.

---

*DITEMPA BUKAN DIBERI. Declare. Enforce. Complete the surface.* 🔥⚒️
