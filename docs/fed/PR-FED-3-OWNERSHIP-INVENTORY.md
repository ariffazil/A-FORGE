# PR-FED-3 — Observability & Front-Door Hygiene Ownership Inventory

> Program: `ARIFOS::FED-ZEN-UPGRADE-PROGRAM::2026-11-22`
> Branch: `agy-cli/pr-fed-3-observability-hygiene`
> Evidence Base: P0 Freeze `/root/forge_work/fed-zen-20261122/FED-ZEN-BASELINE.json` + live read-only probes on KVM8 (`2026-11-22T07:33Z`)
> Policy: Observability & ownership inventory ONLY. Zero live secret mutations, zero HAProxy reloads, zero `mcp-compressor` process terminations, zero 404 log suppression.

---

## Lane A — Langfuse Misrouting Audit `[OBS]`

- **Observed Symptom `[OBS]`**: 72 HTTP 404s in 60 minutes hitting LiteLLM `:4013` via HAProxy `:4000` (`37` `GET /api/public/health`, `35` `POST /api/public/ingestion`).
- **Root Cause `[OBS]`**:
  - `/root/.secrets/vault.flat.env:223` sets `LANGFUSE_BASE_URL=http://localhost:4000`
  - `/root/.hermes/.env:173` sets `export LANGFUSE_BASE_URL="http://localhost:4000"`
  - Port `:4000` is HAProxy `fed_gateway` forwarding to LiteLLM `:4013`; no Langfuse server runs on `:4000`.
- **Classification `[DER]`**:
  - **Sender**: Langfuse SDK clients inherited by `litellm-federation`, `arifosmcp.runtime.observability.worker`, `hermes`, and child processes.
  - **Expected Receiver**: `langfuse_server`
  - **Actual Receiver**: `litellm_front_door` (`localhost:4000 -> 127.0.0.1:4013`)
  - **Retry Behavior**: Periodic health & batch ingestion retry loop emitting 404s.
  - **Secret Exposure Risk**: `HIGH_CREDENTIALS_SENT_TO_WRONG_RECEIVER` whenever `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` are exported alongside the misrouted URL.
- **Remediation Law**: Never suppress 404 logs to hide noise. Disable at sender/env (`LANGFUSE_TRACING_ENABLED=false` and unset/comment out `LANGFUSE_BASE_URL` / `LANGFUSE_HOST`) via `scripts/fed_observability_hygiene.py::generate_env_remediation_diff()` until a verified Langfuse endpoint exists.

---

## Lane B — Liveliness & Health Poll Ownership Inventory `[OBS]`

Baseline noise `[OBS]`: `1,584` `GET /health/liveliness` requests in 60m (`83.81%` of `1,890` parsed HTTP requests on `litellm-federation.service`).

| Poller | Owner | Target | Interval | Timeout | Purpose | Consumer | Duplication | Safe Reduced Cadence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `haproxy_fed_primary` | `haproxy.service` (`backend llm_nodes`, `/etc/haproxy/haproxy.cfg:92`) | `127.0.0.1:4013/health/liveliness` | `5s` (`fall 5 rise 2`) | `15s` (`timeout check`) | Primary backend liveness for `:4000` failover to KVM4 | HAProxy `llm_nodes` | Duplicates `zen_local` on identical `127.0.0.1:4013` (~2.5s combined) | `15s` (owner-approved) |
| `haproxy_zen_local` | `haproxy.service` (`backend llm_zen_nodes`, `/etc/haproxy/haproxy.cfg:119`) | `127.0.0.1:4013/health/liveliness` | `5s` (`fall 3 rise 2`) | `15s` (`timeout check`) | Passthrough backend liveness for `:4012` | HAProxy `llm_zen_nodes` | Exact duplicate of `fed_primary`; can use `track llm_nodes/fed_primary` | `track` or `15s` (owner-approved) |
| `docker_litellm_healthcheck` | `litellm-federation.service` (`/root/scripts/litellm-healthcheck.py`) | `127.0.0.1:4013/health/liveliness` | `30s` | `5s` | Container health status for Docker daemon | Docker engine | Overlaps HAProxy target but distinct restart consumer | `30s` (keep) |
| `fed-provider-probe.timer` | `systemd / FED v3.4 witness chain` (`/etc/systemd/system/fed-provider-probe.timer`) | Upstream provider endpoints -> `route_health` | `30m` (`AccuracySec=1m`, `RandomizedDelaySec=45s`) | Per-probe HTTP timeout | Keep `route_health` witness STALE-or-better (`FRESH<=15m`, `STALE<=60m`) | `fed_router.py` admission gates | None (distinct upstream witness) | `30m` (do not slow; witness ladder requirement) |
| `fed-parity-guard.timer` | `systemd / A-FORGE` (`/root/A-FORGE/scripts/fed-parity-guard.sh`) | KVM8 vs KVM4 model-set hash + HAProxy admin socket | `120s` (`AccuracySec=10s`) | Script curl timeout | Detect KVM8/KVM4 capability drift; set `fed_backup` MAINT on mismatch | HAProxy `/run/haproxy-admin.sock` | None | `120s`–`300s` (owner-approved) |
| `frame-probe.timer` | `systemd / FRAME` (`/etc/systemd/system/frame-probe.timer`) | Federation organ health endpoints | `15m` (`RandomizedDelaySec=30s`) | Probe timeout | Proactive drift & organ availability observation | FRAME observer (`OBSERVER_DOCTRINE.md`) | None | `15m` (keep) |

**Enforcement**: `validate_poller_ownership()` in `scripts/fed_observability_hygiene.py` rejects any poller or cadence change without a named owner.

---

## Lane C — `fed_contrast` Admission Gate Defect & Fix `[OBS]`

- **Baseline Defect `[OBS]`**: `/root/AAA/scripts/fed_router.py:1740-1774` returns only `{provider, model, balance, latency_p50}` with zero `route_health` or policy admission checks. A `RATE_LIMITED`, `QUOTA_EXHAUSTED`, `AUTH_FAIL`, `DEAD`, or `POLICY_INELIGIBLE` route can win if its historical `latency_p50` is low.
- **ZEN Fix (`scripts/fed_observability_hygiene.py::fed_contrast_zen`)**:
  - Emits all 13 required fields (`deployment_id`, `admission_state`, `route_health_state`, `p50_latency_ms`, `p95_latency_ms`, `sample_count`, `sample_window`, `last_sample_time`, `freshness`, `confidence`, `cost_evidence_class`, `balance_freshness`, `exclusion_reason`).
  - Filters out all inadmissible states BEFORE latency/cost ranking.

---

## Lane D — Live `mcp-compressor` Ownership Inventory (`21` Processes, Observability-Only) `[OBS]`

Captured via read-only `ps -eo pid,ppid,lstart,rss,args` on KVM8 at `2026-11-22T07:33Z` (`15:33 +08`).
**Note**: Between P0 Freeze (`15:24 +08`) and this snapshot (`15:33 +08`), `kimi` session PID `653850` (8 children) rotated to `kimi` PID `1588290` (8 children); total count remains **21 processes across 5 live parent PIDs**. Zero processes were terminated.

| PID | Parent PID | Owner Client | Target Server | Start Time (`+08`) | RSS (KB) | Active Conn / Last Req / In-Flight | Initial Classification `[DER]` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `763308` | `762904` | `qwen-code` | `xerj` | `2026-11-22 11:34:41` | `4680` | `UNKNOWN` (live stdio parent) | `IDLE_EXPECTED` (single per parent) |
| `3286985` | `3286873` | `qwen-code` | `xerj` | `2026-11-21 22:35:55` | `4052` | `UNKNOWN` (live stdio parent) | `IDLE_EXPECTED` (single per parent) |
| `4170461` | `4165843` | `1mcp` | `wikipedia` | `2026-11-21 04:05:59` | `8092` | `UNKNOWN` (1mcp daemon child) | `IDLE_EXPECTED` (unique target) |
| `4170465` | `4165843` | `1mcp` | `earthdata` | `2026-11-21 04:05:59` | `8064` | `UNKNOWN` (1mcp daemon child) | `IDLE_EXPECTED` (unique target) |
| `4170472` | `4165843` | `1mcp` | `arxiv` | `2026-11-21 04:05:59` | `8040` | `UNKNOWN` (1mcp daemon child) | `IDLE_EXPECTED` (unique target) |
| `946279` | `946075` | `kimi` | `kimi-aforge` | `2026-11-22 12:33:46` | `4824` | `UNKNOWN` (primary for pair) | `IDLE_EXPECTED` (primary of 4) |
| `946395` | `946075` | `kimi` | `kimi-aforge` | `2026-11-22 12:33:47` | `4716` | `UNKNOWN` (sibling #2) | `DUPLICATE` (same ppid+target) |
| `946577` | `946075` | `kimi` | `kimi-aforge` | `2026-11-22 12:33:48` | `4824` | `UNKNOWN` (sibling #3) | `DUPLICATE` (same ppid+target) |
| `947125` | `946075` | `kimi` | `kimi-aforge` | `2026-11-22 12:34:02` | `4768` | `UNKNOWN` (sibling #4) | `DUPLICATE` (same ppid+target) |
| `946353` | `946075` | `kimi` | `xerj` | `2026-11-22 12:33:47` | `4748` | `UNKNOWN` (primary for pair) | `IDLE_EXPECTED` (primary of 4) |
| `946508` | `946075` | `kimi` | `xerj` | `2026-11-22 12:33:47` | `4712` | `UNKNOWN` (sibling #2) | `DUPLICATE` (same ppid+target) |
| `946718` | `946075` | `kimi` | `xerj` | `2026-11-22 12:33:49` | `4760` | `UNKNOWN` (sibling #3) | `DUPLICATE` (same ppid+target) |
| `947215` | `946075` | `kimi` | `xerj` | `2026-11-22 12:34:04` | `4700` | `UNKNOWN` (sibling #4) | `DUPLICATE` (same ppid+target) |
| `1588512` | `1588290` | `kimi` | `kimi-aforge` | `2026-11-22 15:29:32` | `10400` | `UNKNOWN` (primary for pair) | `IDLE_EXPECTED` (primary of 4) |
| `1588583` | `1588290` | `kimi` | `kimi-aforge` | `2026-11-22 15:29:32` | `11000` | `UNKNOWN` (sibling #2) | `DUPLICATE` (same ppid+target) |
| `1588821` | `1588290` | `kimi` | `kimi-aforge` | `2026-11-22 15:29:34` | `9724` | `UNKNOWN` (sibling #3) | `DUPLICATE` (same ppid+target) |
| `1589269` | `1588290` | `kimi` | `kimi-aforge` | `2026-11-22 15:29:43` | `10496` | `UNKNOWN` (sibling #4) | `DUPLICATE` (same ppid+target) |
| `1588545` | `1588290` | `kimi` | `xerj` | `2026-11-22 15:29:32` | `8108` | `UNKNOWN` (primary for pair) | `IDLE_EXPECTED` (primary of 4) |
| `1588696` | `1588290` | `kimi` | `xerj` | `2026-11-22 15:29:33` | `7888` | `UNKNOWN` (sibling #2) | `DUPLICATE` (same ppid+target) |
| `1588965` | `1588290` | `kimi` | `xerj` | `2026-11-22 15:29:35` | `7840` | `UNKNOWN` (sibling #3) | `DUPLICATE` (same ppid+target) |
| `1589339` | `1588290` | `kimi` | `xerj` | `2026-11-22 15:29:45` | `7888` | `UNKNOWN` (sibling #4) | `DUPLICATE` (same ppid+target) |

**Observation `[DER]`**: Each `kimi` parent spawns 4x `kimi-aforge` + 4x `xerj` = 8 `mcp-compressor` children (12 duplicate siblings across the two live `kimi` parents). Any future cleanup belongs to the `kimi` client launcher owner after confirming zero in-flight requests — NOT ad-hoc process killing.

---

## Strict Log Parser Negative Controls `[OBS]`

Anchored HTTP status regex (`HTTP/\d\.\d"\s+(\d{3})\b`) in `scripts/fed_observability_hygiene.py::parse_litellm_http_log_line()` prevents ephemeral client ports from polluting error telemetry:
- `127.0.0.1:58402` -> parsed `status_code=200`, `is_402=False`
- `100.64.0.5:42960` -> parsed `status_code=200`, `is_429=False`
