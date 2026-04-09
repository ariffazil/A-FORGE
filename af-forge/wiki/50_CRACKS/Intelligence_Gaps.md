---
type: Crack
tags: [intelligence-gaps, arifosmcp, vector-memory, ollama, redis, degraded]
last_sync: 2026-04-09T09:00Z
confidence: 0.97
severity: HIGH
arifos_floor: F1, F2, F11
operator: Copilot
---

# Crack: arifOS MCP Intelligence Gaps

> **Finding**: `arifosmcp` started STANDALONE — missing env vars that compose would inject.
> Qdrant, Redis, Ollama are all running on `arifos_core_network` but not wired to the MCP kernel.

---

## Evidence (from `/health` at 2026-04-09 08:23 UTC)

```json
{
  "verdict": "SEAL", "confidence": 0.88,
  "capability_map": {
    "vector_memory": "degraded",
    "local_model_runtime": "disabled",
    "storage": {
      "vault_postgres": "configured",
      "session_cache": "not_configured",
      "vector_memory": "not_configured"
    }
  }
}
```

---

## Three Gaps

| Gap | Service | Running | Env Var Missing | Impact |
|-----|---------|---------|-----------------|--------|
| 1 | `qdrant` | ✅ healthy | `QDRANT_URL=http://qdrant:6333` | No local vector memory |
| 2 | `redis` | ✅ healthy | `REDIS_URL=redis://redis:6379` | No session cache |
| 3 | `ollama` | ✅ up | `OLLAMA_URL=http://ollama:11434` | No local inference |

**Confirmed**: Compose file at `/root/arifOS/docker-compose.yml` HAS all three env vars correctly defined. Running container was started before compose was used — env vars were never injected.

---

## Fix (888_HOLD — needs Arif approval)

```bash
cd /root/arifOS

# Preflight: confirm image matches (no drift)
docker inspect arifosmcp --format '{{.Config.Image}}'
# Expected: arifos/arifosmcp:latest  ✅ confirmed (sha256:85cfc77e)

# Reconnect (5s downtime — OpenClaw loses MCP connection briefly)
docker compose up -d arifosmcp

# Verify
sleep 5 && curl -s http://localhost:8080/health | jq '.capability_map.storage'
```

**Expected post-fix**:
```json
{"session_cache": "configured", "vector_memory": "configured"}
```

---

## Cross-links

- [[00_OPERATORS/Reconnect_Recovery_Runbook]] — full 3-tier plan
- [[60_TEMPERATURES/Live_Status]] — container map
