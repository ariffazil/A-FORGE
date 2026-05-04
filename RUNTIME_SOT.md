# A-FORGE Runtime SOT

> Audited against the live VPS on **2026-05-04**.

## Canonical runtime owner

The authoritative runtime for the A-FORGE bridge on this VPS is:

- **Repo:** `/root/A-FORGE`
- **Compose file:** `/root/A-FORGE/docker-compose.yml`
- **Container:** `af-bridge-prod`
- **Image:** `a-forge-af-bridge`
- **Network:** `arifos_core_network`

`/root/compose/docker-compose.yml` is the federation stack for shared services. It is **not** the source of truth for the A-FORGE bridge container in the current live topology.

## Live bridge surface

| Field | Value |
|---|---|
| Bind address | `127.0.0.1:7071` |
| Health | `GET /health` returns `ok: true`, `status: healthy`, `version: 0.1.0` |
| Start mode | Docker Compose, restart `unless-stopped` |
| External exposure | Expected to stay local-only behind Caddy or another reverse proxy |

## Governance and data-plane contract

| Contract | Live value |
|---|---|
| `ARIFOS_GOVERNANCE_URL` | `http://arifosmcp:8080` |
| `POSTGRES_URL` | `postgres:5432/vault999` |
| `REDIS_URL` | `redis:6379` |
| `QDRANT_URL` | `http://qdrant:6333` |
| `OLLAMA_BASE_URL` | `http://ollama:11434` |

This means the bridge is wired into the same internal federation network as arifOS and the shared data plane, without needing public bounce URLs.

## Current operational note

At audit time, the A-FORGE repo working tree was **dirty**:

- modified: `src/server.ts`
- untracked: `SKILLS.md`
- untracked: `src/reply/`

Treat the running bridge as a **live dev runtime**, not a sealed canonical release, until the working tree is reviewed and committed or explicitly discarded.

## Rule for future audits

If the runtime owner changes, update all three together in one commit:

1. `/root/A-FORGE/docker-compose.yml`
2. this file
3. the **Runtime Source of Truth** section in `README.md`
