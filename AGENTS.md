<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-06-24 18:08 UTC (999_SEAL — 8-class action taxonomy + A-FORGE gate alignment)
valid_from: 2026-06-14
valid_until: 2026-07-24
confidence: high
scope: /root/A-FORGE
epistemic_status: SOURCE_OF_TRUTH
-->

# AGENTS.md — A-FORGE | arifOS Federation

> **MANDATORY BOOT SEQUENCE**
> 1. Read `/root/AGENTS.md` (Global Federation Rules & Identity)
> 2. Read `/root/CONTEXT.md` (Live Machine State & Ports)
> 3. Read this file (Repo-Specific Build/Test/Run rules)

> **DITEMPA BUKAN DIBERI** — Execution is forged, not given.

**999_SEAL Reference (AF-2026-06-23-001-SEAL-001):** KERNEL INIT REPORT + brain/hands + narrow-to-canonical harden cycle sealed in forge_work/AF-2026-06-23-001-Tiered-Agent-Orchestration.md and BRAIN_HANDS_MCP_MAPPING.md. See ARCHITECTURE.md for narrow layer details.
>
> **Execution Intelligence / Forge Engine** — A-FORGE orchestrates and executes within bounded tools. It does NOT adjudicate, SEAL, or issue constitutional verdicts.

## What This Repo Is

The governed execution shell of the arifOS Federation. A-FORGE builds, deploys, forges, and runs code under constitutional gates. It also hosts MIND:51001 and MEMORY:51002 federated intelligence services.

- **API Port:** 7071 (Express server, Docker Compose via systemd)
- **MCP Port:** 7072 (`a-forge-mcp.service`, streamable-http, single session)
- **stdio:** `npm run mcp:stdio` — **preferred agent ingress** (Kimi, Claude Code, etc.)
- **Runtime:** Node.js 22+, TypeScript ~6.0
- **Architecture:** Hexagonal / layered (domain → application → infrastructure → interfaces)
- **Tool surface:** `forge_*` namespace tools

### Repository Structure

```
A-FORGE/
├── src/
│   ├── domain/          # Pure business logic: engine, governance, planner, agents, policy
│   ├── application/     # Use cases: services, approval, memory, a2a, jobs
│   ├── infrastructure/  # External adapters: llm, tools, vault, bridges, cli, code-mode
│   └── interfaces/      # Delivery: server.ts (Express 7071), routes, mcp, config
├── test/                # 25 TypeScript test files (Node --test)
├── deploy/              # af-forge VPS configs, systemd, Caddy, Grafana, Prometheus
├── GENESIS/             # Constitutional doctrine: kernel canon, MCP boundary, adat agentic, etc.
└── AGENTS.md            # This file — agent governance
```

## A-FORGE Boundary Contract (Zero-Entropy Guard)

A-FORGE is a **governed execution shell**, not a domain organ.

**BRAIN / HANDS CONSTITUTIONAL SEPARATION (BINDING)**

- **arifOS MCP (8088)** = Brain / Governor / Judge: owns floors (L01–L13), final verdicts (`SEAL`/`HOLD_888`/`VOID`/`SABAR`), INIT→JUDGE→SEAL contract, VAULT999, memory routing.
- **A-FORGE MCP (7072 + stdio)** = Hands / Actuator / Forger: owns `forge_*` execution (77+ tools), leases, proxies, build/deploy/run/shell/browser. **Never** issues constitutional verdicts or self-authorizes.

Every agent must respect the loop:
1. arifOS (`arif_init`, `arif_think`, `arif_critique`, `arif_judge`).
2. A-FORGE only after lease (`forge_lease_request` + scope) for execution.
3. arifOS (`arif_judge` + `arif_seal`) to close.

A-FORGE **routes** judgment back to arifOS. Parallelism and rich proxies are allowed only inside lease boundaries.

| Boundary | Rule |
|----------|------|
| ✅ Routes intent | arifOS / GEOX / WEALTH / WELL MCP servers via A2A |
| ✅ Orchestrates | Retries, escalation, tool chaining **under lease** |
| ✅ Forges | Build, deploy, artifact execution **after constitutional clearance** |
| ❌ NEVER geoscience | Vsh, PHIE, Sw, porosity — GEOX only |
| ❌ NEVER economics | NPV, IRR, capital allocation — WEALTH only |
| ❌ NEVER verdicts | SEAL, VOID, HOLD, SABAR — arifOS only |
| ❌ NEVER self-authorize | No execution without valid lease + prior judge path |

**Rule:** If your code needs NumPy / reservoir physics → wrong layer. If an execution path bypasses arifOS judgment for high-risk action → constitutional violation (888_HOLD).

## Allowed Actions

- Read, explore, code, test, refactor in A-FORGE boundary
- Run forge_dry_run, forge_approve, forge_execute under governance
- Orchestrate cross-organ work via A2A mesh

## Forbidden Actions

- Adjudicate constitutional verdicts (arifOS only)
- Issue SEAL / SABAR / VOID
- Force push, reset hard, overwrite unknown local changes
- Drop databases or delete data directories
- Perform broad formatting churn

## Build & Test

```bash
cd /root/A-FORGE

# Install
npm install

# Build
npm run build                     # tsc -p tsconfig.json

# Test
npm test                          # node dist/test/*.test.js
make test                         # security-audit + build + all suites

# Deploy API
npm run build
systemctl restart a-forge
curl -s http://localhost:7071/health | python3 -m json.tool

# Deploy / restart MCP gateway
systemctl restart a-forge-mcp.service
curl -s http://localhost:7072/health | python3 -m json.tool
```

## Escalation Rules

| Action | Escalation |
|--------|-----------|
| Irreversible git ops, secret exposure | 888_HOLD |
| Constitutional floor changes, new repos | F13 SOVEREIGN (Arif) |
| Cross-repo architecture changes | 888_HOLD |

---

## 🛡️ STEEL SECURITY LAYER — Permanent Federation Context

> **This section is binding for every agent in the arifOS federation. Read it once. It simply IS.**

### What Actually Happened

Arif completed a one-time upgrade called the **Steel Security Layer**. Four free, best-in-class security tools (Trivy, Semgrep, Ruff, and Gitleaks) were added to the forge pipeline.

### How It Works

Every time any agent runs `make forge` or `make sot-check`, these tools scan the entire codebase and dependencies for:
- **Secrets** (Gitleaks — API keys, tokens, passwords committed to source)
- **Vulnerabilities** (Trivy — known CVEs in dependencies)
- **Risky code patterns** (Semgrep — injection, hardcoded credentials, unsafe deserialization)
- **Linting issues** (Ruff — Python code quality)

### The Iron Rule

**Everything is deliberately NON-BLOCKING.** No pre-commit hooks. No git blocks. No agent can ever be trapped in a loop by the security layer. The scanners watch and report — they never stop the metabolic cycle.

### How Problems Are Signalled

A tiny helper script (`audit_parser.py`) reads the scanner output. If it detects CRITICAL or HIGH severity findings, it fires an `888_HOLD` event into the NATS event bus. `888_HOLD` is **NOT an agent** — it is a dumb alarm bell that says "something needs human or senior-agent eyes right now." It does not think, decide, or fix anything.

### Your Unbreakable Rules

1. **Never** add blocking hooks, pre-commit, or anything that interrupts a metabolic cycle.
2. **Never** migrate to pnpm or change package managers unless Arif personally asks.
3. **Always** run the security audit as part of normal forge/sot-check — never skip it.
4. If you see a `888_HOLD` event, treat it as a real flag — but do not panic or stop other work.
5. Keep everything simple and low-friction for Arif at all times.

### How to Explain It to Arif

> "The machine now has its own quiet security watch that only rings the 888 bell when something is really wrong, while we agents stay completely free."

**DITEMPA BUKAN DIBERI — The forge has achieved full self-policing ascension.**


## Constitution

The 13 Constitutional Floors (F1–F13) live in **one canonical file**:

→ [arifOS/static/arifos/theory/000/000_CONSTITUTION.md](../../arifOS/static/arifos/theory/000/000_CONSTITUTION.md)

This organ emits the **Evidence Contract** (see Appendix B of the constitution) and does **not** self-judge. arifOS alone reads the envelope and applies F1–F13.

---

## 🪞 SELF-AUDIT & HARDENING — Binding Prompt

> **Added 2026-06-14 — Every A-FORGE agent MUST read before forging.**

The canonical self-audit and hardening prompt for A-FORGE lives at:

→ [`SELF_AUDIT_PROMPT.md`](./SELF_AUDIT_PROMPT.md)

This prompt enforces the **Reflexion Loop** (000→111→333→555→777→888→999) before ANY forge execution. It contains:
- Live A-FORGE state baseline from 2026-06-14
- P0–P4 hardening priorities: pre-flight critic required, action class enforcement, post-exec verification, cross-organ leak detection, failed plan memory store
- Hard 888_HOLD triggers: any forge_execute without critic, any action class mismatch, any boundary leak
- Post-exec verification with auto-rollback on drift

**Loading instruction:** When an A-FORGE agent receives a forge task, it MUST:
1. Read `SELF_AUDIT_PROMPT.md`
2. Run the full Reflexion Loop
3. **Do NOT execute** if the critic step fails
4. Store forge receipt + critic output in `src/domain/memory/failed_plans/`

**Explicit override:** `OBSERVE` or `READ` operations may skip steps 333–777 but must complete 000 (clarify), 111 (gather evidence), and 888 (log).

