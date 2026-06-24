# arifOS MCP vs A-FORGE MCP — Brain vs Hands (Canonical Mapping)

**Date:** 2026-06-23  
**Status:** Binding per F13 sovereign architecture. 999_SEAL RECEIPT: AF-2026-06-23-001-SEAL-001 (incorporated).  
**Source:** arifOS constitutional kernel + A-FORGE governed execution.  
**Sealed in:** AF-2026-06-23-001-Tiered-Agent-Orchestration.md (999_SEAL — CHAOS SEALED)

**999_SEAL Summary (from sealed receipt):**  
Chaos removed. Flow hardened. Narrow = encoder/metabolizer accelerators only. Geometry (scar + soul) declared at init. Canonical handoff required for gov paths. Brain (arifOS) vs Hands (A-FORGE) irrevocable. All under F1-F13. DITEMPA BUKAN DIBERI.

## Core Contrast

| Dimension | arifOS MCP (port 8088) | A-FORGE MCP (port 7072, stdio preferred) |
|-----------|------------------------|------------------------------------------|
| Role | Constitutional kernel / sovereign governor / judge | Governed execution shell / actuator / forger |
| Owns | Law (L01–L13 / F1–F13), truth, judgment, memory routing, VAULT999 seals | Build, deploy, run, shell, browser, orchestration, artifacts, leases |
| Tool namespace | arif_<noun>_<verb> (canonical) | forge_* + proxies |
| Verdict authority | Issues SEAL / SABAR / HOLD_888 / VOID | Never issues final constitutional verdicts |
| Governance | Floor enforcer + INIT→JUDGE→SEAL contract | FloorEnforcer + Lease gates + session gates. Requires arifOS authorization for high-risk |
| Key invariants | Never delegate final judgment. F13 veto absolute. Writes immutable chain | Never self-authorize. Never adjudicate. Routes judgment to arifOS |
| Transport | Primarily streamable-http | stdio (preferred for agents) + streamable-http |
| Session/Safety | arif_init (000) → arif_judge (888) → arif_seal (999) | Leases (forge_lease_request), action classification, human escalation for irreversible |
| Proxies | Routes to GEOX/WEALTH/WELL for evidence | Rich proxies (fs/git/docker/postgres/MiniMax) + own execution primitives |

**One-line:**  
arifOS MCP = Law + Judgment + Memory + Truth. Decides lawful and seals.  
A-FORGE MCP = Hands under law. Does the permitted work via leases.

## Mandatory Agent Flow (Brain → Hands → Seal)

1. Bootstrap: arifOS `arif_init` (geometry declaration, session bind).
2. Evidence/Thinking: arifOS `arif_observe` / `arif_think` / `arif_critique` / `arif_route` / `arif_memory`.
3. Pre-irreversible: A-FORGE `forge_lease_request` (bounded scope). High-risk forge tools require prior arifOS judgment.
4. Execute: A-FORGE `forge_execute` / `forge_run` / `forge_shell` / proxies / jobs.
5. Close: arifOS `arif_judge` + `arif_seal` (VAULT999 record). A-FORGE receipts can be sealed as evidence.

**Transport:** A-FORGE stdio for parallel agent loops (Grok Build 8-way). arifOS http for strong session + human-visible deliberation.

## Tool Mapping (Function Mode + Cognitive Action → Reality)

**Narrow Instruments (subordinate to A-FORGE, feed canonical):**

- **mcp-repo-read** (Encoder/Observe + Evidence)
  - Canonical modes: 111_OBSERVE / 222_EVIDENCE
  - Cognitive: observe (encoder), context synthesis (metabolizer entry)
  - Reality: Evidence feed only. Returns `canonical_handoff` for gov.

- **gb_federation_router** (Route/Planner)
  - Canonical modes: 555_ROUTE
  - Cognitive: route + orchestrate (boundary)
  - Reality: Planning + lease orchestration. Execution after canonical seal.

- **mcp-arifos-kernel** (Measure + Advisory)
  - Canonical modes: 777_MEASURE
  - Cognitive: measure + advisory metabolizer
  - Reality: Read views + gated advisory to 888.

- **mcp-repo-write** (Decoder/Forge — Gated)
  - Canonical modes: 010_FORGE
  - Cognitive: forge (decoder)
  - Reality: Actual change **only** after arifOS `arif_judge` SEAL + lease + geometry.

**Core A-FORGE MCP (forge_* execution primitives + proxies):**
- `forge_lease_*` : Governance boundary (pre-execution authorization).
- `forge_plan` / `forge_dry_run` / `forge_shell_dryrun` : Pre-reality simulation (metabolizer/decoder prep).
- `forge_execute` / `forge_run` / `forge_shell` / `forge_browser_*` : Reality actuation (decoder).
- Proxies (fs/git/docker/postgres/MiniMax): Execution substrate.
- `forge_judge_proxy` / gateway tools: Route back to arifOS for judgment.

**Canonical arifOS MCP (the Law) — From KERNEL INIT REPORT (validated against current workspace):**
- 000 `arif_init` (geometry/scar+soul bind) — ACTIVE, exported
- 111 `arif_observe` / `arif_explore` (encoder) — ACTIVE + REGISTERED (arif_explore now surfaced in __all__)
- 222 `arif_fetch` (evidence) — ACTIVE
- 333 `arif_think` (metabolizer/reason) — ACTIVE
- 444r `arif_compose` (reply)
- 555 `arif_route` / `arif_triage` / `arif_bridge_connect` / `arif_memory` (route + memory) — ACTIVE; arif_memory now surfaced
- 666 `arif_critique` (metabolizer/critique)
- 777 `arif_measure`
- 888 `arif_judge` (judgment) — ACTIVE (includes `arif_kernel_intercept`)
- 010 `arif_forge` (decoder/execute)
- 999 `arif_seal` (reality seal)
- Additional exported: `arif_self_evaluate`, `arif_model_compare` (shadow geometry)
- Soft-deprecated: `arif_bridge`, `arif_kernel_route` (absorbed via passthrough in kernel_canonical)

**Gaps closed in this audit/harden:**
- arif_explore and arif_memory now in __all__ and surfaced (was gap in report snapshot).
- Hardened narrow handoff to prevent bypass of above.

**Open chaos from report (flagged for next seal):**
- arif_organ_attest_all false-positive DEGRADED (#509) — governance signal misfire.
- Sentinel invariant VOID (#479).
- Deps blocked.

## Enforcement in A-FORGE (Current State)

- `src/interfaces/mcp/core.ts` and `forgeTools.ts`: Many high-risk paths call `arif_judge_deliberate` or require lease.
- `GovernanceBridge.ts`, `FloorEnforcer.ts`: Inline constitutional gates.
- Leases: `forge_lease_request` scopes actions; high blast-radius require arifOS.
- Telemetry: Tagged with originating agent + geometry + prior judgment status (instrumented per plan).

Narrow Grok-Build MCPs (services/grok-build-mcp) **must not** implement judgment/seal/forge. They accelerate early layers and hand off.

## Human Interface

- **AAA Cockpit** (https://aaa.arif-fazil.com): F13 sovereign control plane, 888 deliberation, A2A, organ oversight.
- Direct: arifOS http://127.0.0.1:8088/mcp ; A-FORGE http://127.0.0.1:7072/mcp or stdio.
- Health: :8088/health, :7071/health, :7072/health.

## Sources of Truth

- arifOS: arifosmcp/constitutional_map.py, server.py, runtime/tools.py, resources/agent_geometry.py
- A-FORGE: ARCHITECTURE.md (this mapping), src/interfaces/mcp/*, contracts/mcp_surface.yaml, GENESIS/012_AFORGE_MANDATE.md, APEX_THEORY_AND_FEDERATION.md
- Federation: root AGENTS.md, A-FORGE AGENTS.md, plan AF-2026-06-23-001

**arifOS decides what is lawful.**  
**A-FORGE forges what is permitted under law.**  

They are deliberately separated so governance cannot be bypassed by execution power.

---

*This document supersedes prior mappings for the tiered orchestration plan.*