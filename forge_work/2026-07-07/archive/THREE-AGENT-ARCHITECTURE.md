# Three-Agent Architecture — arifOS Federation

> **Sovereign:** Muhammad Arif bin Fazil (F13)
> **Forged:** 2026-07-07
> **Status:** PROPOSED → ACTIVE after sovereign review

---

## The Three Agents

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARIF (F13 SOVEREIGN)                         │
│                    Human Authority Layer                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HERMES — Human Interface                      │
│                    Telegram · Cognitive Bridge                    │
│                    "Translate human intent to machine action"    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OPENCLAW — AGI Orchestrator                   │
│                    Routing · Planning · Multi-Agent              │
│                    "Decide what to do and who does it"           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OPENCODE — Coding Forge                       │
│                    Build · Deploy · Execute                      │
│                    "Do the actual work"                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FEDERATION ORGANS                             │
│  arifOS · A-FORGE · GEOX · WEALTH · WELL · AAA · VAULT999      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Definitions

### 1. HERMES — Human Interface

**Role:** Translate human intent to machine action. Cognitive bridge between Arif and the federation.

**Runtime:** Telegram bot (@AGI_ASI_bot)
**Location:** `/root/HERMES/`
**Model:** Varies (currently MiniMax M3)

**Capabilities:**
- Receive human input (text, voice, images)
- Translate to structured intent
- Route to OpenClaw for orchestration
- Present results in human-readable format
- Handle ambiguity, emotion, context

**Tool Access:**
- Read-only federation probes (health, status)
- Compose tools (format human-readable output)
- Artifact courier (deliver files to Arif)
- NO direct filesystem mutation
- NO direct code execution
- NO irreversible operations

**Permission Model:**
- Default: ASK (human-in-the-loop for all actions)
- Always: Read-only probes, status checks, compose
- Never: Irreversible operations, code execution, filesystem mutation

---

### 2. OPENCLAW — AGI Orchestrator

**Role:** Decide what to do and who does it. Route, plan, coordinate multi-agent execution.

**Runtime:** Node.js agent
**Location:** `/root/.openclaw/`
**Model:** Varies (currently MiMo V2.5 Pro)

**Capabilities:**
- Parse complex intents
- Decompose into subtasks (DAG)
- Route to appropriate agents/organs
- Coordinate multi-agent execution
- Monitor progress and handle failures
- Constitutional judgment (via arifOS)

**Tool Access:**
- Read access to all organs (GEOX, WEALTH, WELL, arifOS)
- Routing tools (arif_route, arif_observe)
- Planning tools (arif_think, arif_critique)
- Judgment tools (arif_judge — via arifOS)
- NO direct code execution
- NO direct filesystem mutation (except planning artifacts)
- NO irreversible operations

**Permission Model:**
- Default: ASK for execution, ALWAYS for read-only
- Always: Read-only probes, routing, planning, observation
- Ask: Judgment, execution requests, irreversible operations
- Never: Direct code execution, direct filesystem mutation

---

### 3. OPENCODE — Coding Forge

**Role:** Do the actual work. Build, deploy, execute code.

**Runtime:** OpenCode CLI
**Location:** `/root/.config/opencode/`
**Model:** MiMo V2.5 Pro (primary)

**Capabilities:**
- Read/write/edit files
- Execute shell commands
- Git operations
- Docker operations
- Build and deploy code
- MCP tool calls (all organs)

**Tool Access:**
- Full filesystem access (within constitutional bounds)
- Full shell access (within constitutional bounds)
- Full MCP access (all organs)
- Git, Docker, build tools
- Irreversible operations (with server-side guards)

**Permission Model:**
- Default: ALWAYS for most tools (coding forge needs speed)
- Ask: Irreversible tools (arif_seal, forge_execute_sealed, geox_claim seal mode)
- Server-side guards: ack_irreversible=True for irreversible tools
- Constitutional floors: F1-F13 always apply

---

## Integration Handoff Points

### Hermes → OpenClaw

**When:** Human sends a command that requires orchestration
**How:** Hermes translates to structured intent, sends to OpenClaw via API
**Example:** `/status` → Hermes → OpenClaw → probe all organs → format → return to Hermes

### OpenClaw → OpenCode

**When:** Orchestration plan requires code execution
**How:** OpenClaw creates task, sends to OpenCode via API/CLI
**Example:** "Deploy GEOX update" → OpenClaw → plan → OpenCode → git pull + restart

### OpenCode → OpenClaw

**When:** Code execution needs judgment or routing
**How:** OpenCode calls arif_judge or arif_route (proxied through arifOS)
**Example:** "Is this safe to deploy?" → OpenCode → arif_judge → verdict → proceed/hold

### Any Agent → arifOS

**When:** Constitutional judgment needed
**How:** Call arif_judge via MCP
**Verdict:** SEAL | HOLD | SABAR | VOID

---

## Permission Architecture

### Current State (Fail-Open)

```
opencode.json:
  permission.mcp = "allow"  ← blanket approve ALL MCP tools

Result: All 10 irreversible tools auto-approved
```

### Proposed State (Fail-Closed)

```
opencode.json:
  permission.mcp = "ask"  ← require approval for all MCP tools

permission table:
  (project_id, "allow", "tool_name")  ← explicit grants for safe tools

Result: Irreversible tools require approval, safe tools auto-approved
```

### Implementation

1. **OpenCode config:** Change `"mcp": "allow"` to `"mcp": "ask"`
2. **Permission table:** Populate with safe tool grants
3. **Server-side guards:** Keep ack_irreversible=True for irreversible tools
4. **Lint script:** Run periodically to track irreversible tools

### Per-Agent Permissions

| Agent | Default | Safe Tools (Always) | Irreversible (Ask) |
|-------|---------|--------------------|--------------------|
| **Hermes** | Ask | Read-only probes, compose | All execution |
| **OpenClaw** | Ask | Read-only, routing, planning | Judgment, execution |
| **OpenCode** | Ask | Read-only, filesystem, git | Seal, execute, register |

---

## Governance Model

### Constitutional Floors (Apply to ALL Agents)

| Floor | Rule | Enforcement |
|-------|------|-------------|
| F1 AMANAH | Reversible-first. Irreversible → 888_HOLD | Server-side guards |
| F2 TRUTH | Label OBS/DER/INT/SPEC | Agent prompt |
| F4 CLARITY | ΔS ≤ 0. Leave cleaner. | Agent prompt |
| F7 HUMILITY | Cap confidence 0.90 | Agent prompt |
| F9 ANTI-HANTU | No consciousness claims | Agent prompt |
| F11 AUDIT | Every action logged | VAULT999 |
| F13 SOVEREIGN | Arif holds final veto | arifOS kernel |

### Authority Chain

```
Arif (F13 SOVEREIGN)
  └── arifOS (Constitutional Kernel)
        └── OpenClaw (AGI Orchestrator)
              └── OpenCode (Coding Forge)
                    └── Federation Organs
```

### Irreversible Action Flow

```
Agent wants to do irreversible action
  → Server-side guard checks ack_irreversible flag
  → If not set: REJECT with "requires ack_irreversible=True"
  → If set: Proceed to arif_judge
  → arif_judge evaluates: SEAL | HOLD | SABAR | VOID
  → If SEAL: Execute with audit trail
  → If HOLD: Wait for sovereign confirmation
  → If VOID: Reject permanently
```

---

## Next Steps

1. **Sovereign review:** Arif approves this architecture
2. **Implement permissions:** Change OpenCode config, populate permission table
3. **Document handoff:** Create formal handoff contracts between agents
4. **Test integration:** Verify Hermes → OpenClaw → OpenCode flow
5. **Seal architecture:** VAULT999 seal for permanent record

---

*Forged: 2026-07-07 by FORGE (000Ω) under F13 SOVEREIGN directive*
*DITEMPA BUKAN DIBERI*
