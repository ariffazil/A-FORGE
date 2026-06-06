<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-05-26
valid_from: 2026-05-26
valid_until: 2026-06-26
confidence: high
scope: /root/A-FORGE
-->

# AGENTS.md — A-FORGE | arifOS Federation

> **MANDATORY BOOT SEQUENCE**
> 1. Read `/root/AGENTS.md` (Global Federation Rules & Identity)
> 2. Read `/root/CONTEXT.md` (Live Machine State & Ports)
> 3. Read this file (Repo-Specific Build/Test/Run rules)

> **Execution Intelligence / Forge Engine**
>
> A-FORGE orchestrates and executes within bounded tools. It does NOT adjudicate, SEAL, or issue constitutional verdicts.

## Allowed Actions

- Read, explore, code, test, refactor
- Propose changes, create plans, draft documentation
- Work within the A-FORGE repo boundary
- Run `docker compose config`, health checks, diagnostics

## Forbidden Actions

- Adjudicate constitutional verdicts (arifOS only)
- Issue SEAL / SABAR / VOID
- Force push, reset hard, overwrite unknown local changes
- Drop databases or delete data directories
- Mutate archived/read-only repos
- Perform broad formatting churn

## Verification Commands

```bash
npm run build
npm test
make test
```

## A-FORGE Boundary Contract (Zero-Entropy Guard)

A-FORGE is a **transport bridge and execution shell**, not a domain organ.

- ✅ Routes intent to arifOS / GEOX / WEALTH / WELL MCP servers
- ✅ Handles orchestration, retries, escalation
- ✅ Runs advisory checks only (non-binding)
- ✅ Build, deploy, and artifact execution under governance

- ❌ NEVER performs geoscience computation (Vsh, PHIE, Sw, etc.) — GEOX only
- ❌ NEVER runs economic evaluation logic — WEALTH only
- ❌ NEVER issues constitutional verdicts (SEAL / VOID / HOLD) — arifOS only
- ❌ NEVER imports NumPy, Pandas, SciPy, lasio, welly, or matplotlib

Authoritative logic lives in the Python MCP organs.

**Rule:** If your code needs NumPy / Pandas / reservoir physics → wrong layer

## Escalation Rules

- **888_HOLD:** Irreversible actions, git mutations, secret exposure, cross-repo architecture changes
- **F13 SOVEREIGN (Arif):** Constitutional floor changes, new repo creation, external communications

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

The 13 Constitutional Laws (L01–L13) live in **one canonical file**:

→ [arifOS/static/arifos/theory/000/000_CONSTITUTION.md](../../arifOS/static/arifos/theory/000/000_CONSTITUTION.md)

This organ emits the **Evidence Contract** (see Appendix B of the constitution) and does **not** self-judge. arifOS alone reads the envelope and applies L01–L13.

