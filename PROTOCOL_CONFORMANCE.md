# PROTOCOL_CONFORMANCE.md — A-FORGE Execution Shell

> Layer: L2 · Role: Execution shell — build, deploy, test, mutation engine · Repo: ariffazil/A-FORGE

## MCP Conformance
| Requirement | Status | Evidence |
|------------|--------|----------|
| llms.txt | ✅ | `/root/A-FORGE/llms.txt` — execution shell summary, architecture, build commands |
| tools/list | ✅ | `:7072` — 52 stateless MCP tools (forge_* namespace), streamable-http transport |
| health endpoint | ✅ | `:7071/health` (Express sense) and `:7072/health` (MCP gateway) |
| MCP protocol | ✅ | MCP streamable-http with session support on :7072 |
| Canonical tool surface | ✅ | 52 stateless tools — full forge_* namespace including forge_shell, forge_filesystem, forge_git, forge_docker, forge_browser, etc. |

## FastMCP Conformance
| Requirement | Status | Evidence |
|------------|--------|----------|
| FastMCP server | ❌ | Not applicable — TypeScript/Node 22+ Express server, not Python FastMCP |
| Resource discovery | ⚠️ | Limited — A-FORGE uses traditional HTTP endpoints for resource access, not MCP resources/list |

## A2A Conformance
| Requirement | Status | Evidence |
|------------|--------|----------|
| Agent card | ✅ | `/.well-known/agent-card.json` — full schema with capabilities, transport, securitySchemes |
| Task schema | ✅ | `POST /tasks` — A2A task submission endpoint |
| Streaming | ⚠️ | No explicit SSE support. A2A tasks are synchronous/poll-based |
| MCP server identity | ✅ | `/.well-known/mcp/server.json` and `/.well-known/agent.json` |

## XMCP Conformance
| Requirement | Status | Evidence |
|------------|--------|----------|
| App schema | ❌ | No webmcp.json — A-FORGE is an execution shell, not an app host |
| Resource schema | ❌ | No MCP resources/list — tools are the primary interface |
| MCP server discovery | ✅ | `/.well-known/mcp/server.json` |

## Gaps
| Gap | Priority | Detail |
|-----|----------|--------|
| FastMCP | — | Not applicable — TypeScript organ |
| XMCP App schema | P3 | Not needed for L2 execution shell role |
| A2A Streaming | P2 | Poll-based A2A tasks; SSE would improve latency for long-running forge operations |
| MCP Resource discovery | P2 | Limited MCP resource surface; tools dominate |

## Required Compliance
- L2 Protocol: MCP (mandatory) + A2A (agent card + task schema mandatory) + FastMCP (not applicable)
- A-FORGE is the execution arm — protocol priority is MCP tools reliability > A2A > XMCP
- 52 stateless tools, all operational
- Next milestone: Add SSE streaming for A2A forge tasks (P2)

---
Generated: 2026-07-19 · Authority: AAA Control Plane
DITEMPA BUKAN DIBERI
