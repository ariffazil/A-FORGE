<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-05-25
valid_from: 2026-05-25
valid_until: 2026-06-25
confidence: high
scope: /root/A-FORGE
-->

# AGENTS.md — A-FORGE

> **Execution Intelligence / Forge Engine**
>
> A-FORGE orchestrates and executes within bounded tools. It does NOT adjudicate, SEAL, or issue constitutional verdicts.

## Mandatory Boot Sequence

1. Read `INVARIANTS.md`
2. Read `README.md`
3. Install: `npm install`
4. Build: `npm run build`

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

## Escalation Rules

- **888_HOLD:** Irreversible actions, git mutations, secret exposure, cross-repo architecture changes
- **F13 SOVEREIGN (Arif):** Constitutional floor changes, new repo creation, external communications
