# arifOS Infrastructure Runtime Capture
**Captured:** 2026-04-26T05:15:00Z  
**Authority:** 888_APEX → 999_SEAL  
**Repo:** A-FORGE is the canonical infra/shell/orchestration repo.

## Mirrored Live Paths

| File in A-FORGE | Mirrors Live Path | Purpose |
|-----------------|-------------------|---------|
| `infra/caddy/Caddyfile` | `/etc/arifos/compose/Caddyfile` | Live reverse proxy config serving all arif-fazil.com domains |
| `infra/compose/docker-compose.yml` | `/etc/arifos/compose/docker-compose.yml` | Live federation stack (15 containers) |
| `infra/compose/docker-compose.override.yml` | `/etc/arifos/compose/docker-compose.override.yml` | Local override layer |
| `infra/runtime/RELEASE_DRIFT.md` | (carried from `/root/arifos-infra`) | Version drift evidence across layers |

## Note on Temporary Evidence Cache

`/root/arifos-infra/` was created by a previous agent as a temporary infra mirror.
This A-FORGE `infra/` subtree is the **canonical capture** of live state.
Any validated content from `arifos-infra` has been reviewed and carried over.

## Capture Checklist

- [x] Caddyfile validated (`caddy validate` passes)
- [x] docker-compose.yml syntactically valid
- [x] All 9 constellation domains return 200
- [x] GEOX root correctly mapped to `/var/www/html/geox`
- [x] WEALTH `/sse*` proxied to organ; no dangling `/mcp*` route
- [x] AAA static files + A2A API separation correct
- [x] MCP static files + API proxy separation correct

## Next Steps (Human Decision)

1. Review this capture in A-FORGE
2. Push to `https://github.com/ariffazil/A-FORGE.git`
3. After push, `/root/arifos-infra` can be archived/removed
