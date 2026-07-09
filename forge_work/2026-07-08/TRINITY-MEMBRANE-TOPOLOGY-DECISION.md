# Trinity-33 Membrane Topology Decision

> **Status:** RATIFIED by F13 sovereign signal "yes" — 2026-07-08
> **Decision:** Run the constitutional membrane as external daemons; arifOS, AAA, and A-FORGE connect as clients.
> **Iron rule preserved:** Never let the forge outrun the kernel.

---

## 1. Why external daemons

The constitutional membrane (MCP, OPA, SPIRE, Temporal, A2A, NATS, Envoy, Keycloak, Kafka) must remain **independent** from the organs it governs. If any organ vendors or embeds the membrane, that organ can mutate the rules that judge it.

External daemons give us:

- **Separation of powers:** arifOS is a policy *client*, not the policy *server*.
- **Lease-based authority:** organs authenticate, but the membrane decides who is who (SPIRE) and what is allowed (OPA/Cedar/OpenFGA).
- **Replayable judgment:** Temporal holds durable workflow history; arifOS issues verdicts, the membrane records the chain.
- **Neutral transport:** A2A/NATS/Envoy route between organs without any organ owning the mesh.

---

## 2. Membrane layer vs. organ layer

```
┌─────────────────────────────────────────────────────────────┐
│                 CONSTITUTIONAL MEMBRANE                     │
│  (daemons — no business logic, no domain code, no agents)   │
│                                                             │
│  Identity     │ SPIRE + Keycloak                            │
│  Policy       │ OPA + Cedar + OpenFGA                       │
│  Protocol     │ MCP + A2A + CloudEvents                     │
│  Messaging    │ NATS + Kafka                                │
│  Routing      │ Envoy                                       │
│  Workflow     │ Temporal                                    │
│  Telemetry    │ OpenTelemetry Collector                     │
│  Memory       │ Qdrant                                      │
│  Provenance   │ Cosign + in-toto + GUAC                     │
└─────────────────────────┬───────────────────────────────────┘
                          │ protocol / lease / mTLS
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐      ┌─────────┐      ┌─────────────┐
   │ arifOS  │      │   AAA   │      │   A-FORGE   │
   │  judge  │      │  state  │      │    hands    │
   │  :8088  │      │  :3001  │      │ :7071/:7072 │
   └────┬────┘      └────┬────┘      └──────┬──────┘
        │                │                  │
        └────────────────┼──────────────────┘
                         ▼
              ┌─────────────────────┐
              │ GEOX · WEALTH · WELL│
              │  domain substrates  │
              └─────────────────────┘
```

---

## 3. Authority chain with membrane

```
Arif (F13)
  │
  ▼
SPIRE/Keycloak — identity attestation
  │
  ▼
arifOS kernel — constitutional judgment
  │
  ▼
OPA/Cedar/OpenFGA — policy decision point
  │
  ▼
Temporal — durable judgment workflow
  │
  ▼
A-FORGE — execution under SEAL
  │
  ▼
Cosign/in-toto/GUAC — provenance + evidence graph
  │
  ▼
VAULT999 — immutable receipt
```

---

## 4. Phased implementation order

### Phase 1 — Identity + Policy (law foundation)
1. SPIRE server + agent registration for all organs.
2. Keycloak realm for human/sovereign identity.
3. OPA deployment with initial F1-F13 Rego policies.
4. Cedar/OpenFGA schema for organ-level authorization.

### Phase 2 — Protocol + Routing (state fabric)
5. NATS server as A2A transport backbone.
6. A2A gateway/CloudEvents envelope.
7. Envoy as service mesh / membrane proxy.
8. Kafka for durable event log (optional, can defer to NATS JetStream).

### Phase 3 — Workflow + Memory + Evidence (execution substrate)
9. Temporal server for durable workflows.
10. Qdrant for semantic memory/precedent.
11. OpenTelemetry Collector for evidence pipeline.
12. Cosign + in-toto + GUAC for provenance.

### Phase 4 — Forge tooling (hands)
13. Dagger + BuildKit + Earthly + act execution runtime.
14. Argo CD for GitOps deployment.
15. Trivy + Gitleaks + Scorecard + Renovate scanning.

**Rule:** no Phase N+1 work begins until Phase N health probes pass.

---

## 5. What changes in each sovereign repo

| Repo | Change |
|------|--------|
| `ariffazil/arifos` | Add clients for SPIRE, OPA, Cedar, OpenFGA, Temporal; remove any embedded policy logic; expose `/health/membrane` probe. |
| `ariffazil/AAA` | Add NATS/A2A/Envoy clients; agent registry reads from SPIRE/Keycloak; cockpit consumes OTel + Qdrant. |
| `ariffazil/A-FORGE` | Add Dagger/BuildKit/Earthly drivers; execution pipeline requires SPIRE identity + OPA permit + Temporal workflow token. |
| `ariffazil/geox/wealth/well` | Add SPIRE agent identity; domain tool calls routed through Envoy; evidence pushed to OTel/GUAC. |
| `ariffazil/ariffazil` | Document the topology; update `FEDERATION_CONTRACT.md` to reference membrane daemons. |

---

## 6. Next concrete action

Create the membrane orchestration layer:

```
/root/federation/membrane/
├── compose.yml          # SPIRE, Keycloak, OPA, NATS, Temporal, Qdrant, OTel
├── policies/            # Rego + Cedar + OpenFGA schemas
├── spire/               # server + agent configs
└── README.md            # boot order and health checks
```

Start with SPIRE + OPA + NATS + Temporal in Docker Compose. All other phases depend on these four.

---

**Decision owner:** F13 SOVEREIGN — Arif Fazil  
**Executor:** Kimi Code (FI-008) under A-FORGE lease  
**Next step:** scaffold `/root/federation/membrane/compose.yml` with Phase 1 daemons.
