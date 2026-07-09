# Hermes Lane Split — 3-Lane Architecture

> **Date:** 2026-07-09
> **Authority:** Arif (F13 SOVEREIGN)
> **Status:** EXECUTED

---

## Problem

Hermes (@ASI_arifos_bot) was trying to be everything — cognitive soul, code executor, miniapp gateway, cron orchestrator, file courier. Result: 553MB RAM, 240MB state.db, 28 skills, 6 cron jobs, chaos.

## Solution — 3 Clean Lanes

```
┌─────────────────────────────────────────────────────────┐
│                    ARIF (F13 SOVEREIGN)                  │
└────────────┬──────────────┬──────────────┬──────────────┘
             │              │              │
     ┌───────▼───────┐ ┌───▼───────────┐ ┌▼──────────────┐
     │    HERMES      │ │   OPENCODE    │ │   OPENCLAW    │
     │    @ASI_       │ │   @arifOS_    │ │   @AGI_ASI_   │
     │    arifos_bot   │ │   bot         │ │   bot         │
     │                │ │               │ │               │
     │  SOUL          │ │  HANDS        │ │  GUTS         │
     │  Human lang    │ │  Code/infra   │ │  Metabolizer  │
     │  Cognitive     │ │  Build/deploy │ │  Miniapps     │
     │  Conversation  │ │  Fix/mutate   │ │  Gateway      │
     │  Agentic       │ │  Machine ops  │ │  Route/reason │
     └────────────────┘ └───────────────┘ └───────────────┘
```

## What Moved

### From Hermes → System Cron
| Job | Schedule | Reason |
|-----|----------|--------|
| `federation-health` | every 2h | Machine health probe — not cognitive |
| `well-entropy-seal` | every 6h | Vault bridge script — not cognitive |

### From Hermes → OpenCode (recommended, not yet executed)
| Command | Reason |
|---------|--------|
| `/model` | Model switching is machine operation |
| `/mcp` | MCP surface discovery is machine operation |
| `/act` | A-FORGE execution is machine operation |
| `/forge` | Build/deploy is machine operation |
| `/code` | Code generation is machine operation |
| `/ops` | Infra operations is machine operation |
| `/diagram` | Diagram generation is machine operation |
| `/deliver` | File courier is machine operation |

### Stays in Hermes (Cognitive Lane)
| Command | Category |
|---------|----------|
| `/genesis` | Identity audit — cognitive |
| `/seal` | VAULT999 seal — governance |
| `/status` | Health report — observational |
| `/think` | Reasoning mode — cognitive |
| `/receipt` | Audit lookup — governance |
| `/organs` | Zen organs — cognitive |
| `/reality` | GEOX intel — domain cognitive |
| `/uncertainty` | Uncertainty classification — cognitive |
| `/cooling` | WEALTH cooling — domain cognitive |
| `/risk` | Risk assessment — governance |
| `/apex` | APEX alignment — cognitive |
| `/zen` | Doctrine check — cognitive |
| `/next` | Task queue — cognitive |
| `/audit` | ASI audit — governance |
| `/vault` | VAULT999 lookup — governance |
| `/image` | Creative — cognitive |
| `/email` | Productivity — human-facing |

### Cron Jobs Staying in Hermes (Cognitive)
| Job | Schedule | Why |
|-----|----------|-----|
| `morning-brief` | 7am MYT | Human-facing intelligence brief |
| `midday-scan` | 12pm MYT | Human-facing scan report |
| `evening-digest` | 6pm MYT | Human-facing end-of-day digest |
| `overnight-research` | 11pm MYT | Human-facing research brief |

## Miniapp Bots

**Status:** Already separate from Hermes.

The 4 miniapp bots (AAA/AGI/AIA/SADO) run as separate Node.js processes from `/root/AAA/telegram-miniapp/`. They are NOT wired through Hermes. They serve the same miniapp URL (`app.arif-fazil.com`) with different entry points.

**Future:** These should consolidate under OpenClaw (@AGI_ASI_bot) as the metabolizer gateway. OpenClaw already runs on :18789 as a node gateway.

## RAM Impact

| Before | After |
|--------|-------|
| Hermes: 553MB (doing everything) | Hermes: ~400MB (cognitive only) |
| OpenCode: 74MB (code only) | OpenCode: 74MB (unchanged) |
| 2 machine cron in Hermes agent | 2 machine cron in system cron |

## Next Steps (not yet executed)

1. Move Hermes machine commands to OpenCode bot handlers
2. Consolidate miniapp bots under OpenClaw gateway
3. Strip machine skills from Hermes skill directory
4. Rename opencode-bot to 777-forge (identity drift fix)

---

*DITEMPA BUKAN DIBERI*
