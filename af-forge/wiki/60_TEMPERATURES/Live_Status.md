---
type: Temperature
tags: [live-status, containers, machine-health, compose-map, intelligence-state]
sources: [docker-ps-2026-04-09, docker-compose-audit-2026-04-09, arifosmcp-health-2026-04-09]
last_sync: 2026-04-09T09:00Z
confidence: 0.97
epistemic_level: OBS
arifos_floor: F2, F11
operator: Copilot
status: active
---

# Live Machine Status — af-forge

> **Snapshot**: 2026-04-09 09:00 UTC (Rev 2 — Compose Map + Intelligence Audit)
> **Hostname**: af-forge | **RAM**: 3.6/15Gi (24%) | **Disk**: 139/193G (72%) | **Uptime**: ~1d 14h

---

## Container → Compose Project Map

### Project: `arifos`
**Source**: `/root/arifOS/docker-compose.yml` + `docker-compose.trinity.yml`
**Network**: `arifos_core_network` | **Status**: ✅ Compose-managed

| Container | Status | Port(s) | Role |
|-----------|--------|---------|------|
| `traefik` | ✅ up | 80, 443 | Edge router / TLS |
| `postgres` | ✅ healthy | 5432 (internal) | Primary database |
| `redis` | ✅ healthy | 6379 (internal) | Cache / pub-sub |
| `qdrant` | ✅ healthy | 6333-6334 (internal) | Vector memory |
| `arifos_landings` | ✅ up | 80 (internal) | Landing page |
| `arifos_webhook` | ✅ up | 9000 (internal) | Webhook receiver |
| `dozzle` | ✅ up | 8082→8080 | Log viewer |
| `uptime_kuma` | ✅ healthy | 3002→3001 | Endpoint health monitor |

---

### Project: `geox`
**Source**: `/root/GEOX/docker-compose.yml` | **Status**: ✅ Compose-managed

| Container | Status | Port(s) | Role |
|-----------|--------|---------|------|
| `geox_server` | ✅ up | 8000→8000 | GEOX MCP server |
| `geox_gui` | ✅ up | 80 (Traefik) | GEOX React frontend |

---

### Project: `portainer-pocketbase-wireguard`
**Source**: `/opt/arifos/apps/portainer-pocketbase-wireguard/` — **⚠️ DIRECTORY DELETED**
**Status**: ⚠️ ORPHANED — cannot recreate if containers die

| Container | Image | Data | Role |
|-----------|-------|------|------|
| `apps_portainer` | `portainer/portainer-ce:2.21.4-alpine` | `/opt/arifos/data/portainer` (bind) ✅ | Docker UI |
| `apps_wireguard` | `ghcr.io/wg-easy/wg-easy:14` | `/opt/arifos/data/wireguard` (bind) ✅ | VPN gateway |
| `apps_pocketbase` | `apps_pocketbase:local` (**local build**) | `/opt/arifos/data/pocketbase` (bind) ✅ | PocketBase backend |

---

### Project: `server` (Eigent)
**Source**: `/srv/arifOS/arifosmcp/eigent/server/` — **⚠️ DIRECTORY DELETED**
**Status**: ⚠️ ORPHANED

| Container | Image | Role |
|-----------|-------|------|
| `eigent_api` | `server-api:latest` (**local build**) | FastAPI server |
| `eigent_celery_beat` | `server-celery_beat:latest` (**local build**) | Task scheduler |
| `eigent_celery_worker` | `server-celery_worker:latest` (**local build**) | Celery worker |
| `eigent_postgres` | `postgres:16` | Eigent DB (volume: `server_eigent_db_data` ✅) |
| `eigent_redis` | `redis:7-alpine` | Cache (volume: `server_eigent_redis_data` ✅) |

---

### STANDALONE (not in any Compose project)

| Container | Network | Port(s) | Root Cause |
|-----------|---------|---------|-----------|
| `arifosmcp` | `arifos_core_network` | 8080 | Started via `docker run`, not compose |
| `ollama` | `arifos_core_network` + bridge | 11434 (localhost) | Started via `docker run` |

> Both defined in `/root/arifOS/docker-compose.yml` but never started via `docker compose up`. They miss env vars that compose would inject.

### NATIVE (systemd)

| Service | Version | Port | Status |
|---------|---------|------|--------|
| `openclaw-gateway` | 2026.4.8 | 18789 | ✅ active since 04:45 UTC |

**Total**: 20 Docker containers + 1 native service

---

## Intelligence State — arifOS MCP `/health`

```
verdict: SEAL (confidence: 0.88) | tools_loaded: 12
```

| Capability | State | Fix |
|------------|-------|-----|
| `vault_postgres` | ✅ configured | — |
| `vector_memory` | ⚠️ **degraded** | QDRANT_URL not in container env |
| `session_cache` | ❌ not_configured | REDIS_URL not in container env |
| `local_model_runtime` | ❌ disabled | OLLAMA_URL not in container env |

> Compose file HAS correct URLs. Running container was started standalone without them.
> Fix: `cd /root/arifOS && docker compose up -d arifosmcp` (5s downtime, needs Arif approval)

---

## Naming Drift

| Running As | Canonical | Action |
|-----------|-----------|--------|
| `arifosmcp` | `mcp` | Rename on next redeploy |
| `arifos_landings` | `landing` | Rename on next redeploy |
| `uptime_kuma` | `uptime` | Rename on next redeploy |
| `apps_portainer` | `portainer` | Rename on next redeploy |
| `apps_wireguard` | `wireguard` | Rename on next redeploy |
| `apps_pocketbase` | `pocketbase` | Rename on next redeploy |

---

## Defined But Not Running

| Service | Status | Note |
|---------|--------|------|
| `openclaw` (Docker) | 🔵 Intentional | Superseded by native systemd v2026.4.8 |
| `model_registry` | ❌ Not started | Port 18792 |
| `arifos_prometheus` | ❌ Not started | Data exists at `/opt/arifos/data/prometheus/` |
| `arifos_grafana` | ❌ Not started | Data exists at `/opt/arifos/data/grafana/` |
| `arifos_n8n` | ❌ Not started | Data exists at `/opt/arifos/data/n8n/` |
| `headless_browser` | ❌ Not started | Browserless provider configured in MCP |
| `civ08_code_server` | ❌ Not started | — |

---

## Cross-links

- [[50_CRACKS/Intelligence_Gaps]] — MCP degraded capabilities
- [[50_CRACKS/Orphaned_Compose_Projects]] — orphaned project recovery
- [[50_CRACKS/Naming_Divergence]] — container name drift
- [[00_OPERATORS/Reconnect_Recovery_Runbook]] — 3-tier action plan
- [[20_BLUEPRINTS/Stack_Components]] — topology diagram
