# AF-FORGE Wiki Index

> **Version**: v1.0.0  
> **Status**: proper wiki tree established  
> **Focus**: VPS infrastructure, components, operations, cracks, and recovery  
> **Last Updated**: 2026-04-10

## Start here
- [[SCHEMA]] — what this wiki is, how it is maintained, and the Karpathy-style persistence pattern
- [[log]] — chronological history of wiki ingests, fixes, and audits

## 00_OPERATORS, who runs the forge
- [[00_OPERATORS/Reconnect_Recovery_Runbook]] — controlled reconnect/recovery path for degraded MCP wiring

## 10_RITUALS, how the forge operates
- [[10_RITUALS/Build]] — build, deploy, verify, rollback ritual for AF-FORGE changes
- [[10_RITUALS/Ingest]] — ingest workflow for new infrastructure knowledge and external docs

## 20_BLUEPRINTS, what is built
- [[20_BLUEPRINTS/Memory_Stack]] — L1/L2/L3 memory model for state, wiki, and VAULT999
- [[20_BLUEPRINTS/Stack_Components]] — VPS topology, components, ports, domains, and control surfaces
- [[20_BLUEPRINTS/Adapter_Bus]] — CLI/agent adapter surface and trust boundary map

## 30_ALLOYS, dependencies and pinned surfaces
- [[30_ALLOYS/Dependency_Surface]] — core runtime dependencies, service substrates, and coupling points

## 40_HAMMERS, tooling
- [[40_HAMMERS/Operational_Tooling]] — tools used to operate, inspect, and recover the forge
- [[70_SMITH_NOTES/Context7_Template]] — reusable note template for Context7-based ingests

## 50_CRACKS, what broke or is risky
- [[50_CRACKS/Intelligence_Gaps]] — degraded MCP wiring and capability gaps
- [[50_CRACKS/Orphaned_Compose_Projects]] — orphaned compose projects and recovery implications
- [[50_CRACKS/Naming_Divergence]] — container naming drift from canonical targets

## 60_TEMPERATURES, machine state
- [[60_TEMPERATURES/Live_Status]] — live machine and container snapshot

## 80_FEDERATION, how AF-FORGE relates to the other wikis
- [[80_FEDERATION/Three_Wikis_Map]] — arifOS, GEOX, AF-FORGE role separation

## 90_AUDITS, sealed reference material
- [[90_AUDITS/Memory_Manifest]] — memory/audit manifest for AF-FORGE

## Raw sources
These are copied from repo root to keep the wiki grounded:
- `raw/README.md`
- `raw/MAP.md`
- `raw/ARCHITECTURE.md`
- `raw/VPS_NATIVE.md`
- `raw/ROADMAP.md`
- `raw/RUNTIME_POLICY.md`
- `raw/package.json`

## Current verdict
- **Wiki shape:** proper and navigable
- **Grounding:** seeded from repo docs and VPS/component material
- **Open work:** continue ingesting operational docs and keep temperature/crack pages current

*DITEMPA BUKAN DIBERI*
