> ⚠️ **NOT CURRENT AUTHORITY** — This document is archived.
> 
> It was demoted to `INTERNAL REFERENCE` in the 2026-05-25 PHOENIX-73E cleanup.
> **Do not cite as current policy.** Current policy: `FEDERATION_STATUS.md` + `REPO_ROLE_MAP.md`.
>
> ---
> 
# A-FORGE / GEOX Relationship

## Status: DEVELOPMENT FORK
This directory (`/root/A-FORGE/arifos/geox`) is a **functional fork** of the canonical GEOX repository (`/root/geox`).

### Role
- **Canonical GEOX**: Truth source for geoscience logic, petrophysics, and subsurface evidence.
- **A-FORGE GEOX**: Experimental sandbox for testing MCP execution, petrophysical rendering patches, and hardened dispatch.

### Synchronization
- **DO NOT** push changes from A-FORGE directly to the GEOX main repo without validation.
- Use `scripts/sync_from_canonical_geox.sh` to pull updates from `/root/geox`.
- A-FORGE is the "execution staging ground"; GEOX is the "mind".

### Invariants
1. All schema changes must originate in `arifOS/abi` or `geox/contracts`.
2. A-FORGE divergence should be minimized to petrophysical rendering logic only.
