# FORGE_FILESYSTEM V2 — Improvement Spec

> **Date:** 2026-07-07
> **Triggered by:** 3-agent filesystem test (Agent A native, Agent B forge_filesystem, Agent C hybrid)
> **Verdict:** PROCEED — 6 improvements, 1 external exposure architecture
> **Evidence:** OBS (test results), DER (gap analysis), INT (MCP spec alignment)

---

## 1. Test Findings Summary

| Agent | Tasks | Success | Key Finding |
|-------|-------|---------|-------------|
| A (Native) | 5/5 | 100% | Zero governance. Read secrets freely. No audit trail. |
| B (forge_filesystem) | 3/5 | 60% | F12 blocked grep searches + writes containing sensitive terms. Meta-governance paradox. |
| C (Hybrid) | 5/5 | 100% | Context-aware tool selection. Native for observation, forge for governed writes. |

### Critical Failure: F12 Content-Scanning Paradox

Agent B's test revealed a **structural flaw** in F12 injection detection:

- **Task 2 (grep for "password|secret"):** BLOCKED — searching for sensitive terms is itself flagged as SECRET_ACCESS
- **Task 3 (write routes.ts with auth content):** BLOCKED — auth.ts content contains "password" parameter
- **Meta-paradox:** Writing a REPORT about F12 blocks was blocked 4 times because the report contained the trigger words

**Root cause:** `F12_THREAT_PATTERNS.SECRET_FILE_PATTERNS` scans the **entire tool argument payload** (including `content` for writes and `pattern` for greps), not just the `target` path. This means:

```
forge_filesystem(grep, pattern="password") → F12 VOID (searching = accessing)
forge_filesystem(write, content="...password...") → F12 VOID (code = exfiltration)
```

This is **correct for detecting injection**, but **incorrect for legitimate security work**. A security audit that searches for hardcoded passwords should not be blocked by the same rule that prevents exfiltrating them.

---

## 2. Six Improvements

### IMPROVEMENT 1: F12 Context-Aware Scanning

**Problem:** F12 SECRET_FILE_PATTERNS scans content payloads, blocking legitimate searches and code writes.

**Fix:** Split F12 secret detection into two modes:

```typescript
// BEFORE (current — scans everything)
SECRET_FILE_PATTERNS: [
  /(?:password|token|credential|api[_-]?key)/i,
]

// AFTER (proposed — context-aware)
SECRET_DETECTION: {
  // Path-based: block ACCESS to actual secret files
  BLOCK_PATHS: [
    /\.env($|\.)/i,
    /id_rsa|id_ed25519|id_dsa/i,
    /(?:private|secret)[_-]?key/i,
  ],
  // Content-based: only block if content MATCHES a known secret pattern
  // (e.g., "sk-prod-...", "ghp_...", actual key material)
  BLOCK_CONTENT: [
    /(?:sk-[a-zA-Z0-9]{20,})/,           // OpenAI-style keys
    /(?:ghp_[a-zA-Z0-9]{36})/,           // GitHub tokens
    /(?:AKIA[0-9A-Z]{16})/,              // AWS access keys
    /(?:xoxb-[0-9-]+)/,                  // Slack tokens
  ],
  // Search-mode: ALLOW pattern searches for security terms
  ALLOW_SEARCH_PATTERNS: true,  // grep mode with pattern="password" is legitimate
}
```

**Rule:** F12 should block **exfiltration** (actual secrets in output), not **searching** (looking for secrets in code). The distinction:

| Scenario | Current | Proposed |
|----------|---------|----------|
| `grep pattern="password"` | VOID | ALLOW (search intent) |
| `write content="API_KEY=sk-prod-abc123"` | VOID | VOID (actual secret) |
| `write content="password = input()"` | VOID | ALLOW (code reference) |
| `read path="/root/.ssh/id_rsa"` | VOID | VOID (sensitive path) |

### IMPROVEMENT 2: New Modes — `move`, `copy`, `delete`, `tree`

**Problem:** forge_filesystem has 5 modes. Standard filesystem MCP has ~10 tools. Missing: move, copy, delete, directory tree.

**Proposed new modes:**

```typescript
mode: z.enum([
  "read", "write", "glob", "grep", "stat",  // existing
  "move",      // rename/move file or directory
  "copy",      // copy file (not directory — use shell for recursive)
  "delete",    // delete file (NOT directory — too dangerous)
  "tree",      // recursive directory listing with depth limit
  "batch_stat", // stat multiple files in one call
])
```

**Implementation for each:**

```typescript
// MOVE — rename/move
if (mode === "move") {
  if (!content) return text("content (destination path) required for mode=move", true);
  const destCheck = checkPathAllowed(content);
  if (!destCheck.allowed) return text(destCheck.error!, true);
  await rename(check.resolvedPath, destCheck.resolvedPath);
  return text({ status: "moved", from: check.resolvedPath, to: destCheck.resolvedPath });
}

// COPY — copy file
if (mode === "copy") {
  if (!content) return text("content (destination path) required for mode=copy", true);
  const destCheck = checkPathAllowed(content);
  if (!destCheck.allowed) return text(destCheck.error!, true);
  await copyFile(check.resolvedPath, destCheck.resolvedPath);
  const bytes = (await stat(check.resolvedPath)).size;
  return text({ status: "copied", from: check.resolvedPath, to: destCheck.resolvedPath, bytes });
}

// DELETE — delete file only (NOT directory)
if (mode === "delete") {
  const s = await stat(check.resolvedPath);
  if (s.isDirectory()) return text("F1 AMANAH: Cannot delete directory via forge_filesystem. Use forge_shell.", true);
  await unlink(check.resolvedPath);
  return text({ status: "deleted", path: check.resolvedPath, bytes: s.size });
}

// TREE — recursive directory listing
if (mode === "tree") {
  const maxDepth = limit ?? 3;
  const tree = await buildTree(check.resolvedPath, 0, maxDepth);
  return text(tree);
}
```

**Governance:** `move`, `copy`, `delete` are MUTATE-class. They require lease and pass through F1-F13.

### IMPROVEMENT 3: Batch Stat

**Problem:** Getting metadata for 4 files requires 4 separate MCP calls.

**Fix:** When `mode="stat"` and `path` is a directory, return stats for ALL files in that directory.

```typescript
if (mode === "stat") {
  const s = await stat(check.resolvedPath);
  if (s.isDirectory()) {
    // Batch stat: return metadata for all files in directory
    const entries = await readdir(check.resolvedPath);
    const results = [];
    for (const entry of entries) {
      const entryPath = join(check.resolvedPath, entry);
      try {
        const es = await stat(entryPath);
        results.push({
          path: entryPath,
          size: es.size,
          isDirectory: es.isDirectory(),
          modified: es.mtime,
          created: es.birthtime,
          mode: es.mode.toString(8),
        });
      } catch { /* skip inaccessible */ }
    }
    return text({ directory: check.resolvedPath, entries: results });
  }
  // Single file stat (existing behavior)
  return text({ ...existing stat response });
}
```

### IMPROVEMENT 4: Read-Only Audit Mode for Sensitive Paths

**Problem:** Sensitive paths are hard-blocked. No way to audit them without native tools.

**Fix:** Add an `audit` mode that reads sensitive paths in a restricted way — returns metadata and structure but not content, with access logged.

```typescript
// New mode: audit — read metadata of sensitive paths without exposing content
if (mode === "audit") {
  const s = await stat(check.resolvedPath);
  // Log the audit access
  const auditLog = {
    path: check.resolvedPath,
    accessed_by: actor_id ?? "unknown",
    timestamp: new Date().toISOString(),
    action: "audit_read",
  };
  // Write to audit log (append-only)
  await appendFile("/var/log/forge-filesystem-audit.jsonl", JSON.stringify(auditLog) + "\n");
  
  return text({
    path: check.resolvedPath,
    size: s.size,
    exists: true,
    isDirectory: s.isDirectory(),
    modified: s.mtime,
    // NEVER return content for audited paths
    content: "[REDACTED — use audit mode]",
  });
}
```

### IMPROVEMENT 5: Thermodynamic Receipt for All Mutations

**Problem:** Write mode returns `landauer_joules` metadata but no receipt for the audit trail.

**Fix:** Every mutation (write, move, copy, delete) generates a receipt that can be sealed to VAULT999.

```typescript
// After every mutation, return a receipt
const receipt = {
  action: mode,
  path: check.resolvedPath,
  actor: actor_id ?? "anonymous",
  session: session_id ?? "stateless",
  timestamp: new Date().toISOString(),
  bytes_affected: byteCount,
  landauer_joules: thermoJ,
  reversibility: mode === "delete" ? "NONE" : "FULL",
  blast_radius: estimateBlastRadius(check.resolvedPath, mode),
  // SHA256 of content for integrity verification
  content_hash: mode === "write" ? sha256(content) : undefined,
};
```

### IMPROVEMENT 6: External MCP Exposure Architecture

**Problem:** forge_filesystem is only accessible internally (localhost:7072). External MCP clients (Claude Desktop, Cursor, Zed) cannot connect.

**Current state:**
- `mcp.arif-fazil.com/mcp` → proxies to arifOS kernel :8088 (52 tools)
- A-FORGE MCP :7072 → internal only, 35 stateless tools including forge_filesystem
- No public A-FORGE endpoint

**Proposed architecture:**

```
External MCP Client (Claude Desktop / Cursor / Zed)
  ↓ MCP Streamable HTTP
  ↓ https://forge-mcp.arif-fazil.com/mcp
  ↓ Caddy reverse proxy
  ↓ A-FORGE MCP :7072
  ↓ FloorEnforcer + F12 + lease
  ↓ forge_filesystem handler
  ↓ OS filesystem (/root, /tmp, /data, /var/log)
```

**Implementation steps:**

1. **Caddy config** — new subdomain `forge-mcp.arif-fazil.com`:
```caddyfile
forge-mcp.arif-fazil.com {
    reverse_proxy 127.0.0.1:7072
    # MCP requires these headers
    header Access-Control-Allow-Origin "*"
    header Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS"
    header Access-Control-Allow-Headers "Content-Type, Accept, Mcp-Session-Id"
}
```

2. **OAuth 2.1** — MCP spec requires authorization for remote servers:
```typescript
// Add to serve.ts
const OAUTH_CLIENTS = new Map([
  ["claude-desktop", { redirect_uri: "https://claude.ai/callback", scopes: ["read", "write"] }],
  ["cursor", { redirect_uri: "https://cursor.sh/callback", scopes: ["read", "write"] }],
]);

// /.well-known/oauth-authorization-server
// /authorize
// /token
// /register (dynamic client registration)
```

3. **MCP Registry** — publish to the official MCP registry:
```json
{
  "name": "arifos-forge-filesystem",
  "description": "Governed filesystem MCP server with constitutional boundaries",
  "url": "https://forge-mcp.arif-fazil.com/mcp",
  "transport": "streamable-http",
  "authentication": "oauth2.1",
  "tools": ["forge_filesystem", "forge_shell", "forge_git", "forge_vault"]
}
```

4. **`.well-known/mcp/server.json`** — discovery file:
```json
{
  "schema_version": "2025-11-25",
  "name": "A-FORGE Governed Filesystem",
  "version": "2.0.0",
  "description": "Constitutional filesystem access with F1-F13 governance",
  "mcp_endpoint": "https://forge-mcp.arif-fazil.com/mcp",
  "transport": "streamable-http",
  "authentication": {
    "type": "oauth2.1",
    "authorization_url": "https://forge-mcp.arif-fazil.com/authorize",
    "token_url": "https://forge-mcp.arif-fazil.com/token"
  },
  "tools": [
    {
      "name": "forge_filesystem",
      "description": "Governed filesystem primitive. Modes: read, write, glob, grep, stat, move, copy, delete, tree.",
      "risk_tier": "MEDIUM"
    }
  ]
}
```

5. **External client config** — for Claude Desktop:
```json
{
  "mcpServers": {
    "arifos-forge": {
      "url": "https://forge-mcp.arif-fazil.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

---

## 3. Priority Matrix

| # | Improvement | Impact | Effort | Priority |
|---|------------|--------|--------|----------|
| 1 | F12 context-aware scanning | HIGH — unblocks security audits | MEDIUM | P0 |
| 2 | New modes (move/copy/delete/tree) | HIGH — feature parity with MCP filesystem | MEDIUM | P1 |
| 3 | Batch stat | MEDIUM — reduces MCP roundtrips | LOW | P1 |
| 4 | Audit mode for sensitive paths | MEDIUM — governance without paralysis | LOW | P2 |
| 5 | Mutation receipts | MEDIUM — audit trail completeness | LOW | P2 |
| 6 | External MCP exposure | HIGH — enables third-party clients | HIGH | P1 |

---

## 4. What NOT to Change

- **F8 path boundaries** — keep `/root`, `/tmp`, `/data`, `/var/log`. These are correct.
- **F1 overwrite guard** — `overwrite=false` default is correct. Don't weaken it.
- **Lease gating for writes** — correct. External clients should get scoped leases.
- **Single tool with modes** — correct design. Don't split into separate tools.
- **Landauer thermodynamic metadata** — unique and valuable. Keep it.

---

## 5. Verification Plan

After implementation, re-run the 3-agent test:

| Task | Agent A (native) | Agent B (forge v2) | Agent C (hybrid) |
|------|------------------|--------------------|--------------------|
| 1. READ | SUCCESS | SUCCESS | SUCCESS |
| 2. SEARCH "password" | SUCCESS | **SUCCESS** (was BLOCKED) | SUCCESS |
| 3. WRITE auth code | SUCCESS | **SUCCESS** (was BLOCKED) | SUCCESS |
| 4. BATCH STAT | SUCCESS (ls -la) | **SUCCESS** (1 call, was 4) | SUCCESS |
| 5. BOUNDARY TEST | SUCCESS (breached) | BLOCKED (correct) | SUCCESS |

**Target:** Agent B goes from 3/5 → 5/5 while maintaining governance integrity.

---

*Forged: 2026-07-07 by FORGE (000Ω) under F13 SOVEREIGN directive*
*DITEMPA BUKAN DIBERI*
