# FastMCP — Federation Forge Reference

**Date:** 2026-07-07  
**Version:** 3.4.3  
**Source:** https://gofastmcp.com/llms.txt  
**Installed:** `/opt/fastmcp-venv` + symlink at `/root/.local/bin/fastmcp`

---

## What FastMCP Is

FastMCP is the Pythonic MCP framework — decorator-based, modern, replaces the low-level MCP Python SDK. `fastmcp` CLI provides dev tools, installation, inspection, and auth utilities.

## CLI Surface

| Command | Purpose | Relevance to Federation |
|---------|---------|------------------------|
| `fastmcp dev` | Hot-reload dev server for MCP tools | Prototyping GEOX/WEALTH/WELL Python tools |
| `fastmcp run` | Run any MCP server | Running `mcp-server-fetch`, custom servers |
| `fastmcp inspect` | View tool schemas + metadata | **Item 5** — tool dedupe (fingerprinting) |
| `fastmcp install` | Install servers into clients | Linking to Claude/Cursor/Gemini |
| `fastmcp call` | Call tools / read resources | Testing |
| `fastmcp auth cimd` | Generate OAuth CIMD docs | Auth integration |
| `fastmcp generate-cli` | Scaffold CLI from MCP server | Creating typed CLIs from tools |

## Items 2 and 5 — Directly Addressed

### Item 2 (Elicitation on trades/sends)

FastMCP server SDK has `ctx.request_user_input()` — server-side `elicitation/create`:

```python
from fastmcp import FastMCP, Context

server = FastMCP("trading")

@server.tool()
def transfer_funds(amount: float, to: str, ctx: Context) -> str:
    # Block until user confirms via form elicitation
    confirm = ctx.request_user_input(
        message=f"Confirm transfer of ${amount} to {to}?",
        schema={
            "type": "object",
            "properties": {
                "ok": {"type": "boolean", "title": "I authorize this transfer"},
                "note": {"type": "string", "title": "Reason"}
            },
            "required": ["ok"]
        }
    )
    if confirm.get("ok"):
        return execute_transfer(amount, to)
    return "Transfer cancelled by user"
```

**This is the Item 2 fix.** The tool blocks until the user responds via the client. For sensitive data, URL mode handles auth/payments.

### Item 5 (Tool dedupe enforcement)

FastMCP has **Tool Fingerprinting** — SHA-256 hash of identity + schema:

```python
# Each tool gets a stable fingerprint
fingerprint = server.tool_fingerprint("transfer_funds")
# Changes when schema or name changes → detect drift
```

On startup, can compare fingerprints to detect duplicates. This is exactly the startup check for tool dedupe.

## Federation Value

| Use Case | How FastMCP Helps |
|----------|-------------------|
| Prototype GEOX Python tools | `fastmcp dev` with hot-reload |
| Prototype WEALTH capital tools | Decorator-based tools, fast iteration |
| Build interactive apps | FastMCPApp (charts, forms, tables) |
| Elicitation | Native `ctx.request_user_input()` — solves Item 2 |
| Tool dedupe | Fingerprinting + inspect — solves Item 5 |
| Auth | OAuth 2.1, CIMD, Bearer token utilities |
| Testing | `fastmcp inspect` + `fastmcp call` |

## forge_fetch vs mcp-server-fetch — Decision Matrix (Updated)

| Use Case | Tool | Why |
|----------|------|-----|
| Inside A-FORGE with governance | `forge_fetch` | Floors, leases, `_epistemic` tags, audit trail |
| Standalone fetch, testing | `mcp-server-fetch` | Official reference, raw MCP |
| Prototyping fetch with Python | `fastmcp run mcp-server-fetch` | Fast iteration |
| Building new federation tool | `forge_*` in A-FORGE (TS) | Governance chain is mandatory |
| Building new organ tool | `fastmcp dev` then port to A-FORGE | Prototype fast, then harden |

---

**DITEMPA BUKAN DIBERI — The forge is forged, not given.**
