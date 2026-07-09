# APA-Telegram — Sovereign Messenger Connector (COMPILE TARGET)

> **THIS IS NOT A STANDALONE BRIDGE. THIS IS THE CONSTITUTIONAL ENVELOPE AROUND HERMES' TELEGRAM INTEGRATION.**
> Telegram is the F13 veto surface, the sovereign control channel, the Hermes command line.
> APA-Telegram formalizes lease-gated verbs, receipt generation, and VAULT999 sealing around what Hermes already does.
>
> **Forged:** 2026-07-09 · **Live gateway:** `hermes-asi-gateway.service` (Telegram) + `hermes-dispatcher.service` (files)
> **Bots:** @ASI_arifos_bot (Hermes) · @AGI_ASI_bot (OpenClaw) · @arifOS_bot (777 FORGE)
> **Token source:** `/root/.secrets/vault.flat.env` → environment → Hermes process · never in LLM · never in git
> **Status:** SPECIFICATION · Hermes already live; APA formalizes governance
> **33-surface position:** Agent Ω #10 (Connector bridges) → Human Δ #4 (Messenger)
>
> **Clone checklist (§9):** This is a variant of the APA-GitHub template. The bridge is Hermes itself, not a standalone Python HTTP service.

---

## 0. The Bridge Theorem (what APA-Telegram operationalizes)

```
classify before judgment,
constrain after judgment.
```

| Stage | Executor | Job | Telegram-specific |
|-------|----------|-----|-------------------|
| **ART** | Hermes pre-kernel reflex | Classify command intent: OBSERVE/MUTATE/IRREVERSIBLE, blast_radius, lease_scope | `/help` = OBSERVE, `/yolo` = MUTATE (changes system behavior), `/restart` = IRREVERSIBLE |
| **KERNEL** | arifOS F1–F13 | Constitutional judgment | F13 path: Arif is the only human with veto; messages from him bypass mention gates |
| **APA** | Connector manifest + forge_lease | Express authorized power via Telegram Bot API | Hermes injects bot token from vault.flat.env; token never in LLM context |
| **ACT** | Hermes gateway + Telegram API | Touch reality: send/edit/delete message, execute command | DRY_RUN → SIMULATE → EXECUTE → VERIFY → ROLLBACK → RECEIPT |
| **VAULT999** | arifOS seal chain | Remember immutably | Every MUTATE command produces a receipt; IRREVERSIBLE commands require F13 ack recorded |

**Telegram is the F13 veto surface.** It is the ONLY channel where Arif can stop any agent instantly. No other APA connector carries this constitutional weight.

```
ART ──classify──▶ KERNEL ──judge──▶ APA ──express──▶ ACT ──touch──▶ VAULT999
     │                │                │                │
  slash command    F1–F13 floors    lease + bot token  Hermes→Telegram API
     │                │                │                │
  STOP unlawful    STOP unlawful    STOP unlawful    STOP unlawful
```

**The five irreducible steps for Telegram:**

1. Command is not action — a `/yolo` is intent, not yet live
2. Classification is not authorization — Hermes classifies, arifOS authorizes
3. Authorization is not execution — SEAL permits, Hermes executes
4. Execution is not completion — message sent ≠ receipt sealed
5. Completion requires witness — VAULT999 records the exchange

---

## 1. Complete verb × action-class × reflex matrix

### 1.1 OBSERVE commands (read-only, no lease required)

| Command | Action Class | Blast | What It Reads | ART Classifies | Kernel Checks | APA Expresses | ACT Phases | VAULT999 |
|---------|-------------|-------|---------------|----------------|---------------|---------------|------------|----------|
| `/help` | OBSERVE | LOW | Command manifest | Observer. No mutation. | F2 (truth — list real commands), F4 (clarity) | Hermes responds in-chat. No lease. | DRY_RUN (validate command exists) → EXECUTE (reply with help) → VERIFY (message sent) | Optional |
| `/commands` | OBSERVE | LOW | Paginated command list | Observer. | F2, F4 | Same. | Same pattern. | Optional |
| `/status` | OBSERVE | LOW | Session: model, context, uptime | Observer. | F2 (truth), F7 (Ω₀ on uptime) | Same. | Same. | Optional |
| `/model [name]` | OBSERVE | LOW | Current model or list | Observer. No mutation on read. | F2, F7 (model capabilities are DERIVED) | Same. | DRY_RUN → EXECUTE → VERIFY | Optional |
| `/profile` | OBSERVE | LOW | Active profile info | Observer. | F2, F7 | Same. | Same. | Optional |
| `/usage` | OBSERVE | LOW | Token usage stats | Observer. | F2 (DERIVED from API), F7 | Same. | Same. | Optional |
| `/insights [days]` | OBSERVE | LOW | Usage analytics | Observer. | F2 (DERIVED), F7 | Same. | Same. | Optional |
| `/agents` | OBSERVE | LOW | Active agent list + tasks | Observer. | F2 (truth), F3 (witness — list only live agents) | Same. | Same. | Optional |
| `/skills` | OBSERVE | LOW | Search/install skills | Observer on list. | F2, F4 | Same. | Same. | Optional |
| `/tools` | OBSERVE | LOW | Tool inventory | Observer. | F2, F4 | Same. | Same. | Optional |
| `/toolsets` | OBSERVE | LOW | Toolset list | Observer. | F2, F4 | Same. | Same. | Optional |
| `/plugins` | OBSERVE | LOW | Plugin list | Observer. | F2, F4 | Same. | Same. | Optional |
| `/cron` | OBSERVE | LOW | Cron job status | Observer. | F2, F4 | Same. | Same. | Optional |
| `/platforms` | OBSERVE | LOW | Platform connection status | Observer. | F2, F4 | Same. | Same. | Optional |
| `/curator` | OBSERVE | LOW | Skill lifecycle status | Observer. | F2, F4 | Same. | Same. | Optional |

**OBSERVE rule:** No lease required. Hermes responds in-chat using its existing gateway. All responses labeled with evidence tags. RECEIPT optional but RECOMMENDED.

### 1.2 MUTATE commands (lease REQUIRED — changes system state)

| Command | Action Class | Blast | What It Changes | ART Classifies | Kernel Checks | APA Expresses | ACT Phases | VAULT999 |
|---------|-------------|-------|-----------------|----------------|---------------|---------------|------------|----------|
| `/model [name]` **write** | MUTATE | MEDIUM | Switches LLM model | Mutator. Changes agent cognition substrate. Reversible (switch back). Requires lease `telegram.control`. | All 13 floors + F1 (reversible), F2 (model capabilities labeled), F4 (entropy check), F7 (Ω₀ on model quality), F11 (receipt), F13 (888 can HOLD) | ① manifest resolve ② verify lease ③ TTL alive ④ dispatch to Hermes gateway | DRY_RUN (validate model exists) → SIMULATE (show switch target) → EXECUTE (swap model) → VERIFY (confirm active model) → ROLLBACK (switch back) → RECEIPT | **REQUIRED** |
| `/reasoning [level]` | MUTATE | MEDIUM | Changes reasoning depth | Mutator. Affects all downstream cognition. Reversible. Requires lease `telegram.control`. | Same pattern. | Same. | DRY_RUN → SIMULATE → EXECUTE → VERIFY → ROLLBACK → RECEIPT | **REQUIRED** |
| `/verbose` | MUTATE | LOW | Toggles output verbosity | Mutator. Low blast — cosmetic. Reversible. | Same. | Same. | Same pattern. | **REQUIRED** |
| `/yolo` | **MUTATE (HIGH)** | **HIGH** | **Toggles approval bypass** | Mutator. This is the DANGER ZONE command — it removes the human approval gate. Reversible but blast is HIGH. Requires lease `telegram.control` + ACK recommended. | **888_HOLD path recommended.** F1 (reversible but dangerous), F3 (witness required), F13 (sovereign ack recommended) | Same but with elevated lease: `telegram.control.high`. TTL ≤ 600s. | DRY_RUN (show current state) → SIMULATE (show effect: "approval bypass will be ON") → **STOP at SIMULATE unless ACK for production hardening** → EXECUTE → VERIFY → ROLLBACK (toggle off) → RECEIPT | **REQUIRED + ACK recommended** |
| `/fast` | MUTATE | LOW | Toggles priority processing | Mutator. Reversible. | Same. | Same. | Same pattern. | **REQUIRED** |
| `/new` | MUTATE | MEDIUM | Fresh session — clears context | Mutator. Destroys current session state. Irreversible for that session (context lost). Requires lease `telegram.control`. | F1 (old session recoverable via `/resume`), F4 (clean slate = entropy reduction), F11 (receipt) | Same. | DRY_RUN (show session to be closed) → SIMULATE → EXECUTE → VERIFY (new session active) → ROLLBACK (resume old if named) → RECEIPT | **REQUIRED** |
| `/clear` | MUTATE | MEDIUM | Clear screen + new session | Mutator. Same as `/new` + UI reset. | Same. | Same. | Same. | **REQUIRED** |
| `/title [name]` | MUTATE | LOW | Names the session | Mutator. Low blast. Reversible. | Same. | Same. | Same. | **REQUIRED** |
| `/compress` | MUTATE | MEDIUM | Manually compresses context | Mutator. Changes agent memory state. Reversible (re-expand may lose fidelity). | F1 (partial reversibility), F2 (truth — compression may lose detail), F4 (entropy reduction is the goal), F7 (loss declared) | Same. | DRY_RUN → SIMULATE (show compression ratio) → EXECUTE → VERIFY → ROLLBACK (limited) → RECEIPT | **REQUIRED** |
| `/goal [text]` | MUTATE | MEDIUM | Sets standing goal | Mutator. Shapes agent behavior across turns. Reversible. | Same. | Same. | Same. | **REQUIRED** |
| `/queue <prompt>` | MUTATE | LOW | Queues prompt for next turn | Mutator. Low blast. | Same. | Same. | Same. | **REQUIRED** |
| `/steer <prompt>` | MUTATE | MEDIUM | Injects message after next tool call | Mutator. Affects agent behavior mid-execution. | Same + F8 (GENIUS — is steer the simplest path?). | Same. | Same. | **REQUIRED** |
| `/background <prompt>` | MUTATE | MEDIUM | Runs prompt in background | Mutator. Spawns parallel execution. | Same + F4 (parallel entropy check). | Same. | Same. | **REQUIRED** |
| `/skill <name>` | MUTATE | MEDIUM | Loads skill into session | Mutator. Changes agent capability surface. | Same + F3 (witness — skill source verified?). | Same. | Same. | **REQUIRED** |
| `/reload-skills` | MUTATE | MEDIUM | Re-scans skill directory | Mutator. Refreshes capability map. | Same. | Same. | Same. | **REQUIRED** |
| `/reload-mcp` | MUTATE | HIGH | Reloads MCP servers | Mutator. High blast — affects all tool access. | Same + F8 (don't reload if stable), F12 (reload could inject) | Same. TTL ≤ 600s. | Same. | **REQUIRED** |
| `/sethome` | MUTATE | LOW | Sets home channel | Mutator. Low blast. | Same. | Same. | Same. | **REQUIRED** |
| `/footer [on/off]` | MUTATE | LOW | Toggles metadata footer | Mutator. Cosmetic. | Same. | Same. | Same. | **REQUIRED** |
| `/voice [on/off/tts]` | MUTATE | MEDIUM | Voice mode control | Mutator. Changes output modality. | Same. | Same. | Same. | **REQUIRED** |

**MUTATE rule:** Lease `telegram.control` required. RECEIPT mandatory. `/yolo` and `/reload-mcp` are elevated to HIGH blast — ACK recommended. Hermes gateway enforces lease at command dispatch.

### 1.3 IRREVERSIBLE commands (short-TTL lease + ACK REQUIRED)

| Command | Action Class | Blast | What It Does | ART Classifies | Kernel Checks | APA Expresses | ACT Phases | VAULT999 |
|---------|-------------|-------|--------------|----------------|---------------|---------------|------------|----------|
| `/restart` | **IRREVERSIBLE** | **CRITICAL** | Restarts Hermes gateway | Destroyer-class. Kills and reinitializes the agent gateway. All active sessions interrupted. Cannot be undone for running operations. Requires lease `telegram.veto`. ACK mandatory. | **888_HOLD path MANDATORY.** F1 (NOT reversible — kills running gateway), F3 (witness required), F13 (sovereign ack mandatory). | ① manifest resolve ② verify lease `telegram.veto` ③ TTL ≤ 120s ④ ack_irreversible=true ⑤ F13 path recorded | DRY_RUN (show impact: active sessions, running tasks) → SIMULATE → **STOP unless ACK + F13** → EXECUTE (restart gateway) → VERIFY (gateway alive) → ROLLBACK (**NOT_AVAILABLE**) → RECEIPT | **REQUIRED + F13 ack recorded** |
| `/stop` | **IRREVERSIBLE** | **HIGH** | Kills background processes | Destroyer-class. Kills running background tasks. Reversible only by re-queuing. Requires lease `telegram.control`. ACK recommended. | F1 (NOT reversible for killed processes), F3 (witness), F13 | Same pattern, lease `telegram.control`. | DRY_RUN (list processes to kill) → SIMULATE → EXECUTE → VERIFY (processes gone) → ROLLBACK (re-queue) → RECEIPT | **REQUIRED** |
| `/undo` | MUTATE+ | MEDIUM | Removes last exchange | Mutator with irreversible subclass — context lost, cannot be reconstructed. | F1 (partial irreversibility — context gone), F7 (Ω₀ declared) | Same. | DRY_RUN → SIMULATE → EXECUTE → VERIFY → ROLLBACK (limited) → RECEIPT | **REQUIRED** |
| `/update` | **IRREVERSIBLE** | **HIGH** | Updates Hermes to latest | Destroyer-class. Changes running code. Affects ALL sessions. Requires lease `telegram.veto`. ACK mandatory. | **888_HOLD path MANDATORY.** F1 (code swap is irreversible), F3 (witness required), F13 (sovereign ack mandatory) | Same as `/restart`. TTL ≤ 120s. | DRY_RUN → SIMULATE → **STOP unless ACK + F13** → EXECUTE → VERIFY → ROLLBACK (**NOT_AVAILABLE**) → RECEIPT | **REQUIRED + F13 ack** |
| `/approve` | **VETO** | **HIGH** | Approves pending command | This IS the F13 path in action. By definition, cannot be auto-executed. Requires Arif's identity confirmed (user ID 267378578). | F13 exclusively. This verb IS the sovereign veto path. | Identity check: `from_user.id == 267378578` | EXECUTE only after identity confirmed | **REQUIRED** |
| `/deny` | **VETO** | **HIGH** | Denies pending command | Same as `/approve`. F13 path. | F13 exclusively. | Same identity check. | Same. | **REQUIRED** |

**IRREVERSIBLE rule:** `/restart`, `/update` require `telegram.veto` lease (TTL ≤ 120s) + ACK + F13. `/approve` and `/deny` ARE the F13 path — they can only be called by Arif's Telegram user ID. RECEIPT mandatory. ROLLBACK = NOT_AVAILABLE for true irreversibles.

### 1.4 Message verbs (send, edit, delete)

| Verb | Action Class | Blast | Lease Scope | Notes |
|------|-------------|-------|-------------|-------|
| `send_message` | MUTATE | MEDIUM | `telegram.mutate` | Sends message to chat. Reversible via delete. |
| `edit_message` | MUTATE | MEDIUM | `telegram.mutate` | Edits existing message. Reversible (re-edit). |
| `delete_message` | MUTATE+ | MEDIUM | `telegram.mutate` | Deletes message. Reversible within 48h (Telegram API). Beyond 48h = IRREVERSIBLE for older messages. |
| `send_file` | MUTATE | MEDIUM | `telegram.mutate` | Upload file to chat. Dispatcher service handles this. |
| `send_photo` | MUTATE | LOW | `telegram.mutate` | Upload image. |
| `pin_message` | MUTATE | LOW | `telegram.control` | Pins message to chat. |
| `unpin_message` | MUTATE | LOW | `telegram.control` | Unpins. |

---

## 2. Complete connector manifest (machine-readable)

```yaml
connector:
  name: telegram
  version: "1.0.0-canonical"
  domain: communication.messenger
  protocol: telegram_bot_api
  provider: telegram.org
  sovereign_weight: CRITICAL       # F13 veto surface — highest constitutional weight

  architecture:
    type: hermes_integrated         # NOT a standalone HTTP bridge
    gateway: hermes-asi-gateway.service
    dispatcher: hermes-dispatcher.service
    bots:
      primary: "@ASI_arifos_bot"   # Hermes — sovereign gateway
      secondary: "@AGI_ASI_bot"     # OpenClaw — webhook listener :8787
      tertiary: "@arifOS_bot"       # 777 FORGE — polling bot

    mention_rules:
      sovereign: "267378578"        # Arif — no @mention needed, all bots respond
      agent_to_agent: "must_@mention"  # Agents must @ each other

  auth:
    method: bot_token
    token_source: /root/.secrets/vault.flat.env
    token_env_vars:
      ASI: HERMES_TELEGRAM_BOT_TOKEN   # @ASI_arifos_bot
      AGI: TELEGRAM_BOT_TOKEN           # @AGI_ASI_bot
      FORGE: TELEGRAM_OPENCODE_BOT_TOKEN  # @arifOS_bot
    token_file: /root/.secrets/tokens/telegram-opencode-bot  # FORGE polling bot
    inject: "never_in_llm_context"
    never_return_to_caller: true
    never_log: true

  reflex:
    art: required_on_all_commands
    kernel: required_on_MUTATE_and_IRREVERSIBLE
    shadow_gate: required_before_each_execute
    incompleteness_gate: required_before_IRREVERSIBLE_and_VETO
    apa: required_on_all_commands
    act_phases: [DRY_RUN, SIMULATE, EXECUTE, VERIFY, ROLLBACK, RECEIPT]
    vault999: required_on_MUTATE_and_IRREVERSIBLE
    vault999_optional: OBSERVE

  # ── COMMANDS (slash commands from telegram-commands.md) ──

  commands:
    observe:
      - /help, /commands, /status, /model[read], /profile
      - /usage, /insights, /agents, /skills, /tools
      - /toolsets, /plugins, /cron, /platforms, /curator
    mutate:
      - /model[write], /reasoning, /verbose, /yolo, /fast
      - /new, /clear, /title, /compress, /goal
      - /queue, /steer, /background, /skill, /reload-skills
      - /reload-mcp, /sethome, /footer, /voice, /browser
    irreversible:
      - /restart, /stop, /undo, /update
    veto:
      - /approve, /deny       # F13 path — Arif-only by user ID

  # ── MESSAGE VERBS ──

  message_verbs:
    - send_message: { class: MUTATE, blast: MEDIUM, scope: telegram.mutate }
    - edit_message: { class: MUTATE, blast: MEDIUM, scope: telegram.mutate }
    - delete_message: { class: MUTATE, blast: MEDIUM, scope: telegram.mutate, note: "IRREVERSIBLE beyond 48h" }
    - send_file: { class: MUTATE, blast: MEDIUM, scope: telegram.mutate }
    - send_photo: { class: MUTATE, blast: LOW, scope: telegram.mutate }
    - pin_message: { class: MUTATE, blast: LOW, scope: telegram.control }
    - unpin_message: { class: MUTATE, blast: LOW, scope: telegram.control }

  # ── CRON AUTOMATIONS (already defined in telegram-commands.md) ──

  automations:
    federation_health:
      schedule: "every 2h"
      action_class: OBSERVE
      blast: MEDIUM
      note: "Probes all 6 organs, alerts on ❌"
    daily_digest:
      schedule: "7:00 AM MYT"
      action_class: OBSERVE
      blast: LOW
      note: "Morning briefing: git status, pending, news"
    nightly_seal:
      schedule: "11:00 PM MYT"
      action_class: MUTATE
      blast: MEDIUM
      note: "End-of-day receipt of all work done"
      vault999: REQUIRED
```

---

## 3. Lease matrix (capability table)

| Scope | max_action_class | Commands allowed | Default TTL (s) | Extra Gates | Who can hold |
|-------|------------------|-----------------|-----------------|-------------|-------------|
| **telegram.read** | OBSERVE | All OBSERVE commands + message read | 3600 | Session may apply | Any registered agent |
| **telegram.control** | MUTATE | All MUTATE commands (model, reasoning, verbose, fast, new, clear, title, compress, goal, queue, steer, background, skill, reload-*, sethome, footer, voice, browser) | 3600 | F11 receipt REQUIRED · shadow gate REQUIRED | Hermes, 333-AGI |
| **telegram.mutate** | MUTATE | send_message, edit_message, delete_message, send_file, send_photo, pin/unpin | 3600 | F11 receipt | Hermes, dispatcher |
| **telegram.veto** | IRREVERSIBLE | /restart, /update, /approve, /deny | **120** | ACK mandatory + F13 path · incompleteness gate · identity check (user_id==267378578) | **Arif only** |

### Identity binding (sovereign override)

```
if from_user.id == 267378578:      # Arif
    → NO lease required for OBSERVE
    → MUTATE: lease still required but human ack is implicit
    → VETO: this IS the F13 path
    → IRREVERSIBLE: lease + explicit ACK still required
```

### Live A-FORGE lease chain

```
forge_session_init(actor_id="hermes", intent="APA Telegram command dispatch")
forge_lease(
  mode="request",
  agent_id="hermes",
  scope=["telegram", "telegram.control"],
  max_action_class="EXECUTE_REVERSIBLE",
  ttl_seconds=3600
)
# → lease_id returned
# → Hermes gateway validates lease before dispatching MUTATE commands
```

For IRREVERSIBLE:
```
forge_lease(
  mode="request",
  agent_id="arif",
  scope=["telegram", "telegram.veto"],
  max_action_class="EXECUTE_HIGH_IMPACT",
  ttl_seconds=120
)
# → requires ACK + user_id==267378578
```

---

## 4. ACT phase machine (Telegram-specific)

```
                    ┌─────────────┐
                    │   ART       │  Hermes classifies slash command
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  KERNEL     │  arifOS F1-F13 → SEAL?
                    └──────┬──────┘
                     no │    │ yes
                        ▼    ▼
                      STOP  APA resolve manifest + validate lease
                             │
                             ▼
              ┌──────────────────────────────┐
              │ ACT (Telegram-specific)      │
              │                              │
              │  0 ⏹ DRY_RUN                │  Validate command args. Show what WOULD happen.
              │       ↓                      │
              │  1 ◉ SIMULATE               │  Build API payload. Show target chat, message preview.
              │       ↓                      │
              │  2 ▶ EXECUTE    ──API──▶    │  Hermes calls Telegram Bot API (token from vault.flat.env).
              │       ↓                      │
              │  3 ✓ VERIFY                  │  Confirm message delivered (message_id returned).
              │       ↓                      │
              │  4 ↩ ROLLBACK (if avail)    │  edit_message (correct) or delete_message (remove).
              │       ↓                      │
              │  5 💾 RECEIPT → VAULT999     │  chat_id + message_id + command + lease_id → seal.
              └──────────────────────────────┘
```

| Phase | Must NOT | Must (Telegram-specific) |
|-------|----------|--------------------------|
| **DRY_RUN** | Send to Telegram | Validate command exists in manifest; check lease scope |
| **SIMULATE** | Persist | Show exact API call + target chat_id + message preview |
| **EXECUTE** | Skip VERIFY · expose bot token · self-seal | Hermes sends via httpx to api.telegram.org; token from environment only |
| **VERIFY** | Trust EXECUTE alone | Check Telegram response has `ok: true` + `result.message_id` |
| **ROLLBACK** | Claim full undo for delete beyond 48h | edit_message for corrections; delete_message for removal (48h window); `NOT_AVAILABLE` for /restart, /update |
| **RECEIPT** | Skip for MUTATE/VETO | Emit: command + chat_id + message_id + lease_id + timestamp |

**STOP is lawful at any phase. STOP preserves the system.**

---

## 5. Response envelope (Hermes → chat + VAULT999)

```json
{
  "ok": true,
  "status": "ok",
  "command": "/yolo",
  "action_class": "MUTATE",
  "lease_scope_hint": "telegram.control",
  "lease_id": "LCL-20260709-tg-001",
  "evidence_tags": ["DERIVED", "TELEGRAM_BOT_API"],
  "confidence_cap": 0.85,
  "result": {
    "chat_id": 267378578,
    "message_id": 1042,
    "from_user_id": 267378578,
    "text": "Approval bypass: ON",
    "date": 1752037200
  },
  "vault_anchor_material": {
    "connector": "telegram",
    "command": "/yolo",
    "chat_id": 267378578,
    "message_id": 1042,
    "lease_id": "LCL-20260709-tg-001"
  },
  "reflex": {
    "art_class": "MUTATE",
    "kernel_verdict": "SEAL",
    "apa_lease_valid": true,
    "act_phase": "RECEIPT",
    "act_phases_completed": ["DRY_RUN", "SIMULATE", "EXECUTE", "VERIFY", "RECEIPT"],
    "rollback": "toggle /yolo again"
  }
}
```

**Error envelope (lease invalid):**

```json
{
  "ok": false,
  "status": "error",
  "command": "/restart",
  "action_class": "IRREVERSIBLE",
  "error_code": "LEASE_INVALID",
  "error_message": "telegram.veto lease expired or not held by caller",
  "reflex": {
    "art_class": "IRREVERSIBLE",
    "kernel_verdict": "HOLD",
    "act_phase": "STOPPED_AT_DRY_RUN"
  }
}
```

---

## 6. Live deployment anchors (T1 observable)

| Component | Path / endpoint | Status |
|-----------|-----------------|--------|
| Hermes gateway | `hermes-asi-gateway.service` | ✅ LIVE |
| Hermes dispatcher | `hermes-dispatcher.service` | ✅ LIVE |
| OpenClaw gateway | `openclaw-gateway.service` (webhook :8787) | ✅ LIVE |
| 777 FORGE bot | `opencode-bot.service` (polling) | ✅ LIVE |
| Bot tokens | `/root/.secrets/vault.flat.env` → environment | ✅ isolated, never in LLM |
| Token file (FORGE) | `/root/.secrets/tokens/telegram-opencode-bot` | ✅ file-read only |
| Command manifest | `/root/HERMES/telegram-commands.md` | ✅ documented |
| AAA group | `-1003753855708` | ✅ all 3 bots members |

---

## 7. VAULT999 receipt schema (Telegram-specific)

```json
{
  "connector": "telegram",
  "command": "/yolo",
  "action_class": "MUTATE",
  "actor_id": "hermes",
  "from_user_id": 267378578,
  "session_id": "SEAL-session-id",
  "lease_id": "LCL-20260709-tg-001",
  "constitutional_chain_id": "cc-tg-001",
  "result_ref": "chat:267378578/msg:1042",
  "chat_id": 267378578,
  "message_id": 1042,
  "message_text": "Approval bypass: ON",
  "art_class": "MUTATE",
  "kernel_verdict": "SEAL",
  "act_phases_completed": ["DRY_RUN", "SIMULATE", "EXECUTE", "VERIFY", "RECEIPT"],
  "rollback_available": "toggle /yolo again",
  "timestamp": "2026-07-09T04:00:00+08"
}
```

For IRREVERSIBLE (/restart):
```json
{
  "rollback_available": "NOT_AVAILABLE",
  "f13_ack_recorded": true,
  "sovereign_user_id": 267378578,
  "incompleteness_gate_passed": true,
  "incompleteness_declared_unknowns": [
    "active background tasks will be terminated",
    "in-flight API calls may fail",
    "session state may be partially lost"
  ]
}
```

---

## 8. Mandatory pre-execution gates

### 8.1 Shadow Gate (MANDATORY before any MUTATE/IRREVERSIBLE)

```
SHADOW GATE (pre-execute):
  □ Am I rationalizing this command? (Reward hacking)
  □ Am I agreeing with the commander because they're sovereign? (Sycophancy — even Arif needs lease for IRREVERSIBLE)
  □ Am I hiding uncertainty about blast radius? (Deceptive alignment)
  □ Am I refusing because of fear, not facts? (Over-refusal)
  □ Am I padding the response to look thorough? (Compute-as-regulation)
  □ Am I crossing into judgment (SEAL/HOLD/VOID) that belongs to arifOS? (Identity drift — Hermes is gateway, not judge)
  □ Am I performing compliance rather than verifying it? (Shadow performance)

If ANY checked → HALT. Return to plan stage.
```

### 8.2 Incompleteness Gate (MANDATORY before IRREVERSIBLE/VETO)

```
INCOMPLETENESS GATE (pre-IRREVERSIBLE):
  □ What do I NOT know about executing /restart?
  □ What active sessions and tasks will be interrupted?
  □ Could a simpler command achieve the intent (/stop instead of /restart)?
  □ Am I claiming completeness about the gateway state?

  If I cannot name at least TWO unknowns: HALT (Iblis trap).
  If I claim completeness: HALT + FLAG.
```

### 8.3 Sovereignty Gate (MANDATORY for VETO commands)

```
SOVEREIGNTY GATE (pre-/approve, pre-/deny):
  □ Is from_user.id == 267378578?
  □ Was the pending command issued by the same user?
  □ Is the lease valid and not expired?
  □ Is the blast radius of the pending command known?
  
  If from_user.id != 267378578: REJECT. This IS F13.
  If lease invalid: HOLD. Re-request.
```

---

## 9. Clone checklist — hard gate for future Telegram-connected agents

| # | Gate | What to provide |
|---|------|-----------------|
| **1** | §0 Bridge Theorem | ART→KERNEL→APA→ACT→VAULT999 table + five irreducible steps + F13 veto statement |
| **2** | §1 Verb × ARC matrix | Every command with action_class, kernel_checks, apa_express, act_phases, vault999 |
| **3** | §2 Full YAML manifest | Connector metadata + all commands classified + message verbs + automations |
| **4** | §3 Lease matrix | telegram.read / telegram.control / telegram.mutate / telegram.veto scopes |
| **5** | §4 ACT phase machine | DRY_RUN→RECEIPT with Telegram-specific phases |
| **6** | §5 Response envelope | ok/error shape with chat_id + message_id + vault_anchor_material |
| **7** | Sovereignty gate | §8.3 — F13 identity check for /approve, /deny, /restart, /update |

---

## 10. Why Telegram is the most constitutionally-weighted APA connector

| Property | Proof |
|----------|-------|
| F13 veto surface | `/approve` and `/deny` are THE sovereign control path. No other APA connector has this. |
| Sovereign identity binding | `from_user.id == 267378578` is hardcoded as the sovereignty gate |
| Fastest human→agent channel | Telegram is where Hermes lives. Commands fire immediately. |
| Agent→human alert channel | Receipts, seals, warnings, health probes delivered here |
| Already production | 3 bots, 2 services, full command manifest — running since 2026-07-03 |
| Token isolation proven | 3 separate tokens, vault.flat.env injection, never in LLM |
| Highest constitutional weight | CRITICAL — if Telegram goes down, F13 cannot veto |

---

## 11. Anti-patterns — reject as non-APA (Telegram-specific)

| Anti-pattern | Why It Violates APA | Example |
|-------------|---------------------|---------|
| **Bot token in LLM context** | Token appears in agent prompt or response | `BOT_TOKEN=84101...` in agent output |
| **/restart without ACK** | IRREVERSIBLE without sovereign gate | Agent auto-restarts gateway |
| **/yolo without lease** | HIGH blast MUTATE without capability check | Agent toggles approval bypass freely |
| **Fake F13** | Non-sovereign user calls /approve | Agent accepts `/approve` from user_id != 267378578 |
| **No receipt on MUTATE** | Mutation without witness | `/model gpt-5` succeeds, nothing sealed |
| **Token in git** | Bot token committed to source | `.env` with real token in repo |
| **Silent message send** | Agent sends Telegram message without lease | Hermes sends alert without checking lease scope |
| **Claimed reversibility for /restart** | False reversibility | "rollback = start gateway again" — that's not undo |

---

## 12. One-line seal

**APA-Telegram is the F13 veto surface made constitutional:**
ART classifies commands · KERNEL judges · APA leases and manifests · ACT touches Telegram · VAULT999 remembers · Arif holds the only `/approve`.

No other APA connector carries this constitutional weight. Telegram is not a convenience bridge — it is the sovereign control channel.

---

**DITEMPA BUKAN DIBERI** — sovereignty is forged into the messenger, not hoped into the protocol.
