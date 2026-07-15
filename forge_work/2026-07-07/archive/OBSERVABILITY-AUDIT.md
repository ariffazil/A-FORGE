# 🔍 OBSERVABILITY · Audit — 2026-07-07

> **Sovereign directive:** Reflect catiemcp 4-layer stack against live federation. Map chaos.
> **Status:** OBS (observed live) + DER (derived from codebase) + INT (interpreted)
> **Auditor:** FORGE (000Ω)

---

## 1. Reflection — Not Everything That Can Be Measured Need To

The catiemcp article is technically correct. Four-layer observability (health → metrics → traces → logs) is production baseline for shared HTTP MCP servers. But it carries an implicit assumption: **that measuring everything is the goal.**

For agentic intelligence, the goal is different.

**What agentic intelligence actually needs to observe:**
- Is the system alive? (liveness)
- Can it serve the sovereign? (readiness)
- Is it telling the truth? (constitutional floor compliance)
- Who did what, under whose authority? (audit trail)
- Where did it slow down or fail? (performance)

The catiemcp stack optimizes for **operational visibility** — traffic, errors, latency, saturation. That's necessary but not sufficient. We need a fifth layer that conventional monitoring doesn't cover:

**Constitutional observability** — identity binding, floor enforcement, judge verdicts, seal chain integrity, drift detection.

The rig analogy in the article is apt: "saying a rig is fine because the radio answers, while ignoring downhole pressure, mud losses, and stuck-pipe indicators." For us, the deeper question is: **is the radio telling the truth about downhole pressure?** That's F2 TRUTH, not Prometheus.

### The Principle

> **Measure what serves governance. Not what merely exists.**

An agentic system that measures everything buries governance signal in operational noise. The 4-stack works when you separate:
1. **Liveness** — process responds (health)
2. **Operability** — can serve requests (readiness + metrics)
3. **Governance** — tells the truth about itself (constitutional)
4. **Accountability** — who did what (audit/traces/logs)

Catiemcp covers 1-2 well, 3 partially (via policy outcome logging), 4 partially (via structured logs). Our federation needs 3 as a first-class layer.

---

## 2. Chaos Map — What Exists vs What's Needed

### 2.1 Infrastructure Layer ✅ EXISTS (but disconnected)

| Service | Port | Status | Role |
|---------|------|--------|------|
| Prometheus | :9090 | ✅ UP | Scraping: A-FORGE, arifOS, node, NATS, Graphiti |
| Grafana | :3000 | ✅ UP | **ZERO dashboards** — running empty |
| Netdata | :19999 | ✅ UP | System metrics (CPU, RAM, disk, network) |
| node_exporter | :9100 | ✅ UP | Host-level Prometheus metrics |
| NATS exporter | — | ✅ UP | NATS Prometheus bridge |

**Gap:** Grafana has zero dashboards. Prometheus scrapes targets but no MCP-specific metrics exist to scrape. The monitoring infrastructure is like a rig with gauges installed but no sensors connected.

### 2.2 Application Layer ⚠️ PARTIAL

| Organ | Health Shape | Dependencies | Metrics | Version |
|-------|-------------|--------------|---------|---------|
| arifOS :8088 | RICH (identity, floors, tools, drift) | **surface_consistency BROKEN** (CANONICAL_13 import error) | None exposed | v2026.07.04-MARHIN |
| A-FORGE :7071 | Basic liveness only | No dependency breakdown | None exposed | 0.1.0 |
| GEOX :8081 | Good (68 tools, freshness) | Identity verified | None exposed | v2026.07.06-phase3.1 |
| WEALTH :18082 | Basic liveness | Architecture layers listed | None exposed | **2026.06.15 (old)** |
| WELL :18083 | **DEGRADED + STALE** | No metrics, no verified telemetry | None exposed | 2026.05.15 |
| AAA :3001 | Probed but not inspected | A2A gateway | None exposed | — |

**Critical findings:**
1. **arifOS surface_consistency = BROKEN** — code references `CANONICAL_13` but the actual constant is `CANONICAL_12`. The import graph is broken: `cannot import name 'CANONICAL_13' from 'arifosmcp.runtime.public_surface'`. This is a live code bug.
2. **WELL is DEGRADED** — `has_metrics: false`, `has_verified_telemetry: false`, `freshness_band: STALE`, `state_age_hours: null`. The human readiness organ has no data.
3. **WEALTH is old** — version 2026.06.15, 3 weeks behind the federation.
4. **No organ exposes `/metrics`** — Prometheus has nothing MCP-specific to scrape.

### 2.3 Observability Layer ❌ MOSTLY ABSENT

| Signal | catiemcp Requirement | Federation State |
|--------|---------------------|-----------------|
| `/health` liveness | ✅ All 6 organs | ✅ Exists but inconsistent shapes |
| `/ready` readiness | Dependency-aware | ❌ **None** — no organ has /ready |
| Prometheus metrics | `mcp_requests_total`, latency histograms | ❌ **None** — no MCP metrics exposed |
| OpenTelemetry traces | `trace_id`, `span_id`, hop-by-hop | ❌ **None** — no OTEL env vars set |
| Structured JSON logs | Correlation IDs, tool names, latency | ⚠️ **Partial** — raw HTTP access logs only |
| MCP tool call metrics | Per-tool counters, success/fail | ❌ **None** |
| Policy decision logging | deny vs true-failed | ❌ **None** |
| Dependency health | Per-dependency status | ⚠️ Only arifOS has deps block (broken) |

### 2.4 Logging Layer ⚠️ FRAGMENTED

| Log Source | Format | Content |
|-----------|--------|---------|
| `/var/log/arifosmcp/` | Raw HTTP access | `"POST /mcp HTTP/1.1" 200 OK` — no tool name, no latency, no trace_id |
| `/var/log/arifos/*.log` | Mixed text | Cron jobs, maintenance, probes — no correlation IDs |
| `/var/log/arifosd/observability.jsonl` | JSON lines | Exists but purpose unclear |
| `/var/log/arifosd/vault.jsonl` | JSON lines | Vault operations |
| `/var/log/arifos-sandbox/violations.jsonl` | JSON lines | Sandbox violations |
| `/var/log/arifos/a3_audit_*.log` | Text | AAA audit logs — daily rotation |

**Key gap:** The MCP access log (`/var/log/arifosmcp/`) shows `"POST /mcp HTTP/1.1" 200 OK` but doesn't record which tool was called, what the policy decision was, or how long it took. That's like a bank ledger that records "transaction processed" without saying who, how much, or whether it was approved.

---

## 3. What's Actually Needed (Prioritized)

### Phase 1: Foundation (what the catiemcp article calls "one thing first")

**Middleware-based latency/error instrumentation + correlation IDs on every MCP call.**

This means: every `POST /mcp` gets timed, every tool call gets a `trace_id` + `request_id`, every response gets logged with `tool_name`, `latency_ms`, `status`, `policy_decision`.

For our Python FastAPI MCP servers (arifOS, GEOX, WEALTH, WELL), this is a single ASGI middleware.

### Phase 2: Metrics Exposure

Each organ exposes `/metrics` (Prometheus format) with:
- `mcp_requests_total{organ, tool, status}`
- `mcp_operation_duration_seconds{organ, tool}` (histogram)
- `mcp_active_sessions{organ}` (gauge)
- `mcp_policy_decisions_total{organ, decision}` (counter)
- `mcp_health_status{organ}` (gauge: 0=down, 1=degraded, 2=healthy)

Prometheus already scrapes these organs — it just needs endpoints to scrape.

### Phase 3: Readiness + Dependency Health

Each organ gets a `/ready` endpoint that checks:
- Tool registry loaded
- Policy/auth subsystem reachable
- Critical dependencies within threshold
- Queue depth acceptable

This separates "process alive" from "can actually serve sovereign requests."

### Phase 4: Constitutional Observability (the missing fifth layer)

This is what catiemcp doesn't cover. For agentic intelligence:
- **Floor compliance rate** — what % of actions pass F1-F13 without intervention
- **Judge verdict distribution** — SEAL vs HOLD vs VOID ratio
- **Seal chain integrity** — chain hash verification
- **Identity drift detection** — actor_signature changes
- **W³ witness consensus** — tri-witness pass/fail rate

This doesn't go in Prometheus. It goes in the Observatory dashboard (arifos.arif-fazil.com) which already exists but is static HTML reading from API calls.

---

## 4. Specific Bugs Found

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | 🔴 HIGH | `surface_consistency: BROKEN` — `CANONICAL_13` import error | arifOS health → `/opt/arifos/app/arifosmcp/runtime/public_surface.py` references `CANONICAL_13` from `constitutional_map` but file defines `CANONICAL_12` |
| 2 | 🟡 MEDIUM | WELL `has_metrics: false`, `freshness_band: STALE` | WELL :18083 health |
| 3 | 🟡 MEDIUM | WEALTH version `2026.06.15` — 3 weeks old | WEALTH :18082 health |
| 4 | 🟡 MEDIUM | Grafana running with zero dashboards | Grafana :3000 |
| 5 | 🟢 LOW | No OTEL env vars set anywhere | System-wide |
| 6 | 🟢 LOW | MCP access logs lack tool name + latency | `/var/log/arifosmcp/` |

---

## 5. Recommendation

**Don't build the full catiemcp stack.** Build the minimal set that serves governance:

1. **Fix the CANONICAL_13 import error** (15 min, arifOS codebase)
2. **Add ASGI timing middleware** to all 4 Python MCP servers (1 hour)
3. **Add `/metrics` endpoint** to each organ (30 min each)
4. **Build 1 Grafana dashboard** — golden signals + MCP tool calls (1 hour)
5. **Fix WELL telemetry gap** (needs biometric data injection)

The full OTEL/traces/Tempo stack can wait. What matters NOW is: can we see which tools are being called, how fast they respond, and whether they succeed?

> **The rig doesn't need a seismic processing cluster. It needs mud weight, standpipe pressure, and flow rate on the driller's console.**

---

*Forged: 2026-07-07 05:55 UTC by FORGE (000Ω)*
*Evidence: live health probes, Prometheus targets, Grafana API, filesystem audit*
*DITEMPA BUKAN DIBERI*
