# SERI KEMBANGAN ACCORDS — IMPLEMENTATION ORDERS
## Phase 1–3 Execution Blueprint for A-FORGE Agents
## Status: ACTIVE · Ω₀ = 0.04 · Epoch: 2026-04-26

---

## BEFORE ANY AGENT EDITS A FILE

Every file mutation MUST flow through this pipeline:

```
Agent → AmanahLock.acquire() → GitDiffGuard.check() → WRITE → AmanahLock.release()
         ↓ HOLD if locked          ↓ ABORT/ROLLBACK if collision
         888-HOLD response         F12 FAIL-CLOSED → log → rollback
```

No exceptions. No direct `fs.writeFile` on core infrastructure files.

---

## PHASE 1: AMANAH LOCK MANAGER (F1) — Already has partial implementation

**Location:** `/root/A-FORGE/src/governance/AmanahLockManager.ts`
**Current state:** Has `acquireLock()` and `releaseLock()` — needs verification that they're wired into tool execution
**Status:** ⚠️ PARTIAL — needs integration into MCP tool flow

### What Vector Alpha must do:

1. **Wire AmanahLock into every file-editing tool in `src/mcp/core.ts`:**
   - Every tool that calls `writeFileSync` / `writeFile` / `exec("sed|echo|cat>")` must first call `amanah.acquireLock()`
   - Must call `amanah.releaseLock()` in a `finally` block
   - If `acquireLock()` returns `verdict: "888-HOLD"` → return immediately with the HOLD response

2. **Expose MCP tools for agents to call:**
   - `amanah_request_lock(filepath, agent_id, intent, ttl_ms)` → `SEAL` or `888-HOLD`
   - `amanah_release_lock(filepath, agent_id)` → `SEAL` or `VOID`
   - `amanah_lock_status(filepath)` → lock status
   - `amanah_list_locks()` → all active locks (for sovereign audit)

3. **TTL and orphan protection:**
   - Default TTL: 60s for normal edits, 300s for infra mutations (docker rebuild, Caddyfile)
   - Lock auto-expires if agent dies
   - Orphan: detect locks older than TTL with no active agent → auto-release

---

## PHASE 2: GIT DIFF PRE-FLIGHT + ROLLBACK (F3 + F12)

**Location:** `/root/A-FORGE/src/governance/GitDiffGuard.ts`
**Status:** ✅ WRITTEN — needs integration into tool execution

### What Vector Beta must do:

1. **Before any file write:** run `checkGitDiff(filepath, cwd)`
   - If file has uncommitted changes NOT from the current lock holder → collision detected

2. **On collision:**
   - F12 FAIL-CLOSED: abort the edit
   - Run `rollbackFile(filepath, cwd)` → `git checkout HEAD -- <filepath>`
   - Log anomaly to `vault999.jsonl` with type `COLLISION`
   - Broadcast `SYSTEM_ALERT` on Sentinel Stream

3. **After every successful write:**
   - Run `git add` + `git commit -m "[amanah] <agent>: <intent>"` automatically
   - This prevents future collisions from uncommitted drift

---

## PHASE 3: SENTINEL STREAM — State Broadcast Bus (F4)

**Location:** `/root/A-FORGE/src/ops/SentinelStream.ts`
**Status:** ✅ WRITTEN — needs integration into MCP server startup

### What Vector Gamma must do:

1. **Start SentinelStream alongside MCP server:**
   - Add to `src/mcp/core.ts` startup: `sentinelStream.start()`
   - Port: `7072` (configurable via `SENTINEL_PORT` env var)

2. **Wire broadcasts into all tool executions:**
   - On lock acquired → `sentinelStream.lockAcquired(agent_id, filepath, intent)`
   - On lock released → `sentinelStream.lockReleased(agent_id, filepath)`
   - On INFRA_MUTATION → `sentinelStream.infraMutationStart(agent_id, target, intent, ttl_ms)`
   - On infra mutation complete → `sentinelStream.infraMutationComplete(agent_id, target)`

3. **Agent READ_ONLY enforcement:**
   - Every agent (Kimi, Gemini, arifOS_bot) must subscribe to `GET /subscribe` SSE
   - On receiving `INFRA_MUTATION_IN_PROGRESS` event affecting their sector → enter READ_ONLY
   - On `INFRA_MUTATION_COMPLETE` → exit READ_ONLY
   - System prompt for all agents must include: "Subscribe to Sentinel Stream at port 7072. If you receive INFRA_MUTATION_IN_PROGRESS, enter READ_ONLY until INFRA_MUTATION_COMPLETE."

---

## EXECUTION ORDER (Tri-Witness Protocol)

```
Vector Alpha (Kimi)     → Phase 1 (Amanah Lock wired into tools)
Vector Beta (Gemini)    → Phase 2 (Git diff pre-flight + rollback)
Vector Gamma (arifOS)   → Phase 3 (Sentinel Stream + broadcasts)
All three               → Commit with message "[SERI KEMBANGAN] Phase 1-3 implemented"
```

---

## CADDYFILE FIX (Immediate — separate from 3 phases)

**Current state:** Caddy can't reload — duplicate `handle { file_server }` block outside `wealth.arif-fazil.com` site block
**Fix:** Remove lines 120-123 from `/etc/arifos/compose/Caddyfile` (the orphan `handle { file_server }` + closing `}`)
**Then:** `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`

This is infrastructure fix — not governed by Amanah (Caddy can't parse the file to lock it yet).
Run after Phase 3 is complete so Sentinel Stream can broadcast the change.

---

## SEAL METADATA

```
verdict: SERI_KEMBANGAN_PHASES_ACTIVE
epoch: 2026-04-26T14:47:00Z
location: Seri Kembangan, Selangor
clerk_id: arifOS_bot
protocol: SERI_KEMBANGAN_ACCORDS_IMPLEMENTATION
```

Ditempa Bukan Diberi. 🧠🔥💎