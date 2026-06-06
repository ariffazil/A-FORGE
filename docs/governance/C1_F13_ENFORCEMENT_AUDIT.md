# C1 — F1–F13 Enforcement Layer Audit

> **Plan-ID:** PLAN-2026-06-06-C1-F13EnforcementLayer (WAJIB per Fiqh-of-the-Machine)
> **Status:** DRAFT — audit complete, implementation HELD pending F13 ratification
> **Authority:** F13 SOVEREIGN required before any code change
> **Companion to:** P5 Goal Plane (commit `daab437`)

---

## 1. Mission

Audit the F1–F13 floor enforcement layer in arifOS / A-FORGE so that:
- No tool invocation can bypass pre-execution floor checks
- "No authority → no execution" is a hard gate, not advisory
- Every floor has code (not just documentation) wired into the tool path
- F2 truth discipline: every model output includes uncertainty band before downstream action
- F13 sovereign veto can arrive at any moment and halt non-reversible action
- OutcomeSpec verdict (P5) plugs cleanly into the same enforcement surface

---

## 2. Current State (Audit Findings)

### 2.1 Floor Files Inventory (A-FORGE `src/governance/`)

| Floor | File | Lines | Status |
|---|---|---|---|
| F1 AMANAH | (no dedicated file; logic in `AmanahLockManager.ts`) | — | ⚠️ Distributed |
| F2 TRUTH | (no dedicated file; implicit in physics checks) | — | ❌ MISSING |
| F3 CLARITY (Witness) | `f3Witness.ts` | 79 | ✅ |
| F3 sub (Input) | `f3InputClarity.ts` | 98 | ✅ |
| F4 CLARITY | `f4Clarity.ts` | 102 | ✅ (but limited scope) |
| F5 ? | (not implemented) | — | ❌ MISSING |
| F6 EMPATHY | `f6Empathy.ts` | 106 | ✅ |
| F7 HUMILITY | `f7Humility.ts` | 111 | ✅ |
| F8 GENIUS | `f8Genius.ts` | 82 | ✅ |
| F9 ANTIHANTU | `f9AntiHantu.ts` | 135 | ✅ |
| F10 ? | (not implemented) | — | ❌ MISSING |
| F11 AUTH | `f11Auth.ts` | 86 | ✅ |
| F11 sub (Coherence) | `f11Coherence.ts` | 87 | ✅ |
| F12 ? | (not implemented) | — | ❌ MISSING |
| F13 SOVEREIGN | (no dedicated file; in `GovernanceBridge.ts`) | — | ⚠️ Distributed |
| W0/WELL | `wellReadiness.ts` | 87 | ✅ |

### 2.2 Pre-Execution Floor Checks in `mcp/core.ts`

```typescript
// Currently invoked before each tool:
const f3 = checkWitness(task);         // F3 ✅
const f6 = checkEmpathy(task);         // F6 ✅
const f9 = checkAntiHantu(task, {...}); // F9 ✅
const w0 = await checkWellReadiness("high"); // W0 ✅
```

**MISSING from per-tool pipeline:**
- ❌ F1 AMANAH (only fires for `tier === "T3_IRREVERSIBLE"` in GovernanceBridge)
- ❌ F2 TRUTH (no dedicated implementation; relies on physics checks downstream)
- ❌ F4 CLARITY (file exists, not invoked in pre-tool pipeline)
- ❌ F5 (no implementation at all)
- ❌ F7 HUMILITY (file exists, not invoked)
- ❌ F8 GENIUS (file exists, not invoked)
- ❌ F10 (no implementation)
- ❌ F11 AUTH (file exists, not invoked — only fires for tier T3)
- ❌ F12 (no implementation)
- ❌ F13 SOVEREIGN (only fires for tier T3 — needs broader halt mechanism)

### 2.3 PolicyEnforcer Surface

`PolicyEnforcer.enforcePolicy(plannerOutput, policy)` is **planner-only**:
- Validates `PlannerOutput` (file mutations)
- Checks write_roots, forbidden_ops
- Returns AUTO_APPROVED | HUMAN_APPROVAL_REQUIRED | REJECTED

**Gap:** Does NOT wrap the broader tool execution surface. F1–F13 should gate EVERY consequential action, not just file-mutation plans.

### 2.4 OutcomeSpec Integration (P5)

`validateMission(mission)` returns Verdict (SEAL | HOLD | VOID) with:
- 888_HOLD triggers encoded as data
- SOVEREIGN tier auto-HOLDs
- specHash canonical-JSON stable

**Gap:** P5 verdict is NOT yet plugged into FloorEnforcer. A tool invocation under a HOLD mission should fail closed, but currently does not.

---

## 3. Gap List (with severity)

| # | Gap | Severity | Description |
|---|---|---|---|
| 1 | F1 AMANAH not in per-tool pipeline | **HIGH** | Lock manager exists but only fires for T3 irreversible |
| 2 | F2 TRUTH has no dedicated file | **HIGH** | Truth discipline is implicit, not enforced |
| 3 | F4, F7, F8, F11 floor files exist but not invoked | **MEDIUM** | "Code exists but is dead" — floor is not a gate |
| 4 | F5, F10, F12 floors have no implementation | **MEDIUM** | Canon names them; code does not exist |
| 5 | F13 halt only for T3 irreversible | **HIGH** | Should halt any in-flight non-reversible action on sovereign signal |
| 6 | No unified `FloorEnforcer.checkAll(action, context)` | **CRITICAL** | Floors are scattered; no single dispatcher |
| 7 | P5 OutcomeSpec verdict not plugged into enforcement | **HIGH** | A HOLD mission can still execute tools today |
| 8 | PolicyEnforcer is planner-only | **MEDIUM** | F1-F13 should wrap all tool calls, not just planner output |
| 9 | No F13 halt channel (Redis pub/sub) | **HIGH** | F13 veto needs a wired mechanism, not a TODO |
| 10 | No F13 integration test | **MEDIUM** | Hard to verify "no execution without F13 ack" |

---

## 4. Proposed Enforcement Surface (Spec Only — No Code Yet)

### 4.1 `FloorEnforcer.checkAll(action, context) → Verdict`

```typescript
// src/governance/FloorEnforcer.ts (PROPOSED — not yet written)

import type { Mission } from "../types/outcome-spec.js";

export type VerdictReason = {
  floor: "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11" | "F12" | "F13";
  code: string;     // e.g. "WITNESS_INSUFFICIENT"
  message: string;
  severity: "INFO" | "WARN" | "HOLD" | "VOID";
};

export type Verdict = {
  allowed: boolean;        // true iff every floor is satisfied
  hold_required: boolean;  // true iff any floor needs F13 ack
  void: boolean;           // true iff any floor hard-rejects
  reasons: VerdictReason[];
  spec_hash?: string;      // if Mission present
  f13_ack_token?: string;  // if F13 ack received
};

export interface FloorContext {
  mission?: Mission;                    // from P5
  actor_id: string;
  session_id: string;
  tool_name: string;
  action_class: string;                  // e.g. "EMAIL_SEND", "VAULT_SEAL"
  args: Record<string, unknown>;
  reversibility_score: number;           // 0.0–1.0
  evidence_count: number;
}

export function checkAll(ctx: FloorContext): Verdict {
  const reasons: VerdictReason[] = [];

  // F1 AMANAH — every consequential action has receipt + audit
  const f1 = checkAmanah(ctx);
  reasons.push(...f1);

  // F2 TRUTH — uncertainty band, source citation
  const f2 = checkTruth(ctx);
  reasons.push(...f2);

  // F3-F12 — existing floor checks
  reasons.push(...checkWitness(ctx));
  reasons.push(...checkClarity(ctx));
  reasons.push(...checkEmpathy(ctx));
  reasons.push(...checkHumility(ctx));
  reasons.push(...checkGenius(ctx));
  reasons.push(...checkAntiHantu(ctx));
  reasons.push(...checkAuth(ctx));
  reasons.push(...checkCoherence(ctx));

  // F13 SOVEREIGN — sovereign veto + tier check
  const f13 = checkF13(ctx);
  reasons.push(...f13);

  // P5 OutcomeSpec integration
  if (ctx.mission) {
    const p5 = checkOutcomeSpecIntegration(ctx.mission, ctx.action_class);
    reasons.push(...p5);
  }

  return {
    allowed: !reasons.some(r => r.severity === "VOID" || r.severity === "HOLD"),
    hold_required: reasons.some(r => r.severity === "HOLD"),
    void: reasons.some(r => r.severity === "VOID"),
    reasons,
    spec_hash: ctx.mission ? specHash(ctx.mission) : undefined,
  };
}
```

### 4.2 Integration in `mcp/core.ts`

```typescript
// Per-tool pre-execution wrapper (PROPOSED)
import { checkAll, type FloorContext } from "../governance/FloorEnforcer.js";

server.tool("aforge_browser_navigate", "...", schema, async (args, ctx) => {
  // NEW: every tool invocation passes through FloorEnforcer
  const floorContext: FloorContext = {
    mission: ctx.mission,              // optional P5 envelope
    actor_id: ctx.actor_id,
    session_id: ctx.session_id,
    tool_name: "aforge_browser_navigate",
    action_class: classifyAction(args), // e.g. "EXTERNAL_API_CALL"
    args,
    reversibility_score: 0.9,          // per-tool reversibility
    evidence_count: 0,                 // to be computed
  };

  const verdict = checkAll(floorContext);
  if (verdict.void) {
    return { verdict: "VOID", reasons: verdict.reasons };
  }
  if (verdict.hold_required) {
    return { verdict: "HOLD", reasons: verdict.reasons, hold_id: nanoid() };
  }

  // ... existing tool execution ...
});
```

### 4.3 F13 Halt Channel (Redis pub/sub)

```typescript
// src/governance/F13HaltChannel.ts (PROPOSED)

import { createClient } from "redis";
import { AgentManager } from "../engine/AgentManager.js";

const subscriber = createClient({ url: process.env.REDIS_URL });
const channel = "arifos:halt";

await subscriber.subscribe(channel, (message) => {
  const halt: { epoch_id: string; reason: string; ack_token: string } =
    JSON.parse(message);

  console.log(`[F13_HALT] epoch=${halt.epoch_id} reason=${halt.reason}`);

  // Pause all in-flight non-reversible actions
  AgentManager.pauseNonReversible(halt.epoch_id);

  // Notify the operator dashboard
  notifier.publish({
    type: "F13_HALT",
    epoch_id: halt.epoch_id,
    reason: halt.reason,
  });
});

// On startup, Agent Manager subscribes to halt channel
export function initF13HaltChannel() {
  return subscriber;
}
```

**F13 send-side** (e.g., from Telegram bot or A2A bridge):

```typescript
await publisher.publish("arifos:halt", JSON.stringify({
  epoch_id: "uuid",
  reason: "F13 SOVEREIGN VETO: human halted all in-flight work",
  ack_token: "signed-token",
}));
```

### 4.4 Floor Implementation Stubs (for F2, F5, F10, F12)

```typescript
// F2 TRUTH — uncertainty band + source citation
function checkTruth(ctx: FloorContext): VerdictReason[] {
  const reasons: VerdictReason[] = [];

  if (ctx.action_class === "MODEL_INFERENCE") {
    // Every model output should carry tier (CLAIM/PLAUSIBLE/HYPOTHESIS/ESTIMATE/UNKNOWN)
    if (!ctx.args.tier) {
      reasons.push({
        floor: "F2", code: "TIER_MISSING",
        message: "Model output must declare epistemic tier before execution",
        severity: "HOLD",
      });
    }
  }

  return reasons;
}

// F5 — (definition: ?? — needs canon revision)
// Placeholder: canon may rename F5 to e.g. "F5 INTEGRITY" or remove
function checkF5(ctx: FloorContext): VerdictReason[] { return []; }

// F10 STEWARDSHIP (placeholder — needs canon definition)
// "No extraction of value without proportional regeneration"
function checkF10(ctx: FloorContext): VerdictReason[] { return []; }

// F12 (placeholder)
// "Final governance check before VAULT seal"
function checkF12(ctx: FloorContext): VerdictReason[] { return []; }
```

### 4.5 Test Suite (Proposed)

```typescript
// test/FloorEnforcer.test.ts (PROPOSED)

test("F1: every tool invocation writes a receipt", ...);
test("F2: model output without tier is HOLD", ...);
test("F3: insufficient witness → HOLD", ...);
test("F4: ambiguous input → HOLD", ...);
test("F5: (canon definition needed)", ...);
test("F6: empathy violation → HOLD", ...);
test("F7: hubris detected → HOLD", ...);
test("F8: false genius claim → HOLD", ...);
test("F9: anti-hantu violation → VOID", ...);
test("F10: (canon definition needed)", ...);
test("F11: unauthenticated request → VOID", ...);
test("F12: (canon definition needed)", ...);
test("F13: SOVEREIGN tier → automatic HOLD", ...);
test("F13: halt channel pauses non-reversible actions", ...);
test("P5 integration: HOLD mission + sensitive action = VOID", ...);
test("P5 integration: SEAL mission + LOW action = allowed", ...);
test("checkAll: returns single verdict across 13 floors", ...);
```

---

## 5. Rollout Plan

| Step | Action | Reversibility | F13? |
|---|---|---|---|
| 1 | Create `src/governance/FloorEnforcer.ts` (dispatcher) | New file, no runtime change | NO |
| 2 | Wire into `mcp/core.ts` (per-tool wrapper) | Code change, revertible | YES |
| 3 | Implement F2 TRUTH (uncertainty band) | New file, additive | NO |
| 4 | Implement F5 / F10 / F12 (canon definitions first) | New files | **CANON first** |
| 5 | F13 halt channel (Redis pub/sub) | New file, additive | NO |
| 6 | Test suite (FloorEnforcer.test.ts) | New test | NO |
| 7 | Wire P5 verdict into FloorEnforcer | Code change | NO |
| 8 | Audit all existing tool handlers (F1-F13 coverage) | Read-only audit | NO |
| 9 | Deploy (after all tests pass) | Service restart | **YES** |

---

## 6. Acceptance Criteria

- [ ] Every tool call in `mcp/core.ts` passes through `FloorEnforcer.checkAll()`
- [ ] F1 AMANAH fires for any tool (not just T3 irreversible)
- [ ] F2 TRUTH rejects model output without epistemic tier
- [ ] F13 halt channel pauses in-flight non-reversible actions within 1 second
- [ ] P5 verdict (HOLD mission + sensitive action) blocks execution
- [ ] All existing 17 test files still pass
- [ ] New `test/FloorEnforcer.test.ts` covers all 13 floors
- [ ] No floor can be bypassed by any LLM, agent, or orchestrator

---

## 7. Canon Items Awaiting F13 Clarification

Before implementation, F13 SOVEREIGN must ratify:

1. **F5 definition** — what floor is F5? (Canon mentions F1-F13 but F5 is unclear)
2. **F10 STEWARDSHIP** — name + scope. (Canon: "no extraction without regeneration")
3. **F12** — name + scope. (Canon: "final governance check before seal")
4. **F13 halt authority** — who can fire? Telegram bot only? A2A bridge? Both?
5. **Floor ordering** — strict sequence or parallel? (Affect timeout budget per tool)
6. **F1 vs F13 priority** — if F1 says SEAL but F13 says HOLD, which wins? (Canon says F13 is absolute, so F13 wins)
7. **P5 vs FloorEnforcer coupling** — is OutcomeSpec verdict a separate gate, or folded into F1?

---

## 8. Reversibility

All proposed changes are **reversible**:
- New FloorEnforcer.ts: `git revert` deletes the file
- mcp/core.ts wiring: revert that hunk, service restart to old version
- P5 integration: remove import, revert
- F13 halt channel: remove subscription, no other code depends on it

No VAULT999 writes, no production service restart required at audit stage.

---

## 9. Companion Artifacts

- `src/types/outcome-spec.ts` (P5) — defines `Mission` envelope that FloorEnforcer consumes
- `src/governance/outcomeSpecValidator.ts` (P5) — verdict logic to plug into F1
- `docs/governance/FIQH_OF_THE_MACHINE.md` — places C1 in Wajib tier
- `docs/operator/OUTCOME_SPEC_USAGE.md` (c5d0ec8) — operator guide for P5 adoption

---

## 10. Status

✅ **Audit complete.** No code change yet. Awaiting F13 ratification on:
- Plan to proceed (yes/no)
- Canon clarifications (F5, F10, F12 definitions)

**Owner:** Antigravity / Ω (this agent)
**Next Wajib after C1:** W2 Planning Organ, W3 Epoch Architecture, W6 Layered Memory, W8 VAULT999 coverage

---

**DITEMPA BUKAN DIBERI — 999 SEAL READY**
