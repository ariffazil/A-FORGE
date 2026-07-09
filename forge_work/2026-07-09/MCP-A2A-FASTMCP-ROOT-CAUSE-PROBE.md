# MCP / A2A / FastMCP Root-Cause Probe — 2026-07-09

**Status:** PROBED (T₁)  
**Sovereign:** Arif  
**Question:** Is FastMCP `mount()` + isolated `session_state_store` the literal mechanical cause of init/triage/observe desync?

---

## Verdict (one line)

**No — not inside arifOS kernel.** Live kernel is **one FastMCP instance** with tools registered via `add_tool`, not FastMCP `.mount()`. Desync was **app-level store lookup + dual token birth**, fixed by **sct_v1** standing. Federation organs *are* separate processes (separate stores by definition) — that is expected, not a misconfigured mount.

---

## FastMCP 3.4.2 facts (installed)

| API | Present? | Live arifOS use |
|-----|----------|-----------------|
| `FastMCP(..., session_state_store=...)` | **Yes** | **Not set** on main server ctor (`server.py` `FastMCP("ARIFOS MCP", ...)`) |
| `mcp.mount(child_server, ...)` | **Yes** | **Not used** for kernel verbs or organs |
| `app.mount("/api/...")` (Starlette) | Yes | webhook/events only — **HTTP path**, not FastMCP session isolation |
| Sub-servers `arifOS-P/T/V/G/E` | Exist in `mcp_tools.py` | Tools **copied** into unified via `add_tool` — same parent FastMCP |

**ExecStart (live):**  
`python -c "from arifosmcp.runtime.__main__ import main; main()"` → single process, port 8088.

---

## What actually desynced (proven earlier + this probe)

| Layer | Reality | Disease class |
|-------|---------|----------------|
| Kernel hop trust | `_SESSIONS[session_id]` optional cache treated as authority | Store interrogate ≠ inhabit |
| Birth token | Was dual-minting `arifos.v1` with invented G | Second wire format |
| Standing | think→compose ignored token | Incomplete spine |
| Organs (GEOX/WEALTH/WELL/A-FORGE) | **Separate systemd processes / ports** | Not FastMCP mount — **process boundary** |
| Path-B proxies | Inject `session_id` into remote organ tools | Cross-process; never shared FastMCP `ctx` state |

**MCP auth alignment:** access token / capability must bind the hop (audience-bound). We mint **`sct_v1`** at init and verify locally — matches “token is the session continuity,” not opaque store hope.

**A2A alignment:** one standing + one `verdict.state` (in progress). Formal `input-required` / SABAR-as-resume-in-place remains **P1** (not yet a TaskState enum on wire).

**MCP convergence law:** still violated by alias/triple-path naming (triage/route/observe aliases) — **document / collapse later**; not the store desync root.

---

## Spine P0 status after probe

| Item | Status |
|------|--------|
| Birth mints `sct_v1` only | **LIVE** (probed) |
| Apex birth = UNMEASURED | **LIVE** |
| Store delete → triage/observe/forge(dry)/compose | **LIVE** (`SPINE_P0_LIVE_OK`) |
| capability_token | Thin facade → sct (no second birth) |
| FastMCP shared `session_state_store` fix | **N/A** — not the failure mode |

---

## What not to do

1. Do not “fix” desync by inventing a shared FastMCP `session_state_store` across GEOX/WEALTH processes — they are **different hosts of meaning**; use SCT + lease + HTTP, not ctx.set_state.
2. Do not re-wire `arifos.v1` as birth.
3. Do not call audit closed on alias collapse until separate RSI pass.

---

## Receipts

- Live birth: `sct_v1.…` + `authority=LIMITED_MUTATE` + apex UNMEASURED  
- Tests: `tests/test_sct_slice1.py` **10 passed**  
- Specs cited by operator: MCP convergence, MCP auth audience token, A2A TaskState, FastMCP mount isolation  

*Probed 2026-07-09 — diagnosis matches protocol; mount() was the right first check; answer is negative for kernel, affirmative for process-boundary organs.*
