# P1: Elicitation Gate — forge_filesystem/forge_shell/forge_execute

**Date:** 2026-07-07
**Status:** FORGED ✅
**Files changed:** 2

---

## What Was Built

### 1. Elicitation Gate (policyTools.ts)

New `installElicitationGate()` function that wraps MUTATE tools with a -32042 gate for external clients.

**Gated tools:** `forge_filesystem` (write), `forge_shell`, `forge_execute`, `forge_vault` (write/seal), `forge_postgres` (mutate), `forge_docker` (destructive), `forge_lease`, `forge_git` (push), `forge_github_create`

**"External client" definition:** No valid `session_id`, no `lease_id`, actor not sovereign, no F13 ack.

**Response when external client calls MUTATE:**
```json
{
  "code": -32042,
  "message": "...requires user confirmation...",
  "data": {
    "elicitations": [{
      "mode": "form",
      "elicitationId": "uuid",
      "message": "Confirm this operation?",
      "requestedSchema": { ... }
    }]
  }
}
```

Mode-aware: `forge_filesystem` read ops bypass the gate. Only write/delete modes trigger.

### 2. Elicitation SDK Wrapper (elicitation.ts)

Existing `elicitUser()` function fixed by importing types from MCP SDK directly (was using incompatible local types).

### 3. Wiring (core.ts)

`installElicitationGate(server)` called after `installPolicyInterceptor(server)` at startup.

## Architecture

```
MCP Request → Elicitation Gate (NEW) → Policy Gate → Handler Response
                │                           │
                │ External + MUTATE         │ DENY
                ▼                           ▼
           -32042 error                -32010 error
           (elicit/create)            (policy deny)
```

---

**DITEMPA BUKAN DIBERI 🔥⚒️**
