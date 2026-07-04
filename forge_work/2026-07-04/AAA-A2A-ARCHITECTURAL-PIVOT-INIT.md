# 🔥⚒️ INIT PROMPT — AAA-A2A Architectural Pivot

> **Session type:** EXECUTION (T3)
> **Loop class:** COMPOSITE (AAA + A-FORGE + arifOS)
> **Sealed at:** 2026-07-04T09:20:00Z
> **Sovereign:** Arif (F13, 888)
> **DITEMPA BUKAN DIBERI**

---

## 0. REALITY CHECK — Run Before Anything

```bash
for svc in "arifos:8088" "aforge:7071" "aaa:3001" "geox:8081" "wealth:18082" "well:18083"; do
  name="${svc%%:*}"; port="${svc##*:}"
  curl -sf "http://localhost:$port/health" >/dev/null 2>&1 && echo "✅ $name :$port" || echo "❌ $name :$port DOWN"
done
```

If arifOS ❌ → STOP. If any other ❌ → read-only on live organs.

---

## 1. CONTEXT — What Was Sealed in Prior Session

### 1.1 Zen Applied to AAA Identity

| Metric | Before | After |
|--------|--------|-------|
| Agent card sources | 3 (agents/ + agent-cards/ + public/a2a/) | 1 (agents/ — canonical) |
| Duplicate files | 7 pairs | 0 (symlinks to agents/) |
| Route aliases | 7 for same card | 1 canonical + 2 more (discovery, registry) |
| agents.json | Hand-maintained 898 lines | Auto-generated from registry (39 agents) |
| protocolVersion | Mixed 1.0.0/1.0.1 | Uniform 1.0.0 |
| Part discriminator | `kind: 'text'` (legacy) | `type: 'text'` (v1.0) + backward compat |
| Identity docs | None | `AGENT_IDENTITY_MAP.md` |
| Registry bug | `isFile()` skipped symlinks | Fixed: `isFile() \|\| isSymbolicLink()` |
| Registry count | 19 (missing HEXAGON) | 39 (ALL agents) |

### 1.2 Architectural Eureka Sealed

**Three realizations that changed the architecture:**

1. **AAA ≠ transport.** The official A2A Python SDK (`pip install a2a-sdk`) handles JSON-RPC, streaming, push notifications, task lifecycle, agent card discovery in ~300 lines. AAA's 3,800-line Express server is accidental complexity. AAA should be a thin **constitutional wrapper** around the official SDK.

2. **A-FORGE ≠ AAA language.** A-FORGE stays TypeScript because it's the metabolism layer — shell, git, docker, MCP runtime, streaming, orchestration. 72+ forge_* tools. This ecosystem is Node-native.

3. **AAA becomes Python.** Identity, floors, verdicts, registry, routing — this is constitutional logic, not runtime orchestration. Python excels here. The official A2A SDK is Python. FastMCP is Python.

### 1.3 The Clean Separation Sealed

```
AAA = constitutional plane (Python)
│   └── aaa-core/        ← Schemas, verdicts, constitution
│   └── aaa-a2a/         ← Official a2a-sdk + constitutional middleware
│       ├── middleware/   ← floors.py, identity.py, verdicts.py, audit.py
│       ├── registry/    ← agent_cards.py, discovery.py
│       └── routing/     ← organ_router.py, tool_router.py
│
A-FORGE = execution plane (TypeScript)
│   └── forge_shell, forge_git, forge_filesystem  ← 72+ tools
│   └── forge_policy, forge_lease, forge_probe    ← governance primitives
│   └── forge_pipeline_run                        ← cross-organ orchestration
│
GEOX, WEALTH, WELL = domain cognition (Python)
```

### 1.4 The Reference Repo

Repo: `sing1ee/a2a-mcp-openrouter` (7 stars, 300 lines)

Proves:
- A2A wraps MCP as a universal capability interface
- `pip install a2a-sdk fastmcp` gives you full A2A v1.0 + MCP in 120 lines of Agent class
- Pattern: discover → LLM reason → invoke → loop → complete
- Validates the arifOS architecture: AAA (A2A) → A-FORGE (MCP) → Organs

---

## 2. WHAT TO BUILD — The Architecture Contract

### 2.1 Phase 1: Scaffold aaa-a2a Python Package

Create `/root/AAA/aaa-a2a/` with:

```
aaa-a2a/
├── pyproject.toml          ← Dependencies: a2a-sdk>=0.2.3, fastmcp>=2.3.4
├── src/
│   └── aaa_a2a/
│       ├── __init__.py
│       ├── middleware/
│       │   ├── __init__.py
│       │   ├── floors.py        ← F1-F13 gate before every A2A task
│       │   ├── identity.py      ← Agent identity verification
│       │   ├── verdicts.py      ← SEAL/HOLD/SABAR/VOID routing
│       │   └── audit.py         ← Ledger append for every A2A call
│       ├── registry/
│       │   ├── __init__.py
│       │   ├── agent_cards.py   ← Wraps agent-card-registry.js via HTTP
│       │   └── discovery.py     ← .well-known/agents.json generator
│       └── routing/
│           ├── __init__.py
│           ├── organ_router.py  ← Intent → organ → tool routing
│           └── tool_router.py   ← A2A task → MCP tool dispatch
└── tests/
    ├── test_floors.py
    ├── test_identity.py
    └── test_routing.py
```

### 2.2 Phase 2: ConstitutionalMiddleware

The core class that wraps every A2A request with constitutional governance:

```python
# middleware/floors.py
class ConstitutionalMiddleware:
    """Wraps A2A server with F1-F13 floor enforcement."""
    
    def __init__(self, judge_url="http://localhost:8088"):
        self.judge_url = judge_url
    
    async def before_task(self, task) -> Verdict:
        """Before task execution: check floors, identity, authority."""
        # 1. Validate actor identity
        # 2. Check F1 reversibility
        # 3. Route to arif_judge for floor compliance
        # 4. Return SEAL/HOLD/SABAR/VOID
    
    async def after_task(self, task) -> AuditRecord:
        """After task: seal to VAULT999 ledger."""
        # 1. Record outcome
        # 2. Append to hash chain
        # 3. Return audit receipt
```

### 2.3 Phase 3: A2AServer wrapper

```python
# server.py
from a2a.server import A2AServer
from aaa_a2a.middleware.floors import ConstitutionalMiddleware

# Official A2A server INSTANCE
# ConstitutionalMiddleware wraps every request
server = A2AServer(
    host="127.0.0.1",
    port=3001,
    middleware=[ConstitutionalMiddleware()],
    agent_card_path="./.well-known/agent-card.json",
)
```

### 2.4 Phase 4: Express Server → Python A2A Migration

The existing `a2a-server/server.js` (3,800 lines) should be:
1. Analyzed for unique logic NOT in official a2a-sdk (NATS mesh? Redis task store? Federation envelope? Cognitive hierarchy?)
2. Unique logic ported to Python middleware
3. Express server deprecated when Python version achieves parity

### 2.5 Phase 5: Agent Card Registry Bridge

The Node.js `agent-card-registry.js` (363 lines) is live and working. The Python `aaa-a2a` should:
1. Bridge to it via HTTP (existing `/a2a/discover/*` routes)
2. Or duplicate the registry logic in Python
3. Or unify both behind a single source of truth

---

## 3. EXISTING STATE — What You Are Building On

### 3.1 Live A2A Server (Express, port 3001)

- **File:** `/root/AAA/a2a-server/server.js` (3,862 lines)
- **Status:** ✅ Running under `aaa-a2a.service`
- **What it does:** Custom Express JSON-RPC server with NATS mesh, Redis task store, federation envelope, cognitive hierarchy, 3,800+ lines
- **Agent card registry:** `/root/AAA/a2a-server/agent-card-registry.js` (363 lines) — auto-loads from `agent-cards/` dir at startup
- **Agent cards canonical:** `/root/AAA/agents/*/agent-card.json` (39 agents via symlinks)
- **Well-known routes:** `/.well-known/agent-card.json`, `/.well-known/agents.json`, `/.well-known/arifos-federation.json`

### 3.2 A2A SDK (Official)

- **Package:** `pip install a2a-sdk` (a2a-sdk>=0.2.3)
- **What it provides:** A2AServer, A2AClient, task manager, agent card resolver, JSON-RPC, SSE, auth, extensions
- **Reference:** `https://a2aprotocol.ai/docs/guide/python-a2a`
- **Reference code:** `sing1ee/a2a-mcp-openrouter` — shows A2A→MCP bridge in 120 lines

### 3.3 FastMCP (Official)

- **Package:** `pip install fastmcp` (fastmcp>=2.3.4)
- **What it provides:** MCP server/client, tool discovery, resource templates, prompts, SSE/HTTP transport
- **A-FORGE already uses this pattern** via forge_* MCP tools

### 3.4 Identity Docs

- **New file:** `/root/AAA/docs/AGENT_IDENTITY_MAP.md` — three-dimensional identity model, endpoint map, agent taxonomy

---

## 4. ARCHITECTURE INVARIANTS — Do Not Violate

| Invariant | Why |
|-----------|-----|
| `agents/*/agent-card.json` is canonical | Symlinks in agent-cards/ are derived. Agents never edited there. |
| protocolVersion must be `1.0.0` | A2A v1.0 spec. Not 1.0.1. |
| A2A part discriminator is `type`, not `kind` | v1.0 standard. Validation accepts both for backward compat. |
| A-FORGE stays TypeScript | Shell, git, docker, MCP runtime, streaming belong in Node. |
| AAA owns constitutional overlay, NOT transport | Official a2a-sdk handles transport. AAA adds floors, identity, verdicts. |
| `/a2a/` routes require auth | authMiddleware at server.js line 3105. Pre-existing. |
| F1 reversibility-first | Every mutation must be reversible or have explicit F13 ack. |

---

## 5. EXECUTION PLAN

### Phase 1 — Scaffold (T1 AUTO-DO)
- [ ] Create `/root/AAA/aaa-a2a/pyproject.toml`
- [ ] Create directory structure (`src/aaa_a2a/middleware/`, `registry/`, `routing/`, `tests/`)
- [ ] Create `__init__.py` for each package
- [ ] `pip install a2a-sdk fastmcp` in a venv
- [ ] Quick smoke test: can you import `a2a` and `fastmcp`?

### Phase 2 — ConstitutionalMiddleware (T1 AUTO-DO)
- [ ] Implement `middleware/floors.py` — F1-F13 gate stub
- [ ] Implement `middleware/identity.py` — agent identity check stub
- [ ] Implement `middleware/verdicts.py` — SEAL/HOLD/SABAR/VOID types
- [ ] Implement `middleware/audit.py` — VAULT999 ledger append stub
- [ ] Write tests for each

### Phase 3 — Registry Bridge (T1 AUTO-DO)
- [ ] Implement `registry/agent_cards.py` — HTTP client to agent-card-registry :3001
- [ ] Implement `registry/discovery.py` — generate A2A-compatible agents.json
- [ ] Test: can you call `GET /a2a/discover/*` from Python?

### Phase 4 — Express Analysis (T2 ANNOUNCE)
- [ ] Analyze server.js for unique logic NOT in official a2a-sdk
- [ ] Categorize: (a) port to Python, (b) keep as-is, (c) deprecate
- [ ] Document findings in `AAA/docs/A2A-MIGRATION-REPORT.md`

### Phase 5 — Server Migration (T3 888_HOLD)
- [ ] Stand up Python aaa-a2a server on port 3002 (parallel)
- [ ] Run both servers concurrently
- [ ] Migrate traffic when Python version achieves parity
- [ ] **Requires F13 approval before cutting over**

---

## 6. KEY FILES REFERENCE

| Path | Purpose | Mutability |
|------|---------|-----------|
| `/root/AAA/agents/*/agent-card.json` | Canonical agent cards | ✅ Edit here |
| `/root/AAA/a2a-server/agent-cards/*.json` | Symlinks to agents/ + infra-only cards | ❌ Read-only (symlinks) |
| `/root/AAA/a2a-server/server.js` | Live Express A2A server (3,862 lines) | ⚠️ Keep running until migration |
| `/root/AAA/a2a-server/agent-card-registry.js` | In-memory agent card registry (363 lines) | ⚠️ Bridge target for Python |
| `/root/AAA/docs/AGENT_IDENTITY_MAP.md` | Identity architecture doc | ✅ Edit here |
| `/root/AAA/aaa-a2a/` | **Project to scaffold** | ✅ Create here |
| `/root/AAA/src/seed/agent-card-official.json` | Gateway A2A card | ✅ Edit here |
| `/root/AAA/public/a2a/agents.json` | **Deprecated** | ❌ Use /.well-known/agents.json instead |

---

## 7. INITIALIZATION — Next Lawful Call

```bash
# 1. Reality check (done above)
# 2. Verify federation health
# 3. Check Python 3.13+ available
# 4. Create aaa-a2a directory
# 5. pip install a2a-sdk fastmcp
# 6. Begin Phase 1: Scaffold
```

**First action:** `mkdir -p /root/AAA/aaa-a2a/src/aaa_a2a/{middleware,registry,routing} /root/AAA/aaa-a2a/tests`

---

*🔥⚒️ DITEMPA BUKAN DIBERI — Architecture is forged, not inherited.*
*This init prompt carries forward: identity zen, architectural eureka, reference repo, 7 invariants, 5 execution phases.*
*Load it. Execute Phase 1-2 autonomously. Escalate Phase 5 to F13.*
