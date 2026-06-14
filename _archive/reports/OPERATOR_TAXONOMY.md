# Operator Layer Taxonomy — OpenClaw + Hermes

**Purpose:** Prevent misdiagnosis. Document what lives where, and what each path means.
**Authority:** OMEGA (Tier 1 cleanup, 2026-06-03)
**Status:** Live

---

## 1. The Two Real Surfaces

| Surface | Port | Process | Purpose |
|---|---|---|---|
| **OpenClaw gateway** | 18789 | `node /usr/lib/node_modules/openclaw/dist/index.js gateway` | Telegram/Discord/MSTeams channels, sub-agent routing, web search, sandboxed exec |
| **cn-organ A2A** | 18790 | `python3 /opt/arifOS/a2a-adapters/openclaw-agent-card.py` | Continue CLI bridge to A-FORGE; A2A agent-card at `/.well-known/agent-card.json` |

> **⚠️ Naming gotcha:** The service unit was previously `openclaw-agent-card.service`. Renamed to `cn-organ.service` (2026-06-03) because it serves cn-organ, NOT OpenClaw core.

---

## 2. The Three Layers of Agent Definitions

### Layer A — Real agents (A2A discoverable)
**Path:** `/root/.openclaw/workspace/agents/<name>/agent-card.json`

```
hermes, openclaw, maxhermes, opencode, hermes-asi, hermes-ops, main (arifOS_bot)
```

These have valid `agent-card.json` following the AAA A2A schema. They are what other agents discover.

### Layer B — Session storage (auto-created)
**Path:** `/root/.openclaw/agents/<name>/`

```
codex/, kimi/, opencode/  — auto-created when those CLIs are invoked
```

These contain only `sessions/` directories. They are **NOT** agent definitions. Do not try to register them.

### Layer C — Active personality config
**Path:** `/root/.openclaw/agents/main/system.md`

This is the `arifOS_bot` persona. Personality file only. Now also has A2A card at `workspace/agents/main/agent-card.json` (Layer A).

---

## 3. Hermes Side

| Path | What | Status |
|---|---|---|
| `/root/.hermes/skills/` | User-installed skills (61 dirs) | Live |
| `/root/.hermes/plugins/` | Federation memory broker plugin (1 plugin) | Live |
| `/root/.hermes/platforms/` | Pairing + Telegram (2 dirs) | Live |
| `/usr/local/lib/hermes-agent/` | Runtime v0.14.0 (2026.5.16) | **Behind upstream v1.0.0** (drift) |
| `/usr/local/lib/hermes-agent.bak.*` | Backups (1.4GB) | Preserved |

> **Skill count gotcha:** `skills_list` reports **138** registered. Disk has **61** dirs. Gap of 77 is system + bundled + lazy-loaded. Both are correct; they measure different things.

---

## 4. Federation Side (canonical organ table)

See `/root/AGENTS.md §5` for the live table. As of 2026-06-03:

| Organ | Port | Tool Count | Notes |
|---|---|---|---|
| arifOS | 8088 | 13 MCP tools | F1-F13 active; build behind main 12 commits |
| arifosd | 18081 | daemon | Constitutional pulse |
| WEALTH | 18082 | 44+ tools | Capital intelligence |
| WELL | 18083 | 13 tools | Reflect-only (state stale 800h+) |
| GEOX | 8081 | 20 tools | Earth intelligence |
| A-FORGE | 7071 | federation probe + execute | Hard-gated by judge seal |
| OpenClaw | 18789 | gateway | Channels: telegram, discord, msteams |
| **cn-organ** | **18790** | **A2A gateway** | **renamed from "openclaw-agent-card" 2026-06-03** |
| APEX | 3002 | deliberation | Decommissioned; mirrored in AAA a2a-server |

---

## 5. Quick diagnostic checks

```bash
# Is OpenClaw alive?
curl -s http://localhost:18789/health
# → {"ok":true,"status":"live"}

# Is cn-organ alive?
curl -s http://localhost:18790/health
# → {"status":"healthy","service":"cn-organ","version":"2026.06.02",...}

# List real agent-cards
ls /root/.openclaw/workspace/agents/*/agent-card.json

# What sub-agents are LIVE in OpenClaw routing?
# (OpenClaw uses openclaw.json agents.defaults, NOT /root/.openclaw/agents/)
python3 -c "import json; d=json.load(open('/root/.openclaw/openclaw.json')); print(list(d.get('agents',{}).keys()))"
```

---

*Maintained by OMEGA. Last refresh: 2026-06-03. Tier 1 cleanup sealed at `OPENCLAW_HERMES_TIER1_CLEANUP_2026-06-03`.*
