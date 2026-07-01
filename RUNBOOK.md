# RUNBOOK.md — A-FORGE (Execution Shell)

> **Organ:** A-FORGE | **API Port:** 7071 | **MCP Port:** 7072 | **stdio:** via `npm run mcp:stdio`
> **Last Updated:** 2026-07-01

## Start / Stop
```bash
systemctl start a-forge
systemctl stop a-forge
systemctl restart a-forge
systemctl status a-forge
```

## Health Check
```bash
curl -s http://127.0.0.1:7071/health | python3 -m json.tool
curl -s http://127.0.0.1:7072/health | python3 -m json.tool
```

## MCP Transports

A-FORGE exposes three MCP surfaces. Choose the right one for the client:

| Surface | Command / URL | Port | Sessions | Use Case |
|---------|--------------|------|----------|----------|
| **stdio** | `npm run mcp:stdio` | n/a | One per process | **Preferred for IDE/agent clients** (Kimi Code CLI, Claude Code, etc.) |
| **Dedicated MCP HTTP** | `http://127.0.0.1:7072/mcp` | 7072 | Single streamable-http session | `a-forge-mcp.service`; OK for one-shot probes |
| **API bridge MCP** | `http://127.0.0.1:7071/mcp` | 7071 | Single streamable-http session | Main A-FORGE API (`a-forge.service`); same singleton limitation |

**Important:** Both HTTP surfaces use a single shared `McpServer` instance. A second streamable-http client that sends `initialize` will receive `Server already initialized`. For multi-client or agent use, route through **stdio**.

### stdio Terminal Requirement
`npm run mcp:stdio` does not need an interactive terminal or PTY. It uses MCP JSON-RPC over plain stdin/stdout pipes via `StdioServerTransport`.

- Use a spawned child process with piped stdin/stdout.
- A TTY is optional and not required for MCP correctness.
- Do not expect readline prompts or terminal UI on this surface.
- Send human logs to stderr only; stdout must stay MCP-clean.

### Restart MCP service
```bash
systemctl restart a-forge-mcp.service
journalctl -u a-forge-mcp.service -n 50 --no-pager
```

### Quick MCP probe
```bash
cd /root/A-FORGE
node -e "import('@modelcontextprotocol/sdk/client/index.js').then(({Client})=>import('@modelcontextprotocol/sdk/client/streamableHttp.js').then(({StreamableHTTPClientTransport})=>{const c=new Client({name:'probe',version:'1'});const t=new StreamableHTTPClientTransport(new URL('http://127.0.0.1:7072/mcp'));c.connect(t).then(()=>c.listTools()).then(r=>console.log(r.tools.length,'tools')).finally(()=>c.close());}))"
```

## Build & Test
```bash
cd /root/A-FORGE
npm install
npm run build
make test            # security-audit + build + 48 test files
```

## Logs
```bash
journalctl -u a-forge -n 50 --no-pager
```

## Common Failure Modes
| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 888_HOLD on execution | No JUDGE_SEAL_AUTHORIZATION from arifOS | Run through arif_judge_deliberate first |
| /health unreachable | Service crashed | `systemctl restart a-forge` |
| `Server already initialized` on second HTTP client | Streamable-http singleton limitation | Use stdio transport, or restart `a-forge-mcp.service` for a fresh session |
| 7072 returns 500 on `initialize` | `serve.ts` not connected to `McpServer` | Ensure `server.connect(transport)` is present and service is rebuilt/restarted |
| Build fails | Node modules stale | `rm -rf node_modules && npm install` |

## What NOT to Do
- Do NOT execute without JUDGE_SEAL_AUTHORIZATION from arifOS
- Do NOT import NumPy/Pandas/SciPy (domain logic lives in Python organs)
- Do NOT self-authorize or issue constitutional verdicts
