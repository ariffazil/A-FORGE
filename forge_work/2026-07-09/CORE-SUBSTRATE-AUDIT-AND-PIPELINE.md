# Core Substrate Audit + Federation Pipeline

**Date:** 2026-07-09T09:05Z  
**Actor:** grok-build  
**Spec anchors:** [MCP Lifecycle 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle) · [Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) · [Client Best Practices](https://modelcontextprotocol.io/docs/develop/clients/client-best-practices)  
**Live probe:** `forge_work/2026-07-09/SUBSTRATE-LIVE-PROBE.json`  
**Backlog classify:** `forge_work/2026-07-09/FEDERATION-BACKLOG-CLASSIFY.json`  
**Prior receipts:** `MCP-GAP-VERIFY.json`, `MCP-LOGGING-COMPLETIONS-FORGE.md`

> **Law:** Harden these six substrates **before** any new pass, GUI, or market packaging.
> Priority: **Lifecycle → Tool quality → Error handling → Transport → Auth → Cache invalidation**

---

## 0. Executive (one screen)

| # | Substrate | Live status | Verdict |
|---|-----------|-------------|---------|
| 1 | **Lifecycle** | All organs serve `tools/list` **before** `notifications/initialized`. Only GEOX mints `Mcp-Session-Id`. | **HARDEN (P0)** |
| 2 | **Tool definitions** | arifOS 12 + A-FORGE 98: KERNEL/ACTUATOR prefixes precise. WELL 4/18 empty input schemas. | **HARDEN WELL + promote clarity DRAFT** |
| 3 | **Error handling** | GEOX/WEALTH/WELL: `isError: true` inside tool result. A-FORGE often omits `isError`. arifOS invalid args can soft-succeed. | **HARDEN A-FORGE envelope** |
| 4 | **Transport** | Prod = Streamable HTTP on all organs. A-FORGE intentional **stateless** path. Protocol: organs `2025-06-18`, A-FORGE `2025-11-25`. | **OK (document dual model)** |
| 5 | **Auth & secrets** | Session ID ≠ auth is correct doctrine. Forged `Mcp-Session-Id` still gets tools/list on arifOS/WEALTH/WELL (list is open). Mutation gates live in kernel/lease, not header. | **OK for list; keep lease/token path** |
| 6 | **`tools/list_changed`** | FastMCP organs **declare** `listChanged: true`. A-FORGE tools cap `{}` (no listChanged). **arifOS does not re-index host catalog on organ notify** — poll only. | **HARDEN host reindex (P0)** |

**Do not build on top yet:** progressive GUI, completions UI, market “authorize product,” logging expansion (SEP-2577 freeze).

---

## 1. Spec → Federation map

### 1.1 Lifecycle (Most Critical)

**Spec MUST:**
1. Client sends `initialize` first  
2. Server responds with caps + version  
3. Client sends `notifications/initialized`  
4. Only then normal ops (server SHOULD NOT send non-ping/non-logging requests before `initialized`)  
5. Graceful transport close on shutdown  

| Organ | init OK | `Mcp-Session-Id` | tools before `initialized` | post tool count |
|-------|---------|------------------|----------------------------|-----------------|
| arifOS :8088 | ✅ | ❌ none | ✅ **allowed** (12) | 12 |
| A-FORGE :7072 | ✅ | ❌ stateless | ✅ **allowed** (98) | 98 |
| GEOX :8081 | ✅ | ✅ UUID | ✅ **allowed** (71) | 71 |
| WEALTH :18082 | ✅ | ❌ none | ✅ **allowed** (50) | 50 |
| WELL :18083 | ✅ | ❌ none | ✅ **allowed** (18) | 18 |

**Gap (P0):** No organ hard-gates operation on receipt of `notifications/initialized`. Spec allows clients to avoid early requests; servers currently do not enforce. For federation multi-hop hosts, **enforce server-side** after first non-stateless client: reject tools/call (and optionally tools/list) with clear RPC error until `initialized`.

**A-FORGE dual model (intentional, not a bug):**  
`serve.ts` — no session → **stateless whitelist**; invalid/expired session → reject with re-init. Document as production pattern; do not force full session on OBSERVE tools.

### 1.2 Tool Definitions Quality

Agent decision surface = names + descriptions + schemas.

| Organ | Count | Vague/empty schema (sample) | Quality note |
|-------|-------|------------------------------|--------------|
| arifOS | 12 | 0/12 | KERNEL stage prefixes; high-signal |
| A-FORGE | 98 | 0/20 | ACTUATOR + affordance + gate flags |
| GEOX | 71 | 0/20 | Clear read-only wording |
| WEALTH | 50 | 1/20 | Structured capital tools; one short edge |
| WELL | 18 | **4/18** | Several tools `properties: {}` |

**Pipeline:**
- **PROMOTE** `ARIFOS-MCP-TOOL-CLARITY-SPEC.md` (DRAFT) → live checklist + cockpit badge contract (Visible / Callable / 888_HOLD).  
- **HARDEN** WELL inputSchemas for tools currently empty.  
- **KILL** any new “helper” tool without unique `capability_surface` (anti-proliferation).

### 1.3 Error Handling

**Spec:** tool failures → successful RPC with `result.isError: true` + actionable content. Not transport crash.

| Organ | Live probe | Status |
|-------|------------|--------|
| GEOX | `isError: true` + validation text | ✅ |
| WEALTH | `isError: true` + `error_class` / `recoverability` | ✅ gold pattern |
| WELL | `isError: true` + validation text | ✅ |
| A-FORGE | content OK, **`isError` absent/null** | ⚠ standardize |
| arifOS | invalid arg still returned status OK (soft) | ⚠ prefer isError on schema fail |

**Partial organ failure:** already true — WELL degraded, arifOS still serves 12 tools (`MCP-GAP-VERIFY`). Keep this.

### 1.4 Transport Correctness

| Rule | Live |
|------|------|
| stdio = dev/local only | ✅ production organs HTTP |
| Streamable HTTP production | ✅ :8088 / :7072 / :8081 / :18082 / :18083 |
| Session ID not auth | ✅ mutation via kernel session + lease, not header alone |
| Protocol version header | A-FORGE emits `mcp-protocol-version: 2025-11-25` |

**Document only:** dual protocol versions are fine if each client negotiates; do not force A-FORGE down to 2025-06-18 without need.

### 1.5 Auth & Secrets Hygiene

From MCP security best practices (mapped to federation):

| Attack / rule | Federation stance | Action |
|---------------|-------------------|--------|
| Session hijack — **session ≠ auth** | Kernel authority via `arif_init` / lease | Keep; never elevate on header alone |
| Token passthrough | Forbidden | No pass-through of third-party tokens |
| Credentials in logs | Scrub rules in logging freeze note | Maintain |
| HTTPS production | Cloudflare / Caddy public doors | OK |
| Short-lived tokens | Lease scopes | OK |
| Confused deputy (OAuth proxy) | Not primary surface (localhost + tunnels) | N/A unless public OAuth proxy ships |

Forged `Mcp-Session-Id` accepted for **tools/list** on arifOS/WEALTH/WELL: acceptable **if** list is public discovery and mutation still gated. GEOX/A-FORGE reject bad session for list when session mode is on.

### 1.6 `tools/list_changed` + Cache Invalidation

| Piece | Status |
|-------|--------|
| Declare `tools.listChanged: true` | FastMCP organs ✅ · A-FORGE ❌ (`tools: {}`) |
| Emit `notifications/tools/list_changed` | GEOX method **fixed** (was wrong name); still **log-only**, not session push |
| Host re-index on notify | **GAP** — arifOS catalog = poll / `arif_retrieve_tools` |
| Client best practice | “Refresh on list_changed” — federation host not compliant |

**This is the silent-failure substrate.** Stale definitions produce wrong tool selection with **no error**.

---

## 2. Federation backlog sweep (maturity)

Automated classify over ~434 recent forge_work artifacts:

| Maturity | Count | Meaning |
|----------|------:|---------|
| KILL/SUPERSEDED | 136 | Cancelled, do-not-build, superseded text |
| SEALED/DONE | 120 | Sealed receipts — archive, don't rework |
| ACTIVE/MIXED | 100 | Live mixed signal — re-probe before build |
| DRAFT | 42 | Explicit draft — promote or kill |
| PENDING | 27 | Open work |
| EXPLORATORY | 6 | Research only |
| STALE_CANDIDATE | 3 | Age + no seal |

### 2.1 Substrate-related: pipeline or kill

| Artifact | Maturity | Decision |
|----------|----------|----------|
| `MCP-GAP-VERIFY.json` | ACTIVE | **KEEP as T1 evidence** |
| `MCP-LOGGING-COMPLETIONS-FORGE.md` | KILL | **KILL expansion** (SEP-2577 + no agent completions) |
| `ARIFOS-MCP-TOOL-CLARITY-SPEC.md` | DRAFT | **PIPELINE → promote to canon checklist** |
| `POST-AGENTIC-HARDENING-STRATEGY.md` | ACTIVE/MIXED | **PARK** — market packaging; **not** core substrate |
| `MCP-APPS-STANDARDIZATION.md` | ACTIVE | **HOLD** until substrate P0 closed |
| `APA-SUBSTRATE-AUDIT.md` | KILL/SUPERSEDED | Archive |
| `INIT_TASKS.json` T1–T5 | PENDING | Reclassified below |
| Completions Phase 2–3 | CANCELLED | **Do not revive** |
| Protocol logging new call sites | FREEZE | **Do not forge** |

### 2.2 INIT_TASKS reclassified under substrate law

| ID | Task | Substrate link | Decision |
|----|------|----------------|----------|
| T1 | manifest.txt 404 | Discovery surface (tool quality / client) | **PIPELINE P1** — restore path or fix health `tool_manifest_url` |
| T2 | WELL biometrics stale | Not MCP substrate; honesty | **HUMAN** — inject or permanent MOCK banner |
| T3 | 999-seal 2026-07-08 DRAFT doxes | Doctrine, not substrate | **HOLD** F13 only if canon wanted |
| T4 | unregister `forge_tier_bind` + affordance regen | Tool quality / deprecation | **PIPELINE P2 polish** |
| T5 | A-FORGE resources/list on stateless | Transport/client discovery | **PIPELINE P2** after lifecycle/list_changed |

---

## 3. Production pipeline (ordered)

### Phase A — P0 Core substrate (block GUI/pass)

| # | Work | Owner organ | Proof |
|---|------|-------------|-------|
| A1 | **Lifecycle gate:** after session mint, reject tools/call until `notifications/initialized` (allow ping). Optional: soft-allow tools/list with `X-MCP-Lifecycle: pre-initialized` log. | GEOX first (sessionful), then FastMCP siblings | Probe: pre-init call → error; post-init → OK |
| A2 | **Host catalog re-index:** arifOS (or 1mcp host) on `notifications/tools/list_changed` → invalidate ToolCatalog + refresh | arifOS | Reload organ tools → host list updates without restart |
| A3 | **A-FORGE `isError: true`** on tool failures (schema/policy deny) | A-FORGE | Conformance test assert field |
| A4 | Declare A-FORGE `tools.listChanged` **only if** emit path exists; else keep `{}` and document poll | A-FORGE | Caps match reality |

### Phase B — P1 Tool quality + discovery

| # | Work | Owner | Proof |
|---|------|-------|-------|
| B1 | WELL empty inputSchemas filled | WELL | vague count → 0 |
| B2 | Promote tool clarity DRAFT → `docs` + affordance badge contract | arifOS + AAA | Spec status ≠ DRAFT |
| B3 | Fix / retarget manifest.txt (INIT T1) | arifOS | 200 or honest remove from health |
| B4 | Progressive discovery partial already (`arif_retrieve_tools`) — wire refresh on A2 | arifOS | Client best-practice alignment |

### Phase C — P2 Polish / kill list

| Item | Action |
|------|--------|
| Completions | **KILL** (agents use full JSON) |
| Logging protocol expansion | **KILL/FREEZE** (SEP-2577) |
| MCP Apps GUI pass | **HOLD** until Phase A green |
| POST-AGENTIC market roadmap | **PARK** — not substrate |
| forge_tier_bind unregister | Optional P2 |
| A-FORGE resources/list | Optional P2 |
| WELL biometrics | Human only |

---

## 4. What is already good (do not re-forge)

1. **arifOS tool copy** — KERNEL prefixes, precise anti-confusion.  
2. **A-FORGE ACTUATOR copy** — gate flags in description.  
3. **WEALTH error envelopes** — `error_class` + recoverability.  
4. **Partial failure resilience** — degraded WELL ≠ dead session.  
5. **Logging freeze decision** — already sealed in `MCP-LOGGING-COMPLETIONS-FORGE.md`.  
6. **Session ≠ auth** doctrine aligns with MCP session-hijack mitigations.  
7. Organs healthy at T1: arifOS / A-FORGE / AAA / GEOX / WEALTH / WELL(process up).

---

## 5. Kill board (entropy reduction)

Explicit **do not build / archive**:

- Completions multi-organ rollout  
- New `notifications/message` call sites  
- OAuth “confused deputy” product until public OAuth proxy is intentional  
- GUI / MCP Apps standardization before Phase A  
- Market packaging from POST-AGENTIC as if substrate-complete  
- Duplicate research substrate docs older than 2026-07-05 with no seal (cold store)

---

## 6. Quant receipt (this sweep)

| Metric | Value | Label |
|--------|------:|-------|
| Organs probed | 5 | OBSERVED |
| Lifecycle hard-gate compliant | 0/5 | OBSERVED |
| Session header organs | 1/5 (GEOX) | OBSERVED |
| Tool defs vague (sampled) | WELL 4; others ~0 | OBSERVED |
| isError-correct organs | 3/5 (GEOX/WEALTH/WELL) | OBSERVED |
| listChanged declared | 4/5 (not A-FORGE) | OBSERVED |
| Host reindex on notify | 0 | OBSERVED gap |
| Backlog classified | 434 files | DERIVED |
| Kill/superseded share | 136 (31%) | DERIVED |
| P0 pipeline items | 4 (A1–A4) | INT |

**G (substrate readiness):** ~0.55 → target ≥0.80 after Phase A.  
**ΔS:** classification + kill board reduces decision entropy.  
**Unknowns:** exact FastMCP session mode flags per organ unit file (WEALTH/WELL/arifOS header absence may be `stateless_http=True`).

---

## 7. Next lawful action

**Execute Phase A in order A1 → A2 → A3 → A4.**  
Do not open GUI/MCP-Apps/market passes until A1+A2 green on live probe.

Re-run:
```bash
python3 forge_work/2026-07-09/mcp_logging_conformance_probe.py  # existing
# plus re-run substrate lifecycle section of SUBSTRATE-LIVE-PROBE
```

Evidence files:
- `SUBSTRATE-LIVE-PROBE.json`
- `FEDERATION-BACKLOG-CLASSIFY.json`
- This document

---

*Forged 2026-07-09 — core substrate before any pass/GUI.*
