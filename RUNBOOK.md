# RUNBOOK.md — A-FORGE (Execution Shell)

> **Organ:** A-FORGE | **Port:** 7071
> **Last Updated:** 2026-06-12

## Start / Stop
```bash
systemctl start a-forge
systemctl stop a-forge
systemctl restart a-forge
systemctl status a-forge
```

## Health Check
```bash
curl -s http://127.0.0.1:7071/health | python3 -m json.tool
```

## Build & Test
```bash
cd /root/A-FORGE
npm install
npm run build
make test            # security-audit + build + 17 test suites
```

## Logs
```bash
journalctl -u a-forge -n 50 --no-pager
```

## Common Failure Modes
| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 888_HOLD on execution | No JUDGE_SEAL_AUTHORIZATION from arifOS | Run through arif_judge_deliberate first |
| /health unreachable | Service crashed | `systemctl restart a-forge` |
| Build fails | Node modules stale | `rm -rf node_modules && npm install` |

## What NOT to Do
- Do NOT execute without JUDGE_SEAL_AUTHORIZATION from arifOS
- Do NOT import NumPy/Pandas/SciPy (domain logic lives in Python organs)
- Do NOT self-authorize or issue constitutional verdicts
