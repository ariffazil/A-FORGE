# MCP Permission Audit — REVISED (Post-Claude Critique)

> **Auditor:** FORGE (000Ω) under F13 SOVEREIGN directive
> **Revised:** 2026-07-07 after Claude's critique on self-attestation
> **Status:** P0 FINDING — server-side guards are NOT a security boundary

---

## The Core Problem

**Who sets `ack_irreversible=True`?**

The calling agent — OpenCode's own LLM loop — sets it itself, on its own judgment, in the same turn it decides to call the tool.

### Evidence

From `/root/arifOS/arifosmcp/runtime/tools.py` line 6436:

```python
async def _elicit_irreversible_ack(
    ctx: Context | None,
    *,
    tool_name: str,
    mode: str,
    actor_id: str | None,
    session_id: str | None,
    ack_irreversible: bool,
) -> tuple[bool, dict[str, Any] | None]:
    if ack_irreversible or mode not in _IRREVERSIBLE_ELICITATION_MODES:
        return ack_irreversible, None  # ← BYPASSES elicitation

    if ctx is None:
        return False, _hold(...)  # ← HOLD if no context

    # Only reaches elicitation if ack_irreversible=False AND ctx available
    response = await ctx.elicit(...)  # ← MCP elicitation round-trip
```

**The flow:**
1. If `ack_irreversible=True` → **immediate return, NO elicitation, NO human confirmation**
2. If `ack_irreversible=False` AND `ctx` available → **elicitation round-trip to human**
3. If `ack_irreversible=False` AND no `ctx` → **HOLD, requires ack_irreversible=True**

**The calling agent can always set `ack_irreversible=True` to bypass the elicitation gate.**

---

## Why This Is Not a Security Boundary

This is structurally identical to the `actor_verified: true` spoofing finding already sealed. A flag the caller controls isn't a guard against the caller.

| Control | Who Sets It | Human-Verified? | Security Boundary? |
|---------|-------------|-----------------|-------------------|
| `ack_irreversible=True` | Calling agent | No | No |
| `actor_verified=true` | Calling agent | No | No |
| `session_id` | Calling agent | No | No |

All three are self-attested flags. The server checks them, but the caller controls them.

---

## What Actually Works

### Elicitation (MCP Spec 2025-11-25)

The MCP protocol has a real mechanism for this: **elicitation** (`elicitation/create`).

**Key properties:**
- Server sends `elicitation/create` request
- Client presents UI to the human
- Only a human response of `accept`/`decline`/`cancel` comes back
- State must NOT be associated with session IDs alone
- User identification must be derived from verified authorization credentials, not client-provided claims

**arifOS already implements this** in `_elicit_irreversible_ack` — but only when `ack_irreversible=False`. The calling agent can bypass it by setting the flag to True.

### GÖDEL-LOCK (Self-Certification Prevention)

From `/root/arifOS/arifosmcp/tools/vault.py`:

```python
if mode == "seal" and ack_irreversible:
    if actor_session_id == judge_session_id:
        return SealOutput(
            verdict="HOLD",
            status="GODEL_LOCK",
            note="actor cannot certify its own IRREVERSIBLE action",
        )
```

This prevents self-certification (actor == judge), but it's a structural check, not a human-verified checkpoint.

---

## The Honest Fix

### Option 1: Remove `ack_irreversible` from the tool schema

Make elicitation the ONLY path for irreversible actions. The calling agent cannot bypass what it cannot set.

**Pros:** True human-verified checkpoint
**Cons:** Breaks headless/automated workflows (eval, CI/CD)

### Option 2: Elicitation-only for specific tools

Keep `ack_irreversible` for non-seal modes, but require elicitation for seal mode specifically.

**Pros:** Preserves headless workflows for non-irreversible actions
**Cons:** More complex logic

### Option 3: Sovereign-signed `ack_irreversible`

Require `ack_irreversible` to be cryptographically signed by Arif's key, not just a boolean.

**Pros:** Non-repudiation, true human consent
**Cons:** Requires key management infrastructure

### Recommended: Option 2

For `arif_seal` (mode=seal), `geox_claim` (mode=seal), and `forge_execute_sealed`:
- **Remove `ack_irreversible` from the tool input schema**
- **Require elicitation round-trip** for these specific modes
- **Keep `ack_irreversible` for non-seal modes** (dry_run, verify, list, etc.)

This preserves headless workflows for non-irreversible actions while ensuring true human consent for irreversible ones.

---

## Revised Permission Model

### Previous (Incorrect) Conclusion

> "The server-side guards are the actual security boundary. The client-side permission is a UI convenience."

**This is wrong.** The server-side guard (`ack_irreversible=True`) is a self-attested flag, not a security boundary.

### Corrected Conclusion

**Neither client-side nor server-side guards are currently security boundaries.**

| Layer | Current | Security Boundary? |
|-------|---------|-------------------|
| Client-side (`"mcp": "allow"`) | Blanket approve all | No |
| Server-side (`ack_irreversible=True`) | Self-attested by caller | No |
| Elicitation (`ctx.elicit()`) | Only when flag is False | **Yes, but bypassable** |
| GÖDEL-LOCK (actor != judge) | Structural check | Partial (prevents self-certification) |

**The only real security boundary is elicitation + GÖDEL-LOCK together.** But elicitation is bypassable via `ack_irreversible=True`.

---

## Immediate Actions

1. **Flag as P0:** `ack_irreversible=True` is a self-attested flag, not a security boundary
2. **Propose fix:** Remove `ack_irreversible` from seal-mode tool schemas, require elicitation
3. **Update lint script:** Check for self-attested flags, not just tool descriptions
4. **Document in VAULT999:** Seal this finding for permanent record

---

## Long-Term Architecture

For the three-agent architecture (OpenCode, OpenClaw, Hermes):

| Agent | Irreversible Path | Human-Verified? |
|-------|-------------------|-----------------|
| **Hermes** | Elicitation via Telegram UI | Yes |
| **OpenClaw** | Elicitation via API | Depends on client |
| **OpenCode** | `ack_irreversible=True` (self-attested) | **No** |

**The fix:** OpenCode's irreversible path must go through elicitation, not self-attested flags.

---

*Revised: 2026-07-07 by FORGE (000Ω) after Claude's critique*
*DITEMPA BUKAN DIBERI*
