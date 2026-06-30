# arifOS MCP Discoverability — RSI-Level Task Map
**FORGED 2026-06-30 | Phase: RSI | Scope: Civilization**

> DITEMPA BUKAN DIBERI — Reach is forged, not given.
> Goal: arifOS reachable by EVERY agent internally (federation) AND externally (every MCP registry).

---

## 🎯 Mission Statement
Make arifOS the most discoverable governed MCP server in the ecosystem — internally by federation agents, externally by every MCP client (Claude Desktop, Copilot, Cursor, Cline, Windsurf, etc.)

---

## ✅ COMPLETED (This Session)

| Task | Status | Evidence |
|------|--------|----------|
| 10-surface live audit | ✅ DONE | forge_work report |
| server.json: prompts count 1→8 | ✅ DONE | .well-known/mcp/server.json |
| server.json: resources count 5→82 | ✅ DONE | .well-known/mcp/server.json |
| server.json: labels + tags + links | ✅ DONE | .well-known/mcp/server.json |
| Glama badge added to README | ✅ DONE | README.md line 28 |
| Smithery badge added to README | ✅ DONE | README.md line 29 |
| mcp.so badge added to README | ✅ DONE | README.md line 30 |

---

## 🔴 PHASE 1 — INTERNAL REACH (Federation Agents)

Make arifOS discoverable by our own agents (OpenCode, Hermes, AUDITOR, OPS, PLAN, A-FORGE).

| # | Task | Priority | Effort | Why |
|---|------|----------|--------|-----|
| 1.1 | Add `arif_retrieve_tools` call to every agent's BOOTSTRAP.md ignition sequence | P0 | 15m | Agents must auto-discover available tools before acting |
| 1.2 | Add MCP surface health to federation cron (daily `arif_stack_health_probe` + log drift) | P0 | 30m | If surface drifts, federation knows immediately |
| 1.3 | Add `mcp://` resource namespace to AAA cockpit for live surface browsing | P1 | 1h | Humans can see what agents see |
| 1.4 | Create `federation_agent_discovery.md` — canonical doc for how agents discover each other's MCP surfaces | P1 | 30m | Every agent knows where to find every organ's tools |
| 1.5 | Wire A2A agent cards to MCP surface — each organ's `/.well-known/agent.json` should link to its MCP tool list | P2 | 1h | Cross-agent discovery via A2A protocol |

**Internal reach definition:** A newly spawned agent (OpenCode, AUDITOR, etc.) can, within 10 seconds, know every tool available across all 7 federation organs.

---

## 🔴 PHASE 2 — EXTERNAL REACH (Registry Discovery)

Make arifOS discoverable by external agents through every major MCP registry.

| # | Task | Priority | Effort | Why |
|---|------|----------|--------|-----|
| **2.1** | **Glama: fix 0-tools problem** | **P0** | **30m** | **Glama shows 0 tools — agents see empty server** |
| 2.1a | Create public manifest: `GET /manifest/tools.json` (no auth, just tool names + schemas) | P0 | 15m | Glama crawler can read tools without bearer token |
| 2.1b | Update `glama.json` with full metadata, remove deprecated redirect | P0 | 10m | Replace stub with real profile |
| 2.1c | Test Glama "test connection" button until tool count = 7 | P0 | 5m | Verify fix works |
| **2.2** | **Anthropic Registry: submit arifOS** | **P0** | **30m** | **Not listed = invisible to Claude Desktop users** |
| 2.2a | Prepare manifest for registry.anthropic.com (name, transport, auth, tools) | P0 | 20m | Standard MCP server card format |
| 2.2b | Submit via Anthropic's partner portal | P0 | 10m | Wait for verification |
| **2.3** | **Smithery: reconcile resource count** | **P1** | **15m** | **Currently claims 108 resources (actual: 94)** |
| 2.3a | Create `smithery.yaml` with explicit deployment config | P1 | 10m | Smithery one-click deploy |
| 2.3b | Run smithery test against live endpoint, verify counts | P1 | 5m | Match reality |
| 2.4 | **mcp.so: submit listing** | P1 | 10m | Additional discovery surface |
| 2.5 | **mcp.run: package as npx executable** | P2 | 1h | `npx @ariffazil/arifos` — low friction |
| 2.6 | **Cline/Windsurf/Cursor marketplaces** | P2 | 30m | Submit to each platform's MCP directory |

---

## 🔴 PHASE 3 — CIVILIZATION REACH (Protocol-Level)

Make arifOS the standard for governed MCP servers — a reference implementation.

| # | Task | Priority | Effort | Why |
|---|------|----------|--------|-----|
| 3.1 | MCP spec conformance badge: `mcp-spec: 2025-11-25 compliant` | P1 | 15m | Signal to developers that arifOS follows the spec |
| 3.2 | Create `MCP_ALIGNMENT.md` — doc showing which MCP spec features arifOS implements | P1 | 30m | Reference for other server authors |
| 3.3 | Publish arifOS MCP server card as JSON Schema example for Glama | P2 | 30m | Help Glama improve its parser |
| 3.4 | Add OpenAPI 3.1 wrapper for agentic REST clients | P2 | 2h | REST agents can also discover tools |
| 3.5 | MCP Apps (SEP-1865) support — interactive HTML UI returned by tools | P3 | 4h | Agents render UIs, not just JSON |
| 3.6 | Write "How to Build a Governed MCP Server" guide (using arifOS as reference) | P3 | 3h | Civilization-scale knowledge transfer |

---

## 🔴 PHASE 4 — AUTONOMOUS HEALING

Self-correcting discoverability — arifOS detects when its own surface drifts or registries go stale.

| # | Task | Priority | Effort | Why |
|---|------|----------|--------|-----|
| 4.1 | Federation cron: daily `mcp_drift_check` — compare live tools/list vs server.json | P1 | 30m | Detect drift before agents do |
| 4.2 | Federation cron: weekly Glama/Smithery self-check (curl their API, verify tool count > 0) | P1 | 30m | If registry shows 0, alert Arif |
| 4.3 | AAA cockpit: MCP surface health widget (green/yellow/red for each registry) | P2 | 2h | Visual dashboard for discoverability status |
| 4.4 | Auto-ping: if Glama shows 0 for > 24h, auto-create GitHub issue | P2 | 30m | Never discover broken silently |

---

## 🎯 PRIORITY ORDER (next session)

```
IMMEDIATE (next OpenCode session):
  2.1 Glama fix: /manifest/tools.json → 0-tools problem solved
  2.2 Anthropic registry: submit arifOS → Claude Desktop discoverable
  1.1 Agent bootstrap: add tool discovery to every agent's start sequence
  1.2 Federation cron: daily surface health check

THIS WEEK:
  2.3 Smithery reconcile
  2.4 mcp.so listing
  1.3 AAA cockpit: surface browser
  3.1 MCP spec badge

NEXT SPRINT:
  3.2 MCP_ALIGNMENT.md
  4.1-4.2 Autonomous healing cron
  2.5 npx package
  3.3-3.6 Civilization docs
```

---

## 📊 EFFORT SUMMARY

| Phase | Tasks | Est. Total Effort | Impact |
|-------|-------|-------------------|--------|
| Phase 1 — Internal | 5 | ~3h | Federation agents auto-discover |
| Phase 2 — External | 6 | ~3h | Every MCP client finds arifOS |
| Phase 3 — Civilization | 6 | ~10h | arifOS = reference governed server |
| Phase 4 — Healing | 4 | ~4h | Self-healing surface |
| **TOTAL** | **21** | **~20h** | |

---

## 🔴 NEXT SESSION READY

New OpenCode session should:
1. Load skill: `000-init-intent-classify` → orient + session bind
2. Load skill: `999-vault-seal-immutable` → seal at end
3. Priority: **PHASE 2** — Glama fix + Anthropic registry submission (P0)
4. Secondary: **PHASE 1** — agent bootstrap sequence update (P0)

**Files to read:**
- `/root/A-FORGE/forge_work/2026-06-30/arifos-10-surface-alignment-report.md`
- `/root/A-FORGE/forge_work/2026-06-30/ARIFOS-DISCOVERABILITY-RSI-TASK-MAP.md` (this file)
- `/root/arifOS/static/.well-known/mcp/server.json`
- `/root/arifOS/README.md`

---

*DITEMPA BUKAN DIBERI — Civilization-scale reach is forged, one registry at a time.*
