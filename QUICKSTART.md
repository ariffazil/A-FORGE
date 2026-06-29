# A-FORGE Quickstart — 15 Minutes to Running Locally

> **A-FORGE** is the execution organ of the arifOS federation. It builds, deploys, and runs approved plans — but only after the constitutional kernel (arifOS) has issued a JUDGE_SEAL_AUTHORIZATION verdict. Without that verdict, the forge stays locked. It is the hands of the federation: capable, precise, and constitutionally bound.

---

## What You'll Have

A running Express server on `http://localhost:7071` — an execution shell that routes to MCP organs and enforces the forge gate.

## Prerequisites

- Node.js 22+
- npm

## Quickstart

```bash
# 1. Clone
git clone https://github.com/ariffazil/A-FORGE.git
cd A-FORGE

# 2. Install dependencies
npm install

# 3. Build TypeScript
npm run build

# 4. Start the server
node dist/src/server.js
```

**That's it.** The server starts on `http://localhost:7071`.

## Verify

```bash
# Health check
curl http://localhost:7071/health | python3 -m json.tool

# Expected: {"ok": true, "service": "A-FORGE", "version": "2026.06.06"}

# Federation probe (pings all connected organs)
curl http://localhost:7071/api/federation-probe | python3 -m json.tool

# MCP tools available through the bridge
curl -s http://localhost:7071/tools | python3 -m json.tool | head -20
```

## Standalone Mode

A-FORGE can run as a standalone execution shell without the other federation organs:

```bash
# Start with stdio MCP (usable by Claude Code, Continue, etc.)
npm run mcp:stdio

# Or start as HTTP MCP server
npm run mcp:http
```

`mcp:stdio` is pipe-based, not terminal-driven. Launch it as a child process with stdin/stdout attached; no PTY is required.

## What A-FORGE Does (And Doesn't Do)

| ✅ Does | ❌ Does NOT |
|---------|------------|
| Routes intent to MCP organs | Perform geoscience computation (GEOX only) |
| Runs builds and deployments | Run economic evaluation (WEALTH only) |
| Executes approved plans | Issue constitutional verdicts (arifOS only) |
| Handles orchestration and retries | Import NumPy, Pandas, or SciPy |
| Enforces forge gate before execution | Self-authorize execution |

## Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness check |
| `GET /api/federation-probe` | Ping all connected organs |
| `POST /forge` | Submit execution plan (requires JUDGE_SEAL_AUTHORIZATION) |
| `GET /tools` | List available tools through MCP bridge |

## Running Tests

```bash
npm run build && npm test
# Runs: AgentEngine, PlanValidator, ParallelPlannerContract, and more
```

## Common Issues

- **TypeScript build fails** → Make sure `npm install` completed without errors
- **Port 7071 in use** → Set `PORT=7072` before starting
- **Federation probe shows all organs down** → Expected in standalone mode. Start arifOS, WEALTH, GEOX, and WELL to see a full federation.

## Next Steps

- Read the [arifOS Constitution](https://github.com/ariffazil/arifos/blob/main/docs/CONSTITUTION.md)
- Set up [GEOX](https://github.com/ariffazil/geox) for Earth intelligence
- Set up [WEALTH](https://github.com/ariffazil/wealth) for capital intelligence
- Set up [WELL](https://github.com/ariffazil/well) for human readiness
- Read the [Glossary](https://github.com/ariffazil/arifos/blob/main/docs/GLOSSARY.md)

---

**DITEMPA BUKAN DIBERI — Forged, Not Given.**
