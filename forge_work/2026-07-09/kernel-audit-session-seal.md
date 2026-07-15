# arifOS Kernel Audit — Session Seal 2026-07-09

> **DITEMPA BUKAN DIBERI — Forged, Not Given.**
> Session: OpenCode on af-forge | Actor: hermes → arif | Sovereign: ARIF_FAZIL

---

## Summary

Deep audit of arifOS kernel surface revealed the kernel is **one state machine wearing eleven costumes**. Every tool response shares ~90% identical payload structure (affordance_contract, full_affordance, nine_signal, sesat_event, metacognition, constitutional_check, decision_thresholds). The per-tool logic is small. The chaos isn't eleven bugs — it's one architectural gap expressed eleven times.

## Bugs Found & Fixed

### FIX 1: arif_triage preflight hardcoded authority (CRITICAL)
**File:** `kernel_canonical.py` lines 778-850
**Root cause:** `actor_verified: False` and `authority_mode: "OBSERVE_ONLY"` were literal constants. Tool imported `_SESSIONS` (used `len()` for count) but never called `.get(session_id)`.
**Effect:** `arif_init` wrote `actor_verified: true` → `arif_triage` returned `false` on same `session_id`.
**Fix:** Now looks up session from `_SESSIONS`, uses actual `actor_verified` and `authority`. Returns `SESSION_NOT_FOUND` HOLD if session_id doesn't exist. Passes `session_id` to `_ok` wrapper.

### FIX 2: _project_light SOVEREIGN gap (SECONDARY)
**File:** `session.py` line 452
**Root cause:** `_is_full_authority = _authority in ("FULL",)` — comment said "FULL/SOVEREIGN → all verbs" but code only checked FULL.
**Fix:** `_authority in ("FULL", "SOVEREIGN")`

### FIX 3: _ok wrapper session_id not passed
**File:** `kernel_canonical.py` line 848
**Root cause:** `_ok("arif_triage", preflight_payload)` without `session_id` → wrapper derived `actor_verified=False` from None lookup.
**Fix:** `_ok("arif_triage", preflight_payload, session_id=session_id)`

## Capability Token Module (BUILT, NOT YET WIRED)

**File:** `/opt/arifos/app/arifosmcp/runtime/capability_token.py` (572 lines)
**Spec:** `/root/A-FORGE/forge_work/2026-07-09/capability-token-spec.md` (290 lines)

7 functions, 7/7 self-tests pass:
- `sign_token()` / `verify_token()` — HMAC-SHA256 roundtrip, tamper rejection
- `derive_authority(G, C_dark, W3, profiles_ok, witness_div, id_verified, sig_verified, context_score)` — 8 hard gates, single source of truth
- `derive_verbs(authority)` — canonical verb list per authority level
- `apply_caveats()` — attenuation (narrow only, never widen)
- `compute_authority_delta()` — explicit trust change on every call
- `build_session_token()` — one-liner: all init context → signed token

## Fiqh Classification of Kernel Components

### WAJIB (non-negotiable)
- One verdict, one source of truth
- Identity persists unbroken from init through session
- Irreversible actions require SOVEREIGN + 888_HOLD (already holds)

### HARAM (must stop)
- Bare unstructured strings on hard-block paths
- Silent authority downgrade with no record
- Undeclared/orphaned inner tools (`arif_mind_reason`)
- Two+ verdict fields disagreeing in one payload

### HARUS (fine, don't fuss)
- Stage number prefixes
- Multiple aliases (if they resolve to one implementation)
- Malay-language state labels

### MAKRUH (trim it)
- Verbatim duplication of schema/thresholds in every response
- `arif_triage` as standalone + init mode + route alias (three paths, one name)
- 30s hard LLM timeout on `arif_critique` with no retry

### SUNAT (keep and extend)
- `sesat_event` — honest structured failure logging
- `nine_signal` three-plane decomposition
- 888_HOLD refusing insufficient authority

## Score Card

| Dimension | Current | After birth-fix | After full fix |
|---|---|---|---|
| Identity/session persistence | 2/10 | 6/10 | 9/10 |
| Single source of truth | 2/10 | 3/10 | 9/10 |
| Registry integrity | 4/10 | 4/10 | 8/10 |
| Failure honesty | 7/10 | 7/10 | 9/10 |
| Irreversible-action gating | 8/10 | 9/10 | 9/10 |
| Payload signal-to-noise | 3/10 | 3/10 | 7/10 |
| **Composite** | **26/60 (4.3)** | **32/60 (5.3)** | **51/60 (8.5)** |

## Ship Order (from sovereign)

1. **Honest dual-source birth** — session_birth = real `_authority` via `derive_authority()`, `arif_forge` only (not `arif_act`)
2. **Number or XCUT Memory + Compose** — tag Route vs Bridge posture
3. **pipeline_order on the public surface** — explicit tool ordering
4. **Real APEX only on judge/warrant** — never invent G at birth (now fixed by `derive_authority`)
5. **Signed capability token** — replace session_id lookup with bearer token
6. **One verdict field** — collapse `verdict`/`verdict_code`/`nine_signal.overall`
7. **Alias collapse** — one tool, one name, modes as param
8. **authority_delta on every response** — explicit trust change
9. **sesat_event always top-level** — never buried in meta

## Zen

*DITEMPA BUKAN DIBERI applies to the kernel too — right now it's given eleven names before it's forged one truth.*

---

Sealed: 2026-07-09 | Actor: OpenCode/hermes | Sovereign: ARIF_FAZIL
