---
type: Runbook
tags: [runbook, 888-hold, disaster-recovery, arifosmcp, reconnect, orphaned]
last_sync: 2026-04-09T09:00Z
confidence: 0.97
arifos_floor: F1, F8, F13
operator: Copilot
status: active
---

# Runbook: Reconnect & Recovery — 2026-04-09

> **Backups done** ✅ | **Tier 1 complete** ✅ | **Tier 2 awaiting Arif approval** 🔒

---

## Tier 1 — SAFE (no approval, no downtime) ✅ COMPLETE

| Step | Command | Status |
|------|---------|--------|
| 1.1 Backup orphaned containers | `docker inspect apps_portainer apps_pocketbase apps_wireguard eigent_* > raw/orphaned-containers-inspect-2026-04-09.json` | ✅ Done (96KB) |
| 1.2 Snapshot arifosmcp | `docker inspect arifosmcp > raw/arifosmcp-before-reconnect-2026-04-09.json` | ✅ Done |
| 1.3 Tag local images | `docker tag server-api:latest server-api:backup-2026-04-09` (x4 images) | ✅ Done |
| 1.4 Verify data volumes | `ls /opt/arifos/data/{portainer,pocketbase,wireguard}` | ✅ All safe |

**Preflight findings** (confirming Tier 2 is safe):
- Image: `arifos/arifosmcp:latest` sha256:85cfc77e — same in compose and running ✅
- `.env` file present at `/root/arifOS/.env` ✅
- Compose has `OLLAMA_URL`, `QDRANT_URL`, `REDIS_URL` correctly set ✅
- Running container has NONE of those env vars (confirms the gap) ✅
- No config drift — reconnect will inject env vars and otherwise keep same image ✅

---

## Tier 2 — 888_HOLD (awaiting Arif: `yes` to proceed)

### Action: Reconnect arifosmcp to Qdrant + Redis + Ollama

**Expected**: 5 seconds downtime. OpenClaw/agents lose MCP connection briefly, then auto-reconnect.
**Expected outcome**: `vector_memory`, `session_cache`, `local_model_runtime` all go green.

```bash
cd /root/arifOS

# Execute reconnect
docker compose up -d arifosmcp

# Verify (wait 5s for startup)
sleep 5 && curl -s http://localhost:8080/health | jq '{
  verdict: .thermodynamic.verdict,
  confidence: .thermodynamic.confidence,
  vector_memory: .capability_map.capabilities.vector_memory,
  session_cache: .capability_map.storage.session_cache,
  local_model: .capability_map.capabilities.local_model_runtime
}'
```

**Rollback if needed**:
```bash
docker compose stop arifosmcp
docker run -d --name arifosmcp --network arifos_core_network \
  -p 127.0.0.1:8080:8080 --restart unless-stopped \
  arifos/arifosmcp:latest
```

---

## Tier 3 — DISASTER RECOVERY

Use only if orphaned containers have died.

### Restore portainer-pocketbase-wireguard
```bash
mkdir -p /root/arifOS/apps/portainer-pocketbase-wireguard
# Copy compose from wiki/50_CRACKS/Orphaned_Compose_Projects.md
cd /root/arifOS/apps/portainer-pocketbase-wireguard
docker compose up -d --no-recreate
```

### Restore eigent
```bash
# Extract env vars from backup first:
jq '.[3].Config.Env' /root/af-forge/wiki/raw/orphaned-containers-inspect-2026-04-09.json

mkdir -p /root/arifOS/apps/eigent-server
# Copy compose + env from wiki/50_CRACKS/Orphaned_Compose_Projects.md
cd /root/arifOS/apps/eigent-server
docker compose up -d --no-recreate
```

---

## Status Tracker

| Action | Tier | Status |
|--------|------|--------|
| Backup all orphaned containers | 1 | ✅ DONE 08:55 UTC |
| Snapshot arifosmcp | 1 | ✅ DONE 08:55 UTC |
| Tag local images | 1 | ✅ DONE 08:58 UTC |
| Verify data volumes | 1 | ✅ DONE 08:58 UTC |
| `docker compose up -d arifosmcp` | 2 | ⏳ **Awaiting Arif `yes`** |
| Verify /health post-reconnect | 2 | ⏳ After above |
| Reconstruct orphaned compose files | 3 | ⏳ Only if containers die |

---

## Cross-links

- [[50_CRACKS/Intelligence_Gaps]] — root cause analysis
- [[50_CRACKS/Orphaned_Compose_Projects]] — orphan analysis + compose reconstruction
- [[60_TEMPERATURES/Live_Status]] — current machine state
- `raw/orphaned-containers-inspect-2026-04-09.json` — 96KB full backup
- `raw/arifosmcp-before-reconnect-2026-04-09.json` — pre-reconnect snapshot
