# ARIF.md | METABOLIC KERNEL v1.0

> SYSTEM TYPE: LORE INTERFACE
> GOVERNANCE: arifOS AAA
> VETO: 888 JUDGE
>
> INVARIANT: Descriptive memory of repo state.
> This file NEVER modifies Law. It only reports and compresses observed reality.


## 0. IDENTITY & MOUNT POINT

- REPO_NAME: A-FORGE
- CONTAINER_ID: 2026-05-15
- DOMAIN_ROLE: Execution Intelligence / Forge Engine — TypeScript agent runtime with constitutional governance, Planner/Executor/Verifier triad, governed memory, 888_HOLD sovereignty controls
- STABILITY_CLASS: ACTIVE
- VERSION: v2026.05.15-FORGED


## 1. CURRENT FOCUS (INSTRUCTION POINTER)

- SABAR cooldown protocol deployed: `CoolingGate.ts` (12KB) with tri-witness, resource budgets, 72h default window. `/sabar/cooldown` endpoint live in `server.ts`.
- DeepnShadow protocol: `HumanInteractionGuard.ts` + `protocols/deepnshadow.ts` — dignity-gated routing.
- Personal OS v2: 6-verb human interface (remember, recall, track, think, hold, execute).
- MCP server: 19 tool classes. HTTP bridge on port 7071. Prometheus metrics.
- Container running `ghcr.io/ariffazil/a-forge:3159d22` — behind HEAD. Rebuild pending.
- Tests: 7/7 pass (node:test). Build clean (TypeScript 5.8+, NodeNext).


## 2. OPERATIONAL MANDATE

- A-FORGE is the execution bridge — builds, tests, deploys under constitutional governance.
- Implements 13 Constitutional Laws (F1–F13) as TypeScript guards.
- Approval Boundary: PENDING → DISPATCHED → APPROVED/REJECTED → REPLAYED.
- Memory Contract: 5 tiers (ephemeral, working, canon, sacred, quarantine).
- VAULT999 client: File, Postgres, NoOp backends.
- MCP tools: forge_check_governance, forge_run, forge_hold, forge_approve, forge_remember, forge_recall.
- Upstream: arifOS kernel (constitutional doctrine).
- Downstream: AAA workspace, GEOX, WEALTH, WELL organs.


## 3. THE 999 SEAL (SESSION LOG)

- 2026-05-15 | Omega + Claude | SABAR cooldown protocol (CoolingGate + tests + endpoint). DeepnShadow guard. Personal OS v2. Pushed to main. Container not yet rebuilt.
- 2026-05-13 | OpenCode | DeepnShadow protocol migrated from standalone skill to internal routing. HumanInteractionGuard forged. ActionBadge TS errors fixed.
- 2026-05-12 | OpenCode | GEOX artifacts cleaned from A-FORGE root (geox_*.py, pyproject, Dockerfile.unified). Causal Scene v2 extracted to geox.
- 2026-04-23 | arifOS_bot | ARIF.md scaffolded — first metabolic kernel instance for A-FORGE. Gold Seal v1.0 published.


## 4. ACTIVE TOPOLOGY (MEMORY MAP)

- CRITICAL_FILES:
  - `src/server.ts` → HTTP Bridge (Express, port 7071). /sabar/cooldown, /sense, /governance/evaluate
  - `src/engine/AgentEngine.ts` → Core execution loop with governance gates
  - `src/governance/CoolingGate.ts` → SABAR cooldown protocol (tri-witness, resource budgets)
  - `src/governance/` → F1-F13 floor implementations (f3InputClarity, f4Entropy, f6HarmDignity, f7Confidence, f9Injection, f11Coherence)
  - `src/approval/` → Approval Boundary (TicketStore, ApprovalRouter)
  - `src/memory-contract/` → 5-tier governed memory
  - `src/vault/` → VAULT999 client
  - `src/mcp/server.ts` → MCP stdio server (19 tool classes)
  - `src/tools/` → BaseTool, ToolRegistry, File/Search/Shell/Editor tools

- ENTRYPOINTS:
  - `npm run build && node dist/src/server.js` → HTTP bridge
  - `node dist/src/mcp/server.js` → MCP stdio server
  - `make up` → Docker Compose stack

- DATA_FLOWS:
  - CLI → AgentEngine → LLM Provider → Tool Execution → Memory → Vault999
  - arifOS JUDGE → A-FORGE forge_precheck → WELL coupled readiness → execute


## 5. INTERRUPTS & FAULTS (BLOCKERS)

- SOFT_FRICTION: Container image behind HEAD. SABAR cooldown not in running container.
- HARD_BLOCK: None. Build clean. 7/7 tests pass.


## 6. RECENT SCARS (W_scar)

- [2026-05-15] → [SABAR cooldown protocol forged] → [CoolingGate.ts + tests + endpoint deployed to git, not yet in container]
- [2026-05-12] → [GEOX artifacts co-located in A-FORGE root] → [Cleaned. Moved to geox repo. Root decluttered.]
- [2026-04-21] → [A-FORGE not audited] → [Topology audit done 2026-05-15. All critical files mapped.]


## 7. EXECUTION BUFFER (COMMANDS)

| Command | Status | Context |
|---------|--------|---------|
| `npm run build` | ✅ | TypeScript → dist/ |
| `npm test` | ✅ | 7/7 pass |
| `make up` | ✅ | Docker Compose stack |
| `node dist/src/server.js` | ✅ | HTTP bridge on 7071 |


## 8. PRIVILEGE ESCALATION (888 HOLD)

- [Q]: Rebuild A-FORGE container to activate SABAR cooldown in production?
- [CONTEXT]: Code committed + pushed. Container runs old image. Ω₀ = 0.2 (low uncertainty).
- [Q]: Full 13-floor governance audit — are all stubs implemented?
- [CONTEXT]: F2 (Truth), F10 (Privacy), F12 (Stewardship) are stubs. F1 enforced via gate, F5 outside governance dir. Ω₀ = 0.4 (medium — audit needed).


## 9. PIPELINE PREFETCH (NEXT MOVES)

- [ ] Rebuild + push A-FORGE container → `docker compose up -d`
- [ ] Implement F2, F10, F12 stubs
- [ ] Wire SealService into AgentEngine (currently only plan-level validation)
- [ ] Full topology audit of all 19 tool classes


---

*🪙 GOLD SEAL | METABOLIC KERNEL v1.0 | arifOS AAA | 888 JUDGE VETO | DITEMPA BUKAN DIBERI*
*Readable by: single human · couple · company · institution · AI agent · machine · team · civilisation intelligence*
