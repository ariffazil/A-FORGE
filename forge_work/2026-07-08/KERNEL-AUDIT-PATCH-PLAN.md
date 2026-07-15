# 🔥 KERNEL AUDIT — Patch Plan (2026-07-08)

> **Auditor:** A-AUDIT (DeepSeek V4 Pro, 1M ctx)
> **Executor:** FORGE (000Ω)
> **Verdict:** HOLD — kernel alive but semantically impure
> **Evidence band:** YELLOW (L2 prior tool responses, L4 architectural classification)
> **Epistemic labels:** OBS (observed code), DER (derived from structure), INT (interpreted from audit)

---

## Summary

The auditor identified 4 P0 bugs and 4 P1 improvements. After reading the kernel source (`tools.py` 20K lines, `model.py`, `verdicts.py`, `contracts.py`, `verdict_wrapper.py`, `session.py`, `constitutional_map.py`), I confirm the findings are structurally valid. The root cause of most issues is **code accumulation** — three different verdict enums, three-source actor verification, and 20K lines in a single file.

---

## P0-1: Actor Verification Drift

### Root Cause (OBS)

Three-source lookup at `tools.py:2908-2912`:

```python
actor_verified_flag = out.get("actor_verified")                    # source 1
if actor_verified_flag is None and isinstance(out.get("actor"), dict):
    actor_verified_flag = out["actor"].get("identity_verified")     # source 2
if actor_verified_flag is None and isinstance(result_payload, dict):
    actor_verified_flag = result_payload.get("actor_verified")      # source 3
```

Each tool can emit `actor_verified` in three different locations. The wrapper picks the first non-None. If a tool emits `actor_verified=True` in `result_payload` but the session store has `False`, the session-bound resolution at line 1505-1512 catches it — but the three-source lookup at 2908-2912 happens BEFORE session-bound resolution, creating a window where the wrong value enters the pipeline.

### Fix

**Single canonical source:** session store only. Remove the three-source lookup.

```python
# BEFORE (tools.py:2908-2912):
actor_verified_flag = out.get("actor_verified")
if actor_verified_flag is None and isinstance(out.get("actor"), dict):
    actor_verified_flag = out["actor"].get("identity_verified")
if actor_verified_flag is None and isinstance(result_payload, dict):
    actor_verified_flag = result_payload.get("actor_verified")

# AFTER:
# Single source of truth: session store. Per-tool claims are advisory only.
_session_id_for_verify = out.get("session_id") or (
    result_payload.get("session_id") if isinstance(result_payload, dict) else None
)
actor_verified_flag = False  # default: unverified
if _session_id_for_verify and _session_id_for_verify != "unknown":
    _sess = get_session(_session_id_for_verify)
    if _sess and isinstance(_sess, dict):
        actor_verified_flag = bool(_sess.get("actor_verified", False))
```

### Invariant

```
actor_verified has ONE source: session store.
Per-tool `actor_verified` in result/out is advisory log only, never used for gating.
If session not found → actor_verified=False.
```

### Files

- `arifosmcp/runtime/tools.py` lines 2908-2912 → replace with session-only lookup
- `_compute_canonical_verdict` (line 1420) → no change needed (already uses session-bound resolution at 1491-1512)

---

## P0-2: Verdict Language Collision

### Root Cause (OBS)

Three separate verdict enumerations exist:

| Enum | Location | Values |
|------|----------|--------|
| `SealType` (aka `Verdict`) | `models/verdicts.py:19-30` | VOID, HOLD, SABAR, PARTIAL, SEAL |
| `VerdictCode` | `runtime/contracts.py:27-34` | SEAL, PARTIAL, VOID, SABAR, 888_HOLD |
| `RuntimeStatus` | `models/verdicts.py:210-221` | SUCCESS, ERROR, TIMEOUT, RETRY, HOLD |

Plus the envelope at `tools.py:3061` uses a plain string `verdict` that can be: "SEAL", "DEGRADED", "OBSERVE_ONLY", "HOLD", "VOID", "SABAR".

The auditor observed `verdict: SEAL` in the envelope for a read-only tool call. This is technically correct (the kernel's SEAL means "all floors passed, proceed") but semantically dangerous because SEAL implies constitutional ratification in the broader arifOS doctrine.

### Fix

**Consolidate to two enums:**

1. `Verdict` (= SealType) — constitutional governance: VOID > HOLD > SABAR > PARTIAL > SEAL
2. `RuntimeStatus` — transport plumbing: SUCCESS, ERROR, TIMEOUT, RETRY, BLOCKED

**Remove `VerdictCode`** — it's a duplicate of `SealType` with `HOLD = "888_HOLD"` instead of `HOLD = "HOLD"`.

**Add to envelope:**

```python
envelope = {
    "status": status,              # transport: OK/ERROR
    "verdict": verdict,            # constitutional: SEAL/PARTIAL/SABAR/HOLD/VOID/OBSERVE_ONLY/DEGRADED
    "execution_status": exec_status,  # COMPLETED/HOLD/ERROR
    "authority_mode": authority_mode, # FULL/OBSERVE_ONLY/SOVEREIGN
    ...
}
```

**Add invariant:** Read-only tools (action_class=OBSERVE) with `actor_verified=False` emit `verdict=OBSERVE_ONLY`, never `verdict=SEAL`.

### Files

- `arifosmcp/runtime/contracts.py` — deprecate `VerdictCode`, alias to `SealType`
- `arifosmcp/runtime/verdict_wrapper.py` — import `SealType` instead of `VerdictCode`
- `arifosmcp/runtime/tools.py` — add `authority_mode` to envelope

---

## P0-3: Authority Ambiguity

### Root Cause (OBS)

The envelope at `tools.py:3058-3097` emits:

```json
{
  "status": "OK",
  "verdict": "SEAL",
  "actor_verified": false,
  "_ATTENTION": "IDENTITY_NOT_VERIFIED",
  "output_policy": "OBSERVE_ONLY",
  "status_scope": "transport"
}
```

The auditor saw `authority: FULL` and `authority_mode: OBSERVE_ONLY` simultaneously. This comes from different layers: the session may declare `authority: FULL` (human is sovereign) while the runtime correctly sets `authority_mode: OBSERVE_ONLY` (tool not authorized to execute). But the envelope doesn't clearly separate these.

### Fix

Add structured authority block to envelope:

```python
"authority": {
    "human_authority": "SOVEREIGN",           # always SOVEREIGN for Arif
    "runtime_authority": "OBSERVE_ONLY",      # what this tool can do
    "mutation_allowed": False,                 # can this call mutate state?
    "seal_allowed": False,                     # can this call seal to VAULT999?
    "actor_verified": False,                   # is identity verified?
}
```

Replace the current flat `actor_verified` + `output_policy` + `status_scope` with this structured block. Keep flat fields for backward compat but add the structured block as primary.

### Files

- `arifosmcp/runtime/tools.py` — add `authority` dict to envelope at line ~3058

---

## P0-4: Affordance Unknowns

### Root Cause (OBS)

`_get_affordance_contract` at line 1179-1205 returns UNKNOWN for tools not in `TOOL_AFFORDANCE_CONTRACTS`. The fallback is conservative (fail-safe), which is good design. But many tools are unknown because `TOOL_AFFORDANCE_CONTRACTS` only covers ~15 tools out of 32+ in the registry.

### Fix

**Fill affordance contracts for all canonical 9 + key internal tools.**

The canonical 9 (`arif_init`, `arif_observe`, `arif_think`, `arif_route`, `arif_critique`, `arif_judge`, `arif_forge`, `arif_compose`, `arif_seal`) plus key internals (`arif_ping`, `arif_canary`, `arif_triage`, `arif_memory`, `arif_measure`, `arif_fetch`, `arif_bridge_connect`, `arif_conformance_report`, `arif_kernel_status`, `arif_kernel_health`).

Add a CI check: `assert all(t in TOOL_AFFORDANCE_CONTRACTS for t in CANONICAL_NINE)`

### Files

- `arifosmcp/runtime/tools.py` — add entries to `TOOL_AFFORDANCE_CONTRACTS` dict (line 828+)
- `arifosmcp/tests/` — add affordance completeness test

---

## P0-4b: forge_* Affordance Contracts (Transport Awareness)

### Root Cause (OBS)

The `TOOL_AFFORDANCE_CONTRACTS` dict in `arifosmcp/runtime/tools.py` only covers `arif_*` tools. The 79 `forge_*` tools (defined in A-FORGE TypeScript at `src/interfaces/mcp/`) have NO affordance representation in arifOS. When an arifOS agent calls a forge_* tool via bridge/proxy, it has no pre-call knowledge of:

- Whether the tool requires stdio transport (many do — `forge_filesystem_*`, `forge_shell`, `forge_git`)
- Whether the tool mutates state (`forge_shell` yes, `forge_filesystem_read` no)
- Whether the tool requires a session/lease
- The blast radius

The `_get_affordance_contract` fallback returns UNKNOWN for all forge_* tools, which is fail-safe but prevents intelligent routing.

### Fix

Add `transport_constraint` field to the affordance schema, and register forge_* tools by transport+mutation class:

```python
# New field in TOOL_AFFORDANCE_CONTRACTS schema:
"transport_constraint": "stdio_only" | "http_ok" | "any"
"requires_stdio": True/False  # derived from transport_constraint
```

### forge_* Affordance Registry (by class)

**Class 1: OBSERVE / read-only / http_ok**
```python
# These tools are safe on any transport, read-only, no lease needed
FORGE_OBSERVE_TOOLS = [
    "forge_probe", "forge_health_check", "forge_status",
    "forge_registry", "forge_registry_status", "forge_fingerprint_check",
    "forge_isomorphism_check", "forge_surface_audit", "forge_surface_guard",
    "forge_vps_ports", "forge_vps_services", "forge_vps_cron",
    "forge_boundaries_assert", "forge_netdata_alarms", "forge_netdata_metrics",
    "forge_journalctl", "forge_shell_status", "forge_shell_ledger",
    "forge_shell_alert_history", "forge_worktree", "forge_docs_lookup",
    "forge_scan", "forge_memory", "forge_search", "forge_minimax_search",
    "forge_research", "forge_fetch", "forge_fetch_json", "forge_fetch_links",
    "forge_fetch_metadata", "forge_fetch_url", "forge_chart",
    "forge_skillstore_read", "forge_job",  # job status is observe
]
```

**Class 2: OBSERVE / read-only / stdio_only**
```python
# These tools require stdio session ownership — fail on Streamable HTTP
FORGE_OBSERVE_STDIO_TOOLS = [
    "forge_filesystem_read", "forge_filesystem_stat",
    "forge_filesystem_search", "forge_filesystem_tree", "forge_filesystem",
    "forge_git",  # mode=status/diff/log are read-only but need stdio
]
```

**Class 3: MUTATE / requires lease / stdio_only**
```python
# These tools mutate state and require stdio + session + lease
FORGE_MUTATE_STDIO_TOOLS = [
    "forge_filesystem_write", "forge_filesystem_patch",
    "forge_filesystem_move", "forge_filesystem_delete",
    "forge_shell", "forge_shell_dryrun",
    "forge_git",  # mode=commit is mutate
    "forge_docker",  # mode=exec is mutate
    "forge_postgres",  # mutate=true
    "forge_github_create_issue", "forge_github_create_or_update_file",
    "forge_github_create_pull_request", "forge_skillstore_write",
    "forge_filesystem_write", "forge_synthesize", "forge_stage",
    "forge_sandbox_run", "forge_lock", "forge_tier_bind",
]
```

**Class 4: EXECUTE / requires judge+lease / stdio_only**
```python
# These tools require prior arifOS judge SEAL + lease
FORGE_EXECUTE_STDIO_TOOLS = [
    "forge_execute", "forge_execute_sealed", "forge_pipeline_run",
    "forge_register", "forge_seal", "forge_skill",
    "forge_send_confirm", "forge_transfer_confirm",
]
```

**Class 5: GOVERNANCE / proxy to arifOS / http_ok**
```python
# These tools proxy to arifOS — no mutation in A-FORGE
FORGE_GOVERNANCE_TOOLS = [
    "forge_judge_proxy", "forge_heart_critique", "forge_check_governance",
    "forge_docket_prep", "forge_receipt_draft", "forge_verify_timeline",
    "forge_evaluate", "forge_predict", "forge_witness", "forge_scar",
    "forge_scar_scan", "forge_session_init", "forge_lease",
]
```

### Template for each entry

```python
"forge_shell": {
    "action_class": "EXECUTE",
    "mutation": True,
    "external_side_effect": True,  # runs arbitrary commands
    "irreversible": "depends",     # depends on command
    "requires_session": True,
    "requires_lease": True,
    "requires_human_ack": True,    # GATE patterns need ack
    "expected_blast_radius": "HIGH",
    "output_is_evidence": True,
    "output_is_approval": False,
    "safe_autonomous_use": False,
    "transport_constraint": "stdio_only",
    "requires_stdio": True,
    "known": True,
},
```

### Invariant

```
No forge_* tool with transport_constraint=stdio_only may be called via Streamable HTTP.
The affordance contract must surface transport_constraint BEFORE the call.
Agents on HTTP must skip stdio_only tools and report the constraint.
```

### Files

- `arifosmcp/runtime/tools.py` — add `transport_constraint` field to `TOOL_AFFORDANCE_CONTRACTS` schema; add forge_* entries
- `arifosmcp/runtime/tools.py` `_get_affordance_contract` — add forge_* lookup (currently only looks up arif_* + legacy aliases)
- `arifosmcp/tests/` — add test: forge_* tools have affordance contracts

---

## P1-5: Alias Parity

### Status (OBS)

The `_LEGACY_ALIASES` map at line 20358-20419 is a bidirectional map: `arif_* → arifos_*` AND `arifos_* → arif_*`. This is correct — aliases are hard pointers. But the map is circular (A→B and B→A), which means `_LEGACY_ALIASES.get("arifos_init")` returns `"arif_init"`, and `_LEGACY_ALIASES.get("arif_init")` returns `"arifos_init"`. This could cause infinite loops if not handled.

### Fix

Add alias parity test: for every alias pair (A, B), verify that `f(A) == B` and `f(B) == A`, and that the canonical handler is the same for both.

### Files

- `arifosmcp/tests/` — add alias parity test

---

## P1-6: Forge `arif_tool_audit`

### Proposed Tool

```python
"arif_tool_audit": {
    "action_class": "OBSERVE",
    "mutation": False,
    "external_side_effect": False,
    "irreversible": False,
    "requires_session": False,
    "requires_lease": False,
    "requires_human_ack": False,
    "expected_blast_radius": "LOW",
    "output_is_evidence": True,
    "output_is_approval": False,
    "safe_autonomous_use": True,
}
```

Modes: `registry` (list all tools), `affordance` (check completeness), `alias_parity` (verify aliases), `safe_probe` (dry-call each tool), `report` (full audit).

### Files

- New: `arifosmcp/tools/tool_audit.py`
- `arifosmcp/runtime/tools.py` — register tool
- `arifosmcp/constitutional_map.py` — add to CANONICAL_TOOLS

---

## Priority Execution Order

```
P0-1  (actor drift)       → 1 hour  → tools.py 3-line change
P0-2  (verdict collision)  → 2 hours → contracts.py deprecation + tools.py envelope
P0-3  (authority split)    → 1 hour  → tools.py envelope addition
P0-4  (affordance fill)    → 2 hours → tools.py dict additions + test
P0-4b (forge_* affordance) → 2 hours → tools.py forge_* entries + transport_constraint field
P1-5  (alias parity)       → 30 min  → test only
P1-6  (tool_audit)         → 3 hours → new tool + registration
```

**Total estimated:** ~12 hours of forge work.

---

## What NOT To Do

- Do NOT add more verdict enums
- Do NOT add more tools to solve tool governance
- Do NOT refactor tools.py (20K lines) in one pass — surgical patches only
- Do NOT touch VAULT999 seal chain
- Do NOT modify constitutional floors F1-F13

---

## Invariants to Enforce

1. `actor_verified` has ONE source: session store
2. Read-only tools with `actor_verified=False` emit `verdict=OBSERVE_ONLY`, never `SEAL`
3. `VerdictCode` is deprecated; all code uses `SealType` (aka `Verdict`)
4. Authority is structured: `{human_authority, runtime_authority, mutation_allowed, seal_allowed, actor_verified}`
5. Every canonical tool has an affordance contract (no UNKNOWN for canonical 9)
6. Alias parity: `f(A) == B` and handler(A) == handler(B)
7. `transport_constraint` is surfaced in every forge_* affordance contract
8. No `stdio_only` tool called via Streamable HTTP (fail at affordance, not at execution)

---

*DITEMPA BUKAN DIBERI — The kernel is alive. Now make it clean.*
