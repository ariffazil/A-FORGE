# A-FORGE — Entry Point
**Status:** OPERATIONAL | **Organ:** FORGE (A) | **Authority:** arifOS

## Quick Start
```bash
# Install
npm install

# Build (outputs: dist/server.js)
npm run build

# Run tests
make test

# Docker deploy
docker compose -f deploy/arifOS/docker-compose.yml up -d
```

## Critical Files
| File | Purpose |
|------|---------|
| `src/server.ts` | MCP server |
| `src/cli.ts` | CLI entry |
| `deploy/` | All infrastructure configs |
| `.mcp.json` | Tool server manifest |

## Directory Map
```
A-FORGE/
├── src/            # Source code
│   ├── server.ts   # MCP server
│   ├── cli.ts      # CLI
│   ├── engine/     # AgentEngine, BudgetManager
│   ├── tools/      # Tool registry
│   └── ops/        # Thermodynamic cost
├── deploy/          # Docker, Caddy, monitoring
├── docs/            # Documentation
└── ...
```

## Federation
```
AAA (Body) ←→ arifOS (Kernel) ←→ A-FORGE (Forge - this)
```

## Build Commands
| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run build` | TypeScript → dist/ |
| `make test` | Run test suite |
| `make clean` | Clean build artifacts |

See `.AGENTS.md` for full agent onboarding context.
**999 SEAL ALIVE**