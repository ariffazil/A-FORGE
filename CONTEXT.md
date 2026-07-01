<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-07-01
valid_from: 2026-06-24
valid_until: 2026-07-31
confidence: high
scope: /root/A-FORGE
-->

# CONTEXT.md — A-FORGE (Engineering Actuator)

> **Organ:** A-FORGE | **Port:** 7071 (MCP: 7072) | **Repo:** `ariffazil/A-FORGE`
> **Last Updated:** 2026-07-01

## Live State

- **Service:** `a-forge.service` (systemd, port 7071)
- **MCP Service:** `a-forge-mcp.service` (systemd, port 7072)
- **Health:** `http://127.0.0.1:7071/health`
- **Runtime:** Node.js 22+ / TypeScript / Express
- **Role:** Engineering actuator — execute under SEAL, never self-authorize

## Key Components

- `src/domain/` — pure business logic
- `src/application/` — use cases (services, approval, jobs)
- `src/infrastructure/` — external adapters (LLM, tools, vault, bridges)
- `src/interfaces/` — delivery (Express server, MCP, routes)

## Dependencies

- arifOS MCP kernel (8088) — constitutional judgment + leases
- All domain organs for health/status monitoring
- VAULT999 (8100/5001) — audit ledger writes

## Known Issues

- Federation Governance Gate previously failed due to missing `FEDERATION_CONTRACT.md` and `CONTEXT.md` — **resolved 2026-06-24**

---

*DITEMPA BUKAN DIBERI — Execution is forged under judgment, not given.*
