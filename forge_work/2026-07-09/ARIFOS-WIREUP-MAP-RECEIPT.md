# ARIFOS Wire-Up Map Receipt

**receipt_id:** `wireup-2026-07-09-5dfca63`  
**timestamp:** `2026-07-09T12:08:59Z`  
**receipt_sha256:** `bc9f8c6a7c8bebf0166d851e050c4fbf93dd9522aaab89d659adecf18384b716`  
**git HEAD:** `5dfca63` (`5dfca634487ece154171e846c52d7deab1d21d84`)  
**tree:** `0f8bb087d074baa97c3a4e0b0f83d33bc1b7f1db`  
**working_tree_hash:** `c41b45ed5ee07b16…` (3231 files)  
**live deploy:** `5dfca63` match=True  
**health:** healthy / kanon-5dfca63

## Code map (arifosmcp)

| Package | .py files |
|---------|----------:|
| `runtime` | 386 |
| `core` | 89 |
| `schemas` | 65 |
| `tools` | 52 |
| `resources` | 34 |
| `apps` | 27 |
| `(root)` | 26 |
| `geometry` | 19 |
| `gateway` | 18 |
| `transport` | 16 |
| `intelligence` | 16 |
| `memory` | 16 |
| `kernel` | 15 |
| `boot` | 14 |
| `evals` | 13 |
| `hexagon` | 13 |
| `integrations` | 12 |
| `tests` | 10 |
| `federation` | 8 |
| `abi` | 7 |
| `providers` | 7 |
| `rasa` | 7 |
| `evidence` | 7 |
| `arifos_registry` | 7 |
| `arifos_vault` | 6 |

**Total:** 982 python files · **tests:** 308 test_*.py

## Flow

`arif_init → arif_observe/think → arif_route → arif_judge → arif_forge → arif_seal`

Entry: `arifosmcp.runtime.__main__:main → systemd arifos.service :8088`  
Surface: 11 exposed / 17 internal canonical / 41 diagnostic / 58 declared

## Orphans (high-signal sample)

Static reachability found **421** modules not imported from runtime/tools/resources.
These are candidates — many are CLI/entry scripts, apps, or dormant integrations. Not auto-delete.

- `arifosmcp`
- `arifosmcp.CONSTITUTIONAL_EXTENSION_v2026.06.11-SELH`
- `arifosmcp.a2a_server`
- `arifosmcp.abi.cross_organ_probe`
- `arifosmcp.abi.nats_heartbeat_daemon`
- `arifosmcp.abi.penangprobe`
- `arifosmcp.abi.v1_0`
- `arifosmcp.agents.eureka`
- `arifosmcp.agents.eureka.__main__`
- `arifosmcp.agents.eureka.agent`
- `arifosmcp.agents.eureka.signals`
- `arifosmcp.agents.eureka.substrate`
- `arifosmcp.agents.eureka.validator`
- `arifosmcp.apex_civilizational_audit`
- `arifosmcp.apps.charters`
- `arifosmcp.apps.forge_app`
- `arifosmcp.apps.geox_app`
- `arifosmcp.apps.geox_bridge`
- `arifosmcp.apps.judge_console`
- `arifosmcp.apps.lifecycle`
- `arifosmcp.apps.metabolic_monitor`
- `arifosmcp.apps.ops_dashboard`
- `arifosmcp.apps.wealth_app`
- `arifosmcp.arifos_attestation`
- `arifosmcp.arifos_attestation.manifest_hash`
- `arifosmcp.arifos_attestation.sbom_scan`
- `arifosmcp.arifos_attestation.sigstore_verify`
- `arifosmcp.arifos_attestation.slsa_verify`
- `arifosmcp.arifos_kernel_wiring`
- `arifosmcp.arifos_mcp_linter`
- `arifosmcp.arifos_observability`
- `arifosmcp.arifos_observability.agent_trace_schema`
- `arifosmcp.arifos_observability.otel_tracer`
- `arifosmcp.arifos_observability.risk_event_schema`
- `arifosmcp.arifos_otel_wiring`
- `arifosmcp.arifos_policy`
- `arifosmcp.arifos_policy.cedar_bridge`
- `arifosmcp.arifos_policy.opa_bridge`
- `arifosmcp.arifos_registry`
- `arifosmcp.arifos_registry.capability_manifest`

## Shadow emergence

**69** duplicate basenames (same filename, multiple paths). Review before consolidating.

## Fixes sealed this pass

- vault.py: call _arif_vault_seal (sync) not _arif_seal alias — restores ack_irreversible wire
- regenerated llms.txt via scripts/generate_tool_manifest.py (hash gate)

## Hash-timestamp seal rule (going forward)

Every governed change set must produce:
1. `git commit` with conventional message + tree identity
2. Receipt JSON under `A-FORGE/forge_work/YYYY-MM-DD/` with:
   - `timestamp_utc`
   - `git.head` + `tree_hash`
   - `working_tree_content_hash_sha256` (pre-commit) or post-commit HEAD
   - `receipt_sha256` of the receipt body
3. Optional VAULT999 seal for irreversible claims

Script: `arifOS/scripts/emit_change_receipt.py` (installed this pass).


## Final (post-commit)

- commit: `40fe403`
- SCT+drift: **14/14 PASS**
- known residual: canonical13 triage public vs 11 live; seal read-mode ADMIT_READ
- receipt emitter: `scripts/emit_change_receipt.py`
- receipt_sha256: `0fd137ede0456b9d0af86519518c259bd9816166762007f23d18c2faef535a91`
