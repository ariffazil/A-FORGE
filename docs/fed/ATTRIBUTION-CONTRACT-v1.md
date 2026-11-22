# FED Attribution Contract — v1

**Contract id:** `arifos.fed-attribution.v1`
**Status:** STAGED (branch `feat/fed-attribution-fabric-20261122`)
**Authority:** advisory plane only — FED never judges, never executes, never self-seals
**Companion:** `fed_attribution_callback.py` (PR-FED-1), `deploy/fed/nodes.json`, `deploy/fed/agents.json`

---

## 1. One sentence

Every inference call must be reconstructable as **actor → purpose → route → deployment → provider → artifact → outcome**, without ever inspecting prompt content.

## 2. Fields and who stamps them

| Field | Stamped by | Source | Required |
|---|---|---|---|
| `actor_id` | caller | explicit header/metadata → virtual key/team → tags → known service identity → `UNKNOWN` | yes (first-party) |
| `client` | caller | harness/version slug (`opencode/2.1`) | yes |
| `origin_node` | caller | `ARIFOS_NODE_ID` or hostname registry | yes |
| `session_id` | caller | session/thread id | interactive: yes |
| `task_id` | caller | task id | when a task exists |
| `turn_id` | caller | turn id | when turn-scoped |
| `purpose` | caller | coarse intent class (`interactive`, `verify`, `build`, `background`, `memory-consolidation`) | yes |
| `trace_id` | caller | 32 lowercase hex; deterministic helper available | yes |
| `requested_model_group` | caller | alias the caller asked for | when known |
| `entry_gateway` | **receiving gateway only** | `FED_ENTRY_GATEWAY` env (e.g. `litellm_kvm8_4000`) | yes |
| `serving_provider` | callback | provider taxonomy (never `openai` transport) | yes |
| `deployment_id` | callback | LiteLLM `model_info.id` | when configured |
| `cost_evidence_class` | callback | `PROVIDER_REPORTED` / `LITELLM_CALCULATED` / `PLAN_INCLUDED_COST_UNATTRIBUTED` / `ESTIMATED` / `UNKNOWN` | yes |

**Hard rule:** a caller may never claim an `entry_gateway` it did not physically enter. Origin node travels with the call; entry gateway is a property of the door.

## 3. Transmission lanes

1. **Headers (preferred)** — canonical names:
   `x-arifos-actor-id`, `x-arifos-client`, `x-arifos-node-id`, `x-arifos-session-id`,
   `x-arifos-task-id`, `x-arifos-turn-id`, `x-arifos-purpose`, `x-arifos-trace-id`,
   `x-arifos-requested-model-group`, `x-arifos-attribution-contract`.
2. **Body metadata (fallback)** — flat dict under `"metadata"`; LiteLLM forwards it to callbacks.
   Keys: `actor_id`, `session_id`, `task_id`, `turn_id`, `purpose`, `trace_id`,
   `requested_model_group`, `origin_node`, `client`, `attribution_contract`.
3. **Authenticated key/team (universal fallback)** — one virtual key per actor.
   Works on any node, any harness, zero client cooperation. Confidence 0.95, not 1.0.

Precedence is fixed: explicit metadata → authenticated key/team → tags → known service identity → explicit `UNKNOWN`. Never infer actor from prompt text.

## 4. Node and gateway identity

Format: `<transport>_<node>_<port>` → `litellm_kvm8_4000`, `litellm_kvm4_4000`.

| Node | Role | Physical entry | Status (2026-11-22) |
|---|---|---|---|
| kvm8 (`af-forge`, 100.64.0.2) | primary | HAProxy :4000 → litellm-federation :4013 | active |
| kvm4 (`srv1946043`, 100.64.0.5) | standby front door | docker litellm :4000 | active, **ledger degraded** (0-byte DB) |
| kvm2 (`azwaos`, `flow-edge`, 100.64.0.4) | edge consumer | `fed-tunnel.service` → kvm4 :4000 | consumer only, no local litellm |
| future | any role | must be enrolled in `nodes.json` | — |

The registry is data, not code: a new node is one JSON row plus one env var on its receiving gateway.

## 5. Privacy boundary

Stored: identity, lineage, token counts, cost class, provider taxonomy.
Never stored: prompt bodies, response bodies, credentials, API keys, raw api_base credentials.
`api_base_host` is reduced to hostname only.

## 6. Compatibility with PR-FED-1

`fed_attribution_callback.py` in PR-FED-1 reads exactly the header/metadata names above.

One staged follow-up is required before multi-node deployment: its
`VALID_ENTRY_GATEWAYS` currently accepts only `litellm_kvm8_4000 | other`, so a
kvm4 request would be recorded as `other`. The fix is to validate against
`nodes.json` gateway ids (or accept `litellm_<node>_<port>` by pattern), then set
`FED_ENTRY_GATEWAY=litellm_kvm4_4000` on kvm4's container.

## 7. Verification ladder

| Level | Command | PASS means |
|---|---|---|
| L0 offline | `python3 scripts/fed_flow_probe.py` | nodes + agent routes inventoried; reachability measured |
| L1 syntax | `python3 -m pytest tests/fed/test_fed_attribution_fabric.py -q` | contract/client/ledger unit-tested |
| L2 canary | `python3 scripts/fed_flow_probe.py --live --actor opencode --node kvm8` | one call delivered **and** ledger row matched by `trace_id` |
| L3 cross-node | same, `--base-url http://100.64.0.5:4000/v1 --node kvm4` | kvm4 row lands in a schema-initialized ledger |
| L4 agent | harness-specific wiring applied + one real task | row shows the harness actor, not `UNKNOWN` |

A 200 is not L2. L2 requires the ledger row.
