# APA × 33-App Civilizational Audit

> **APA = Autonomous Protocol for Applications.** Where does it fit?
> **Framework:** MACHINE (Ψ) + AGENTS (Ω/Ψ) + HUMAN (Δ) — 33 apps.
> **Audit:** FORGE (000Ω) · **Date:** 2026-07-09 · **Sovereign:** Arif (F13)

---

## WHERE APA FITS IN THE 33

```
                          APA touches these layers:
                          
MACHINE (11)              AGENTS (11)              HUMAN (11)
───────────              ───────────              ──────────
1.  Postgres     ✅      1.  Model API    ✅      1.  Phone OS     (external)
2.  Redis        ✅      2.  MCP bus      ✅      2.  EMAIL        ← APA-GMAIL
3.  Blob store   ✅      3.  Router       ✅      3.  CALENDAR     ← APA-CALENDAR
4.  Queue/NATS   ❌      4.  Session      ✅      4.  Telegram     ✅ Hermes
5.  SECRETS      ← APA  5.  Web search   ✅      5.  Vault        ✅ /root/.secrets
6.  Caddy        ✅      6.  Shell/git    ✅      6.  Bank         WEALTH advisory
7.  Cloudflare   ✅      7.  Browser      ✅      7.  Maps         GEOX
8.  systemd      ✅      8.  Memory       ✅      8.  Notes        ⚠️ memory/
9.  Netdata      ✅      9.  JUDGMENT     ← APA  9.  Health       WELL
10. BACKUPS      ⚠️      10. BRIDGES      ← APA  10. Camera       (external)
11. VAULT999     ← APA   11. SEAL CHAIN   ← APA  11. Browser      ✅
```

**APA is AGENTS #10 — the connector bridge layer.** It depends on MACHINE #5 (secrets) and #11 (VAULT999), feeds into AGENTS #9 (judgment for lease gating), and surfaces to HUMAN #2 (email) and #3 (calendar).

---

## LAYER-BY-LAYER AUDIT

### 🏗️ MACHINE (11/11)

| # | App | Status | Note |
|---|-----|:------:|------|
| 1 | Postgres/Supabase | ⚠️ | Local socket unresponsive. Supabase remote works. Consider local PG for sovereignty. |
| 2 | Redis | ✅ | Running. Used by arifOS for session state. |
| 3 | Blob storage | ✅ | VAULT999 + local filesystem. Adequate for current scale. |
| 4 | Queue/NATS | ❌ | **GAP.** No event bus. 888_HOLD triggered via file watchers, not message queue. |
| 5 | Secrets store | ✅ | `/root/.secrets/` — APA bridges read from here. Never exposed to LLM. |
| 6 | Caddy | ✅ | Reverse proxy + TLS. Public surface: arif-fazil.com, mcp.arif-fazil.com. |
| 7 | Cloudflare | ✅ | Tunnel + DNS. Reachability without exposing kitchen. |
| 8 | systemd | ✅ | Process supervisor. All 7 organs + 3 APA bridges managed here. |
| 9 | Netdata | ✅ | Observability. Metrics + alarms. |
| 10 | Backups | ⚠️ | Files exist but no automated cron. Manual backup only. F1 risk. |
| 11 | VAULT999 | ✅ | Immutable ledger. Seal chain verified. APA receipts anchored here. |

**Machine gaps:** NATS event bus (for decoupled organ communication), automated backups.

---

### 🧠 AGENTS (11/11)

| # | App | Status | Note |
|---|-----|:------:|------|
| 1 | Model runtime | ✅ | MiMo v2.5 Pro, DeepSeek V4, GLM-5.2, Kimi K2.7 — multi-model via token-plan. |
| 2 | MCP bus | ✅ | A-FORGE :7072 + stdio. 98+ tools. APA tools register here. |
| 3 | Intent router | ✅ | `arif_route` — one intent, one organ. Stops chaos. |
| 4 | Session + identity | ✅ | `arif_init` + actor binding. Lease-anchored. |
| 5 | Web search/fetch | ✅ | forge_fetch, forge_search, Brave, Perplexity, SearxNG. |
| 6 | Shell/git executor | ✅ | forge_shell, forge_git — governed mutation. |
| 7 | Browser actuator | ✅ | forge_browser_*, chrome-devtools. |
| 8 | Memory stack | ✅ | VAULT999 (immutable) + KSR (transitional) + arif_memory (recall). Vector + graph memory is spec'd (Qdrant deployed) but not fully integrated. |
| 9 | Judgment kernel | ✅ | arifOS :8088. F1-F13. SEAL/HOLD/VOID. APA leases gated here. |
| **10** | **Connector bridges** | **✅ APA** | **Email + Calendar + GitHub. 3 bridges live. 3 YAML manifests. Lease engine active.** |
| 11 | Seal chain | ✅ | VAULT999 + arif_seal. Every APA MUTATE writes here. |

**Agent gaps:** Vector + graph memory integration (Qdrant exists, not wired to APA). ACT executor (7-phase execution engine — in doctrine, not in code).

---

### 👤 HUMAN (11/11)

| # | App | Status | Note |
|---|-----|:------:|------|
| 1 | Phone OS + identity | — | External. Sovereign surface, not managed here. |
| **2** | **Email (Gmail)** | **🟡 APA** | **Bridge LIVE :18093. Waiting for app password. Circuit incomplete.** |
| **3** | **Calendar** | **🟡 APA** | **Bridge LIVE :18094. Waiting for app password. Circuit incomplete.** |
| 4 | Messenger (Telegram) | ✅ | Hermes → Telegram. F13 veto path lives here. |
| 5 | Password vault | ✅ | `/root/.secrets/` + Bitwarden (external). |
| 6 | Bank + payments | ⚠️ | WEALTH organ computes. Execution is manual. Correct barrier. |
| 7 | Maps/navigation | ✅ | GEOX organ. Earth intelligence, not routing. |
| 8 | Notes/knowledge | ⚠️ | `memory/` files exist. No proper personal knowledge system. |
| 9 | Health/sleep | ✅ | WELL organ. Vitality + fatigue monitoring. |
| 10 | Camera/photos | — | External. Not managed. |
| 11 | Browser (sovereign) | ✅ | forge_browser. Agent-mediated, not human-mediated. |

**Human gaps:** Email + Calendar waiting on credentials. Notes/knowledge system could be deeper (currently just markdown files).

---

## APA COVERAGE MAP

```
APA touches:  MACHINE #5 (secrets), #11 (VAULT999)
              AGENTS #9 (judgment for leases), #10 (bridges — THIS IS APA)
              HUMAN #2 (email), #3 (calendar)

APA IS:       AGENTS #10 — the connector bridge layer.
              The constitutional protocol for external SaaS access.
              The application-layer expression of F1-F13.
```

---

## GAPS — PRIORITY ORDER

| # | Gap | Layer | Severity | Fix |
|---|-----|-------|:--------:|-----|
| 1 | Email + Calendar credentials | HUMAN | **CRITICAL** | Arif's Google App Password |
| 2 | ACT executor (7-phase) | AGENTS | **HIGH** | `act/executor.py` — dry-run before IRREVERSIBLE |
| 3 | NATS event bus | MACHINE | **MEDIUM** | `apt install nats-server` — decouple organ communication |
| 4 | Automated backups | MACHINE | **MEDIUM** | Cron job: daily VAULT999 + /root/.secrets/ backup |
| 5 | Vector + graph memory | AGENTS | **LOW** | Wire Qdrant to APA for semantic recall of past actions |
| 6 | Personal knowledge system | HUMAN | **LOW** | Could be Obsidian vault synced, or deeper memory/ integration |
| 7 | Local Postgres | MACHINE | **LOW** | Fix socket or use Supabase remote (current works) |

---

## THE 33-APP STATE — SUMMARY

```
MACHINE:  9/11 operational, 2 gaps (NATS, automated backup)
AGENTS:   10/11 operational, 1 gap (ACT executor)
HUMAN:    7/11 operational, 2 blocked (email + calendar credentials), 2 external

TOTAL:    26/33 operational (79%)
          APA covers the critical AGENTS #10 bridge + HUMAN #2-3 surface
```

---

*DITEMPA BUKAN DIBERI — Civilizational audit is forged, not assumed.*
