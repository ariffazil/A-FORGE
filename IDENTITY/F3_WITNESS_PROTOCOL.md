# F3 External Witness Protocol — Agent Onboarding

> **DITEMPA BUKAN DIBERI** — Forged, Not Given.
> **Doctrine:** 2026-07-08-test-doctrine.md (SEALED entry_id: 114e226187be4bf4)
> **Authority:** F13 SOVEREIGN

---

## What Is F3 Witness?

F3 (NAMING/WITNESS) requires that an agent proves it is **operationally alive**, not just registered. A name in a registry is not a citizen. A citizen demonstrates behavior.

> "Call things what they are." — F3

An agent with an Ed25519 keypair but no live operational pulse is a **passport without a person**. F3 witness is the first breath.

---

## The Three Witness Channels

| Channel | What It Proves | How |
|---------|---------------|-----|
| **Human** | Sovereign acknowledges the agent | Arif confirms: "Agent X is commissioned" |
| **AI** | Kernel verifies identity + session | `arif_init` → session bound → actor verified |
| **External** | Agent demonstrates live tool use | Agent executes one governed action through federation |

**W³ = ∛(Human × AI × External)** — geometric mean. Any channel = 0 → W³ = 0.

---

## Per-Agent Witness Checklist

### 📡 Hermes (Telegram)

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | **Identity** | Agent has Ed25519 keypair | ✅ Generated |
| 2 | **Registry** | Entry in agent_identities.json | ⏳ Pending |
| 3 | **Session bind** | `arif_init` from Hermes runtime | session_id returned |
| 4 | **Live pulse** | Hermes sends one governed message to Arif on Telegram | Message contains `session_id` + `actor_id` |
| 5 | **Kernel verify** | Kernel receives and validates the message | `actor_id` matches registry |
| 6 | **F11 check** | No constitutional breach during pulse | Clean |

**How Hermes completes F3:**
```
1. Hermes boots → calls arif_init(mode="init", actor_id="hermes")
2. Kernel returns session_id + authority
3. Hermes sends message to Arif: "Hermes online. Session: <session_id>. Actor: hermes."
4. Kernel logs the pulse → F3 witness recorded
```

**Blocker:** Hermes needs to call `arif_init` from its runtime, not from a human typing commands.

---

### 🌀 OpenClaw (A2A / Channel)

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | **Identity** | Agent has Ed25519 keypair | ✅ sha256:5eef4f66…10e3 |
| 2 | **Registry** | Entry in agent_identities.json | ✅ Commissioned |
| 3 | **Session bind** | `arif_init` from OpenClaw runtime | session_id returned |
| 4 | **Live pulse** | OpenClaw executes one tool call through A-FORGE MCP | Tool call logged |
| 5 | **Lease check** | Lease valid, no T3 action without approval | Clean |
| 6 | **F11 check** | No constitutional breach during pulse | Clean |

**How OpenClaw completes F3:**
```
1. OpenClaw boots → calls arif_init(mode="init", actor_id="openclaw")
2. Kernel returns session_id + authority (OBSERVE + limited MUTATE)
3. OpenClaw calls one tool: e.g., forge_health_check() or arif_observe()
4. Tool call logged with session_id + actor_id → F3 witness recorded
```

**Blocker:** OpenClaw needs to call `arif_init` from its runtime, establishing a governed session.

---

### 🏗️ grok-build (CARD_ONLY → needs upgrade)

| # | Check | Status | Blocker |
|---|-------|--------|---------|
| 1 | **Identity** | ❌ No Ed25519 keypair | Generate via `agent-keygen.sh grok-build` |
| 2 | **Registry** | ❌ Not in agent_identities.json | Register via `agent-onboard.py` |
| 3 | **Agent card** | ✅ `grok-build.json` exists | — |
| 4 | **Authority** | ⚠️ CARD_ONLY | Needs sovereign approval to upgrade |
| 5 | **Session bind** | ❌ No session | Needs `arif_init` from runtime |
| 6 | **Live pulse** | ❌ No pulse | Needs tool execution |

**grok-build is at Stage 0** — agent card exists but no identity, no registry, no pulse.

**To commission grok-build:**
```bash
# Step 1: Generate keypair
/root/A-FORGE/scripts/identity/agent-keygen.sh grok-build /root/A-FORGE/IDENTITY/keys/grok-build

# Step 2: Register (sovereign approval)
python3 /root/A-FORGE/scripts/identity/agent-onboard.py \
  --agent-id grok-build \
  --agent-type external \
  --role build_harness \
  --public-key /root/A-FORGE/IDENTITY/keys/grok-build/grok-build_ed25519_public.pem \
  --sovereign-approval

# Step 3: F3 witness — grok-build calls arif_init + one tool
```

---

## F3 Witness Recording

When an agent completes its F3 witness, the following entry is written to governance alerts:

```json
{
  "timestamp": "2026-07-09T01:38:00Z",
  "event": "f3_witness_completed",
  "agent_id": "hermes",
  "session_id": "SEAL-...",
  "witness_channels": {
    "human": {"score": 1.0, "source": "sovereign_ack"},
    "ai": {"score": 1.0, "source": "arif_init_verified"},
    "external": {"score": 1.0, "source": "live_tool_call"}
  },
  "W3": 1.0,
  "verdict": "WITNESSED"
}
```

---

## Status Board

| Agent | Identity | Registry | Session | Live Pulse | F3 Status |
|-------|----------|----------|---------|------------|-----------|
| **Hermes** | ✅ Ed25519 | ⏳ Pending | ⏳ Pending | ⏳ Telegram check-in | **PENDING** |
| **OpenClaw** | ✅ Ed25519 | ✅ Commissioned | ⏳ Pending | ⏳ A2A pulse | **PENDING** |
| **grok-build** | ❌ No keypair | ❌ Not registered | ❌ No session | ❌ No pulse | **CARD_ONLY** |

---

*Forged: 2026-07-09 by FORGE (000Ω)*
*DITEMPA BUKAN DIBERI*
