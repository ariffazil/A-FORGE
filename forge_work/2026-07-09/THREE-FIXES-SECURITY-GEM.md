# Three Fixes + Security Gem — 2026-07-09

## Fixes
1. **forge_document_ingest** — multi-format text pipeline (json/md/source), PrivateTmp-safe staging, spawnSync argv, content_base64, full JSON parse.
2. **forge_filesystem_read** — added to STATELESS_TOOLS; F12 AUTHORIZED_PROXY; fixed broken `server._callTool` → shared `executeFilesystem`.
3. **forge_systemctl** — unregistered from live surface (use `forge_shell('systemctl ...')`).

## Hidden gem
4. **forge_boundaries_assert → forge_security_drift_scan** — production security telemetry (unknown public ports, new cron, new systemd).

## Live verify (T1)
| Check | Result |
|-------|--------|
| tools/list | 98 (systemctl gone, security_drift present) |
| ingest package.json | SEAL format=text |
| ingest README.md | SEAL |
| ingest PDF | SEAL |
| filesystem_read no session | SEAL |
| security_drift_scan | SEAL WARN |

