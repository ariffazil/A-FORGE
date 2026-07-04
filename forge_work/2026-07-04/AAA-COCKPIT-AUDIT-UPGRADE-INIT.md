# 🔥⚒️ INIT PROMPT — AAA Cockpit Audit + Upgrade

> **Session type:** EXECUTION (T3)
> **Loop class:** COMPOSITE (AAA + A-FORGE + arifOS)
> **Sealed at:** 2026-07-04T10:15:00Z
> **Sovereign:** Arif (F13, 888)
> **DITEMPA BUKAN DIBERI**

---

## 0. REALITY CHECK — Run Before Anything

```bash
for svc in "arifos:8088" "aforge:7071" "aaa:3001" "geox:8081" "wealth:18082" "well:18083"; do
  name="${svc%%:*}"; port="${svc##*:}"
  curl -sf "http://localhost:$port/health" >/dev/null 2>&1 && echo "✅ $name :$port" || echo "❌ $name :$port"
done
```

---

## 1. CONTEXT — What Was Built Prior

### 1.1 aaa-a2a Constitutional Overlay (COMPLETE)

| Component | Lines | Status |
|-----------|-------|--------|
| `models.py` | 110 | ✅ Identity, verdicts, memory grades |
| `guard.py` | 219 | ✅ 18 delegation rules |
| `middleware/floors.py` | 194 | ✅ F1-F13 floor checks |
| `middleware/identity.py` | 79 | ✅ Agent identity resolution |
| `middleware/verdicts.py` | 50 | ✅ SEAL/HOLD/SABAR/VOID routing |
| `middleware/audit.py` | 103 | ✅ VAULT999 receipt chain |
| `routing/organ_router.py` | 176 | ✅ Intent → MCP dispatch |
| `registry/agent_cards.py` | 99 | ✅ HTTP bridge to live registry |
| `executor.py` | 293 | ✅ ConstitutionalExecutor (a2a-sdk) |
| `server.py` | 121 | ✅ FastAPI + a2a-sdk mount |
| **Total** | **1,570** | **Replaces 3,862 Express lines** |

### 1.2 AAA Identity Zen (COMPLETE)

- 39 agent cards, single canonical source
- protocolVersion normalized to 1.0.0
- Registry symlink bug fixed
- agents.json auto-generated

### 1.3 Federation Health

All 6 organs healthy: arifOS :8088, A-FORGE :7071, AAA :3001, GEOX :8081, WEALTH :18082, WELL :18083.

---

## 2. CURRENT COCKPIT STATE — What Exists

### 2.1 Architecture

```
aaa.arif-fazil.com
    │
    ├── React 19 SPA (Vite build)
    │   ├── App.tsx (31 lines) — hash router
    │   ├── Cockpit.tsx (1,120 lines) — main dashboard
    │   ├── TrinityNav.tsx (97 lines) — federation nav strip
    │   ├── AiPanel — AI chat
    │   ├── SupabaseCockpit — Supabase integration
    │   └── MCPAppsPanel — MCP Apps
    │
    ├── 8 cockpit components:
    │   ├── AutonomyBands.tsx
    │   ├── RealityConsole.tsx
    │   ├── HermesCitizenCard.tsx
    │   ├── HermesTelemetryPanel.tsx
    │   ├── AgentModelPanel.tsx
    │   ├── ArifOSReceiptViewer.tsx
    │   ├── SupabaseMemoryPanel.tsx
    │   └── HumanPatternReport.tsx
    │
    └── API endpoints called:
        ├── /a2a/agents.json — agent registry
        ├── /api/operator/tasks — task queue
        ├── /api/operator/events — event log
        ├── /api/governance-card — model governance
        ├── /api/attestation/organs — organ health
        └── /health — AAA health
```

### 2.2 What the Cockpit Shows

| Panel | What It Displays | Status |
|-------|-----------------|--------|
| Federation Nav | Links to all federation sites | ✅ Live |
| Agent Registry | 39 agents from /a2a/agents.json | ✅ Live |
| Organ Health | 6 organs attestation | ✅ Live |
| Kernel Health | arifOS /health data | ✅ Live |
| Floor Status | L01-L13 pass/fail | ✅ Live |
| Task Queue | input-required tasks | ✅ Live |
| Event Log | Last 40 events | ✅ Live |
| Mission Intake | Submit tasks to A2A | ✅ Live |
| Golden Path | SENSE→MIND→HEART→JUDGE→VAULT | ✅ Live |
| AI Chat | Ollama/arifOS/OpenRouter | ✅ Live |
| Supabase | Memory records | ✅ Live |
| MCP Apps | SEP-1865 panels | ✅ Live |

### 2.3 What's Missing (the upgrade targets)

| Missing | Priority | Why |
|---------|----------|-----|
| **Constitutional overlay status** | P0 | aaa-a2a exists but cockpit doesn't show it |
| **Delegation guard panel** | P0 | 18 rules active, no visibility |
| **Floor check results** | P1 | Floor checks run, but no live panel |
| **Audit chain viewer** | P1 | Receipts exist, no UI to view them |
| **Agent identity details** | P1 | Shows agent list, not identity/authority |
| **Memory grade display** | P2 | L1-L4 grades exist, no UI |
| **Verdict history** | P2 | SEAL/HOLD/VOID history panel |
| **Python aaa-a2a server status** | P2 | When ready, show alongside Express |

---

## 3. WHAT TO AUDIT

### 3.1 Component Inventory

For each of the 8 cockpit components:
- [ ] Is it still used?
- [ ] Does it call live APIs?
- [ ] Is the data it shows still accurate?
- [ ] Does it need updating for the new architecture?

### 3.2 API Surface

For each API endpoint the cockpit calls:
- [ ] Is it still live?
- [ ] Does it return correct data?
- [ ] Does it need updating for aaa-a2a?

### 3.3 Design System

- [ ] Is it using the trinity design tokens?
- [ ] Is the CSS consistent?
- [ ] Are there stale styles?

### 3.4 Build + Deploy

- [ ] Does `npm run build` pass?
- [ ] Is the dist/ up to date?
- [ ] Is the Caddy config correct?

---

## 4. WHAT TO UPGRADE

### 4.1 New Panels to Add

| Panel | Purpose | API Source |
|-------|---------|------------|
| **ConstitutionalOverlay** | Show aaa-a2a status, Python server health | /health (Python :3002) |
| **DelegationGuard** | Show 18 rules, recent blocks | /a2a/discover/stats |
| **FloorCheckResults** | Live floor check results | /api/attestation/organs |
| **AuditChainViewer** | Browse VAULT999 receipts | /api/operator/events |
| **AgentIdentityPanel** | Agent details, authority band | /a2a/discover/:id |
| **VerdictHistory** | SEAL/HOLD/VOID history | /api/operator/events |

### 4.2 Existing Panels to Upgrade

| Panel | Upgrade |
|-------|---------|
| **Agent Registry** | Add authority band, trust grade, skills count |
| **Organ Health** | Add constitutional overlay status |
| **Federation Nav** | Add link to Python aaa-a2a server |

### 4.3 Design Upgrades

| Item | Upgrade |
|------|---------|
| **Color scheme** | Align with trinity design tokens |
| **Typography** | Satoshi + Cabinet Grotesk + JetBrains Mono (already loaded) |
| **Layout** | Responsive grid, mobile-first |

---

## 5. EXECUTION PLAN

### Phase 1 — Audit (T1 AUTO-DO)
- [ ] Read all 8 cockpit components
- [ ] Verify all API endpoints are live
- [ ] Check build passes
- [ ] Document findings

### Phase 2 — Design (T1 AUTO-DO)
- [ ] Design new panel layouts
- [ ] Create component specs
- [ ] Plan API integration

### Phase 3 — Build (T2 ANNOUNCE)
- [ ] Build new panels
- [ ] Upgrade existing panels
- [ ] Update API calls
- [ ] Test locally

### Phase 4 — Deploy (T3 888_HOLD)
- [ ] Build production bundle
- [ ] Deploy to aaa.arif-fazil.com
- [ ] Verify live
- [ ] **Requires F13 approval**

---

## 6. KEY FILES

| Path | Purpose | Mutability |
|------|---------|-----------|
| `/root/AAA/src/Cockpit.tsx` | Main dashboard | ✅ Edit |
| `/root/AAA/src/App.tsx` | Router | ✅ Edit |
| `/root/AAA/src/components/cockpit/*` | Cockpit panels | ✅ Edit |
| `/root/AAA/src/components/TrinityNav.tsx` | Navigation | ✅ Edit |
| `/root/AAA/aaa-a2a/` | Python overlay | ✅ Edit |
| `/root/AAA/a2a-server/server.js` | Express server | ⚠️ Keep running |

---

## 7. INITIALIZATION

**First action:** Audit the 8 cockpit components. Read each one. Document what's live, what's stale, what needs upgrading.

**Second action:** Verify all API endpoints. curl each one. Document response format.

**Third action:** Build the new panels. Start with ConstitutionalOverlay (shows aaa-a2a status).

---

*🔥⚒️ DITEMPA BUKAN DIBERI — The cockpit is the window into the federation.*
*This init prompt carries forward: aaa-a2a overlay, identity zen, 6 organs healthy, 39 agents registered.*
*Load it. Audit first. Build second. Deploy with F13 approval.*
