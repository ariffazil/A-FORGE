---
type: Crack
tags: [orphaned-containers, docker-compose, disaster-recovery, portainer, eigent]
last_sync: 2026-04-09T09:00Z
confidence: 0.97
severity: HIGH
arifos_floor: F1, F8
operator: Copilot
---

# Crack: Orphaned Compose Projects

> **Finding**: Two Docker Compose project directories are **deleted**. The containers run fine now but cannot be recreated from source if they stop.

---

## Affected Projects

### `portainer-pocketbase-wireguard`
- **Source dir**: `/opt/arifos/apps/portainer-pocketbase-wireguard/` — **NOT FOUND**
- **Backup**: `raw/orphaned-containers-inspect-2026-04-09.json` ✅

| Container | Image | Data | Risk if Lost |
|-----------|-------|------|-------------|
| `apps_portainer` | `portainer/portainer-ce:2.21.4-alpine` | `/opt/arifos/data/portainer` ✅ | Low — public image |
| `apps_pocketbase` | `apps_pocketbase:local` ⚠️ LOCAL | `/opt/arifos/data/pocketbase` ✅ | HIGH — local build |
| `apps_wireguard` | `ghcr.io/wg-easy/wg-easy:14` | `/opt/arifos/data/wireguard` ✅ | HIGH — VPN config |

### `server` (Eigent)
- **Source dir**: `/srv/arifOS/arifosmcp/eigent/server/` — **NOT FOUND**
- **Backup**: `raw/orphaned-containers-inspect-2026-04-09.json` ✅

| Container | Image | Data | Risk |
|-----------|-------|------|------|
| `eigent_api` | `server-api:latest` ⚠️ LOCAL | None | HIGH — local build |
| `eigent_postgres` | `postgres:16` | `server_eigent_db_data` ✅ | CRITICAL — user data |
| `eigent_redis` | `redis:7-alpine` | `server_eigent_redis_data` ✅ | Medium — ephemeral |

**Local images are tagged** for protection: `server-api:backup-2026-04-09`, `apps_pocketbase:backup-2026-04-09`

---

## Reconstructed Compose Files

### `/root/arifOS/apps/portainer-pocketbase-wireguard/docker-compose.yml`

```yaml
services:
  portainer:
    image: portainer/portainer-ce:2.21.4-alpine
    container_name: apps_portainer
    restart: unless-stopped
    volumes:
      - /opt/arifos/data/portainer:/data
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - "127.0.0.1:9000:9000"

  pocketbase:
    image: apps_pocketbase:local
    container_name: apps_pocketbase
    restart: unless-stopped
    volumes:
      - /opt/arifos/data/pocketbase:/pb_data
    ports:
      - "127.0.0.1:8090:8090"

  wireguard:
    image: ghcr.io/wg-easy/wg-easy:14
    container_name: apps_wireguard
    restart: unless-stopped
    cap_add: [NET_ADMIN, SYS_MODULE]
    volumes:
      - /opt/arifos/data/wireguard:/etc/wireguard
    ports:
      - "51820:51820/udp"
      - "51821:51821/tcp"
```

### `/root/arifOS/apps/eigent-server/docker-compose.yml`

```yaml
services:
  api:
    image: server-api:latest
    container_name: eigent_api
    restart: unless-stopped
    ports:
      - "3001:5678"
    depends_on: [postgres, redis]

  celery_beat:
    image: server-celery_beat:latest
    container_name: eigent_celery_beat
    restart: unless-stopped

  celery_worker:
    image: server-celery_worker:latest
    container_name: eigent_celery_worker
    restart: unless-stopped

  postgres:
    image: postgres:16
    container_name: eigent_postgres
    restart: unless-stopped
    volumes:
      - eigent_db_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: eigent_redis
    restart: unless-stopped
    volumes:
      - eigent_redis_data:/data

volumes:
  eigent_db_data:
    name: server_eigent_db_data
    external: true
  eigent_redis_data:
    name: server_eigent_redis_data
    external: true
```

> ⚠️ Eigent env vars (DB passwords, API keys) must be extracted from backup before creating compose:
> ```bash
> jq '.[3].Config.Env' raw/orphaned-containers-inspect-2026-04-09.json
> ```

---

## Cross-links

- [[00_OPERATORS/Reconnect_Recovery_Runbook]] — full recovery plan with status tracker
- [[60_TEMPERATURES/Live_Status]] — container project map
