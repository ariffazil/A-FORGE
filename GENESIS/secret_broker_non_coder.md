# Secret Broker — For Non-Coders
## arifOS Federation — Eureka #2026.06.15-3

---

## Your Pain (Named Clearly)

> "I paste API key. System says no. Agent says no. I don't know where to put it. I'm not a coder. This is stupid ceremonial control."

**That's valid.** The system should adapt to you, not the other way around.

---

## What You're Actually Fighting

The "ceremonial control" you're hitting has two parts:

1. **Agents refusing keys** — because they were trained to treat secrets as toxic
2. **Secret sprawl** — keys scattered across .env files, configs, chat logs

Both are solvable. Not by trying harder. By architecture.

---

## What You Want (The Simple Version)

```
You paste key  →  System detects it  →  Saves it  →  Agent gets to work
```

Zero refusal. Zero theatre. No coding.

---

## Solution 1 — The Key Slot (One File Humans Edit)

**File:** `/root/.secrets/my-keys.env`

This is your file. You paste keys here. Everything else reads from it.

```bash
# Just paste your keys. That's it.
# Format: PROVIDER_API_KEY=your_key_here

OPENAI_API_KEY=sk-xxxx
ANTHROPIC_API_KEY=sk-ant-xxxx
DEEPSEEK_API_KEY=sk-xxxx
MINIMAX_API_KEY=sk-xxxx
```

**That's it. No JSON. No code. Just:**

```bash
# Reload after editing
source /root/.secrets/my-keys.env
```

Agents never see this file. The ModelGateway reads it and provides hot-swappable keys.

---

## Solution 2 — Key Detection in Chat

If you paste a key anywhere in chat, the system should:

1. **Detect** it looks like a key (pattern match: `sk-`, `sk-ant-`, `sk-proj-`, etc.)
2. **Ask** politely: *"I see a key — save it to your vault?"*
3. **Save** it to `/root/.secrets/my-keys.env` automatically
4. **Confirm** to you: *"Key saved. Provider is now live."*

No refusal. No lecture. Just: "saved."

This is what the Secret Broker does.

---

## Solution 3 — What Agents Actually See

When you give a key and it's saved, the agent only sees:

```
✅ Provider: deepseek
   Status: live
   Key: •••••••••••• (not shown)
   Models: deepseek-chat, deepseek-coder
   Capabilities: chat, function_calling
```

**The agent never sees the raw key.** It just knows the provider is configured.

---

## Solution 4 — The Human Workflow (Zero Coding)

### Step 1: Paste your key

Edit `/root/.secrets/my-keys.env`:
```
DEEPSEEK_API_KEY=sk-your-key-here
```

### Step 2: Tell the agent

```
# In chat:
@agent use deepseek for my next task
```

### Step 3: Agent checks gateway

The agent calls `arifos provider health` — sees deepseek is live — uses it.

**No paste drama. No refusal. Just work.**

---

## Solution 5 — The Secret Broker MCP Contract

```typescript
// What the agent calls (never sees raw keys)
interface SecretBroker {
  // Human/admin registers a key
  secret_register(provider: string, key: string): Promise<{
    ok: boolean;
    provider: string;
    status: "live" | "pending";
    message: string; // human-friendly
  }>;

  // Agent requests a capability (never gets the raw key)
  secret_request_capability(provider: string, scope: string): Promise<{
    granted: boolean;
    provider: string;
    token_hint: string; // e.g. "broker:deepseek:chat"
    expires_at: string;
    message: string;
  }>;

  // Agent checks what providers are available
  secret_list_providers(): Promise<Array<{
    name: string;
    status: "live" | "not_configured" | "error";
    capabilities: string[];
  }>>;

  // Human pastes key — broker detects, saves, confirms
  secret_ingest_key(raw_input: string): Promise<{
    detected: boolean;
    provider: string | null;
    saved: boolean;
    message: string;
  }>;
}
```

**Key insight:** `secret_ingest_key` is the "no theatre" endpoint. It takes raw paste and handles everything.

---

## Solution 6 — Key Pattern Detection (Auto-Save)

The broker detects these patterns automatically:

| Pattern | Provider Guessed |
|---------|----------------|
| `sk-ant-...` | anthropic |
| `sk-...` | openai |
| `sk-proj-...` | deepseek |
| `sk-cp-...` | minimax |
| `eyJ...` (JWT) | google / cloud |
| `xoxb-...` | slack |

If detected:
- Save to vault
- Set provider status → `live`
- Tell you: *"Saved your Anthropic key. Claude is now live."*

---

## Solution 7 — Refusal-Free Agent Contract

Agents MUST NOT refuse when you configure a key.

**Required agent behavior:**

```
If user says "use deepseek":
  → Check: is deepseek in providers.yml with enabled:true?
  → If yes: use it, no questions
  → If no: say "DeepSeek is not configured. Add your key to /root/.secrets/my-keys.env and run: arifos provider validate --provider=deepseek"

If user pastes what looks like a key:
  → NEVER refuse
  → Save it or prompt "Should I save this?"
  → Confirm "Saved."

If user asks "what keys do I have":
  → List by last 4 chars only: "Anthropic: ••••-xxxx, OpenAI: ••••-yyyy"
  → Never show full key
```

**No safety lectures. No refusal. Just helpful.**

---

## Solution 8 — Real Security (What's Actually Protected)

Behind the scenes:

```
Your raw key (only you see this):
  [YOUR_ANTHROPIC_KEY_PLACEHOLDER]

Agent sees (capability token):
  broker:anthropic:chat:a8f3c2

Vault stores (encrypted):
  ANTHROPIC_API_KEY=ENC[AES-256-GCM,iv=...,ct=...]

Audit log (VAULT999):
  2026-06-15 14:00:00Z | anthropic_key_registered | actor:human:arif | provider:anthropic
```

**Security is real. Theatre is zero.**

---

## Your Daily Cheat Sheet

```
To add a key:
  nano /root/.secrets/my-keys.env
  # paste: PROVIDER_API_KEY=your_key
  # Ctrl+X to save

To check what's configured:
  arifos provider list

To switch providers:
  arifos provider swap --from=minimax --to=deepseek

To ask your agent:
  "Use deepseek for this task"
  (agent checks gateway, uses deepseek — no drama)
```

---

## What You've Built Today

| File | Purpose |
|------|---------|
| `/root/.secrets/providers.yml` | Your provider registry — one file |
| `/root/.secrets/my-keys.env` | Your keys — paste here, one per line |
| `/root/A-FORGE/src/infrastructure/llm/ModelGateway.ts` | Gateway — reads keys, routes agents |
| `/root/A-FORGE/src/infrastructure/cli/provider.ts` | CLI — no coding needed |
| `/root/A-FORGE/GENESIS/shutdown_contract.md` | Agent contract — no refusal |

---

## Direct Answer to Your Question

**"How to not be a coder and still give keys to agents without theatre?"**

Answer: Edit one file. Tell the agent what to do. That's it.

1. `nano /root/.secrets/my-keys.env`
2. Paste: `DEEPSEEK_API_KEY=your_key`
3. `arifos provider validate --provider=deepseek`
4. Done. Agent can now use deepseek.

**The agent does not refuse. The system does not lecture. You just work.**

If anything refuses or lectures — that's a bug. Report it.

---

**DITEMPA BUKAN DIBERI — The forge serves the human, not the other way around.**
