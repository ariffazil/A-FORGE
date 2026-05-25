> ⚠️ **NOT CURRENT AUTHORITY** — This document is archived.
> 
> It was demoted to `INTERNAL REFERENCE` in the 2026-05-25 PHOENIX-73E cleanup.
> **Do not cite as current policy.** Current policy: `FEDERATION_STATUS.md` + `REPO_ROLE_MAP.md`.
>
> ---
> 
# A-FORGE Runtime SOT (Archived Snapshot)

> ⚠️ Historical snapshot captured on 2026-05-11.  
> Do not treat this file as live runtime truth.  
> Current canonical SOT: `docs/SOT_2026-05-20_CANONICAL.md`.

> Audited against the live VPS on **2026-05-11**.

## Canonical runtime owner

The authoritative bridge definition for A-FORGE on this VPS remains:

- **Repo:** `/root/A-FORGE`
- **Compose file:** `/root/A-FORGE/docker-compose.yml`
- **Expected container:** `af-bridge-prod`
- **Configured image:** `ghcr.io/ariffazil/a-forge:3159d22`
- **Network:** `arifos_core_network`

`/root/compose/docker-compose.yml` is the federation stack for shared services. It is **not** the source of truth for the A-FORGE bridge container in the current live topology.

## Live bridge surface

| Field | Value |
|---|---|
| Bind address | `127.0.0.1:7071` |
| Health | `GET /health` currently **unreachable** on `127.0.0.1:7071` |
| Start mode | Docker Compose, restart `unless-stopped` |
| External exposure | Expected to stay local-only behind Caddy or another reverse proxy |
| Live container state | `af-bridge-prod` is **not present/running** at audit time |
| Related live container | `forge-notifier` is running and healthy |

## Governance and data-plane contract

| Contract | Live value |
|---|---|
| `ARIFOS_GOVERNANCE_URL` | `http://arifosmcp:8080` |
| `POSTGRES_URL` | `postgres:5432/vault999` |
| `REDIS_URL` | `redis:6379` |
| `QDRANT_URL` | `http://qdrant:6333` |
| `OLLAMA_BASE_URL` | `http://ollama:11434` |

This means the bridge is configured to use the same internal federation network as arifOS and the shared data plane, without needing public bounce URLs.

## Current operational note

At the 2026-05-11 audit:

- the compose definition is present and still canonical,
- the bridge container is **not** running,
- and any doc claiming a healthy local `7071` bridge is stale until `af-bridge-prod` is recreated and `/health` answers again.

## Rule for future audits

If the runtime owner changes, update all three together in one commit:

1. `/root/A-FORGE/docker-compose.yml`
2. this file
3. the **Runtime Source of Truth** section in `README.md`
