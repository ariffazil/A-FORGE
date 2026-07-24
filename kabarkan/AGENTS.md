# KABARKAN — Worker Directory

> **DITEMPA BUKAN DIBERI**
> **Phase 1:** NATS stream + producer + worker
> **Status:** CODE COMPLETE — pending deploy

## Files

| File | Role |
|------|------|
| `worker.py` | Kabarkan Worker v1 — NATS consumer → Postgres → MinIO |
| `kabarkan-worker.service` | systemd unit (:18902 health) |
| `nats_setup.sh` | NATS JetStream stream creation |
| `patch_telemetry.py` | Patch arifOS telemetry.py for NATS producer |
| `deploy.sh` | One-shot deploy (install + setup + start) |

## Deploy

```bash
# Check readiness
bash /root/A-FORGE/kabarkan/deploy.sh --check

# Full deploy
bash /root/A-FORGE/kabarkan/deploy.sh

# Verify
curl -s http://127.0.0.1:18902/health | python3 -m json.tool
journalctl -u kabarkan-worker -f
```

## Architecture

```
arifOS kernel (:8088)
  └── telemetry.py ──fire-and-forget──→ NATS kabarkan.ingest.span.<tool>
                                            │
Kabarkan Worker (:18902)                     │
  ├── NATS pull consumer ←───────────────────┘
  ├── Batch merge (500ms / 100 records)
  ├── Postgres INSERT (idempotent)
  └── MinIO archive (90+ days)
```

## Requirements

- Python 3.12+
- nats-py, asyncpg, aioboto3
- NATS with JetStream (localhost:4222)
- Postgres with `observability` schema
- MinIO (optional, for cold storage)

*Forged 2026-07-24 by OpenCode (333-AGI)*
*DITEMPA BUKAN DIBERI*
