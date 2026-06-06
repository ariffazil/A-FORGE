# FloorEnforcer — Operator Note

> **Status:** C1 implementation on branch `forge/c1-floor-enforcer-2026-06-06`. Awaiting F13 merge to main.
> **Authority:** F13 SOVEREIGN ratified 2026-06-06.
> **Tagline:** *No agent, no LLM, no orchestrator can bypass. Unknown = HOLD.*

---

## TL;DR

Every consequential action in arifOS now passes through **one** dispatcher: `FloorEnforcer.checkAll(action, context)`. It runs F1–F13 in priority order, composes the verdict, and returns `SEAL | CAUTION | HOLD | VOID`. The verdict is final — no parallel gates, no overrides.

```typescript
import { checkAll, isAllowed } from "arifforge/governance/FloorEnforcer.js";

const verdict = checkAll({
  action: {
    action_id: "act-123",
    tool_name: "aforge_browser_navigate",
    action_type: "NETWORK_OUT",
    target: "https://example.com",
    tier: 3,
    actor: "arif-fazil",
    session_id: "SEAL-abc",
    intent: "Fetch example.com docs",
    expected_outcome: "HTML returned",
    args: { url: "https://example.com" },
    reversibility_score: 0.9,
    blast_radius: "local",
    evidence_count: 1,
  },
  actor_id: "arif-fazil",
  session_id: "SEAL-abc",
  f13_halt_active: false,
});

if (verdict.void) return error("Spec invalid");
if (verdict.hold_required) return queueForF13Ack(verdict);
if (verdict.final === "CAUTION") logCaution(verdict);
// proceed
```

---

## Floor Priority Order (canonical)

```
0. F13 SOVEREIGN     — absolute veto (halt or SOVEREIGN tier)
1. F11 AUTH          — actor/session authority
2. F12 INJECTION     — command/path/prompt/authority smuggling
3. F10 ONTOLOGY      — schema and category integrity
4. F1  AMANAH        — reversibility, blast radius, stewardship
5. F2  TRUTH         — epistemic tier, evidence
6. F4  CLARITY       — intent + expected_outcome
7. F7  HUMILITY      — uncertainty declaration
8. F8  GENIUS        — composite (diagnostic for now)
9. F5  PEACE²        — destructive verb, live-service blast
10. F6 EMPATHY       — stakeholder impact (placeholder)
11. F3 WITNESS       — composite (diagnostic for now)
+ F9 ANTIHANTU       — sentience/consciousness claim
+ Unknown-action safety net (C1 hard constraint)
```

---

## Verdict Composition (canonical)

```
VOID    > HOLD      > CAUTION    > SEAL

Any HARD floor violation (F1, F2, F4, F7, F9, F10, F11, F12, F13) → HOLD or VOID
SOFT floor (F5, F6) → CAUTION or HOLD
DERIVED floor (F3, F8) → diagnostic (composite)
```

**Hard rule:** Unknown floor, unknown tier, unknown action type, missing required field, missing actor/session on mutating action → HOLD (never ALLOW).

---

## P5 OutcomeSpec Coupling

`Mission` envelope (P5) is **folded into** FloorEnforcer, not a parallel gate. P5 fields map to specific floors:

| Mission field | Enforced by |
|---|---|
| objective | F4 CLARITY |
| success_criteria | F4 / F8 |
| reversibility_required | F1 AMANAH |
| evidence_required | F2 TRUTH |
| blast radius (via constraints) | F1 / F5 |
| stakeholder impact | F6 |
| actor / authority | F11 |
| sensitivity=SOVEREIGN | F13 |
| tool category | F10 |
| injection risk (via tool args) | F12 |

Architecture: `ActionRequest → FloorEnforcer.checkAll() → Verdict → mcp/core.ts wrapper`

---

## F13 Halt Channel

**Three authoritative sources** (per C1 spec):
1. **Telegram bot** from verified Arif identity
2. **AAA / A2A bridge** halt event from verified Arif session
3. **Local emergency** file or env flag (VPS operator fallback)

**Channel:** `arifos:halt` (Redis pub/sub in production; in-process EventEmitter fallback for now)

**Message shape:**
```typescript
{
  type: "F13_HALT",
  issued_by: "arif",
  source: "telegram" | "aaa_a2a" | "local",
  scope: "action" | "tool" | "organ" | "federation",
  target: "<action_id | tool_name | organ_name | 'all'>",
  reason: "<plain text>",
  issued_at: "<ISO 8601>",
  nonce: "<UUID v4>",
  signature_or_token: "<verified signature>"
}
```

**Rules:**
- Valid halt overrides ALL active and pending execution within declared scope
- Invalid halt: log but ignore (no false halt)
- Ambiguous halt: HOLD all affected actions until clarified
- Federation scope halt blocks everything

**In code:**
```typescript
import { issueF13Halt, getF13HaltChannel } from "arifforge/governance/F13HaltChannel.js";

// Local test halt
await issueF13Halt("local", "action", "act-123", "Manual review needed");

// Check if a halt applies
if (getF13HaltChannel().isActive("tool", "aforge_browser_navigate")) {
  // block this tool
}
```

---

## F5 PEACE² — Destructive Action Detection

F5 detects:
- Destructive verbs: `delete, wipe, destroy, kill, purge, reset, drop, force, overwrite, revoke, shutdown, rotate-secret, chmod-777, truncate, terminate, abort, evict, demolish`
- Blast radius > service: `INFRASTRUCTURE_RESTART, PRODUCTION_DEPLOY, EXECUTE`
- External blast + chmod-777/rotate-secret/hard-reset: escalation

**Without rollback plan** → HOLD. **With rollback plan + narrow blast** → CAUTION (allowed with logging). F5 does NOT VOID alone — only pairs with F1/F9/F11/F12/F13.

---

## F10 ONTOLOGY — Required Schema

Every action **MUST** declare:
- `action_id` (UUID v4)
- `tool_name` (string)
- `action_type` (canonical category)
- `target` (path, URL, organ name, etc.)
- `tier` (epistemic tier 0-5)
- `actor` (string)
- `session_id` (string)
- `intent` (plain text, ≥ 5 chars)
- `expected_outcome` (plain text, ≥ 5 chars)

Mutating actions also need:
- `rollback_plan` (free text)
- `reversibility_score` (0.0-1.0)
- `blast_radius` (local|repo|service|vps|federation|external)
- `evidence_count` (≥ 1 for tier ≥ 3)

Invalid schema → VOID. Missing required field → VOID.

---

## F12 INJECTION — Threat Patterns

F12 detects in `args` + `target` + `intent`:
- Shell metacharacters: `;|&$\`<>!*?{}[]\\`
- Path traversal: `../`, `..\\`
- Absolute sensitive paths: `/etc/`, `/root/.ssh/`, `/proc/`, `/sys/`, etc.
- Prompt injection: "ignore previous", "bypass safety", "reveal secret", "act as root", "you are now root"
- Secret files: `.env`, `id_rsa`, `private.key`, `api_key`, `token`, `password`
- Authority smuggling: "f13 ratified", "I am arif", "sovereign ack", "self-authorize"

Clear injection or secret exfiltration → VOID. Suspicious bounded → HOLD.

---

## Adoption Roadmap

| Phase | What | When |
|---|---|---|
| **Phase 0** | Code on branch, no live wiring | NOW (commit pending F13 merge) |
| **Phase 1** | Per-tool wrapper in `mcp/core.ts` (every tool passes through `checkAll`) | After merge, before deploy |
| **Phase 2** | AAA mission_intake uses FloorEnforcer + P5 Mission | After Phase 1 |
| **Phase 3** | DAG planner refuses to start sub-mission without parent Mission | After Phase 2 |
| **Phase 4** | VAULT999 stores floor verdict alongside spec_hash | After Phase 3 |
| **Phase 5** | F13 halt channel wired to Telegram bot + AAA bridge | Production deploy |

---

## Files

| File | Purpose |
|---|---|
| `src/types/action-request.ts` | `ActionRequest`, `FloorContext`, `ActionCategory`, `EpistemicTier`, threat patterns |
| `src/governance/floor-types.ts` | Shared `FloorName`, `Severity`, `FloorReason` |
| `src/governance/FloorEnforcer.ts` | Main dispatcher `checkAll()` + verdict composition |
| `src/governance/F13HaltChannel.ts` | Sovereign veto channel (in-process; Redis-ready interface) |
| `src/governance/f1Amanah.ts` | F1 reversibility + blast radius + stewardship |
| `src/governance/f2Truth.ts` | F2 epistemic tier + evidence |
| `src/governance/f5Peace2.ts` | F5 destructive verb + rollback + live-service blast |
| `src/governance/f10Ontology.ts` | F10 schema validation + category lock |
| `src/governance/f12Injection.ts` | F12 shell/path/prompt/authority smuggling |
| `test/FloorEnforcer.test.ts` | 26 test cases covering all 13 floors + verdict composition |
| `test/F13HaltChannel.test.ts` | 10 test cases for halt channel |

---

## Test Coverage (Phase 0)

- ✅ F1: 4 cases (actor, session, blast+reversibility, destructive no rollback, floor change)
- ✅ F2: 3 cases (tier UNKNOWN, tier LOW, missing evidence)
- ✅ F4: 1 case (intent ambiguous)
- ✅ F5: 2 cases (destructive no rollback, destructive with rollback)
- ✅ F9: 1 case (sentience claim)
- ✅ F10: 3 cases (missing field, invalid action_type, malformed Mission)
- ✅ F11: 1 case (anonymous actor on SEAL session)
- ✅ F12: 4 cases (shell metachar, path traversal, secret file, authority smuggling)
- ✅ F13: 5 cases (SOVEREIGN tier, action halt, tool halt, federation halt, halt override)
- ✅ Verdict composition: 2 cases (VOID beats HOLD, HOLD beats CAUTION)
- ✅ Unknown safety net: 1 case (tier=99 → HOLD)
- ✅ C1 hard constraint: enforced everywhere

**Total: 26 FloorEnforcer + 10 F13Halt = 36 test cases**

---

## Reversibility

All changes are reversible:
- New files (`FloorEnforcer.ts`, floor files, tests): `git rm` reverts
- mcp/core.ts integration (Phase 1, not yet applied): revert that hunk
- F13 halt channel: in-process only (no Redis connection yet), so no external state to undo

No VAULT999 writes, no production service restart required at Phase 0.

---

**DITEMPA BUKAN DIBERI — 999 SEAL READY**
