# MCP Frontpage Fix Receipt — 2026-07-08

## What changed
1. **Caddy** (`mcp.arif-fazil.com`): removed SPA `try_files` catch-all; proxy `/health`, `/tools`, `/llms.txt`, `/api/*`, `/.well-known/jwks.json`, `agent.json` → arifOS `:8088`.
2. **Landing** (`/var/www/html/mcp/index.html`): honest governance-door copy; live `/health` stats; A-FORGE tile; connect config; machine route links.

## Backups
- `/etc/caddy/Caddyfile.bak.20260708T190818Z` (approx timestamp)
- `/var/www/html/mcp/index.html.bak.20260708T190818Z`

## Verified (public)
| Route | Result |
|-------|--------|
| `/health` | JSON healthy, tools_exposed=12 |
| `/tools` | JSON count=12 |
| `/llms.txt` | text/plain |
| `/.well-known/jwks.json` | JSON keys |
| `/mcp` initialize | ARIFOS MCP ok |
| unknown path | 404 (not HTML 200) |

## Intentionally not claimed
Domain organs (GEOX/WEALTH/WELL/A-FORGE) keep own MCP — not collapsed into this tools/list.
