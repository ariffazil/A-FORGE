# MCP Transport Topology — arifOS Federation

> **DITEMPA BUKAN DIBERI**
> **Last updated:** 2026-06-28
> **Canonical:** This file is the single source of truth for transport architecture.

---

## 1. FEDERATION TRANSPORT MAP

```
                          ┌──────────────────────────┐
                          │      Caddy v2.11.4        │
                          │   arif-fazil.com (edge)   │
                          │   Cloudflare TLS + HSTS   │
                          └──────┬───────┬──────┬────┘
                                 │       │      │
          ┌──────────────────────┼───────┼──────┼──────────────────┐
          │                      │       │      │                  │
          ▼                      ▼       ▼      ▼                  ▼
   ┌──────────┐          ┌────────┐ ┌──────┐ ┌──────┐     ┌──────────┐
   │  arifOS  │          │  GEOX  │ │WEALTH│ │ WELL │     │ A-FORGE  │
   │  :8088   │          │ :8081  │ │:18082│ │:18083│     │  :7072   │
   │ FastMCP  │          │FastMCP │ │FastMC│ │FastMC│     │ Node SDK │
   │ Python   │          │ Python │ │Python│ │Python│     │ TS       │
   └────┬─────┘          └────────┘ └──────┘ └──────┘     └────┬─────┘
        │                                                      │
        │              ┌───────────┐        ┌───────────┐      │
        ├──────────────► MIND MCP  │        │ MEMORY MC │◄─────┤
        │              │  :51001   │        │  :51002   │      │
        │              │ (Python)  │        │ (Python)  │      │
        │              └───────────┘        └───────────┘      │
        │              ┌───────────┐        ┌───────────┐      │
        ├──────────────►minimax-med│        │minimax-cod│◄─────┤
        │              │  :18090   │        │  :18091   │      │
        │              └───────────┘        └───────────┘      │
        │                                                      │
        ▼                                                      ▼
┌──────────────────┐                                ┌──────────────────┐
│  VAULT999 API    │                                │  PLAYWRIGHT MCP  │
│  :5001           │                                │  :8931           │
│  (Python HTTP)   │                                │  (Browser)       │
└──────────────────┘                                └──────────────────┘
```

## 2. TRANSPORT TYPE PER ORGAN

| Organ | Port | Transport | Framework | Session Mgmt | Middleware Stack |
|-------|------|-----------|-----------|-------------|-----------------|
| **arifOS** | 8088 | Streamable HTTP | FastMCP 3.x (Python) | SDK-managed | OriginValidation → MCPSessionBridge → MCPProtocolVersion → CORS → GovernancePipeline → Airlock → GlobalPanic |
| **GEOX** | 8081 | Streamable HTTP | FastMCP (Python) | SDK-managed | OriginValidation → CORS |
| **WEALTH** | 18082 | Streamable HTTP | FastMCP (Python) | SDK-managed | Minimal (no Origin/MCP-Version validation) |
| **WELL** | 18083 | Streamable HTTP | FastMCP (Python) | SDK-managed | OriginValidation |
| **A-FORGE MCP** | 7072 | Streamable HTTP + stdio | Node.js SDK 1.29.0 | sessionIdGenerator (UUID) | CORS only (handled in serve.ts) |
| **AAA A2A** | 3001 | Express HTTP | Node.js/Express | N/A (A2A protocol) | Standard Express |
| **MIND** | 51001 | stdio | FastMCP (Python) | N/A (stdio) | None |
| **MEMORY** | 51002 | stdio | FastMCP (Python) | N/A (stdio) | None |
| **minimax-media** | 18090 | Streamable HTTP | FastMCP (Python) | SDK-managed | None |
| **minimax-code** | 18091 | Streamable HTTP | FastMCP (Python) | SDK-managed | None |

## 3. PUBLIC ENDPOINTS (via Caddy)

| Subdomain | Backend | Port | MCP Path | Notes |
|-----------|---------|------|----------|-------|
| arifos.arif-fazil.com | arifOS | 8088 | /mcp | Canonical kernel. Accept header rewriting. |
| geox.arif-fazil.com | GEOX | 8081 | /mcp | Host header override set |
| wealth.arif-fazil.com | WEALTH | 18082 | /mcp | No Host header override |
| well.arif-fazil.com | WELL | 18083 | /mcp | No Host header override |
| forge.arif-fazil.com | A-FORGE API | 7071 | N/A | HTTP API (not MCP) |
| mcp.arif-fazil.com | arifOS | 8088 | /mcp | Legacy alias |
| aaa.arif-fazil.com | AAA | 3001 | /a2a | A2A protocol (not MCP) |

## 4. INTERNAL CLIENTS & TRANSPORT

| Client | Organs Connected | Transport Type | Config Location |
|--------|-----------------|---------------|-----------------|
| Claude Code | arifOS, GEOX, WEALTH, WELL, A-FORGE | Streamable HTTP | `/root/.claude/settings.json` |
| OpenCode | All 5 MCP + 10+ stdio servers | Streamable HTTP + stdio | `/root/.config/opencode/opencode.json` |
| GitHub Copilot | All 5 MCP + 8 others | Streamable HTTP + stdio | `/root/.copilot/mcp-config.json` |
| Grok Build | arifOS, GEOX, WEALTH, memory, repo | Python FastMCP (stdio) | `/root/A-FORGE/services/grok-build-mcp/` |
| Hermes (Telegram) | arifOS via A2A bridge | A2A (JSON-RPC) | `/root/.hermes/config.yaml` |

## 5. PROTOCOL VERSIONS

| Version | Organs | Status |
|---------|--------|--------|
| **2025-11-25** (canonical) | ALL | Active — preferred for all new clients |
| 2025-03-26 | arifOS (backward compat) | Accepted but deprecated |
| 2024-11-05 | arifOS transport bridge only | Legacy — accepted at middleware level |

## 6. SECURITY MIDDLEWARE COVERAGE

| Middleware | arifOS | GEOX | WEALTH | WELL | A-FORGE |
|-----------|--------|------|--------|------|---------|
| **OriginValidation** (DNS rebinding) | ✅ | ✅ | ❌ | ✅ | ❌ |
| **MCPProtocolVersion** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **MCPSessionBridge** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **GovernancePipeline** (F1-F13) | ✅ | ✅ (partial) | ❌ | ❌ | ✅ (FloorEnforcer) |
| **CORS** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Rate Limiting** | ❌ | ❌ | ❌ | ❌ | ❌ |

## 7. CHANGE LOG

| Date | Change | Author |
|------|--------|--------|
| 2026-06-28 | Initial topology document. Fixed PEER_SOVEREIGNS metadata (GEOX port, protocol versions). Added MCP-Protocol-Version header to A-FORGE. Fixed fault_codes.py bogus version. Removed bearer token from mcporter configs. | FORGE audit |
