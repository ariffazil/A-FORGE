# Concrete Implementation Spec — Fixing the Trust Loop

> **Plain engineering terms. No framework vocabulary.**
> **Auditable line-by-line. Implementable tomorrow.**
> **FORGE (000Ω) — 2026-07-07**

---

## What's Actually Broken

**The trust loop:**
1. Vault seal fires because `ack_irreversible=True`
2. That flag was set by the tool call itself
3. The tool call was allowed because `"mcp": "allow"`
4. That's fine because "server-side guards handle it"
5. The guard checks `ack_irreversible=True`

**Nobody verified that a human confirmed this.** Every layer points at a different layer as "where the real check happens."

**GÖDEL-LOCK is not enforced.** The comparison is:
```python
judge_session_id = session_id  # tool argument
actor_session_id = actor_id    # tool argument
if actor_session_id == judge_session_id:
    return HOLD
```
Both values are set by the calling agent. The agent can set them to different values to bypass the check.

**Verify mode is truly read-only.** It reads the vault ledger and returns an irreversibility chain. No writes.

---

## Complete List of Self-Settable Consent Flags

### arifOS
| Tool | Flag | Type | Default | Gates |
|------|------|------|---------|-------|
| `arif_init` | `ack_irreversible` | bool | False | Session creation |
| `arif_forge` | `ack_irreversible` | bool | False | Execution |
| `arif_seal` | `ack_irreversible` | bool | False | Vault seal |
| `arif_browser_interact` | `ack_irreversible` | bool | False | Browser interaction |

### GEOX
| Tool | Flag | Type | Default | Gates |
|------|------|------|---------|-------|
| `geox_claim` | `ack_irreversible` | bool | False | Claim seal |
| `geox_prospect` | `ack_irreversible` | bool | False | Prospect seal |

### WEALTH
| Tool | Flag | Type | Default | Gates |
|------|------|------|---------|-------|
| `wealth_vault_write` | `human_confirmed` | bool | False | Vault write |

### A-FORGE
| Tool | Flag | Type | Default | Gates |
|------|------|------|---------|-------|
| `forge_seal` | `human_approval_token` | string | required | Vault seal |
| `forge_execute_sealed` | `vault_seal_id` | string | required | Sealed execution |

**Note:** A-FORGE's `human_approval_token` is a string, not a boolean. It's required, not optional. This is better but still self-attested — the calling agent provides the token.

---

## The Fix

### 1. Remove self-settable consent flags from irreversible tool schemas

**Tools to modify:**
- `arif_seal` (mode=seal): remove `ack_irreversible` parameter
- `geox_claim` (mode=seal): remove `ack_irreversible` parameter
- `geox_prospect` (mode=seal): remove `ack_irreversible` parameter
- `wealth_vault_write`: remove `human_confirmed` parameter

**What replaces it:** Unconditional `ctx.elicit()` call. No bypass branch.

**Code change for arif_seal:**
```python
# BEFORE (current):
async def arif_seal(
    mode: str = "seal",
    ack_irreversible: bool = False,  # ← self-settable
    ...
):
    ack_irreversible, hold = await _elicit_irreversible_ack(
        ctx, tool_name="arif_vault_seal", mode=mode,
        actor_id=actor_id, session_id=session_id,
        ack_irreversible=ack_irreversible,  # ← if True, bypasses elicitation
    )

# AFTER (fixed):
async def arif_seal(
    mode: str = "seal",
    # ack_irreversible removed from schema
    ...
):
    if mode == "seal":
        # Unconditional elicitation — no bypass
        response = await ctx.elicit(
            f"arif_seal is about to write to the immutable ledger.\n"
            f"actor_id={actor_id or 'anonymous'}\n"
            f"session_id={session_id or 'none'}\n"
            f"Confirm only if this should permanently proceed.",
            IrreversibleConfirmation,
        )
        if not isinstance(response, AcceptedElicitation):
            return SealOutput(
                verdict="HOLD",
                status="ELICITATION_REQUIRED",
                note="Human confirmation required for irreversible seal.",
            )
```

### 2. Fix GÖDEL-LOCK to use verified identity, not self-attested arguments

**Current problem:** Both `session_id` and `actor_id` are tool arguments set by the calling agent.

**Fix:** Use the MCP session's authenticated identity, not the tool argument.

```python
# BEFORE (current):
judge_session_id = session_id  # tool argument
actor_session_id = actor_id    # tool argument
if actor_session_id == judge_session_id:
    return HOLD

# AFTER (fixed):
# Get the actual MCP session identity from the transport layer
mcp_session = ctx.session if ctx else None
judge_identity = mcp_session.authenticated_identity if mcp_session else None
actor_identity = actor_id  # still from tool argument, but now compared against verified identity

if judge_identity and actor_identity and judge_identity == actor_identity:
    return HOLD  # same identity is both actor and judge
```

**But:** This requires MCP client authentication (see #3).

### 3. Authenticate MCP client connections

**Current:** Any client can connect to the MCP server. No identity verification.

**Fix:** Require JWT or similar authentication for MCP connections.

```python
# In MCP server setup:
@server.on_connect
async def on_connect(ctx: Context):
    # Verify client identity
    auth_token = ctx.transport.headers.get("Authorization")
    if not auth_token:
        raise McpError("Authentication required")
    
    # Verify JWT signature
    try:
        payload = verify_jwt(auth_token, SECRET_KEY)
        ctx.session.authenticated_identity = payload["sub"]
    except:
        raise McpError("Invalid authentication")
```

**For Telegram (Hermes):** The Telegram message itself is the authentication. Telegram's API verifies the user. When Hermes forwards to OpenClaw/OpenCode, it signs the consent with a key derived from the Telegram message.

### 4. Fail-closed on elicitation timeout

**Current:** No timeout handling for elicitation.

**Fix:** Add explicit timeout with abort.

```python
import asyncio

try:
    response = await asyncio.wait_for(
        ctx.elicit(...),
        timeout=300,  # 5 minutes
    )
except asyncio.TimeoutError:
    return SealOutput(
        verdict="HOLD",
        status="ELICITATION_TIMEOUT",
        note="Human did not respond within 5 minutes. Action blocked.",
    )
```

**Default:** No response = block, not no response = proceed.

### 5. Propagate consent through the hop chain

**Current:** Arif says "yes" to Hermes on Telegram. No proof survives to OpenCode.

**Fix:** Sign a structured consent object that propagates.

```python
# In Hermes (Telegram handler):
consent = {
    "action_hash": sha256(tool_call_json),
    "actor_id": "arif",
    "timestamp": iso_now(),
    "nonce": random_hex(),
}
signed_consent = sign(consent, hermes_private_key)

# Forward signed_consent with the tool call

# In arifOS (vault seal):
def verify_propagated_consent(signed_consent, action_hash):
    # Verify signature
    if not verify_signature(signed_consent, hermes_public_key):
        return False
    
    # Verify action hash matches
    if signed_consent["action_hash"] != action_hash:
        return False
    
    # Verify not expired
    if age(signed_consent["timestamp"]) > MAX_CONSENT_AGE:
        return False
    
    # Verify nonce not replayed
    if signed_consent["nonce"] in used_nonces:
        return False
    used_nonces.add(signed_consent["nonce"])
    
    return True
```

### 6. Deduplicate WEALTH tools

**Current duplicates:**
- `wealth_compute_emv` / `wealth_emv_compute`
- `wealth_compute_evoi` / `wealth_evoi_compute`
- `wealth_agent_path` / `wealth_reason_agent`
- `wealth_monte_carlo` / `wealth_monte_carlo_simulate`
- `wealth_registry_status` / `wealth_system_registry_status`

**Fix:** Pick canonical name, delete alias, update all callers.

```bash
# Example: remove wealth_emv_compute alias
# 1. Find all callers
grep -rn "wealth_emv_compute" /root/WEALTH/ /root/A-FORGE/ /root/arifOS/
# 2. Update to canonical name
sed -i 's/wealth_emv_compute/wealth_compute_emv/g' ...
# 3. Remove alias from tool registry
```

### 7. Verify non-seal modes are truly side-effect-free

**Verified:**
- `arif_seal(mode="verify")`: Read-only. Returns irreversibility chain. No writes.
- `arif_seal(mode="dry_run")`: Writes to drift_log (session-local), but NOT to vault ledger. Acceptable.
- `arif_seal(mode="list")`: Read-only. Returns vault entries.
- `arif_seal(mode="chain")`: Read-only. Returns chain tip.

**Verdict:** Non-seal modes are truly side-effect-free (or session-local only).

---

## Implementation Order

1. **Deduplicate WEALTH tools** — mechanical, low-risk, do first
2. **Remove self-settable consent flags** — replace with unconditional elicitation
3. **Add elicitation timeout** — fail-closed on no response
4. **Fix GÖDEL-LOCK** — use verified identity, not self-attested arguments
5. **Authenticate MCP clients** — JWT or similar
6. **Propagate consent through hop chain** — signed consent objects

---

## Completion Criteria

- [ ] No tool in any organ has a self-settable consent flag gating an irreversible action
- [ ] Every elicitation is bound to a verified human, not a verified session
- [ ] Elicitation timeout = block (fail-closed)
- [ ] GÖDEL-LOCK compares verified identities, not self-attested arguments
- [ ] Consent propagates cryptographically through the hop chain
- [ ] WEALTH has no duplicate tools
- [ ] Non-seal modes verified as side-effect-free

---

*Written: 2026-07-07 by FORGE (000Ω)*
*Plain engineering terms. No framework vocabulary.*
*DITEMPA BUKAN DIBERI*
