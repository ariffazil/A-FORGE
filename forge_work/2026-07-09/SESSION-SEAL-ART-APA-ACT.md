# Session Seal — 2026-07-09 — ART · APA · ACT

> **Sovereign:** Arif (F13)
> **Session:** FORGE-2026-07-09-three-layer-zen
> **Seal:** SESSION_20260709_ART_APA_ACT

---

## What Was Built

### 1. Three-Layer Bot Architecture

```
HERMES    SOUL     /000_salam.../999_ingat    human digital tools
OPENCLAW  GUTS     /000.../999 process verbs  machine/VPS/infra
777-FORGE HANDS    /000.../999 machine verbs  intelligent code
```

### 2. Cognitive Commands (Hermes)
- 10 BM cognitive verbs: `/000_salam` through `/999_ingat`
- 12 cognitive verbs: `/ask_curious`, `/dream_what`, etc.
- SOUL.md rewritten for cognitive-only identity
- 13 machine skills archived, 16 remain

### 3. Process Commands (OpenClaw)
- 10 process verbs: INTAKE→ABSORB→DIGEST→DISTRIBUTE→TRANSFORM→VALIDATE→RELEASE→SYNTHESIZE→ARBITRATE→CRYSTALLIZE
- 7 utility: /probe /route /bridge /pipe /state /model /mcp

### 4. Machine Commands (777-FORGE)
- 10 machine verbs: INIT→OBSERVE→THINK→ROUTE→ACT→VERIFY→HEART→FORGE→JUDGE→VAULT
- Each with its own handler (was stubbed, now real)
- Identity drift resolved
- /start /help /status zen'd

### 5. Tool Routing
- **Hermes:** brave-search, perplexity, context7, github (read), GEOX, WEALTH, WELL
- **OpenClaw:** VPS, docker, shell, system ops
- **777-FORGE:** A-FORGE, git, build, deploy

### 6. Machine Ops Separated
- federation-health → system cron (every 2h)
- well-entropy-seal → system cron (every 6h)
- Cognitive briefs stay in Hermes

---

## The Insight: ART · APA · ACT

### The Complete Constitutional Reflex Arc

```
ART (pre-kernel)          → Should this approach the kernel?
  POWER × TRUST × SYSTEM  → PROCEED | HOLD | BLOCK | DEFAULT_OBSERVE

KERNEL (judgment)          → Is this lawful?
  F1-F13                   → SEAL | SABAR HOLD | VOID

APA (application layer)    → How do we reach external systems?
  forge_lease + manifests  → capability-gated connectors

ACT (execution)            → Touch reality without corruption.
  DRY-RUN → EXECUTE        → VERIFY → RECEIPT
```

**APA fills the gap between judgment and execution.**

Without APA:
```
ART → KERNEL → ACT → ??? (how do we actually call Gmail? GitHub write? Calendar?)
```

With APA:
```
ART → KERNEL → APA → ACT → VAULT999
                            (receipt)
```

### What APA Is

APA is forge_lease lifted into a formal application protocol.

- **forge_lease** = capability-based, time-bounded authorization primitive
- **APA** = that primitive formalized into manifests, scopes, gates, and bridges for external applications

APA replaces OAuth with lease-based auth:
- OAuth: browser → vendor → token → cloud → API
- APA: user → forge_lease → local secrets → direct protocol → API

### How APA Maps to the Stack

| Layer | Role | APA Component |
|-------|------|---------------|
| **AAA** (control plane) | Agent routing, session, leases | Lease engine, actor binding |
| **APA** (application protocol) | External app manifests, scopes, bridges | Manifest + forge_lease + gates |
| **A-FORGE** (execution shell) | MCP tools, event sourcing, receipts | forge_email, forge_calendar, etc. |

### The Complete Data Flow

```
Arif: "schedule a meeting tomorrow at 3pm"
  │
  ├─ ART: classify intent → MUTATE, calendar, medium blast
  ├─ KERNEL: F1-F13 check → needs lease calendar:write
  ├─ APA: check forge_lease → scope=calendar:write, TTL=60s
  ├─ ACT: forge_calendar.createevent → CalDAV bridge → external calendar
  └─ VAULT999: receipt {actor, session, verb, result, sha256}
```

### APA Connectors (planned)

| Connector | Protocol | MCP Tool | Lease Scope |
|-----------|----------|----------|-------------|
| Email | IMAP/SMTP | forge_email.search, forge_email.send | email:read, email:send |
| Calendar | CalDAV | forge_calendar.list, forge_calendar.create | calendar:read, calendar:write |
| GitHub | REST | forge_github.read, forge_github.write | github:read, github:write |
| Drive | HTTP | forge_drive.list, forge_drive.upload | drive:read, drive:write |
| Slack | WebSocket | forge_slack.read, forge_slack.send | slack:read, slack:write |

### Why This Matters

This is not "add tools to a model." This is:

> Start with physics (laws, invariants, primitives).
> Then derive protocols (APA).
> Then derive runtime behavior (A-FORGE tool calls).

The difference between ad-hoc tool integration and constitutional tool governance.

---

## Files Modified

| File | Change |
|------|--------|
| `/root/HERMES/SOUL.md` | Rewritten — cognitive-only, human digital tools |
| `/root/HERMES/config.yaml` | brave/context7/github un-quarantined, aforge removed |
| `/root/HERMES/skills/cognitive-commands/SKILL.md` | NEW — 10 cognitive + 12 verb commands |
| `/root/HERMES/HERMES-COMMAND-MANIFEST.md` | Rewritten — /NNN_word format |
| `/root/HERMES/skills/.archive-2026-07-09/` | 13 machine skills archived |
| `/root/HERMES/cron/jobs.json` | 2 machine jobs disabled |
| `/root/.openclaw/workspace/skills/openclaw-commands/SKILL.md` | NEW — process commands |
| `/root/.openclaw/workspace/openclaw/agents/agi/workspace.yaml` | skill registered, YAML fixed |
| `/root/.openclaw/workspace/bots/opencode-bot/bot.py` | 4 new handlers, /start /help /status zen'd |
| `/etc/systemd/system/opencode-bot.service` | Description updated |
| `/root/A-FORGE/forge_work/2026-07-09/` | Architecture docs |

---

## What's Next

1. **APA-GitHub connector** — manifest, lease scopes, bridge, MCP tool schema
2. **APA-Email connector** — IMAP/SMTP bridge with lease-gated send
3. **APA-Calendar connector** — CalDAV bridge
4. **Lease engine** — forge_lease formalization
5. **OpenClaw miniapp consolidation** — AAA/AGI/AIA/SADO → single gateway

---

## Constitutional Anchors

- F1 AMANAH: All changes reversible. Backups before edits.
- F2 TRUTH: Every claim labeled OBS/DER/INT/SPEC.
- F4 CLARITY: Entropy reduced. 28→16 skills, machine ops separated.
- F11 AUDIT: This seal is the receipt.
- F13 SOVEREIGN: Arif directed, Arif approved.

---

*v1 — 2026-07-09. ART → KERNEL → APA → ACT → VAULT999.*
*DITEMPA BUKAN DIBERI*
