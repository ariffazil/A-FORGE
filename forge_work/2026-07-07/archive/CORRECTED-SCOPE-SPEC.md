# Corrected Scope — Gate Only External-Binding Actions

> **Filter:** Does this leave your systems and bind an external counterparty who can't be undone by you alone?
> **FORGE (000Ω) — 2026-07-07**

---

## The Correct Filter

**Gate needed:** Action reaches a real person or real money outside Arif's own systems.

**No gate needed:** Action only affects Arif's own dev environment, ledger, or infrastructure.

---

## Tool Classification

### No Gate — Fire Freely

| Tool | Why No Gate |
|------|-------------|
| `arif_seal` | Own ledger. Bad entry sits there, doesn't ship, doesn't cost anything but disk. |
| `arif_forge` (execution) | Internal engineer/write/commit — own dev environment. |
| `arif_browser_interact` (read/scrape/navigate) | Read-only browser actions. No external binding. |
| `geox_claim` | Internal geological claim, own system. |
| `geox_prospect` | Internal screening/computation. |
| `wealth_vault_write` | Own portfolio ledger, not a live trade. |
| `wealth_stock_analysis` | Analysis only, not trade execution. No broker integration. |
| All git operations | Own code. |
| All server admin | Own infrastructure. |
| All memory writes | Own systems. |
| All MCP tool calls (read-only) | Observation, no mutation. |

### Gate Needed — External Counterparty

| Tool | Why Gate | Gate Mechanism |
|------|----------|----------------|
| **Telegram send** (Hermes/arifOS) | Reaches real people. Can't unsend. | Elicitation before send |
| **Browser submit/purchase** | Posts or purchases externally. Can't undo. | Elicitation before submit |
| **Trade execution** (if wired to real broker) | Real money. Can't un-trade. | Elicitation before order |
| **Email send** (if implemented) | Reaches real people. Can't unsend. | Elicitation before send |
| **Fund transfer** (if implemented) | Real money. Can't un-transfer. | Elicitation before transfer |

### Conditional — Depends on Sub-Action

| Tool | Read-Only (No Gate) | External-Binding (Gate) |
|------|---------------------|------------------------|
| `arif_browser_interact` | navigate, scrape, screenshot | submit, purchase, post |
| `wealth_stock_analysis` | analysis, math verification | actual order execution (not currently wired) |

---

## Current State

### What Actually Exists Today

| Category | Tool | External Binding? | Current Gate |
|----------|------|-------------------|--------------|
| Telegram send | `f11_bridge.py` sendMessage | **Yes** — reaches real people | None |
| Telegram send | Hermes artifact-courier | **Yes** — sends files to Arif | None |
| Browser | `arif_browser_interact` | **Conditional** — submit yes, navigate no | `ack_irreversible` (self-settable) |
| Trade | `wealth_stock_analysis` | **No** — analysis only, no broker | N/A |
| Vault seal | `arif_seal` | **No** — own ledger | `ack_irreversible` (self-settable) |
| Claim seal | `geox_claim` | **No** — own system | `ack_irreversible` (self-settable) |

### What Needs Fixing

1. **Telegram send** — currently has NO gate. Needs one.
2. **Browser submit** — currently has self-settable `ack_irreversible`. Needs real elicitation.
3. **Vault seal, claim seal** — currently have self-settable `ack_irreversible`. Remove the flag entirely — no gate needed.

---

## The Actual Fix

### 1. Remove `ack_irreversible` from internal-only tools

**Tools to modify:**
- `arif_seal`: remove `ack_irreversible` parameter entirely
- `geox_claim` (seal mode): remove `ack_irreversible` parameter entirely
- `geox_prospect` (seal mode): remove `ack_irreversible` parameter entirely
- `wealth_vault_write`: remove `human_confirmed` parameter entirely

**Why:** These only affect Arif's own systems. No external counterparty. Gate burns attention for zero protective value.

### 2. Add elicitation to external-binding actions

**Telegram send (Hermes/arifOS):**
```python
# Before sending a Telegram message to a real person:
response = await ctx.elicit(
    f"About to send message to {recipient}:\n"
    f"{message_preview}\n"
    f"Confirm to send.",
    SendConfirmation,
)
if not isinstance(response, AcceptedElicitation):
    return {"status": "BLOCKED", "reason": "Human confirmation required for outbound message"}
```

**Browser submit:**
```python
# Before submit/purchase/post action:
if action in {"submit", "purchase", "post"}:
    response = await ctx.elicit(
        f"About to {action} on {page_url}:\n"
        f"Form data: {form_data_preview}\n"
        f"Confirm to proceed.",
        SubmitConfirmation,
    )
    if not isinstance(response, AcceptedElicitation):
        return {"status": "BLOCKED", "reason": "Human confirmation required for external submission"}
```

### 3. Fix browser-interact conditional split

**Current:** `ack_irreversible` gates ALL browser actions (read and write).

**Fix:** Gate only submit/purchase/post. Navigate/scrape/screenshot run freely.

```python
# In arif_browser_interact:
EXTERNAL_ACTIONS = {"submit", "purchase", "post", "click"}  # click can trigger form submission

if action in EXTERNAL_ACTIONS:
    # Require elicitation
    response = await ctx.elicit(...)
    if not isinstance(response, AcceptedElicitation):
        return HOLD
else:
    # Read-only — fire freely
    pass
```

### 4. Fail-closed on elicitation timeout

```python
try:
    response = await asyncio.wait_for(
        ctx.elicit(...),
        timeout=300,  # 5 minutes
    )
except asyncio.TimeoutError:
    return {"status": "BLOCKED", "reason": "Human did not respond. Action blocked."}
```

---

## Updated Lint Script Filter

The lint script should flag tools that:
1. Have self-settable consent flags (`ack_irreversible`, `human_confirmed`, etc.)
2. AND bind external counterparties

Tools that only affect internal systems should NOT be flagged.

```bash
# New filter: "leaves the system + external counterparty"
EXTERNAL_BINDING_KEYWORDS="send.*message\|send.*email\|submit\|purchase\|post\|trade.*execute\|order.*execute\|transfer.*fund\|wire.*money"

# Flag only if BOTH conditions are met:
# 1. Has self-settable consent flag
# 2. Description matches external-binding keywords
```

---

## Completion Criteria (Corrected)

- [ ] No self-settable consent flags on internal-only tools (vault seal, claim seal, etc.)
- [ ] Elicitation required ONLY for: Telegram send, browser submit/purchase, trade execution, email send, fund transfer
- [ ] Elicitation timeout = block (fail-closed)
- [ ] Browser interact: conditional split (read-only = free, submit = gated)
- [ ] Lint script uses "external counterparty" filter, not "irreversible" keyword

---

## One Line for OpenCode

> Gate only: trade execution, outbound send (email/message), real fund transfer, and browser actions with external binding effect (purchase/post/submit). Everything else — vault seal, forge execution, geox claims, git, server ops, memory writes — runs with zero human confirmation, permanently. Remove `ack_irreversible` from all internal-only tools. Add elicitation to the narrow external-binding set.

---

*Written: 2026-07-07 by FORGE (000Ω)*
*Corrected scope: external counterparty only.*
*DITEMPA BUKAN DIBERI*
