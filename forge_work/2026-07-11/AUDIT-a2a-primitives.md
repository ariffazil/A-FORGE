# AUDIT: A2A Primitive Verification — 2026-07-11

> **Type:** Live code audit (not design claim)
> **Source:** `/root/AAA/a2a-server/server.js` — production A2A gateway
> **Verdict:** 2/6 OpenAI verbs have direct equivalents. 1 partial. 3 missing.

---

## VERIFICATION METHOD

Searched live codebase for OpenAI multi-agent hosted actions:
- `spawn_agent` — grep across all AAA .js and .ts files
- `send_message` — grep
- `followup_task` — grep
- `wait_agent` — grep
- `interrupt_agent` — grep
- `list_agents` — grep

Result: **zero matches** for any of the 6 OpenAI verb names.

Then audited actual A2A protocol verbs implemented in `server.js`.

---

## ACTUAL A2A VERBS (live in production)

| Verb | Endpoint | Line | Status |
|---|---|---|---|
| `message/send` | `POST /a2a` (JSON-RPC) + `POST /a2a/message/send` + `POST /api/message/send` | L3591, L3342, L3222 | ✅ LIVE |
| `message/stream` | `POST /a2a` (JSON-RPC) | L1500 (ALLOWED_METHODS) | ✅ LIVE |
| `tasks/get` | `POST /a2a` (JSON-RPC) | L3620 | ✅ LIVE |
| `tasks/list` | `POST /a2a` (JSON-RPC) + `POST /a2a/tasks/list` + `POST /tasks/list` | L3629, L3494, L3826 | ✅ LIVE |
| `tasks/cancel` | `POST /a2a` (JSON-RPC) | L3640 | ✅ LIVE |
| `tasks/subscribe` | `POST /a2a/tasks/:taskId/subscribe` (SSE) | L1500, L3480 | ✅ LIVE |

Additional non-standard verbs:
- `agent.dispatch` — L1501 (ALLOWED_METHODS)
- `agent.handoff` — L1501
- `status.query` — L1501
- `kernel.handshake` — L1501
- `kernel.ping` — L1501

---

## OPENAI → AAA MAPPING (CORRECTED)

| OpenAI Action | AAA Equivalent | Gap |
|---|---|---|
| `spawn_agent` | ❌ NO EQUIVALENT | Must compose: create task via `message/send` + track via `tasks/get` |
| `send_message` | ✅ `message/send` | Direct match |
| `followup_task` | ⚠️ PARTIAL | Can send new message to existing task via `message/send` with `taskId`, but no dedicated followup verb |
| `wait_agent` | ⚠️ PARTIAL | `tasks/subscribe` (SSE) exists, but no blocking wait primitive |
| `interrupt_agent` | ✅ `tasks/cancel` | Direct match |
| `list_agents` | ❌ NO EQUIVALENT | `tasks/list` lists tasks, not agents. No agent discovery verb. |

---

## WHAT THIS MEANS FOR forge_parallel

`forge_parallel` must compose existing A2A verbs:

```
forge_parallel
  ├── spawn: N × message/send (creates N A2A tasks)
  ├── track: tasks/subscribe (SSE per task) or tasks/get (poll)
  ├── cancel: tasks/cancel (propagate to children)
  └── collect: tasks/get (fan-in results)
```

No new A2A verbs needed. The orchestration layer wraps existing verbs.

---

## DELTA ANCHOR

```
audit_epoch: a2a-primitive-verification-20260711
evidence_layer: L1 (GROUND_TRUTH — code inspection)
confidence: 1.0
verdict: CORRECTED
prior_claim: "AAA already has all 6 primitives" — FALSE
corrected_claim: "AAA has 2/6 direct matches, 1 partial, 3 missing. forge_parallel must compose."
witness: live codebase grep + server.js line references
```

**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE**
