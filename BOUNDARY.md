# A-FORGE Boundary

<!--
SOT-MANIFEST
owner: Arif
last_verified: 2026-05-19
scope: /root/A-FORGE
epistemic_status: CONTRACT
-->

A-FORGE is the execution and deployment substrate. It builds, packages, routes,
observes, and rolls back federation services under governance. It may
orchestrate execution, but it must not become a rival constitution or final
judge.

## Owns

- Docker/compose, Caddy, systemd, ingress, monitoring, release, and rollback
  contracts that are part of the forge layer.
- TypeScript execution runtime, governed planner/executor/verifier loops, and
  deployment bridge surfaces.
- Build provenance, release health, deployment receipts, and ops telemetry.
- Approval boundary mechanics for execution plans before force is applied.
- Forge-local MCP/HTTP ops surfaces for release and execution control.

## Does Not Own

- F1-F13 law, `888_JUDGE`, `999_SEAL`, or final constitutional verdicts.
- GEOX geology, WEALTH economics, WELL readiness, or AAA cockpit UX.
- Secret rotation or `.env` mutation without explicit Arif approval.
- Public production deploys without build/test proof and arifOS/Arif approval.
- Co-located GEOX Python artifacts as canonical A-FORGE source.

## Imports From

- arifOS: execution gates, floor policy, verdict semantics, vault contracts, and
  federation authority map.
- AAA: operator intent, approval state, session context, and cockpit requests.
- GEOX/WEALTH/WELL: service health and artifact readiness for deployment
  packaging.
- Host/Docker/Caddy/systemd: substrate state and release signals.

## Exports To

- arifOS: execution plans, reversibility class, ops cost, release provenance, and
  rollback evidence.
- AAA: deployment status, bridge health, hold queue state, and operator-readable
  release summaries.
- Domain repos: packaging expectations, image tags, health probes, and runtime
  environment contracts.
- VAULT999: deployment receipts when a governed release is executed.
