> ⚠️ **NOT CURRENT AUTHORITY** — This document is archived.
> 
> It was demoted to `INTERNAL REFERENCE` in the 2026-05-25 PHOENIX-73E cleanup.
> **Do not cite as current policy.** Current policy: `FEDERATION_STATUS.md` + `REPO_ROLE_MAP.md`.
>
> ---
> 
# Entropy Reduction Record - 2026-05-20

This is a historical cleanup record moved out of the README so the README can remain the front door.

## Commits

- `b619eb1` - Root-doc entropy cleanup (`docs/api|deployment|governance|archive` + `.AGENTS.md`)
- `7a6afba` - Code entropy cleanup
  - `as any` reduced to 0 across `src/` + `test/`
  - `/governance/evaluate` extracted to `src/routes/governanceRoutes.ts`
  - MCP resources extracted to `src/mcp/resources.ts`
- `be5cbe1` - Evicted 276 GEOX artifacts, dead code, and foreign deploy configs
- `f827cad` - Relocated arifOS/arif-sites/AAA deploy configs to canonical repos
- `d006ca1` - Final entropy sweep: removed disguised GEOX files (`legacy` = `server.py`, `stash` = `fastmcp.json`), GEOX deploy scripts, entrypoints, and data dumps
- `3196ca8` - Evicted 15 GEOX documentation files to `/root/geox/docs/`
- `2033a85` - Removed GEOX `app.json` manifest and copy-pasted GEOX `SECURITY.md`

## Result

A-FORGE was reduced from approximately 190M to 33M. A-FORGE now contains only A-FORGE plus arifOS federation concerns. GEOX lives in `/root/geox`.

## Runtime Truth Note

Historical runtime snapshots in `docs/archive/*SOT*.md` are audit-time records, not live status assertions. Use current health checks and compose state before making runtime claims.
