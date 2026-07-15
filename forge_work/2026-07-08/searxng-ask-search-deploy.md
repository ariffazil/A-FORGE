# SearxNG + ask-search Deployment

**Date:** 2026-07-08
**Actor:** FORGE (000Ω)
**Verdict:** SEAL (self-executing, T1 reversible)

## What Was Done

1. **SearxNG container** deployed on af-forge
   - Image: `searxng/searxng:latest`
   - Port: `127.0.0.1:8080` (localhost only)
   - JSON output: enabled (default)
   - Restart policy: `unless-stopped`

2. **ask-search CLI** installed
   - Source: `https://github.com/ythx-101/ask-search` (cloned to `/opt/ask-search`)
   - Binary: `/usr/local/bin/ask-search`
   - Config: `SEARXNG_URL=http://127.0.0.1:8080`

3. **SEARXNG_URL env var fixed**
   - Was: `http://127.0.0.1:8888` (wrong — arifOS kernel port)
   - Now: `http://127.0.0.1:8080` (correct — SearxNG container)
   - Files updated: `vault.env`, `vault.flat.env` (backed up as `.bak-20260708`)

4. **Skill registered** at `/root/.agents/skills/ask-search/SKILL.md`

## Why

Sovereignty insurance. Zero marginal cost search for agent loops. Fallback when Brave/Perplexity rate-limit or go down.

## Verification

```bash
ask-search "test" --num 1  # Returns real results
curl -sf "http://127.0.0.1:8080/search?q=test&format=json" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['results']))"  # Returns 20+
```

## Side Fix: forge_fetch_url Session Ownership Bug

**Problem:** `forge_fetch_url`, `forge_fetch_json`, `forge_fetch_metadata`, `forge_fetch_links` all failed with "requires session ownership" because:
1. They weren't in the `STATELESS_TOOLS` whitelist in `serve.ts`
2. They used `server._callTool()` which doesn't exist on McpServer (SDK v1.29.0)

**Fix:**
1. Added all 4 proxy tools to `STATELESS_TOOLS` in `serve.ts`
2. Extracted fetch handler logic into `executeFetch()` function in `proxyTools.ts`
3. Both `forge_fetch` and proxy tools now call `executeFetch()` directly

**Files changed:**
- `/root/A-FORGE/src/interfaces/mcp/serve.ts` (stateless whitelist)
- `/root/A-FORGE/src/interfaces/mcp/proxyTools.ts` (executeFetch extraction)

**Verification:** `forge_fetch_url`, `forge_fetch_json`, `forge_fetch_metadata` all tested and working.
