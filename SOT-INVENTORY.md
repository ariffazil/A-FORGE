# SOT Inventory — A-FORGE
**Probed:** 2026-07-12T20:34Z  
**Epoch:** FEDERATION-SOT-20260712-ac8550fa  
**Session:** SEAL-75dad8dbbb6a4683  

---

## 1. Git State

| Field | Value |
|-------|-------|
| **HEAD** | `27fbfb8` scars: update entropy scan index |
| **Active branch** | `refactor/apex-entropy-20260712` ✅ (matches context) |
| **Other local branches** | `main`, `forge/a-forge-openclaw-handoff`, `forge/a-forge-opencode-manager` |
| **Remote** | `origin/main`, `origin/refactor/apex-entropy-20260712` + 5 other remotes |
| **Dirty files** | **23 files** — 413 insertions, 107 deletions |
| **Deleted** | `040_ACT_PLAYBOOK.md` (1 line) |
| **Modified (source)** | `src/domain/registry/federationAlignment.ts` (49±), `src/interfaces/mcp/prompts.ts` (169±), `src/interfaces/mcp/proxyTools.ts` (54±), `src/interfaces/mcp/shell/forgeShell.ts` (119±), `src/interfaces/mcp/surfaceAuditTools.ts` (12±) |
| **Modified (config/data)** | `config/mcp_policies.json` (69±), `data/agent_identities.json` (17±) |
| **Modified (test)** | `test/VerticalAgentE2E.test.ts` (2±) |
| **Modified (GENESIS symlinks)** | All 13 symlinks (path update — 2± each) |

**Recent commits (5):**
1. `27fbfb8` scars: update entropy scan index
2. `1c2c30c` feat(somatic): complete Somatic Intelligence Kernel P0-P6+WIRE
3. `c2a066c` feat(e2e): D8 VerticalAgentEngine + ToM doc + buildEnvelope work-ledger wiring
4. `4b1430a` refactor: unify governed agent measurement contracts
5. `b75df14` docs(readme): fix tool count + update federation_release

---

## 2. Architecture (src/)

**Pattern:** Hexagonal / layered (domain → application → infrastructure → interfaces)

| Layer | Dir count | Key modules |
|-------|-----------|-------------|
| **domain/** | 19 dirs | engine, forge (skill, workflow), governance (F1-F13 enforcers, 40+ files), agents (mesa-detector, vertical-agent), apex (Python dark), registry, types, planner, orchestration, containment |
| **application/** | 7 dirs | a2a, approval (TicketStore, HumanEscalationClient), jobs (AgentManager, BackupManager), memory (ArifOSMemoryClient, LTM/STM), personal-v2 (PersonalOS) |
| **infrastructure/** | 12 dirs | llm (7 providers), tools (ToolRegistry, ShellTools, FileTools, MiniMax, Wealth), vault (Postgres, Supabase, MerkleV3), code-mode (sandbox), bridges (geox, wealth), cli, tui |
| **interfaces/** | 5 dirs + 30+ MCP files | mcp setup (serve.ts, server.ts, stdio.ts), 28 tool-definition files, contract (forge8, civilizational 8 organs), routes, middleware, config |
| **contracts/** | 1 file | types.ts |
| **elicit/** | 2 files | Python elicit server |
| **executor/** | 3 files | forge executor |
| **policy_interceptor/** | 1 file | mcp_policy_gate.py |

---

## 3. MCP Surface (Live)

| Endpoint | Port | Status | Key Metrics |
|----------|------|--------|-------------|
| **MCP Gateway** | **7072** | ✅ HEALTHY | `a-forge-mcp.service`, transport=streamable-http, **52 stateless tools** (README: 98 total incl. session-bound), sessions active |
| **Sense API** | **7071** | ✅ HEALTHY | `a-forge.service`, version=0.1.0, profile=enterprise, **authority_ceiling=777_FORGE**, owner_summary=GREEN, final_authority=ARIF |

**MCP tool definition files** (28 files in `src/interfaces/mcp/`):
- `forgeTools.ts` — core forge verbs
- `forge8Verbs.ts` — constitutional execution verbs
- `gatewayTools.ts` — gateway proxy tools
- `proxyTools.ts` — federation proxy tools
- `parallelTools.ts` — parallel execution tools
- `surfaceAuditTools.ts` — MCP surface auditing
- `surfaceGuardTools.ts` — federation drift watchdog
- `stateAnchorTools.ts` — state anchors
- `policyTools.ts` — policy enforcement
- `documentIngest.ts` — document ingestion
- `verifyTimelineTools.ts` — timeline verification
- `tools/arifos-epoch.ts` — epoch management
- `tools/arifos-plan-build.ts` — plan building
- `contract/forge8.ts`, `forge8_execution_verbs.ts`, `civilizational_eight_organs.ts` — constitutional contract

---

## 4. Execution Gates (src/domain/governance/)

**40+ governance files implementing constitutional floors F1–F13:**

| Gate | File | Function |
|------|------|----------|
| **F1 Amanah** | `f1Amanah.ts` | Trust/amanah enforcement |
| **F2 Truth** | `f2Truth.ts` | Truth/evidence chain |
| **F3 Witness** | `f3Witness.ts` (also `f3InputClarity.ts`) | Multi-witness validation |
| **F4 Clarity** | `f4Clarity.ts` | Output clarity |
| **F5 Peace** | `f5Peace2.ts` | Non-aggression |
| **F6 Empathy** | `f6Empathy.ts` | Empathy floor |
| **F7 Humility** | `f7Humility.ts` | Uncertainty acknowledgment |
| **F8 Genius** | `f8Genius.ts` | Capability calibration |
| **F9 AntiHantu** | `f9AntiHantu.ts` | Anti-ghost detection |
| **F10 Ontology** | `f10Ontology.ts` | Domain ontology |
| **F11 Coherence/Auth** | `f11Coherence.ts`, `f11Auth.ts` | Coherence + auth |
| **F12 Injection** | `f12Injection.ts` | Injection guard |
| **F13 Halt** | `F13HaltChannel.ts` (test) | Sovereign veto channel |

**Execution flow gates:**
- `AutonomousForgeGate.ts` — 7-phase forge lifecycle
- `PreForgeGateClient.ts` — pre-flight checks
- `CoolingGate.ts` — cooling period enforcement
- `SkillStagingGate.ts` — skill deployment staging
- `TriWitnessValidator.ts` — 3-witness validation
- `TrustTierEnforcer.ts` — trust tier gating
- `FloorEnforcer.ts` — constitutional floor dispatch
- `GovernanceBridge.ts` — bridge to arifOS
- `AmanahLockManager.ts` — lock/lease management
- `McpPolicyGate.ts` — MCP policy intercept
- `ModelCapabilityGate.ts` — model capability checks
- `GitDiffGuard.ts` — git diff safety guard
- `ActGateClient.ts` — ACT authorization client
- `ForgeSealService.ts` — forge seal service
- `mcp-surface-guard.ts` — MCP surface drift detection

---

## 5. Affordance Registry

- **AGENTS.md** defines a **compile-into-runtime rule** for A-FORGE: every discovery must produce `insight → organ → failure mode → action → telemetry field` mapping.
- **5-level reuse hierarchy:** Organs → Floors → Verdicts → Memory classes → MCP primitives
- **Boundary contract (zero-entropy guard):** A-FORGE = Hands/Actuator/Forger only. Never self-authorize. Never issue constitutional verdicts. Never compute domain logic (geoscience → GEOX, economics → WEALTH).
- **Allowed:** Build, deploy, code execution, orchestration, artifact management under lease
- **Forbidden:** Constitutional verdicts, SEAL/ SABAR/ VOID, force-push on main (feature branches OK), broad formatting churn

---

## 6. Systemd Geometry

**Host total:** 343 unit files, ~70 running, **39 federation-classified**  
**Canonical map:** `deploy/systemd/geometry.md` + `units-manifest.yaml`

| Unit | Organ | Axis | Status | Notes |
|------|-------|------|--------|-------|
| `a-forge.service` | ACT | ΩΨ | active/enabled | Execution shell (Docker Compose) |
| `a-forge-mcp.service` | ACT | ΩΨ | active/enabled | MCP gateway on :7072 |
| `aforge-heartbeat.service` | ACT | Ψ | active/enabled | Health pulse |
| `forge-gateway.service` | ACT | ΩΨ | inactive/disabled | Standby |
| `hermes-dispatcher.service` | ACT | Ω | active/enabled | Dispatch plane |
| `mind.service` | ACT | Ω | active/enabled | Mind plane |
| `surface-guard.service` | ACT | ψ | active/enabled | Federation drift watchdog |
| `apa-{telegram,github,email,calendar}-bridge.service` | APA | ΔΩΨ | active/enabled | 4 bridge services (A-FORGE repo) |

**A-FORGE specific units:**
- `a-forge-mcp.service`: Node.js, HTTP on :7072, `ProtectSystem=full`, `ProtectHome=read-only`, `PrivateTmp=true`, `ReadWritePaths=/root/A-FORGE/data`
- `a-forge.service`: Type=oneshot, docker-compose, depends on docker.service
- `surface-guard.service`: Node.js daemon, restarts on-failure (30s), after `arifos a-forge-mcp geox-mcp`

---

## 7. Forge Receipt Patterns

**69+ RECEIPT files** across forge_work/ (2026-07-05 to 2026-07-13)  
**50+ SEAL files** across the same period

**Receipt structure (canonical):**
```json
{
  "receipt_id": "receipt_<hash>",
  "session_id": "...",
  "actor_id": "...",
  "organ": "...",
  "tool_name": "...",
  "action_class": "...",
  "authority_scope": "...",
  "input_hash": "...",
  "output_hash": "...",
  "epistemic_status": "...",
  "evidence_layer": "L1|L2|L3",
  "witnesses": [...],
  "floor_results": {...},
  "verdict_request": "...",
  "vault999_status": "SEALED|PENDING"
}
```

**25 required fields** in the canonical receipt schema (`forge_work/canonical_receipt.schema.json`).  
**Markdown receipt pattern:** tables with Approved by / Executed by / Verified by headers, artefact action tables, post-archive conformance checks.

**Recent receipts (2026-07-12):** 15+ covering consolidation epoch, Somatic Kernel P0-P6, group archiving (forgetting/merging), SKILL unification, empirical eureka, AAA sandbox proxy, MCP apps tools call wire.

---

## 8. GENESIS/ Directory

| File | Type | Status |
|------|------|--------|
| 000–010 + PH-KOSMO | Symlinks → `../../arifOS/GENESIS/` | ✅ Dirty (path update) |
| `012_AFORGE_MANDATE.md` | Local | ✅ Clean — A-FORGE organ invariants |
| `mcp_model_gateway_contract.md` | Local | ✅ Clean — MCP model gateway spec |
| `providers_yml_spec.md` | Local | ✅ Clean — providers YAML spec |
| `secret_broker_non_coder.md` | Local | ✅ Clean — secret broker contract |
| `shutdown_contract.md` | Local | ✅ Clean — shutdown contract |

---

## 9. Test Coverage

**55 test files** in `test/`:
- 54 `.test.ts` (Node --test framework)
- 1 `.mjs` (seal-mcp-surface)
- **Core governance gates tested:** AutonomousForgeGate, CoolingGate, F13HaltChannel, FloorEnforcer, SkillStagingGate, TriWitnessValidator, TrustTierEnforcer, GovernanceCardGate
- **Integration:** VerticalAgentE2E, federation-safety-integration, real-agentic-stack, mcp-conformance, mcp-surface-guard
- **Other:** engine, a2a, vaultClient, mesa-detector, agentReadiness, ToolScoper, intentRouter, plus 20+ more

---

## 10. Deploy Infrastructure

| Component | Details |
|-----------|---------|
| **Docker Compose** (deploy/) | Prometheus + Grafana + Notifier + arifOS MCP service |
| **af-forge/** | Dockerfile, docker-compose, nginx, CSP widgets, SSL |
| **agent-plane/** | Docker Compose, backup cron, Prometheus scrape config |
| **Caddy** | Caddyfile for reverse proxy |
| **Grafana** | Datasource config |
| **Prometheus** | Prometheus config |
| **Monte Carlo** | Deployed on A-FORGE upstream by the af-forge/docker-compose.yml (manifests) |
| **Docker networks** | `A-FORGE-internal` (external), `arifosmcp_arifos_trinity` (external) |
