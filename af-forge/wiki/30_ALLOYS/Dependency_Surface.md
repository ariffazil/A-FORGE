---
type: Alloy
tags: [dependencies, docker, node, typescript, runtime, surfaces]
sources: [raw/package.json, raw/ARCHITECTURE.md, raw/RUNTIME_POLICY.md]
last_sync: 2026-04-10
confidence: 0.84
status: active
operator: arifOS_bot
---

# Alloy: Dependency Surface

This page tracks the dependency classes that AF-FORGE relies on, at the level that matters operationally.

It is not trying to duplicate a lockfile.
It is trying to capture what kinds of things the machine depends on and where coupling risk lives.

## Major dependency classes

### Runtime stack
- Node / TypeScript runtime for the repo itself
- Docker as the main service substrate
- systemd for native host services

### Data/memory services
- Postgres
- Redis
- Qdrant

### Model/runtime services
- OpenAI-backed runtime surfaces
- Ollama when local model execution is enabled
- OpenClaw as orchestration/runtime surface

### Operator tools
- Docker CLI / compose
- git
- agent CLIs
- monitoring/admin surfaces such as Dozzle, Uptime Kuma, Portainer

## Coupling risks
1. **Container vs native drift**
   - when a service exists in compose but is actually running standalone
2. **Local-image dependence**
   - when rebuild/recovery depends on images not reproducible from current source
3. **Deleted project roots**
   - when data still exists but compose definitions are gone
4. **Trust expansion**
   - when a runtime mode broadens command/tool authority without equivalent audit clarity

## Operational use
Read this page before:
- upgrades
- cleanup/pruning
- rebuilds
- service migration
- shell policy changes

## Related
- [[20_BLUEPRINTS/Stack_Components]]
- [[50_CRACKS/Orphaned_Compose_Projects]]
- [[50_CRACKS/Intelligence_Gaps]]
