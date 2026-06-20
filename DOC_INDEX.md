# A-FORGE Document Index

> **Doctrine:** DITEMPA BUKAN DIBERI — Forged, Not Given.
> **Purpose:** One map for all documentation. New agents start here.

---

## 1. Constitutional Layer (Must Read)

| File | Size | Purpose |
|------|------|---------|
| `CONSTITUTION.md` | 97 lines | Binding: never self-authorize. arifOS judges, A-FORGE executes. |
| `ARCHITECTURE.md` | 209 lines | Hexagonal architecture, 4-layer forge gate, federation topology. |
| `CLAUDE.md` | 136 lines | Agent instruction surface — build, test, deploy, verify. |
| `AGENTS.md` | 177 lines | Repo constitution — build rules, escalation, SOT manifest. |

## 2. Operational Layer (Read When Needed)

| File | Size | Purpose |
|------|------|---------|
| `RUNBOOK.md` | 42 lines | Start/stop, health check, logs, test commands. |
| `CONTEXT.md` | 27 lines | Live state, current focus, known issues. |
| `FEDERATION_STATUS.md` | 10 lines | Pointer to arifOS federation status (canonical SoT). |
| `FEDERATION_CONTRACT.md` | — | Vendored contract from arifOS kernel. |
| `INVARIANTS.md` | 111 lines | Identity — what A-FORGE owns and does not own. |

## 3. Development Docs

| File / Dir | Purpose |
|------------|---------|
| `docs/TUI-ARCHITECTURE.md` | TUI forge — design and runbook |
| `docs/TUI-RUNBOOK.md` | TUI operational guide |
| `docs/A-FORGE_VPS.md` | VPS deployment and infrastructure |
| `docs/ACP_PROTOCOL.md` | Agent Control Protocol |
| `docs/DESIGN_WEBSITE.md` | Website design spec |
| `docs/DOC_FAMILY_MAP.md` | Cross-repo doc relationships |
| `docs/METABOLIC_WORKFLOW.md` | Metabolic cycle documentation |
| `docs/PHASE_B_DESIGN_NOTE.md` | Phase B architecture |
| `docs/PHYSICS_9_SPEC.md` | Physics-9 spec for execution gates |
| `docs/PROMPT_TO_VPS_AGENTS.md` | VPS agent prompt templates |
| `docs/REPO_ROADMAP.md` | Full repo roadmap (47KB — detailed) |
| `docs/repo-role-boundary.md` | Role boundaries |
| `docs/archive/` | Historical release notes and SOT files |

## 4. Subdirectories

| Dir | Purpose |
|-----|---------|
| `docs/api/` | API specs |
| `docs/architecture/` | Architecture deep-dives |
| `docs/archive/` | Historical/stale docs preserved for reference |
| `docs/deployment/` | Deployment guides |
| `docs/governance/` | Governance documentation |
| `docs/integration/` | Integration guides |
| `docs/operations/` | Operations runbooks |
| `docs/operator/` | Operator guides |
| `docs/plans/` | Planning docs |
| `docs/prompts/` | Agent prompts |
| `docs/superpowers/` | Superpower/feature docs |

## 5. Ingest Order for New Agents

1. `CONTEXT.md` — Live state (1 min)
2. `ARCHITECTURE.md` — Architecture (3 min) 
3. `CONSTITUTION.md` — Rules (1 min)
4. `INVARIANTS.md` — Boundaries (1 min)
5. `AGENTS.md` — Build/test (2 min)
6. `RUNBOOK.md` — Operations (1 min)

Total: **~9 minutes** for full context. **~3 minutes** for routine work.
