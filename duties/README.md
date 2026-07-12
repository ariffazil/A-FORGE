# Duties — Bounded Autonomic Agents

## Canonical surfaces (2026-07-12 zen)

| Agent | Path | Scope | Authority |
|-------|------|-------|-----------|
| **autonomic_recovery_v1 (sense+fitness)** | `/root/WELL/loop/` | `well-heartbeat.service` only | A_effective shrinks power; max 1 mutation |
| **ARA-v1 (organ health)** | `duties/autonomic-recovery-agent.py` | multi-organ health probes | GREEN restart allowlist; kernel excluded |

**Rule:** Prefer WELL/loop for substrate-aware fitness and A_effective.  
ARA-v1 may restart organ units; it must not expand allowlist without F13.  
Do not dual-restart the same unit from both agents in one window.

### Run WELL loop
```bash
PYTHONPATH=/root/WELL /root/WELL/.venv/bin/python3 /root/WELL/loop/recovery_v1.py --json
PYTHONPATH=/root/WELL /root/WELL/.venv/bin/python3 /root/WELL/loop/recovery_v1.py --mutate --json
```

### Receipts
- WELL: `/root/WELL/loop/receipts/`
- ARA: `duties/logs/`
