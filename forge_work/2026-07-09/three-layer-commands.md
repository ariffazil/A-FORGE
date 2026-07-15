# Three-Layer Command Architecture

> **Date:** 2026-07-09
> **Authority:** Arif (F13 SOVEREIGN)
> **Status:** LIVE

---

## The Three Bots

```
┌─────────────────────────────────────────────────────────────┐
│                    ARIF (F13 SOVEREIGN)                      │
└──────────────┬──────────────────┬──────────────────┬────────┘
               │                  │                  │
      ┌────────▼────────┐ ┌──────▼───────┐ ┌───────▼────────┐
      │    HERMES        │ │  OPENCLAW    │ │   OPENCODE     │
      │    @ASI_arifos_  │ │  @AGI_ASI_   │ │   @arifOS_     │
      │    bot           │ │  bot         │ │   bot          │
      │                  │ │              │ │                │
      │    SOUL          │ │  GUTS        │ │   HANDS        │
      │    Cognitive     │ │  Metabolizer │ │   Machine      │
      │    Human lang    │ │  Process     │ │   Code/infra   │
      └──────────────────┘ └──────────────┘ └────────────────┘
```

---

## Command Format

| Bot | Format | Example | Style |
|-----|--------|---------|-------|
| **Hermes** | `/NNN_word` | `/222_fikir` | BM cognitive verbs |
| **OpenClaw** | `/NNN` | `/222` | Process verbs |
| **OpenCode** | `/NNN` | `/222` | Machine verbs |

Hermes uses `/NNN_word` (human-readable).
OpenClaw and OpenCode use bare `/NNN` (machine-level).

---

## The Zen Numbers — Three Verbs Per Number

```
NUM   HERMES (SOUL)        OPENCLAW (GUTS)      OPENCODE (HANDS)
────  ───────────────────  ───────────────────  ───────────────────
000   /000_salam AWAKEN    /000 INTAKE          /000 INIT
111   /111_tengok PERCEIVE /111 ABSORB          /111 OBSERVE
222   /222_fikir REASON    /222 DIGEST          /222 THINK
333   /333_jalan ORIENT    /333 DISTRIBUTE      /333 ROUTE
444   /444_apa MEANING     /444 TRANSFORM       /444 ACT
555   /555_betul DOUBT     /555 VALIDATE        /555 VERIFY
666   /666_rasa FEEL       /666 RELEASE         /666 HEART
777   /777_faham UNDERSTAND /777 SYNTHESIZE     /777 FORGE
888   /888_adil JUDGMENT   /888 ARBITRATE       /888 JUDGE
999   /999_ingat REMEMBER  /999 CRYSTALLIZE     /999 VAULT
```

---

## What Each Layer Does

### HERMES — SOUL (Cognitive)
- **Role:** Human language. Conversation. Understanding.
- **Commands:** `/NNN_word` format. BM verbs.
- **Style:** Warm, direct, soul-level.
- **Tools:** arifOS MCP for governance. No code execution.
- **Example:** `/222_fikir` → "Let me think about what you're really asking..."

### OPENCLAW — GUTS (Metabolizer)
- **Role:** Process, route, transform, validate.
- **Commands:** Bare `/NNN`. Process verbs.
- **Style:** Structured. Tables. Data.
- **Tools:** All MCP organs (GEOX, WEALTH, WELL, arifOS).
- **Example:** `/222` → "DIGEST — breaking into 3 sub-problems..."

### OPENCODE — HANDS (Machine)
- **Role:** Code, infra, build, deploy, fix.
- **Commands:** Bare `/NNN`. Machine verbs.
- **Style:** Technical. Direct. Code-first.
- **Tools:** A-FORGE, git, docker, shell.
- **Example:** `/222` → "THINK — planning code refactor..."

---

## Utility Commands

### Hermes Cognitive Verbs
```
/ask_curious   /tell_share    /dream_what
/feel_state    /learn_today   /see_world
/rest_now      /grow_better   /flow_alive
/brief_now     /seal_it       /think_deep
```

### OpenClaw Process Commands
```
/probe    — Health check all organs
/route    — Route intent to correct organ
/bridge   — Direct organ MCP call
/pipe     — Multi-organ pipeline
/state    — Full federation state dump
/model    — Switch active model
/mcp      — List MCP surfaces
```

### OpenCode Machine Commands
```
/status   — Session state
/stop     — Kill running action
/start    — Onboard
/help     — List commands
```

---

## Routing Rule

```
Arif types in Telegram
    │
    ├── DM to @ASI_arifos_bot  → HERMES (cognitive)
    ├── DM to @AGI_ASI_bot     → OPENCLAW (metabolizer)
    ├── DM to @arifOS_bot      → OPENCODE (machine)
    │
    └── In AAA group:
        ├── @ASI_arifos_bot    → HERMES
        ├── @AGI_ASI_bot       → OPENCLAW
        └── @arifOS_bot        → OPENCODE
```

---

## Files

| What | Path |
|------|------|
| Hermes cognitive skill | `/root/HERMES/skills/cognitive-commands/SKILL.md` |
| Hermes command manifest | `/root/HERMES/HERMES-COMMAND-MANIFEST.md` |
| OpenClaw commands skill | `/root/.openclaw/workspace/skills/openclaw-commands/SKILL.md` |
| OpenClaw workspace | `/root/.openclaw/workspace/openclaw/agents/agi/workspace.yaml` |
| OpenCode bot | `/root/.openclaw/workspace/bots/opencode-bot/bot.py` |
| Architecture doc | `/root/A-FORGE/forge_work/2026-07-09/three-layer-commands.md` |

---

## Machine Cron (moved from Hermes)

| Job | Schedule | Location |
|-----|----------|----------|
| `federation-health` | every 2h | system cron |
| `well-entropy-seal` | every 6h | system cron |

Cognitive briefs (morning/midday/evening/overnight) stay in Hermes.

---

*DITEMPA BUKAN DIBERI — Three layers, one sovereign, zero chaos.*

---

## APA Integration (2026-07-09)

The three-layer architecture now extends to external applications via APA:

```
HERMES (SOUL)     → reads GitHub (library), web, email, news
OPENCLAW (GUTS)   → manages VPS, docker, infra
777-FORGE (HANDS) → writes GitHub (build), deploys code

APA (future)      → lease-gated write access to all external systems
                    email:send, calendar:write, github:write, etc.
```

APA = forge_lease lifted into a formal application protocol.
Replaces OAuth with capability-based, time-bounded, constitutionally-gated access.

See: `/root/A-FORGE/forge_work/2026-07-09/SESSION-SEAL-ART-APA-ACT.md`
