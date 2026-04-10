---
type: Blueprint
tags: [vps, topology, components, services, ports, domains]
sources: [raw/MAP.md, 60_TEMPERATURES/Live_Status.md]
last_sync: 2026-04-10
confidence: 0.9
status: active
operator: arifOS_bot
---

# Blueprint: Stack Components

This page is the operational component map for AF-FORGE as a VPS machine.

It answers one question cleanly: **what is actually on this box, and what role does each component play?**

## Layers

### Edge and access
- **Traefik**: public ingress and TLS on `80/443`
- **OpenClaw gateway**: agent orchestration on `18789`
- **WireGuard**: VPN surface on `51820/udp`

### Core data and memory
- **Postgres**: primary structured state
- **Redis**: cache / transient coordination
- **Qdrant**: vector memory substrate
- **VAULT999**: immutable governance ledger layer

### Intelligence services
- **arifosmcp / mcp**: constitutional kernel service
- **OpenClaw**: agent runtime/orchestrator
- **GEOX**: Earth-domain tool surface
- **Ollama**: local model runtime when enabled

### Observability and operator surfaces
- **Uptime Kuma**: endpoint monitoring
- **Dozzle**: container log viewing
- **Portainer**: Docker administration

### App / automation surfaces
- **PocketBase**
- **Eigent**
- **Webhook receiver**
- **Landing pages / forge site**

## Current operational split

The VPS is not one single clean compose universe.
It is a mix of:
- compose-managed projects
- standalone Docker containers
- native systemd services
- orphaned-but-running services whose compose sources are missing

That split matters because recovery, restart, and naming discipline differ by class.

## Compose/native classes

### Compose-managed
Grounded in [[60_TEMPERATURES/Live_Status]]:
- `arifos`
- `geox`

### Standalone
- `arifosmcp`
- `ollama`

### Native
- `openclaw-gateway`

### Orphaned
- `portainer-pocketbase-wireguard`
- `server` (Eigent)

## Publicly meaningful surfaces
These are the ones that matter most operationally because they touch access, debugging, or exposure:
- `22` SSH
- `80/443` public web ingress
- `18789` OpenClaw dashboard/gateway surface
- `3002` Uptime Kuma
- `8000` GEOX
- `8080` arifosmcp
- `8082` Dozzle
- `51820/udp` WireGuard

## Main risks in this component map
1. Some services are public that do not need to be.
2. Some services are running outside compose discipline.
3. Some recovery paths depend on local images or deleted source directories.
4. Naming drift makes operator reasoning slower than it should be.

## Related
- [[60_TEMPERATURES/Live_Status]]
- [[50_CRACKS/Orphaned_Compose_Projects]]
- [[50_CRACKS/Naming_Divergence]]
- [[20_BLUEPRINTS/Adapter_Bus]]
