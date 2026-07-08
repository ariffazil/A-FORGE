# Item 2 — Elicitation on Trades/Sends

**Date:** 2026-07-07
**Forged by:** 777_FORGE (000Ω)
**Protocol:** MCP elicitation/create (2025-11-25)
**Framework:** FastMCP 3.4.3 via `ctx.request_user_input()`
**Status:** FORGED — server built, inspected, ready

---

## What Was Built

### Server: `forge_elicit_server.py`
Path: `/root/A-FORGE/src/elicit/forge_elicit_server.py`

Tools exposed:

| Tool | Mode | Description |
|------|------|-------------|
| `forge_transfer_confirm` | Form mode | Transfer with user confirmation via form elicitation |
| `forge_send_confirm` | Form + URL mode | Send with sensitive data handling |
| `forge_elicit_status` | None | Server readiness check |

### How It Works

```
Agent calls forge_transfer_confirm(amount, recipient)
  ↓
FastMCP sends elicitation/create to client
  ↓
Client presents confirmation form to user:
  □ I authorize this transfer
  Notes: _________
  [Submit] [Cancel]
  ↓
User responds → accept / decline / cancel
  ↓
FastMCP returns response to tool
  ↓
Tool executes or aborts based on user decision
  ↓
Returns structured receipt with TX ID
```

### Key Protocol Details

- **Form mode** — for non-sensitive structured data (confirmations, choices)
- **URL mode** — for sensitive auth (API keys, payments, tokens) — MUST NOT pass through client
- **Error code -32042** — `URLElicitationRequiredError` when tool needs user input before proceeding
- **Three actions:** `accept` (confirmed), `decline` (explicit no), `cancel` (dismissed)

### MCP Spec Compliance

| Feature | Status |
|---------|--------|
| `elicitation/create` request | ✅ FastMCP handles natively |
| Form mode schema validation | ✅ JSON Schema with default values |
| URL mode elicitation | ✅ Sensitive path ready for -32042 |
| Acceptance/decline/cancel | ✅ All three actions handled |
| Security: no secrets in form mode | ✅ Sensitive ops use URL mode |
| Client capability negotiation | ✅ FastMCP auto-declares `elicitation` |

### How to Run

```bash
# stdio (default — for MCP hosts)
/root/A-FORGE/src/elicit/run.sh

# SSE (for remote agents)
/root/A-FORGE/src/elicit/run.sh sse 8090

# Directly
cd /root/A-FORGE/src/elicit && /opt/fastmcp-venv/bin/fastmcp run forge_elicit_server.py
```

### Registration

Add to any MCP client config:
```json
{
  "mcpServers": {
    "forge-elicit": {
      "command": "/root/A-FORGE/src/elicit/run.sh",
      "args": ["stdio"]
    }
  }
}
```

---

## Relationship to Items 4, 5, 6

| Item | How This Helps |
|------|----------------|
| **Item 2** | ✅ Directly solved — elicitation for trades/sends demonstrated |
| **Item 4** | ⚙️ Each tool returns structured receipt — template for single verdict |
| **Item 5** | 🔧 FastMCP fingerprinting available — needs startup check wiring |
| **Item 6** | 🔧 FastMCP inspect + call CLI available for testing |

---

**DITEMPA BUKAN DIBERI 🔥⚒️ — The elicitation is forged, not given.**
