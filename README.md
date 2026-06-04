# A-FORGE — Vision Execution Shell
> **SEAL:** 333_MIND-DITEMPA-BUKAN-DIBERI-20260523
> **Repository:** https://github.com/ariffazil/A-FORGE
> **Purpose:** arifOS Federation Vision Forge + GEOX Manifest

> ⚠️ **CANONICAL AUTHORITY NOTICE:**
> A-FORGE is the **execution shell**, not a constitutional authority.
> The sovereign constitution and F1-F13 floors live in `ariffazil/arifOS`.
> For live federation status, see `ariffazil/arifOS/FEDERATION_STATUS.md`.
> See also `REPO_ROLE_MAP.md` for canonical organ roles.

---

## What is A-FORGE?

A-FORGE is the **vision execution shell** of the arifOS Federation. Where arifOS
is the constitutional kernel (the "why" and "what not to do"), A-FORGE is the
execution layer (the "how" and "what to build").

A-FORGE was forged through the REFORGE operation (2026-05-23), consuming 23
archive documents and producing canonical target documents across all three
repositories.

```
┌─────────────────────────────────────────────────────────┐
│  A-FORGE — Vision Shell                                 │
│                                                         │
│  SOVEREIGN_INTELLIGENCE.md   — Trinity organ network    │
│  REPO_ROADMAP.md             — GEOX + WEALTH manifest   │
│  REPO_CONSTITUTION.md        — GEOX internal reference (subordinate) │
│  DEPLOYMENT.md               — Deployment playbook      │
│  DOC_FAMILY_MAP.md           — Document lineage map     │
└─────────────────────────────────────────────────────────┘
                        ↓ reforged from
┌─────────────────────────────────────────────────────────┐
│  docs/archive/  (23 consumed files — SEALED, not deleted)│
└─────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
A-FORGE/
│
├── docs/
│   ├── architecture/
│   │   ├── SOVEREIGN_INTELLIGENCE.md   # Trinity organ network (MERGED +6 appendix)
│   │   │   ├── Appendix A: TRINITY_NETWORK_MAP.md
│   │   │   ├── Appendix B: TRINITY_ECOSYSTEM_MAP.md
│   │   │   ├── Appendix C: VISION_INTELLIGENCE_IMPLEMENTATION.md
│   │   │   ├── Appendix D: FORGE_HARDENED_VISION.md
│   │   │   ├── Appendix E: TOOL_CONSOLIDATION_MAP.md
│   │   │   └── Appendix F: 99_LEVEL_MISSING_MAP.md
│   │   ├── INTEGRATIONS.md
│   │   └── INFRASTRUCTURE.md
│   │
│   ├── REPO_ROADMAP.md               # GEOX + WEALTH manifest (MERGED +6 sections)
│   │   ├── Section A: ZERO_LOOPHOLE_V1_IMPLEMENTATION.md
│   │   ├── Section B: GEOX_SIMPLIFIED_MANIFEST.md
│   │   ├── Section C: GEOX_DESIGN_FORGE_SEAL.md
│   │   ├── Section D: EXTERNAL_INTEGRATION_GUIDE.md
│   │   ├── Section E: WIKI_UPDATE_SUMMARY.md
│   │   └── Section F: ROADMAP.md
│   │
│   ├── DEPLOYMENT.md                  # Deployment playbook (MERGED +7 appendices)
│   │   ├── Appendix A: AAA_GRADE_SEAL.md
│   │   ├── Appendix B: SITE_DEPLOYMENT_PLAN.md
│   │   ├── Appendix C: SITE_GEOK_ARIF_FAZIL_COM.md
│   │   ├── Appendix D: MCP_APPS_AUDIT.md
│   │   ├── Appendix E: SITE_MAP_VISUAL.md
│   │   ├── Appendix F: 888_HOLD_RELEASE_SUMMARY.md
│   │   └── Appendix G: GEOX_STATUS_AND_FOCUS.md
│   │
│   ├── REPO_CONSTITUTION.md          # Federation constitution (MERGED +2 appendix)
│   │   ├── Appendix: SOT_AAA_FEDERATION_MAPPING.md
│   │   └── Appendix: ALIGNMENT.md
│   │
│   ├── DOC_FAMILY_MAP.md             # Cross-repo document lineage (NEW)
│   │
│   ├── 00_META/
│   │   ├── GEOX_INVARIANTS.md         # GEOX 5-plane constitution (REFORGED)
│   │   └── WEALTH_INVARIANTS.md       # WEALTH 8-plane constitution (REFORGED)
│   │
│   ├── archive/                       # CONSUMED — 23 REFORGE source files
│   │   ├── TRINITY_NETWORK_MAP.md
│   │   ├── TRINITY_ECOSYSTEM_MAP.md
│   │   ├── VISION_INTELLIGENCE_IMPLEMENTATION.md
│   │   ├── FORGE_HARDENED_VISION.md
│   │   ├── TOOL_CONSOLIDATION_MAP.md
│   │   ├── 99_LEVEL_MISSING_MAP.md
│   │   ├── AAA_GRADE_SEAL.md
│   │   ├── SITE_DEPLOYMENT_PLAN.md
│   │   ├── SITE_GEOK_ARIF_FAZIL_COM.md
│   │   ├── MCP_APPS_AUDIT.md
│   │   ├── SITE_MAP_VISUAL.md
│   │   ├── 888_HOLD_RELEASE_SUMMARY.md
│   │   ├── GEOX_STATUS_AND_FOCUS.md
│   │   ├── ZERO_LOOPHOLE_V1_IMPLEMENTATION.md
│   │   ├── GEOX_SIMPLIFIED_MANIFEST.md
│   │   ├── GEOX_DESIGN_FORGE_SEAL.md
│   │   ├── EXTERNAL_INTEGRATION_GUIDE.md
│   │   ├── WIKI_UPDATE_SUMMARY.md
│   │   ├── ROADMAP.md
│   │   ├── GEOX_INVARIANTS.md
│   │   ├── WEALTH_INVARIANTS.md
│   │   ├── SOT_AAA_FEDERATION_MAPPING.md
│   │   └── ALIGNMENT.md
│   └── archive/_CONSUME_MANIFEST.md   # Source → target lineage log
│
├── agent/                            # Agent workspace
│   ├── agent.go                      # OpenClaw agent (port 18789)
│   └── ...
│
├── _forge/                           # Forge workspace
│   ├── ...
│   └── _00_META/                     # Forge-level meta
│
└── _00_META/                         # Root meta
    └── FORGE.md                      # Forge manifest
```

---

## Canonical Context Index — Read in This Order

This repo is the **agent entry point** for the arifOS federation. Read in this order:

| Priority | File | Purpose |
|----------|------|---------|
| 000 | `README.md` | This file — human and agent orientation |
| 001 | `AGENTS.md` | Mandatory agent behavior, repo hygiene, execution rules |
| 002 | `INVARIANTS.md` | Live ports, public URLs, forbidden stale assumptions |
| 003 | `.mcp.json` | Active MCP endpoint configuration |
| 004 | `AGENT_KERNEL_START.md` | Estate-wide entry ritual and truth hierarchy |

## Live Routing Invariants (VERIFIED 2026-06-02)

| Service | Public host | Local target | Status |
|---------|-----------|-------------|--------|
| **arifOS** | `arifos.arif-fazil.com` | `127.0.0.1:8088` | ✅ LIVE |
| **GEOX** | `geox.arif-fazil.com` | `127.0.0.1:8081` | ✅ LIVE |
| **WEALTH** | `wealth.arif-fazil.com` | `127.0.0.1:18082` | ✅ LIVE |
| **WELL** | `well.arif-fazil.com` | disabled | ⛔ 404 intentional |

## Forbidden Stale Assumptions

- ❌ arifOS MCP at `localhost:8080` — correct is `8088`
- ❌ GEOX MCP at `localhost:8081` — correct is `8081` (18081 is arifosd, NOT GEOX)
- ❌ WEALTH disabled — it is LIVE on `18082`
- ❌ WELL "NOT DEPLOYED" — it IS deployed, live on `18083`
- ❌ APEX not archived — it is read-only

## Required Pre-Flight Check

```bash
# MCP endpoint invariant check (fails if stale ports detected)
./scripts/preflight-check-mcp.sh

# Estate-wide invariant check
bash /root/arifOS/scripts/check-estate-invariants.sh
```

---

## Core Documents

### SOVEREIGN_INTELLIGENCE.md

The canonical vision document for the Trinity organ network (Δ AGI / Ω ASI / Ψ APEX).
Merged from 6 archive sources. Contains:
- Trinity architecture diagram
- Agent binding protocols
- Tool consolidation matrix
- 99-level governance map

**Reference:** For arifOS kernel implementation, see `arifOS/core/`

### REPO_ROADMAP.md

The GEOX + WEALTH production manifest:
- **GEOX:** 5-plane geoscience domain (Subsurface, Seismic, Petrophysics, Basin, Drilling)
- **WEALTH:** 8-plane financial domain (Risk, Compliance, Valuation, Portfolio, Derivatives, Regulatory, Reporting, Audit)
- Zero-loophole implementation plan
- External integration guide

**Reference:** Domain invariants at `docs/00_META/GEOX_INVARIANTS.md` and `WEALTH_INVARIANTS.md`

### DEPLOYMENT.md

The deployment playbook for:
- VPS deployment (72.62.71.199 — `af-forge`)
- A-FORGE service (port **7071** per `identity.toml`; OpenClaw relay at 18789)
- arifOS MCP deployment (port **8088** — see Forbidden Stale above)
- APEX PRIME deployment (port 3002)
- GEOX.arif-fazil.com site
- AAA grade verification

**Reference:** For live deployment configs, see `arifOS/deploy/`

### REPO_CONSTITUTION.md

The federation constitution defining:
- SOT (Source of Truth) AAA Federation mapping
- AAA² agent-agnostic architecture alignment
- Governance protocols

---

## Current State vs Target State

### CURRENT_STATE (as of 2026-06-02)

| Item | Status | Notes |
|------|--------|-------|
| SOVEREIGN_INTELLIGENCE.md | REFORGED | 6 archives merged |
| REPO_ROADMAP.md | REFORGED | 6 archives merged |
| DEPLOYMENT.md | REFORGED | 7 archives merged |
| REPO_CONSTITUTION.md | REFORGED | 2 archives merged |
| GEOX_INVARIANTS.md | REFORGED | Cross-repo (also in arifOS) |
| WEALTH_INVARIANTS.md | REFORGED | Cross-repo (also in arifOS) |
| DOC_FAMILY_MAP.md | ACTIVE | Full cross-repo lineage |
| docs/archive/ | SEALED | 23 consumed files preserved |

### TARGET_STATE (planned)

| Item | Status | Notes |
|------|--------|-------|
| arifOS integration | PENDING | arifOS reads A-FORGE docs as SOT |
| GEOX.arif-fazil.com | PENDING | Public site deployment |
| WEALTH domain implementation | PENDING | 8-plane financial pipeline |
| AAA integration | PENDING | See AAA/ repository |

---

## Federation Map

```
A-FORGE (Vision Shell)
    ├── arifOS (Constitutional Kernel) ← reads + executes
    │       ├── root core/ (Legacy Constitutional Engine)
    │       ├── arifosmcp/ (MCP Shell)
    │       ├── commands/ (Canonical entrypoint)
    │       ├── APEX/ (Tool registry)
    │       └── deploy/ (VPS configs)
    │
    └── AAA (Agent Cockpit)
            ├── KERNELPLAN.md + AAA² appendix
            ├── federated_a2a_protocol.md
            ├── agent-cards/ (4 agents)
            └── a2a/registry/agent-cards.json
```

---

## GEOX Domain (Geoscience)

GEOX is the 5-plane geoscience inference layer:

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Subsurface  │ → │   Seismic     │ → │ Petrophysics │
│  Plane       │   │  Plane        │   │   Plane      │
└──────────────┘   └──────────────┘   └──────────────┘
         ↓                   ↓                  ↓
┌──────────────┐   ┌──────────────┐
│    Basin     │ → │   Drilling   │
│  Plane       │   │   Plane      │
└──────────────┘   └──────────────┘
```

Each plane has:
- F2 ground truth protocols (PETRONAS insider data)
- Invariant constraints (physical laws)
- W_scar consequence surface (thermodynamic budget)
- 888_JUDGE human override gate

**Reference:** `docs/00_META/GEOX_INVARIANTS.md`

---

## WEALTH Domain (Financial)

WEALTH is the 8-plane financial governance layer:

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│   Risk   │ │Compliance│ │Valuation │ │Portfolio │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
     ↓           ↓           ↓           ↓
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Derivatives│ │Regulatory│ │Reporting │ │  Audit   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

Each plane governed by:
- EU AI Act high-risk classification
- APEX PRIME judgment protocol
- 888_JUDGE atomic operation gate

**Reference:** `docs/00_META/WEALTH_INVARIANTS.md`

---

## REFORGE Operation Log

| Source File | Target | Action | Date |
|-------------|--------|--------|------|
| 6× Trinity maps | SOVEREIGN_INTELLIGENCE.md | MERGE +6 appendix | 2026-05-23 |
| 6× roadmap files | REPO_ROADMAP.md | MERGE +6 sections | 2026-05-23 |
| 7× deployment docs | DEPLOYMENT.md | MERGE +7 appendix | 2026-05-23 |
| 2× constitution docs | REPO_CONSTITUTION.md | MERGE +2 appendix | 2026-05-23 |
| GEOX_INVARIANTS.md | arifOS/ + A-FORGE/ | REFROGE (2x) | 2026-05-23 |
| WEALTH_INVARIANTS.md | arifOS/ + A-FORGE/ | REFROGE (2x) | 2026-05-23 |
| 23 archive files | docs/archive/ | CONSUMED (SEALED) | 2026-05-23 |

Full lineage: `docs/DOC_FAMILY_MAP.md`

---

## Cross-Reference

| Document | Purpose |
|----------|---------|
| `docs/DOC_FAMILY_MAP.md` | Full cross-repo document lineage |
| `docs/00_META/GEOX_INVARIANTS.md` | GEOX 5-plane constitution |
| `docs/00_META/WEALTH_INVARIANTS.md` | WEALTH 8-plane constitution |
| `docs/REPO_ROADMAP.md` | GEOX + WEALTH manifest |
| `docs/DEPLOYMENT.md` | Deployment playbook |

For kernel implementation, see: **arifOS/**  
For agent architecture, see: **AAA-Cockpit** (`ariffazil/AAA`)

---

## AAA Terminology Note

AAA is a polymorphic acronym. When reading A-FORGE docs that mention AAA:

| Term | Surface | Role |
|------|---------|------|
| **AAA-HF** | Hugging Face dataset | Doctrine, floors, verdicts, schemas, evals |
| **AAA-Cockpit** | GitHub `ariffazil/AAA` | Control plane, A2A, dashboard, agent registry |
| **AAA-Doctrine** | Conceptual layer | Constitutional alignment principle |

A-FORGE executes approved work only. A-FORGE must not treat **AAA-Cockpit** as constitutional authority. Constitutional judgment lives in **arifOS** (F1–F13, 888_JUDGE).

> "AAA is polymorphic by design. When precision matters, qualify the surface."

---

**DITEMPA BUKAN DIBERI — A-FORGE is the shell that executes the vision.**


---

## Federated Architecture

This repository is a core organ of the **arifOS Federation**, running on VPS `af-forge` (72.62.71.199) at `/root/`:

| Role | Path (canonical on this VPS) | GitHub |
|------|------------------------------|--------|
| **Operator Cockpit (AAA)** | `/root/AAA` | [`ariffazil/AAA`](https://github.com/ariffazil/AAA) |
| **Constitutional Kernel (arifOS)** | `/root/arifOS` | [`ariffazil/arifOS`](https://github.com/ariffazil/arifOS) |
| **Vision Shell (A-FORGE)** | `/root/A-FORGE` | [`ariffazil/A-FORGE`](https://github.com/ariffazil/A-FORGE) |
| **Geological Engine (GEOX)** | `/root/geox` | [`ariffazil/geox`](https://github.com/ariffazil/geox) |
| **Capital Engine (WEALTH)** | `/root/WEALTH` | [`ariffazil/wealth`](https://github.com/ariffazil/wealth) |
| **Biological Substrate (WELL)** | `/root/WELL` | [`ariffazil/well`](https://github.com/ariffazil/well) |
| **Informational Surfaces (arif-sites)** | external | [`ariffazil/arif-sites`](https://github.com/ariffazil/arif-sites) |

> Note: legacy Windows path references (`C:\ariffazil\...`) appeared in earlier drafts of this section and have been replaced with the canonical Linux VPS paths.

*Unified under the arifOS Sovereign Constitution (F1–F13). For F11 audit, see `arifOS/VAULT999/outcomes.jsonl`.*
