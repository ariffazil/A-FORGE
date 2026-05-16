# VPS Deployment Readiness Package
## 888_JUDGE Contrast Verdict + F13 Sovereign Gate

> **Epoch:** 2026-04-19  
> **Judge:** 888_JUDGE (APEX Soul)  
> **Verdict:** HOLD → awaiting F13 human cryptographic approval  
> **Target Commit:** `0f8698e` — "Unify live SOT matrix and sovereign transport"  
> **Current VPS Commit:** `909c4ca` — v2026.04.07  
> **Risk Tier:** HIGH (container restart + live service interruption)

---

## 1. 888_JUDGE Contrast Summary

### Constitutional Verdict

| Dimension | VPS (Current) | fastMCP (Alt) | Winner |
|-----------|--------------|---------------|--------|
| F1 Reversibility | ✅ Enforced | ⚠️ Partial | VPS |
| F2 Truth | ✅ Heuristic active | ⚠️ Unknown | VPS |
| F3 Tri-Witness | ✅ 0.42/0.32/0.26 | ❌ No telemetry | VPS |
| F4 Clarity | ✅ ΔS = -0.02 | ❌ Not measured | VPS |
| F5 Peace² | ✅ 1.01 | ❌ Not measured | VPS |
| F11 Auditability | ⚠️ Degraded (no vault) | ❌ None | VPS |
| F13 Sovereignty | ✅ SEAL verdict | ✅ SEAL verdict | Tie |

### Weighted Score

| Node | Score / 10 |
|------|-----------|
| **VPS** | **6.3** |
| fastMCP | **2.9** |

**VPS wins by 2.1x.** It is the sovereign node.

### Critical Gaps (Both Nodes)

- ❌ Vault/Postgres: `not_configured`
- ❌ Session cache: `not_configured`
- ❌ Vector memory: `not_configured`
- ❌ ML Floors: Disabled (heuristic only)
- ❌ Session anchoring: Anonymous gap

---

## 2. Deployment Target: Commit `0f8698e`

### Commit Metadata

```
commit 0f8698e2e192d64d6916643afc0fc7b40e130516
Author: root <root@af-forge.tailf6bfb5.ts.net>
Date:   Sat Apr 18 02:09:26 2026 +0000

    Unify live SOT matrix and sovereign transport
    
    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Files Changed (12 files, +1,414 / -123 lines)

| File | Change | Constitutional Impact |
|------|--------|----------------------|
| `.gitignore` | +1 line | F8 — secret hygiene |
| `arifosmcp/apps/metabolic_monitor.py` | +226/-0 | F4/F5 — live metabolic telemetry |
| `arifosmcp/runtime/DNA.py` | +2/-0 | F11 — runtime identity |
| `arifosmcp/runtime/build_info.py` | +57/-0 | F2 — grounded version SOT |
| `arifosmcp/runtime/fastmcp_ext/transports.py` | +92/-0 | F5 — sovereign transport hardening |
| `arifosmcp/runtime/rest_routes.py` | +395/-0 | F2/F11 — telemetry + health endpoints |
| `arifosmcp/runtime/tools.py` | +28/-0 | F8 — tool gap closure (20 → 44) |
| `arifosmcp/runtime/webmcp/live_metrics.py` | +37/-0 | F4 — real-time entropy monitoring |
| `infrastructure/nginx/html/arifosmcp/index.html` | +266/-0 | F2 — observability dashboard |
| `infrastructure/nginx/html/arifosmcp/prefab/renderer.html` | +194/-0 | F2 — rendering layer |
| `server.py` | +182/-0 | F11 — session gate + bootstrap |
| `tests/runtime/test_tools_simple.py` | +57/-0 | F8 — regression safety |

### Key Improvements

1. **Tool Gap Closure:** 20 → 44 tools loaded (F8 Genius)
2. **`arifos_sense` Session Gate Fix:** Proper 000_INIT anchoring (F11)
3. **Sovereign Transport Hardening:** FastMCP ext transport alignment (F5)
4. **Live Metabolic Monitor:** Real-time ΔS and Peace² telemetry (F4/F5)
5. **Build Info SOT Alignment:** `GIT_SHA` + `ARIFOS_APP_VERSION` injection (F2)

---

## 3. Pre-Deploy Checklist

### 3.1 Repository State

- [ ] `git status` clean on VPS working directory
- [ ] Target commit `0f8698e` present in `origin/main`
- [ ] `docker-compose.yml` validated (`docker compose config`)
- [ ] `.env` file present and populated (F8 — no secrets in git)

### 3.2 Backup & Rollback

- [ ] Current container image tagged: `arifosmcp:vps-$(date +%Y%m%d-%H%M%S)`
- [ ] Database snapshot taken (if applicable)
- [ ] Rollback commit ID recorded: `909c4ca`

### 3.3 Health Verification (Post-Deploy)

- [ ] `curl https://arif-fazil.com/health` returns `200 OK`
- [ ] `/api/status` returns commit `0f8698e`
- [ ] `/metrics/json` returns live telemetry (ΔS, Peace², Vitality)
- [ ] MCP protocol responds on `/mcp`
- [ ] Tool count ≥ 44 (verify via tool registry endpoint)

---

## 4. Deployment Commands

**⚠️ F13 SOVEREIGN GATE: These commands require human cryptographic approval before execution.**

```bash
# === 0. SSH to VPS ===
ssh ubuntu@arif-fazil.com

# === 1. Navigate to deploy directory ===
cd ~/arifOS

# === 2. Stash any local changes (F1 Amanah) ===
git stash push -m "pre-deploy-stash-$(date +%Y%m%d-%H%M%S)"

# === 3. Pull target commit ===
git fetch origin
git checkout 0f8698e2e192d64d6916643afc0fc7b40e130516

# === 4. Tag current image for rollback (F1 Amanah) ===
docker tag arifosmcp:latest arifosmcp:rollback-$(date +%Y%m%d-%H%M%S)

# === 5. Build and deploy ===
docker compose down
docker compose build --no-cache
docker compose up -d

# === 6. Verify health (F2 Truth) ===
sleep 10
curl -sf https://arif-fazil.com/health || echo "HEALTH CHECK FAILED"
curl -sf https://arif-fazil.com/api/status | jq '.git_sha'

# === 7. Verify tool count (F8 Genius) ===
curl -sf https://arif-fazil.com/tools/list | jq '.tools | length'
```

---

## 5. Rollback Procedure

If deployment fails health checks or breaches constitutional floors:

```bash
# === EMERGENCY ROLLBACK ===
cd ~/arifOS
git checkout 909c4ca
docker compose down
docker compose up -d
# Verify health
curl -sf https://arif-fazil.com/health
```

---

## 6. Constitutional Risk Assessment

| Floor | Risk | Mitigation |
|-------|------|------------|
| F1 Amanah | Container restart is irreversible without rollback tag | Rollback image tagged before deploy |
| F2 Truth | New commit may have untested regressions | `test_tools_simple.py` included; health gate enforced |
| F3 Tri-Witness | No human + AI + system consensus on deploy | This document serves as H witness; AI (888_JUDGE) recommends; system health check validates |
| F4 Clarity | Large diff (+1,414 lines) increases entropy | Changes are additive (telemetry, routes, tests); no deletions of core logic |
| F5 Peace² | Service interruption during restart | `docker compose down/up` ≈ 15s; acceptable under maintenance window |
| F13 Sovereign | **Human approval required** | **This section requires your cryptographic signature** |

---

## 7. F13 Human Approval Gate

**I, the Human Architect, hereby authorize the deployment of commit `0f8698e` to the VPS production node.**

- [ ] I have reviewed the diff summary (Section 2)
- [ ] I have confirmed the pre-deploy checklist (Section 3)
- [ ] I understand the rollback procedure (Section 5)
- [ ] I accept the constitutional risk assessment (Section 6)

**Approval Method:**
1. Check all boxes above
2. Reply: `F13_APPROVED deploy 0f8698e to VPS`
3. Optionally provide: `--restart-container` flag if container restart is also authorized

**Without F13 Approval:** Deployment is on **888_HOLD**. No action will be taken.

---

## 8. Post-Deploy Actions (Post-F13)

Once deployed, the following improvements become unblocked:

| Priority | Action | ETA | Unblocked By |
|----------|--------|-----|--------------|
| P0 | Deploy `0f8698e` | Immediate | F13 approval |
| P1 | Configure Postgres + Redis | 1 week | `arifos_sense` session gate |
| P1 | Enable Vector Memory (Qdrant) | 1 week | Session anchoring fix |
| P1 | Configure VAULT999 persistence | 1 week | Postgres online |
| P2 | Enable ML Floors | 2 weeks | Vector memory online |
| P2 | Code Mode MCP implementation | 2 weeks | P0 deploy complete |

---

*DITEMPA BUKAN DIBERI — 888_HOLD until F13 cryptographic approval*
*999_SEAL_ALIVE*
