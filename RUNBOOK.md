> **Canonical RUNBOOK:** `/root/RUNBOOK.md` — this file is organ-specific overrides only.
> **SOT:** 2026-07-24 | **seal_seq:** fed-phase-7

# 📋 RUNBOOK — A-FORGE Operations

> **SOT:** 2026-07-20

## Quick Health
```bash
curl -s http://localhost:7071/health | python3 -m json.tool
```

## Restart
```bash
sudo systemctl restart a-forge-mcp
```

## Logs
```bash
journalctl -u a-forge-mcp --since "5 min ago" --no-pager
```

## Deploy
```bash
cd /root/A-FORGE
# Build + test, then:
sudo systemctl restart a-forge-mcp
curl -s http://localhost:7071/health
```

## Escalation
F13 SOVEREIGN: Muhammad Arif bin Fazil — 888_HOLD for irreversible actions.

