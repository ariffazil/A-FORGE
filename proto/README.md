# FastMCP Workflow — Organ Tool Prototyping

> **FastMCP 3.4.3** installed at `/opt/fastmcp-venv` → `/root/.local/bin/fastmcp`
> **Purpose:** Prototype organ tools in Python before porting to A-FORGE TypeScript
> **Doctrine:** Fail fast, learn fast. Prototype in Python, harden in TypeScript.

---

## Why Two Languages?

| Surface | Language | Why |
|---------|----------|-----|
| arifOS kernel (8088) | Python | Started as constitutional server. FastAPI + uvicorn. |
| A-FORGE MCP (7072) | TypeScript | Started as execution shell. Express + MCP SDK. |
| GEOX/WEALTH/WELL engines | Python | Physics/computation. NumPy, pandas, scipy. |
| FastMCP prototypes | Python | Fastest path from idea to working MCP tool. |

**The strategic direction:** FastMCP as the Python prototyping surface. A-FORGE TypeScript as the governed production surface. When a prototype proves itself, port to A-FORGE with full F1-F13 governance.

---

## Quick Start

```bash
# 1. Activate FastMCP
source /opt/fastmcp-venv/bin/activate
# or: /root/.local/bin/fastmcp

# 2. Create a prototype
vim /root/A-FORGE/proto/geox/my_tool.py

# 3. Hot-reload dev server
fastmcp dev /root/A-FORGE/proto/geox/my_tool.py

# 4. Inspect tool schemas
fastmcp inspect /root/A-FORGE/proto/geox/my_tool.py

# 5. Call a tool directly
fastmcp call /root/A-FORGE/proto/geox/my_tool.py tool_name '{"arg":"value"}'

# 6. Install into Claude Desktop / Cursor
fastmcp install /root/A-FORGE/proto/geox/my_tool.py
```

---

## Directory Structure

```
/root/A-FORGE/proto/
├── README.md                    # This file
├── geox/                        # GEOX prototypes
│   └── basin_resolve.py         # Basin metadata resolver
├── wealth/                      # WEALTH prototypes
│   └── (empty — awaiting prototypes)
├── well/                        # WELL prototypes
│   └── (empty — awaiting prototypes)
└── examples/                    # Cross-cutting examples
    └── elicitation_demo.py      # Elicitation gate demo (888_HOLD external)
```

---

## Prototype → Production Pipeline

```
Phase 1: PROTOTYPE (Python/FastMCP)
  ├── fastmcp dev — hot-reload iteration
  ├── fastmcp inspect — schema verification
  ├── fastmcp call — manual testing
  └── fastmcp install — client integration testing

Phase 2: VALIDATE (Python/FastMCP)
  ├── Schema matches A-FORGE conventions (forge_* naming)
  ├── Error handling tested
  ├── Edge cases documented
  └── Performance benchmarked

Phase 3: HARDEN (TypeScript/A-FORGE)
  ├── Port to proxyTools.ts or domain module
  ├── Add FloorEnforcer integration
  ├── Add action classification (OBSERVE/MUTATE/IRREVERSIBLE)
  ├── Add lease gating for mutations
  ├── Add receipt trail (VAULT999)
  └── Register in forge_registry

Phase 4: EXTERNAL (TypeScript/A-FORGE + MCP)
  ├── Add external aliases (forge_*_read, forge_*_write)
  ├── Add outputSchema + structuredContent
  ├── Add elicitation gate for external clients
  ├── Add OAuth 2.1 auth
  └── Publish to MCP Registry
```

---

## Elicitation = External 888_HOLD

FastMCP's `ctx.request_user_input()` is the MCP protocol-level equivalent of arifOS's `888_HOLD`:

```python
# In Python prototype:
confirm = ctx.request_user_input(
    message="Confirm write to /root/config.json?",
    schema={"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"]}
)
```

```typescript
// In A-FORGE TypeScript (elicitationGate.ts):
const result = evaluateElicitationGate({
  message: "Confirm write to /root/config.json?",
  action_class: "EXECUTE_REVERSIBLE",
  tool_name: "forge_filesystem",
  target: "/root/config.json",
  transport: "http", // external client
});
```

| Internal (federation) | External (MCP client) |
|---|---|
| arif_judge → 888_HOLD → Telegram ack | ctx.request_user_input() → client form |
| Constitutional floors F1-F13 | Schema-based confirmation |
| arifOS kernel judges | Tool logic decides when to pause |

---

## Tool Fingerprinting

Every A-FORGE tool gets a SHA-256 fingerprint of (name + schema) at startup.
Compare against stored fingerprints to detect:

- **New tools** added since last restart
- **Removed tools** that disappeared
- **Schema drift** — same name, different schema
- **Duplicates** — same name registered twice

Location: `/root/A-FORGE/.registry/fingerprints.json`

---

## Rules

1. **Prototypes live in `/root/A-FORGE/proto/`** — never in `src/`
2. **No governance in prototypes** — they're sandboxed experiments
3. **FastMCP dev for iteration** — hot-reload beats build cycles
4. **Port to TypeScript for production** — governance is mandatory
5. **Never expose prototype tools to external clients** — they lack F1-F13

---

*DITEMPA BUKAN DIBERI — Prototype fast, harden later, govern always.*
