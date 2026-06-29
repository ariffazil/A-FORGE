# WELL→FORGE BRIDGE AUDIT — Diagnostic Report

**Date:** 2026-06-29
**Analyst:** FORGE (000Ω)
**Verdict:** CHAOS — bridge defined but NOT WIRED into execution gate

---

## Signal Path: What SHOULD Happen

```
forge_execute (high-impact)
  → checkWellReadiness(riskLevel)
    → WELL/state.json OR well_assess_homeostasis (WELL MCP :18083)
      → verdict: PASS | SABAR | HOLD
        → modulate execution intensity or block
```

## Signal Path: What ACTUALLY Happens

```
forge_execute (high-impact)
  → ActGateClient.actCheck()     ← checks dry-run, canary, human ack
  → AgentEngine F1 gate         ← checks ackIrreversible flag
  → ModelCapabilityGate          ← checks model authority
  → PlanGovernanceGate           ← checks plan DAG
  → [NOTHING calls checkWellReadiness()]
  → EXECUTE
```

**WELL is never consulted before execution.**

---

## GAP 1 — checkWellReadiness: Defined but Orphaned

**File:** `/root/A-FORGE/src/domain/governance/wellReadiness.ts`
**Status:** EXPORTED but UNUSED anywhere in execution path

```typescript
// Defined at line 25 — exported at governance/index.ts:42
export async function checkWellReadiness(riskLevel): Promise<WellReadinessResult>

// NEVER imported in:
//   - ActGateClient.ts
//   - AgentEngine.ts
//   - forge_execute handler (core.ts ~line 644)
//   - any engine or execution file
```

**Evidence:** `grep -r "checkWellReadiness" /root/A-FORGE/src/` returns only 5 matches — all inside `wellReadiness.ts` itself and the orphaned export in `index.ts`. Zero callers.

---

## GAP 2 — wellReadiness.ts reads stale local file, not live WELL organ

**File:** `wellReadiness.ts:26`
```typescript
const statePath = resolve(process.cwd(), "WELL", "state.json");
```

- Reads `WELL/state.json` from filesystem
- Does NOT call WELL MCP organ (port 18083)
- Current state.json age: **1456.7 hours** (60+ days stale — from 2026-04-30)
- On failure to read: defaults to `verdict: "PASS"` — **fails open**

```
WELL live status: degraded
  well_signal: "WELL_HOLD"
  well_score: null
  truth_status: "INSUFFICIENT_DATA"
  freshness: EXPIRED (5244239 seconds old)
  owner_summary: RED — "sovereign_state_unknown, biometric_state_expired_168h_ceiling"
```

The live WELL is screaming HOLD but `checkWellReadiness` would return PASS if the file existed because it defaults to PASS on any error.

---

## GAP 3 — forge_well tool EXISTS but is manual, not pre-flight

**File:** `core.ts:995-1048`

`forge_well` properly routes to WELL MCP (:18083):
```typescript
const laneUrl = process.env.WELL_TRUTH_LANE_URL || "http://localhost:18083";
const client = new StreamableHTTPClientTransport(...);
const upstreamResult = await client.callTool({ name: "well_assess_homeostasis", ... });
```

BUT:
- It's a **manual tool** — agents must explicitly call it
- It's **NOT wired** into the execution gate
- An agent could run `forge_execute` on a critical task without ever calling `forge_well` first
- No `riskLevel` parameter maps to WELL verdicts

---

## GAP 4 — forge_execute handler (core.ts ~644) has no WELL call

The `forgeHandler` for `forge_execute` calls:
1. `telemetryInvoke("forge_execute")`
2. Judge verdict check (SEAL verification)
3. Landauer cost estimation
4. `telemetrySuccess` or `telemetryFailure`

**No WELL consult. No homeostasis check. No operator readiness gate.**

---

## Summary Table

| Component | Expected | Actual | Status |
|-----------|----------|--------|--------|
| `wellReadiness.ts` | Auto-called on high-impact exec | Never called | 🔴 ORPHANED |
| `WELL/state.json` read | Fresh biometric signal | 60+ day stale file | 🔴 STALE |
| `forge_well` tool | Pre-flight readiness gate | Manual standalone tool | 🟡 UNWIRED |
| `forge_execute` | WELL veto before exec | No WELL consult | 🔴 GAP |
| WELL live organ | Source of truth for readiness | Alive but degraded + expired | 🟡 DEGRADED |

---

## Root Cause

The bridge is **defined in doctrine** (WELL constitution, A-FORGE blue map) but **not implemented in code**. `checkWellReadiness` was written as a skeleton but never hooked into:
- `ActGateClient.actCheck()` — the pre-execution gate
- `AgentEngine.execute()` — the main execution path
- `forge_execute` handler — the MCP entry point

---

## What Needs to Be Built

1. **Wire `checkWellReadiness` into `ActGateClient.actCheck()`** — call it before returning `PROCEED` for `EXECUTE_HIGH_IMPACT` / `IRREVERSIBLE` actions
2. **Replace file read with live WELL MCP call** — `wellReadiness.ts` should call `well_assess_homeostasis` via HTTP, not read a stale JSON file
3. **Map WELL verdicts to execution modulation:**
   - `HOLD` → block `forge_execute` for critical risk
   - `SABAR` → require human acknowledgment for high risk
   - `PASS` → proceed normally
4. **Fix `WELL/state.json` freshness** — or remove the file-based fallback entirely; a stale file that fails open is worse than no signal

---

## Epistemic Status

- OBS: `grep`, `read`, `curl` on live system
- DER: Gap analysis from code path tracing
- SPEC: Recommended fix direction (wiring sketch)

---

*DITEMPA BUKAN DIBERI — CHAOS IDENTIFIED, SEAL TO FOLLOW*
