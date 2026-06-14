# CONTEXT.md — A-FORGE (Execution Shell)

> **Organ:** A-FORGE | **Port:** 7071 | **Repo:** `ariffazil/A-FORGE`
> **Kernel SoT:** `ariffazil/arifos` (FEDERATION_CONTRACT.md + GENESIS/000)
> **Last Updated:** 2026-06-12

## Live State
- **Service:** `a-forge.service` (systemd, enabled)
- **Health:** `http://127.0.0.1:7071/health`
- **Runtime:** TypeScript, Node 22
- **Role:** Governed execution — never adjudicates, never self-authorizes

## Dependencies
- arifOS MCP kernel (port 8088) — JUDGE_SEAL_AUTHORIZATION required before execution
- All 6 organ MCP endpoints for routing

## Current Focus
- Operational. CONSTITUTION.md ratified 2026-06-05. 4-layer forge gate active.
- GENESIS/ still missing (pending 011+ allocation)
- TUI production gaps sealed 2026-06-14: governance panel live, CI fixed, tui:start renamed

## Known Issues
- No GENESIS/ — kernel canon unlinked
- Pre-existing CI rot SEALED 2026-06-14 (checkout/setup-node @v6 → @v4)
- F2/F12 post-execution judge now halting (was annotation-only)
- GEOX/WEALTH bridge calls: advisory-only (graceful degradation by design for phase 1)
- F3 Tri-Witness: still linguistic detection (distributed consensus: phase 2 backlog)
- Ed25519 sovereign signature: pynacl present, wire-up pending (phase 2 backlog)
