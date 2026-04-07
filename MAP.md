# arifOS — AF VPS Architecture Map

> **Last Updated:** 2026-04-02T20:28Z
> **Session Seal:** `fa4ee6b` — Docmost Agent Logbook Operational
> **Authority:** 999 (A-VALIDATOR) | ΔΩΨ
> **Motto:** DITEMPA BUKAN DIBERI

---

## Machine Identity

| Key | Value |
|-----|-------|
| Host | `srv1325122` — Arif's personal VPS |
| IP | `72.62.71.199` |
| OS | Linux (Docker host) |
| Repo | `github.com/ariffazil/arifOS` → `/root/arifOS/` |
| Network | `arifos_trinity` (bridge, explicit name — no prefix chaos) |
| Sovereign | Muhammad Arif bin Fazil (F13) |

---

## Container Map — arifOS Stack

### 🔵 Infrastructure Layer
| Container | Image | Internal Port | Role |
|-----------|-------|---------------|------|
| `traefik` | traefik:v3.6.9 | 80/443 (public) | Edge router, SSL/TLS, Let's Encrypt |
| `postgres` | postgres:16 | 5432 | Primary DB — `arifos_vault` + `docmost` schemas |
| `redis` | redis:7 | 6379 | Sessions, cache, shared memory scratchpad |
| `qdrant` | qdrant/qdrant | 6333 | Vector memory — `arifos_memory` collection |
| `ollama` | ollama/ollama | 11434 | Local LLM inference — `bge-m3`, embeddings |

### 🟡 Intelligence Layer
| Container | Image | Internal Port | Role |
|-----------|-------|---------------|------|
| `mcp` | `arifos/arifosmcp:latest` | 8080 | Constitutional kernel — 11 Mega-Tools, 13 Floors |
| `openclaw` | openclaw | 18789 | Agent gateway / orchestrator |
| `registry` | `arifos/model-registry:latest` | 18792 | Model registry |
| `geox` | `arifos/geox:latest` | 8000 | Earth Witness — geoscience MCP tools |

### 🟢 Observability Layer
| Container | Image | Internal Port | Role |
|-----------|-------|---------------|------|
| `prometheus` | prom/prometheus | 9090 | Metrics scrape — target: `mcp:8080` |
| `blackbox` | prom/blackbox-exporter | 9115 | HTTP probe exporter |
| `uptime` | louislam/uptime-kuma:1 | 3001 | Endpoint health monitoring |

> ❌ Grafana removed (2026-04-02) — agents query Prometheus directly.

### 🟣 Automation Layer
| Container | Internal Port | Role |
|-----------|---------------|------|
| `n8n` | 5678 | Workflow automation |
| `webhook` | 9000 | Webhook handler |

### ⚪ Civilisation Layer
| Container | Internal Port | Role |
|-----------|---------------|------|
| `docmost` | 3000 | Agent + human shared logbook at `logbook.arif-fazil.com` |
| `browser` | 3000 | Headless Browserless — web automation |
| `pdf` | 8080 | PDF generation service |
| `forge` | 80 | Forge landing site |
| `landing` | 80 | AAA landing site |
| `code` | 8080 | Code execution sandbox (Traefik internal-only) |
| `whatsapp` | — | WhatsApp bridge (Traefik internal-only) |
| `sandbox-*` | — | Isolated execution sandboxes (openclaw) |

---

## Live Domains

| Domain | Container | Status |
|--------|-----------|--------|
| `arifosmcp.arif-fazil.com` | `mcp` | ✅ `/mcp` + `/health` |
| `logbook.arif-fazil.com` | `docmost` | ✅ Agent logbook, Enterprise license |
| `uptime.arif-fazil.com` | `uptime` | ✅ |
| `forge.arif-fazil.com` | `forge` | ✅ |
| `aaa.arif-fazil.com` | `landing` | ✅ |
| `geox.arifosmcp.arif-fazil.com` | `geox` | ✅ DNS live |
| `registry.arifosmcp.arif-fazil.com` | `registry` | ✅ DNS live |
| `pdf.arifosmcp.arif-fazil.com` | `pdf` | ✅ |
| `flow.arifosmcp.arif-fazil.com` | `n8n` | ✅ |
| `code.arifosmcp.arif-fazil.com` | `code` | 🔒 Traefik disabled (internal only) |
| `whatsapp.arifosmcp.arif-fazil.com` | `whatsapp` | 🔒 Traefik disabled (internal only) |
| `monitor.arifosmcp.arif-fazil.com` | — | ❌ Grafana removed |

### Cloudflare Pages (not VPS)
| Domain | Source |
|--------|--------|
| `arif-fazil.com` | `/root/arif-sites/arif` |
| `arifos.arif-fazil.com` | `/root/arif-sites/arifos` |
| `waw.arif-fazil.com` | `/root/waw` |

---

## MCP Endpoints

| Endpoint | Transport | Status |
|----------|-----------|--------|
| `https://arifosmcp.arif-fazil.com/mcp` | HTTP/SSE | ✅ |
| `https://arifosmcp.fastmcp.app/mcp` | FastMCP Cloud | ✅ |
| `https://geoxarifOS.fastmcp.app/mcp` | FastMCP Cloud | ✅ |

---

## Inter-Service URLs (use inside containers on `arifos_trinity`)

```
postgres:    postgresql://arifos_admin:***@postgres:5432/arifos_vault
redis:       redis://redis:6379/0
qdrant:      http://qdrant:6333
ollama:      http://ollama:11434
mcp:         http://mcp:8080
openclaw:    http://openclaw:18789
registry:    http://registry:18792
geox:        http://geox:8000
browser:     http://browser:3000
docmost:     http://docmost:3000
prometheus:  http://prometheus:9090
n8n:         http://n8n:5678
```

---

## Docmost Logbook

| Key | Value |
|-----|-------|
| URL | `https://logbook.arif-fazil.com` |
| Internal | `http://docmost:3000` |
| Workspace | `arifOS Forge` |
| Workspace ID | `019d4fc7-6847-7077-bd7b-1decdf54ce70` |
| Default Space | `General` — ID `019d4fc7-6857-732b-892d-53c903eb88a5` |
| License | Enterprise trial (100 seats, expires 2026-06-01) |
| API Tool | `agent_logbook` in `mcp` — modes: `write_page`, `search`, `list_spaces`, `get_page` |

**API note:** Docmost GET `*` wildcard catches all GET routes → always use POST endpoints.

---

## Volume Mounts — mcp (critical dual-mount)

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `/root/arifOS/arifos_mcp` | `/usr/local/lib/python3.12/site-packages/arifosmcp:ro` | Live code as `arifosmcp` module (running CMD) |
| `/root/arifOS/arifos_mcp` | `/usr/src/app/arifos_mcp:ro` | Live code as `arifos_mcp` module (new imports) |
| `/opt/arifos/data/core` | `/usr/src/app/data:rw` | Persistent core data |
| `arifosmcp_vault` | `/usr/src/app/VAULT999:rw` | Immutable audit trail |

> ⚠️ **Pending:** After `make fast-deploy`, Dockerfile CMD switches to `arifos_mcp.runtime.server:app`. Then remove the first mount.

---

## Compose Files

| File | Services | Note |
|------|----------|------|
| `/root/arifOS/docker-compose.yml` | All 20+ arifOS services | Master — run all ops from here |
| `/root/arifOS/docmost-compose.yml` | `docmost` | Separate file, `arifos_trinity` external. Run with `-f docmost-compose.yml`. Do NOT use `--remove-orphans` on main compose (kills docmost) |

---

## Other VPS Stacks (not arifOS — do not touch)

| Stack | Containers | Network |
|-------|-----------|---------|
| `portainer-pocketbase-wireguard` | `apps_pocketbase`, `apps_portainer`, `apps_wireguard` | `arifosmcp_arifos_trinity` |
| `server` (eigent) | `eigent_api`, `eigent_celery_*`, `eigent_postgres`, `eigent_redis` | `arifosmcp_arifos_trinity` |

> ⚠️ Network `arifosmcp_arifos_trinity` is used by these stacks. Do NOT prune it.

---

## Shared Memory (Redis)

| Key | TTL | Content |
|-----|-----|---------|
| `shared_mem:global:anon:AF_VPS_MAP` | 24h | JSON copy of this architecture map |

Namespace: `shared_mem:{agent_id}:{session_id}:{key}`

---

## Deploy Commands

```bash
cd /root/arifOS

make fast-deploy      # 2-3 min — code changes
make reforge          # 10-15 min — deps/Dockerfile changed
make hot-restart      # ~10s — config only
make strategy         # auto-detect what to run

# Docmost separately
docker compose -f docmost-compose.yml up -d
```

---

## Git Commits This Session

| Commit | Change |
|--------|--------|
| `2c70dd8` | fix: OLLAMA_URL, uptime-kuma, Dockerfile CMD |
| `fab07de` | feat: agent memory layer + docmost + ollama naming sealed |
| `89a3914` | fix: network name=arifos_trinity |
| `e8d5772` | fix: mount arifos_mcp live dir into /usr/src/app |
| `e73f3d1` | fix: LE rate limit, DNS for geox/registry/uptime, code/whatsapp internal |
| `8323727` | drop: remove grafana entirely |
| `fa4ee6b` | fix: agent_logbook POST endpoints, format field, default space_id |
