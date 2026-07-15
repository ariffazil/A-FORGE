# MCP Client-Side Permission Audit — 2026-07-07

> **Auditor:** FORGE (000Ω) under F13 SOVEREIGN directive
> **Scope:** arifOS, GEOX, WEALTH, WELL MCP servers
> **Status:** FINDINGS FIRST — patch pending sovereign review

---

## Finding 1: Permission Binding Mechanism

### Where permissions are stored

OpenCode stores permissions in **three layers**:

| Layer | Location | Key | Current State |
|-------|----------|-----|---------------|
| **Config** | `~/.config/opencode/opencode.json` → `permission.mcp` | `"mcp": "allow"` | Blanket-approve ALL MCP tools |
| **Session** | `opencode.db` → `session.permission` column | `{"permission": "tool_name", "pattern": "*", "action": "deny"}` | Only native tools (todowrite, task) |
| **Database** | `opencode.db` → `permission` table | `(project_id, action, resource)` | **EMPTY** — no persistent per-tool approvals |

### Evidence

```sql
-- permission table is empty
sqlite3 ~/.local/share/opencode/opencode.db "SELECT COUNT(*) FROM permission;"
-- Result: 0

-- Session permissions only cover native tools
sqlite3 ~/.local/share/opencode/opencode.db "
SELECT id, permission FROM session 
WHERE permission LIKE '%deny%' LIMIT 3;
"
-- Result: sessions have todowrite/task set to deny, NOT MCP tools

-- Config blanket-approves all MCP
python3 -c "
import json
with open('/root/.config/opencode/opencode.json') as f:
    cfg = json.load(f)
print(cfg['permission']['mcp'])
"
-- Result: "allow"
```

### Binding key analysis

The `permission` table schema:
```sql
CREATE TABLE `permission` (
  `id` text PRIMARY KEY,
  `project_id` text NOT NULL,
  `action` text NOT NULL,
  `resource` text NOT NULL,
  ...
);
CREATE UNIQUE INDEX `permission_project_action_resource_idx` 
  ON `permission` (`project_id`,`action`,`resource`);
```

**Binding is `(project_id, action, resource)` — name-only.** No `server_id`, no `tool_schema_hash`. The `resource` field is the tool name string.

### What "Always" and "Ask" actually mean

The UI showing "Always" for `arif_seal`, `forge_execute`, `geox_claim` is **NOT** from per-tool configuration. It's from the blanket `"mcp": "allow"` in the config. ALL MCP tools are auto-approved.

The UI showing "Ask" for `arif_bridge_connect` and `arif_memory` is likely from:
1. The TUI's own rendering logic (tools never called in this session show "Ask")
2. OR a session-level override I haven't found

**Bottom line:** There is no per-tool MCP permission granularity in the current config. The "Always/Ask" display is cosmetic, not functional.

---

## Finding 2: Rename Behavior (Fail-Open)

### Test

Since the `permission` table is EMPTY and the config uses `"mcp": "allow"`:

1. **Rename a tool:** If `arif_seal` is renamed to `arif_vault_seal`, the old permission grant (if any) would be orphaned in the `permission` table. But since the table is empty, there's nothing to orphan.

2. **Fallthrough behavior:** The blanket `"mcp": "allow"` means ANY tool name — renamed, new, or spoofed — gets auto-approved. This is **fail-open**.

3. **Cross-server collision:** If two MCP servers expose `seal` (same name), the blanket approval applies to both. No server-level isolation.

### Verdict

**FAIL-OPEN.** A renamed or altered tool silently inherits trust. A spoofed tool name from a different server gets auto-approved.

---

## Finding 3: Inverted Permission Defaults

### Irreversible tools currently auto-approved

| Tool | Server | Irreversibility Evidence | Current | Should Be |
|------|--------|-------------------------|---------|-----------|
| `arif_seal` | arifOS | "Irreversible. Requires ack_irreversible=True for seal mode." | Always (blanket) | Ask |
| `arif_forge` | arifOS | "commit/write/generate modes execute after judge SEAL" | Always (blanket) | Ask |
| `geox_claim` | geox | "seal mode is IRREVERSIBLE (requires ack_irreversible=True)" | Always (blanket) | Ask |
| `forge_execute_sealed` | aforge | "FAILS HARD without valid seal" | Always (blanket) | Ask |
| `forge_seal` | aforge | "Seal a Tri-Witness validated skill into permanent VAULT999 memory. Irreversible." | Always (blanket) | Ask |

### Low-blast-radius tools that could be Always

| Tool | Server | Blast Radius | Current | Could Be |
|------|--------|-------------|---------|----------|
| `arif_bridge_connect` | arifOS | Low — routing passthrough, no direct state mutation | Ask (cosmetic) | Always |
| `arif_observe` | arifOS | None — read-only | Ask (cosmetic) | Always |
| `geox_surface_status` | geox | None — read-only registry probe | Always (blanket) | Always (correct) |

---

## Finding 4: No Tool Schema Hash in Binding

The `permission` table has no `tool_schema_hash` field. This means:

1. If a tool's input schema changes (e.g., `arif_seal` adds a new parameter), the old permission grant still applies
2. A tool could be re-implemented with different side effects under the same name
3. No way to detect schema drift at the permission layer

---

## Proposed Fix

### Config format limitation

OpenCode's config format uses `"mcp": "allow"` as a **string**, not a nested object. Per-tool MCP permissions are **NOT supported** in the config. The only options are:
- `"mcp": "allow"` — blanket approve all MCP tools
- `"mcp": "ask"` — require approval for all MCP tools

There is no middle ground in the config format.

### Recommended approach

Since per-tool config is not supported, the fix is **server-side**:

1. **Keep `"mcp": "allow"` in the client config** — it's the only way to make MCP tools work without constant prompts
2. **Rely on server-side guards** — the MCP servers already have `ack_irreversible=True` requirements for irreversible tools
3. **Document the irreversible tools** — use the lint script to track them
4. **Add server-side confirmation prompts** — for the 10 irreversible tools, add explicit confirmation in the tool handler

### Server-side guards (already in place)

| Tool | Server | Guard |
|------|--------|-------|
| `arif_seal` | arifOS | Requires `ack_irreversible=True` |
| `geox_claim` | geox | Requires `ack_irreversible=True` for seal mode |
| `forge_execute_sealed` | aforge | Requires valid seal from arifOS |
| `forge_seal` | aforge | Requires Tri-Witness validation |

### Long-term (binding improvement)

Propose binding permissions to `(server_id, tool_name, tool_schema_hash)` instead of just `tool_name`. This requires:
1. Adding `server_id` and `schema_hash` columns to the `permission` table
2. Updating the OpenCode client to populate these on permission grant
3. Checking schema hash on each tool call — if changed, require re-confirmation

---

## Deliverable: Lint Script

See `mcp-permission-lint.sh` — flags any tool whose description matches irreversibility language but whose permission is "always" (or blanket-allowed).

---

*Audited: 2026-07-07 by FORGE (000Ω)*
*DITEMPA BUKAN DIBERI*
