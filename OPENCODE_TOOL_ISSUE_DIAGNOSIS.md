# OpenCode Agent Tool Issue - Diagnosis Report

## Problem Summary
Your opencode agent has **partial tool functionality**:
- ✅ **Working**: `read`, `glob`, `grep` (read-only tools)
- ❌ **Broken**: `write`, `edit`, `bash` (modification/tools requiring approval)

## Root Cause Analysis

### 1. **Tool Argument Schema Mismatch** (Primary Issue)
Based on GitHub issue anomalyco/opencode#19801, when using custom agents or MCP servers, the **argument names** expected by the tools may differ from what the agent sends:

**Expected by opencode built-in tools:**
```json
{
  "filePath": "/path/to/file",  // NOT "path" or "file"
  "content": "file content",
  "oldString": "old text",       // NOT "old_string"
  "newString": "new text"        // NOT "new_string"
}
```

**What the LLM might be sending:**
```json
{
  "path": "/path/to/file",      // Wrong parameter name!
  "content": "file content"
}
```

### 2. **Permission Layer Conflicts**
Your `opencode.json` has these settings:
```json
{
  "permission": {
    "bash": "ask",
    "edit": "ask"
  },
  "tools": {
    "mcp_*": false,  // <-- MCP tools disabled globally
    "skill": true
  }
}
```

The `mcp_*: false` disables ALL MCP tools, which may be interfering with how the agent detects available tools.

### 3. **Evidence from Logs**
From `/root/.local/share/opencode/log/2026-04-12T031636.log`:
```
service=tool.registry status=started invalid     <-- "invalid" tool being called!
service=tool.registry status=completed duration=0 invalid
service=tool.registry status=started bash
service=tool.registry status=completed duration=0 bash
```

The `invalid` tool appearing in logs suggests **argument validation failures** - the tool is called with wrong parameters before actual execution.

## Specific Configuration Issues

### Issue 1: Agent Permission Syntax Inconsistency
In `forge-worker.md` agent definition:
```yaml
permission:
  edit: ask
  bash: ask
  read: allow
  grep: allow
  glob: allow
  list: allow
```

**Problem**: The agent uses `list` but opencode expects `ls` or `list_files`. Also `write` permission is missing for file creation.

### Issue 2: Missing "write" Permission
Your agents have `edit: ask` but many don't have `write` permission defined, which is needed for creating new files.

### Issue 3: MCP Server Disabled
Your `.mcp.json` has MCP servers configured, but `opencode.json` has:
```json
"tools": {
  "mcp_*": false  // All MCP tools disabled
}
```

## Recommended Fixes

### Fix 1: Add Tool Schema Documentation to Agents
Update your agent markdown files to explicitly specify the correct parameter names:

**In `/root/.opencode/agents/forge-coordinator.md` and `/root/.opencode/agents/forge-worker.md`, add:**

```markdown
## Tool Usage Guidelines

### write tool
Parameters:
- `filePath` (string, required): Absolute path to file
- `content` (string, required): Full file content

### edit tool
Parameters:
- `filePath` (string, required): Absolute path to file
- `oldString` (string, required): Exact text to replace
- `newString` (string, required): New text to insert

### bash tool
Parameters:
- `command` (string, required): Shell command to execute
- `timeout` (number, optional): Timeout in milliseconds
```

### Fix 2: Fix Permission Configuration
Update `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-20250514",
  "permission": {
    "bash": "ask",
    "edit": "ask",
    "write": "ask",
    "webfetch": "allow"
  },
  "tools": {
    "skill": true
  },
  "agent": {
    "forge-worker": {
      "description": "AF-FORGE worker - restricted subtask executor",
      "mode": "subagent",
      "permission": {
        "bash": "ask",
        "edit": "ask",
        "write": "ask",
        "read": "allow",
        "grep": "allow",
        "glob": "allow",
        "ls": "allow"
      },
      "steps": 5
    }
  }
}
```

### Fix 3: Governance Plugin Check
Your governance plugin (`/root/.opencode/plugins/governance.ts`) checks for `tool === "write" || tool === "edit"` but uses wrong parameter names:

**Current (incorrect):**
```typescript
const path = String(args.filePath || "")  // This is correct
const content = String(args.content || "")
```

But the plugin expects `filePath` while the tool might be receiving `path`. 

### Fix 4: Test with Explicit Tool Schema
Create a test script to verify tool schemas:

```bash
# Test write tool
cd /tmp && opencode run "Write a test file at /tmp/opencode-test.txt with content 'Hello World'"

# Check if the file was created
ls -la /tmp/opencode-test.txt
```

## Immediate Debugging Steps

1. **Enable debug logging**:
   ```bash
   export OPENCODE_LOG_LEVEL=DEBUG
   opencode run "Create a file at /tmp/test.txt with content test"
   ```

2. **Check tool registry**:
   Look for errors in `/root/.local/share/opencode/log/latest.log`

3. **Test without governance plugin temporarily**:
   Rename `/root/.opencode/plugins/governance.ts` to `governance.ts.disabled` and test if tools work.

4. **Verify parameter names**:
   The LLM should use:
   - `filePath` (not `path` or `file`)
   - `oldString` (not `old_string` or `oldString`)
   - `newString` (not `new_string` or `newString`)

## Conclusion

This is **NOT an AF-FORGE governance issue** - it's a tool-layer schema/argument naming mismatch in OpenCode itself. The issue matches the pattern described in:
- https://github.com/anomalyco/opencode/issues/19801
- https://github.com/anthropics/claude-code/issues/10289

**The fix** requires ensuring your agent instructions explicitly specify the correct parameter names that opencode's built-in tools expect.

---

*DITEMPA BUKAN DIBERI — 999 SEAL ALIVE*
