# Fetch MCP Server — Federation Forge

**Date:** 2026-07-07  
**Official source:** https://github.com/modelcontextprotocol/servers/tree/main/src/fetch  
**Status:** FORGED — installed, upgraded forge_fetch, verified

---

## What was done

### 1. Installed official mcp-server-fetch (Python)
```
uv tool install mcp-server-fetch
→ /root/.local/bin/mcp-server-fetch
```
Supports: --user-agent, --ignore-robots-txt, --proxy-url

### 2. Upgraded forge_fetch (proxyTools.ts)

| Feature | Before (regex) | After (Readability) |
|---------|---------------|-------------------|
| Article extraction | Basic tag stripping | **Mozilla Readability** (`@mozilla/readability`) |
| HTML→markdown | None (tag strip only) | `htmlToMarkdown()` — headings, links, bold, code, lists |
| `start_index` | Not supported | Supported for chunked reading |
| `disable_readability` | Not supported | Supported for fallback |
| Imports | None | `jsdom`, `@mozilla/readability` |

### 3. forge_fetch tool signature (updated)

```
forge_fetch(url, mode, max_chars?, start_index?, disable_readability?, timeout_ms?)
  mode: "html" | "markdown" | "text" | "json" | "readable" (default: readable)
  start_index: number = 0 (chunked reading)
  disable_readability: boolean = false (force basic extraction)
```

### 4. Dual availability

The official `mcp-server-fetch` is also available as a standalone stdio MCP server:
```
mcp-server-fetch --user-agent "A-FORGE/1.0" --ignore-robots-txt
```

---

## Architecture

```
Agent/Tool call
    ↓
forge_fetch (A-FORGE tool, TypeScript)
    ├── mode=readable  → Mozilla Readability + htmlToMarkdown()
    ├── mode=markdown  → htmlToMarkdown()
    ├── mode=text      → basic tag strip
    ├── mode=html      → raw HTML
    ├── mode=json      → JSON parse
    └── disable_readability → basic tag strip (fallback)
```

Separately, `mcp-server-fetch` available as standalone server if needed.

---

## MCP spec compliance

| Official fetch feature | forge_fetch |
|----------------------|-------------|
| `url` (required) | ✅ |
| `max_length` (default 5000) | ✅ `max_chars` (default 50000 — larger for federation use) |
| `start_index` (default 0) | ✅ NEW |
| `raw` mode (skip markdown) | ✅ `mode: "html"` |
| `robots.txt` compliance | ⚠️ Not enforced by default (add --ignore-robots-txt) |
| Proxy support | ⚠️ Not configured (can add --proxy-url) |
| Readability extraction | ✅ NEW — Mozilla Readability |
| Proper HTML→markdown | ✅ NEW — heading/link/code/list conversion |

---

**DITEMPA BUKAN DIBERI — The fetch is forged, not given.**
