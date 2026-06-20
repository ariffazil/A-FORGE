# STATUS.md — A-FORGE Execution Shell

> **Authority:** F13 SOVEREIGN (Muhammad Arif bin Fazil)
> **Scope:** A-FORGE organ only — for federation status see `FEDERATION_STATUS.md`
> **Last probe:** 2026-06-20T13:22 UTC

---

## 1. Current Health

| Metric | Value | Source |
|--------|-------|--------|
| **Status** | OPERATIONAL | `curl :7071/health` |
| **Port** | 7071 | systemd `a-forge.service` |
| **Build** | ✅ Compiles clean | `tsc -p tsconfig.json` |
| **Runtime** | Node.js 22+, TypeScript ~6.0 | `package.json` |
| **Architecture** | Hexagonal / layered | `ARCHITECTURE.md` |
| **Tests** | 17 test suites | `make test` |
| **Git HEAD** | `92bfd52` | `git log -1` |

## 2. Architecture Summary

```
Constitutional Kernel (arifOS :8088)
    │ JUDGE_SEAL_AUTHORIZATION
    ▼
A-FORGE Execution Shell (:7071)
    ├── Forge Plan → Forge Dry Run → Forge Approve → Forge Execute
    ├── 20+ forge MCP tools
    ├── Unforge rollback capability
    └── ADAT AGENTIC — DITEMPA BUKAN DIBERI
```

## 3. Structural State (2026-06-20)

| Directory | Status |
|-----------|--------|
| `src/` | ✅ 6-module hexagonal (domain, application, infrastructure, interfaces) |
| `deploy/` | ✅ Canonical deploy configs (Docker, systemd, Caddy, Grafana, Prometheus) |
| `GENESIS/` | ✅ Symlinked arifOS canon + 012_AFORGE_MANDATE.md |
| `docs/` | ✅ DOC_INDEX.md added, stale docs archived |
| ~~`infra/`~~ | ❌ Removed — was stale duplicate of deploy/ |
| ~~`ops/k8s/`~~ | ❌ Removed — federation is bare-metal, never used k8s |

## 4. Quick Commands

```bash
systemctl status a-forge
curl -s http://127.0.0.1:7071/health | python3 -m json.tool
cd /root/A-FORGE && npm run build && make test
journalctl -u a-forge -n 20 --no-pager
```
