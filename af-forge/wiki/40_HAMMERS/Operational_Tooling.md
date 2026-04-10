---
type: Hammer
tags: [tooling, operations, docker, openclaw, observability, admin]
sources: [raw/MAP.md, raw/ARCHITECTURE.md, 60_TEMPERATURES/Live_Status.md]
last_sync: 2026-04-10
confidence: 0.88
status: active
operator: arifOS_bot
---

# Hammer: Operational Tooling

These are the main tools that actually let AF-FORGE operate, inspect, and recover the VPS.

## Infrastructure hammers
- **Docker / Docker Compose**: primary service control plane
- **systemd**: native service supervision for host-level services
- **git**: state/version trace for repo-side knowledge and code

## Agent/runtime hammers
- **OpenClaw**: orchestration, messaging, tool execution, session control
- **agent-workbench**: coding-oriented agent loop and local runtime
- **CLI adapters**: external agent interfaces that may route work into the forge

## Observability hammers
- **Uptime Kuma**: endpoint health view
- **Dozzle**: live container logs
- **Portainer**: Docker administration UI

## Caution
Useful hammer does not mean safe public surface.
Administrative tooling is often worth keeping, but not worth exposing broadly.

## Rule of thumb
- if a tool changes machine state, treat it as high-trust
- if a tool exposes logs/admin state, treat it as sensitive even when "nothing private" is stored
- if a tool is only for debugging, it should not quietly become permanent public infrastructure

## Related
- [[20_BLUEPRINTS/Stack_Components]]
- [[60_TEMPERATURES/Live_Status]]
- [[50_CRACKS/Naming_Divergence]]
