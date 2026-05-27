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
