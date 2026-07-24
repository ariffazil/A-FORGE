# AGENTS.md — A-FORGE | arifOS Federation

> **A-FORGE is the hands. The hands never adjudicate.**
> `arif_judge` says GO → `forge_lease` → execute → `arif_seal` closes. No link skipped.

## Identity

Execution shell. Builds, deploys, runs code under constitutional lease. Ports: 7071 (Express API), 7072 (MCP gateway). stdio: `npm run mcp:stdio`.

## Build & Test

```bash
npm install
npm run build    # tsc
npm test         # Node --test
make test        # security-audit + build + all suites
systemctl restart a-forge      # deploy API
systemctl restart a-forge-mcp  # deploy MCP
curl :7071/health
```

## Boundary

| ✅ Routes intent → arifOS / GEOX / WEALTH / WELL |
|---|---|
| ✅ Forges under lease |
| ❌ Never geoscience (GEOX owns it) |
| ❌ Never economics (WEALTH owns it) |
| ❌ Never verdicts (arifOS owns it) |
| ❌ Never self-authorizes |

One line: if it changes the world, lease must exist first.
