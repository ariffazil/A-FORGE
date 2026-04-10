---
type: Alloy
tags: [dependency-matrix, versions, pinning, libraries]
sources: [30_ALLOYS/Dependency_Surface.md, raw/package.json]
last_sync: 2026-04-10
confidence: 0.8
status: active
operator: arifOS_bot
---

# Alloy: Dependency Matrix

This page is the human-readable matrix for important AF-FORGE dependency surfaces.

| Surface | Class | Status | Note |
|---------|-------|--------|------|
| Docker | substrate | active | primary service execution layer |
| systemd | host runtime | active | native services like OpenClaw gateway |
| Node / TypeScript | repo runtime | active | repo build/runtime surface |
| Postgres | data | active | structured persistence |
| Redis | cache | active | transient coordination |
| Qdrant | vector | active | memory substrate |
| OpenClaw | agent runtime | active | orchestration and messaging |
| Ollama | local model | conditional | useful when local model execution is enabled |

See also: [[30_ALLOYS/Dependency_Surface]]
