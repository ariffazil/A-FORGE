---
type: Blueprint
tags: [adapter-bus, cli, agents, trust, runtime, interfaces]
sources: [raw/README.md, raw/ARCHITECTURE.md, raw/VPS_NATIVE.md, raw/package.json]
last_sync: 2026-04-10
confidence: 0.86
status: active
operator: arifOS_bot
---

# Blueprint: Adapter Bus

AF-FORGE is not just one agent loop. It is a coordination surface for multiple agent and CLI entry points.

This page describes that surface as an **adapter bus**: the place where different interfaces can plug into the forge while still respecting operational boundaries.

## Main interfaces observed
- local CLI entry points from the repo runtime
- OpenClaw as the live operator/orchestrator surface
- external coding-agent style tools and profiles
- trusted VPS mode for `agent-workbench`

## Why this matters
If every agent runtime is treated as equivalent, trust boundaries blur.
That is how “helpful tooling” quietly becomes “root with vibes”.

AF-FORGE should instead think in layers:
- **interface**: how a human or agent asks for work
- **runtime**: where the work executes
- **authority**: what is actually permitted
- **memory**: where outcomes are stored

## Trusted VPS mode
`VPS_NATIVE.md` makes one thing very clear:
trusted local VPS mode is a **high blast radius** posture.

When enabled, it broadens tool access and weakens shell filtering.
That should be treated as an explicit machine-trust decision, not a casual default.

## Adapter bus view

```text
human / operator
    -> interface (OpenClaw, CLI, coding agent)
    -> runtime (agent-workbench, OpenClaw, service container)
    -> tool boundary
    -> machine action
    -> wiki/state/vault trace
```

## Design rule
The adapter bus should stay understandable enough that you can answer:
1. who initiated this,
2. where it ran,
3. what tools it could touch,
4. what state it changed,
5. where the trace survived.

If those answers are fuzzy, the bus is too blurry.

## Related
- [[20_BLUEPRINTS/Memory_Stack]]
- [[20_BLUEPRINTS/Stack_Components]]
- [[40_HAMMERS/Operational_Tooling]]
- [[80_FEDERATION/Three_Wikis_Map]]
