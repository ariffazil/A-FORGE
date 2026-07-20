---
type: System
title: A-FORGE Execution Shell
description: Governed execution shell — build, deploy, run, and mutate under constitutional gates. The BODY of the federation Trinity (SOUL·MIND·BODY)
resource: http://localhost:7071/health
tags: [federation, execution, forge, build, deploy]
timestamp: 2026-07-20T08:00:00Z
links:
  - ../atlas333.md
  - ../federation-map.md
---
# A-FORGE (Execution Shell)

Doctrine: DITEMPA BUKAN DIBERI — Forged, Not Given

## What it does

A-FORGE is the **BODY/HANDS** of the federation. It:

- **Executes** — Runs commands, builds code, deploys services under lease
- **Forge Tools** — 111+ MCP tools (forge_shell, forge_docker, forge_git, forge_filesystem, etc.)
- **Never adjudicates** — Routes all judgment to arifOS via forge_judge_proxy
- **Never self-authorizes** — Requires lease + prior judge path for mutations
- **Lease System** — Time-bounded execution permissions from arifOS

## Constitutional Boundary

| Allowed | Forbidden |
|---------|-----------|
| Execute under lease | Self-authorize |
| Route to organs | Issue verdicts |
| Orchestrate | Judge floors |
| Build and deploy | Seal without arifOS |

## Ports

- `:7071` — Express API server
- `:7072` — MCP gateway (streamable HTTP, internal loopback)

## Key Paths

- `/root/A-FORGE/` — Source
- `/root/A-FORGE/src/domain/` — Pure business logic (engine, governance, planner)
- `/root/A-FORGE/src/infrastructure/tools/` — All forge_* tool implementations
- `/root/A-FORGE/forge_work/` — Working artifacts, day-bucketed
