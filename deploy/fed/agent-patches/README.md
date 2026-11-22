# Agent wiring — staged patches

**Status:** STAGED. Nothing here is applied to a live harness. Each patch is
reversible and must be verified with one live canary before the next agent is wired.

Three wiring lanes, in order of preference:

1. **Header injection** — per-request `x-arifos-*`; confidence 1.0.
2. **Body metadata** — `{"metadata": {...}}` in the request body; confidence 1.0.
3. **Per-actor virtual key** — universal fallback, any harness, any node; confidence 0.95.

Every agent gets `ARIFOS_NODE_ID` regardless of lane, so origin is preserved.

---

## opencode (FI-001)

Config: `/root/.config/opencode/opencode.json`, provider `litellm-federation`.
Candidate patch — `opencode-federation-provider.snippet.json`:

- adds `settings.headers` with `{env:ARIFOS_*}` interpolation
- requires the launch environment to export `ARIFOS_ACTOR_ID=opencode` and `ARIFOS_NODE_ID`
- **VERIFY** that the `aisdk:@ai-sdk/openai-compatible` package forwards `settings.headers`; if it does not, fall back to key mapping

Session/task/turn headers cannot be static in config. For per-session identity,
use the client helper in a wrapper or a per-session launch script that exports
`ARIFOS_SESSION_ID` before starting opencode.

## hermes (FI-000)

Config: `/root/.hermes/config.yaml`, base_url `http://127.0.0.1:4000/v1`, key `FED_ZEN_KEY`.
Candidate patch — `hermes-env.snippet`:

- export `ARIFOS_ACTOR_ID=hermes`, `ARIFOS_NODE_ID=<node>`
- keep `FED_ZEN_KEY`; replace it with a per-actor virtual key at provisioning time
- header injection is UNKNOWN for Hermes' OpenAI client; key mapping is the reliable lane

## kimi-code (FI-008)

Config: `/root/.kimi/config.toml`, FED base_url `http://127.0.0.1:4000/v1`.
Lane: **key mapping** (config header injection unverified). Export `ARIFOS_NODE_ID`.

## codex / claude-code / qwen-code / agy / openclaw

Routes are UNKNOWN until probed per harness. All five can be attributed through
per-actor virtual keys with zero client changes. Do not claim header support
without a live canary that shows the row.

---

## Provisioning order

1. `python3 scripts/fed_actor_key_plan.py --models <groups> --out plan.json`
2. Under a bounded authority gate: create keys via `POST /key/generate`
3. Put each key in the harness secret store (never git)
4. Export `ARIFOS_NODE_ID` for the harness process
5. Run `scripts/fed_flow_probe.py --live --actor <name>` with that key
6. Accept the wiring only when the ledger row shows the actor, not `UNKNOWN`
