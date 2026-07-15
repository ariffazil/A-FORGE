# MCP Logging + Completions — Spec-locked forge note

**Date:** 2026-07-09  
**Status:** **FREEZE logging expansion** (SEP-2577 Final) · Completions **NOT building** (agents use full tool JSON) · Multi-organ native  
**Phase C seal:** 2026-07-12 — A-FORGE removed false `logging:{}` / `completions:{}` capability force (`core.ts`). Stateless `serve.ts` already omitted both. `completion/complete` not served.
**Spec:** MCP base lifecycle MUST · Logging deprecated · Completions MAY for human UI only

---

## Sovereign answers (2026-07-09) — next forge locked

| # | Question | Answer | Forge consequence |
|---|----------|--------|-------------------|
| 1 | Autocomplete? | Completions are for **human-in-the-loop UIs**. Agents call tools with full JSON → **no value**. | **Do not build** Phase 2–3 completions unless Arif later wants UI typing. |
| 2 | One door or many? | MCP **native** = one host, many servers. Organs as separate MCP servers is correct. | Keep multi-organ topology. Front-door proxy optional, not required. |
| 3 | Logging? | **SEP-2577 Final** — `logging/setLevel` + `notifications/message` **deprecated**. ~1-year removal window. | **Freeze expansion.** Keep stderr + structured receipts + HOLD_CANDIDATE. No A-FORGE logging. No new organs on protocol logging. |

### Canonical ops path (post-freeze)

```
stderr (ops) + structured tool/receipt envelopes + HOLD_CANDIDATE jsonl
  ≠ notifications/message growth
```

Existing GEOX/arifOS/WEALTH emit paths: **maintenance-only** (scrub/rate/bugs). Do not add new call sites or new organs to protocol logging.

---

## Meta-rule

> Logging told us what happened (deprecated channel). Completions prevent wrong human typing (we don't need them for agent tool JSON).

Utilities ≠ tools. Never expose log/complete as LLM-callable tools.

---

## Logging — locked rules (spec + zen)

| # | Rule | Status |
|---|------|--------|
| L1 | Declare `logging: {}` only if setLevel path exists **and** emit path exists | A-FORGE: dropped false claim. GEOX: declared + emit |
| L2 | Never emit `notifications/message` if capability absent | Compliant |
| L3 | `logging/setLevel` optional; honor server-side if client sends | GEOX: FastMCP session min + `client_log_level=warning` default |
| L4 | stderr always for ops; stdout only JSON-RPC | `emit_mcp_log` mirrors stderr |
| L5 | Logger namespace = `organ.subsystem` (`geox.floor`) | Wired |
| L6 | Machine state in structured `data`; human text in `message` | Wired |
| L7 | Rate limit: one summary per tool outcome key | Wired (2s window) |
| L8 | Default client min = **warning** (not debug) | GEOX FastMCP kwargs |
| L9 | Scrub secrets/PII/paths from `data` | Wired |
| L10 | Severity = client urgency; floor/verdict in `data` = federation truth | Table below |
| L11 | 888_HOLD logic lives in **arifOS**, not “level == alert” alone | Design invariant |

### Constitutional → MCP severity

| Event | Level | `data` must include |
|-------|-------|---------------------|
| Lifecycle (opt-in if setLevel ≤ info) | info/notice | organ, tool |
| F7 cap / soft floor | warning | floor, verdict, tool |
| HOLD/VOID | error | floor, verdict |
| Hard BLOCK | critical | floor, verdict |
| F13 / human required | alert | floor=F13, verdict |
| Federation breach | emergency | organ, blast |

### Severity does not enforce

```
organ emit notifications/message (level + data)
  → client displays
  → arifOS (if subscribed/bridged) inspects data.floor / data.verdict
  → arifOS may fire 888_HOLD
```

MCP log = **transport**. Constitution = **logic**.

---

## Completions — **CANCELLED for agent surface** (human UI only if ever revived)

| # | Rule | Notes |
|---|------|-------|
| C0 | **Do not implement** unless humans type prompt/resource args in a host UI | Sovereign answer 2026-07-09 |
| C1 | If ever built: declare `completions: {}` **only after** handler exists | -32601 if declared without handler |
| C2 | `ref/prompt` → `name`; `ref/resource` → **URI** | Spec |
| C3 | Never advertise completions on agent-only organs | Current federation = tool JSON |

Phase 2–3 proxy registry: **shelved** until human UI requirement appears.

---

## Forge sequence (closed)

| Phase | Work | Status |
|-------|------|--------|
| 0 | A-FORGE drop false logging · WELL identity | **DONE** |
| 1a–1c | GEOX/arifOS/WEALTH emit + HOLD_CANDIDATE bridge | **DONE** → **FREEZE** (SEP-2577) |
| 2–3 | Completions | **CANCELLED** (no human UI typing path) |
| 4 | Conformance probes | **DONE** |

### Stop list (do not forge without new F13)

- New `notifications/message` call sites  
- A-FORGE `logging: {}`  
- `completions: {}` on any organ  
- Protocol logging as primary observability (use stderr / OTel / receipts)

---

## Live proof anchors (2026-07-09)

- WELL `/mcp` → `serverInfo.name=WELL`, 18 `well_*` tools (identity fix)
- A-FORGE `/mcp` → no `logging` capability (honest)
- GEOX → `logging:{}` + `mcp_logging.py` + floor wrapper emits

---

*Forged 2026-07-09. Spec-grounded. Completions not advertised until handlers exist.*


## Phase 1b receipt (2026-07-09)

- `arifosmcp/runtime/mcp_logging.py` + verdict/fail wire in `tools_internal.py` + `client_log_level=warning`
- `wealth_mcp/mcp_logging.py` + gov-block/tool-fail wire in `wealth_mcp/server.py` + `client_log_level=warning`
- A-FORGE: still no `logging:{}` until real emit path exists (honest)
- Completions: still deferred / not advertised


## Phase 1c + 4 receipt (2026-07-09)

### 1c Bridge
- `arifosmcp/runtime/mcp_log_bridge.py` — `evaluate_log_for_hold` / `record_hold_candidate`
- Severity alone never HOLD; requires structured `verdict`/`floor` (esp. F13)
- Advisory jsonl: `ARIFOS_MCP_LOG_HOLD_CANDIDATES` (default `/var/lib/arifos/vault/mcp_log_hold_candidates.jsonl`)
- Wired from arifOS `emit_mcp_log` — does **not** call arif_judge or vault seal

### 4 Conformance
- Probe: `A-FORGE/forge_work/2026-07-09/mcp_logging_conformance_probe.py`
- Expect: arifOS/GEOX/WEALTH/WELL logging=yes completions=no; A-FORGE logging=no


## Cleanup receipt (2026-07-09) — decisions executed

| Action | Result |
|--------|--------|
| Completions cancelled | Unwired arifOS/GEOX/WEALTH/WELL; modules stubbed no-op; A-FORGE handlers removed |
| Multi-organ initialize | Each organ self-identifies; no completions; FastMCP may still declare logging (deprecated, maintenance) |
| Protocol logging freeze | `MCP_PROTOCOL_LOGGING` default **0** — emit path = stderr (+ arifOS HOLD_CANDIDATE); no `notifications/message` unless opt-in |
| A-FORGE honesty | No `logging` / `completions` in initialize capabilities |
| Partial organ failure | Existing: `organ_attestation` marks DEGRADED/PARTIAL without killing host; bridges use timeouts + except |

**Canonical path:** stderr + structured receipts + HOLD_CANDIDATE  
**Not:** expand protocol logging · ship completions · crash session on one organ down


## Correction — do not accept parallel "FORGE DONE" on completions (2026-07-09)

A parallel agent claimed A-FORGE logging+completions "proven" and asked to restart
FastMCP organs to activate completions.py. **That contradicts sovereign freeze:**

1. Completions **CANCELLED** for agent surface (full tool JSON).
2. Protocol logging **FROZEN** (SEP-2577 Final).
3. A-FORGE must **not** advertise `logging:{}` / `completions:{}`.

**Live truth after re-assert (post-cleanup):**
- A-FORGE: no logging, no completions in initialize; setLevel/complete → method not found path
- FastMCP organs: completions **not wired** (CANCELLED comments); complete → -32601
- Do **not** systemctl restart to activate completions

Undeclared-but-working complete handlers (advertise none, still answer complete) are a
protocol honesty bug — removed from A-FORGE serve.ts.
