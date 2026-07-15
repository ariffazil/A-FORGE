# Session Capability Token (SCT) — Spec v0.1

**Date:** 2026-07-09  
**Doctrine:** Inhabit, don't interrogate. Continuity is default.  
**Status:** SPEC — implement after F13 ack or sovereign “slice 1”  
**Amanah:** Extends existing HMAC sign/verify; no fake APEX; store becomes optional cache.

---

## 0. One sentence

`arif_init` mints a **signed capability token** that *carries* standing; every hop **verifies + may re-mint** that token — never re-looks-up trust from a store that might disagree.

---

## 1. Root pattern killed

| Bug class | How SCT kills it |
|-----------|------------------|
| L11 session-not-found | Verification is local to the token; store miss ≠ authority miss |
| Init/triage/observe desync | Authority lives *in* the token all three read |
| Silent FULL→OBSERVE_ONLY | `authority_delta` emitted when re-mint changes band |
| Dual path `_project_light` vs `SessionState` | Single mint function; both paths call it |
| Agent reverse-engineering G | `apex_scalars` inside token (measured or `UNMEASURED`) |

---

## 2. Existing substrate (do not reinvent)

| Piece | Path | Use |
|-------|------|-----|
| Sign | `runtime/session.py` `_sign_session_payload` | H2 blob.sig (HMAC-SHA256 truncated) |
| Verify | `_verify_session_token` | Same secret `ARIFOS_SESSION_SECRET` |
| Command-center twin | `apps/command_center/state.py` | Already mints `session_id, actor_id, iat, exp` |
| Store | `_FileSessionStore` / `_SESSIONS` | **Optional cache only** after SCT lands |
| L11 gate | `runtime/session_auth.validate_session` | Upgrade: accept SCT first, store second |

**Upgrade requirement (security):** full HMAC hex (32+ bytes), not 16-char truncate, when `sct_v=1`. Keep v0 verify for command-center until cutover.

---

## 3. Token format (SCT v1)

### 3.1 Wire shape

```
sct_v1.<base64url(payload_json)>.<hmac_sha256_hex>
```

- Prefix makes versioning and debugging trivial for agents.
- Payload is **compact JSON**, sorted keys, no whitespace (same as today).
- Signature over the **base64url payload string** (constant-time compare).

### 3.2 Payload schema (claim set)

```json
{
  "sct_v": 1,
  "sid": "SEAL-…",
  "actor": "arif",
  "auth": "OBSERVE_ONLY | LIMITED_MUTATE | FULL | SOVEREIGN",
  "av": true,
  "stage": "000",
  "lane": "AGI",
  "iat": 1720000000,
  "exp": 1720003600,
  "ttl": 3600,
  "verdict": {
    "state": "OK | SEAL | SABAR | HOLD | VOID | OBSERVE_ONLY | SYUBHAH | RETAK",
    "dominant_reason": "string | null"
  },
  "apex": {
    "G": "UNMEASURED | number",
    "C_dark": "UNMEASURED | number",
    "W3": "UNMEASURED | number",
    "h": "UNMEASURED | number"
  },
  "witness": {
    "active": 0,
    "diversity": "NONE | PARTIAL | FULL"
  },
  "allowed": ["arif_observe", "arif_think", "arif_route"],
  "kid": "default",
  "nbf": 1720000000
}
```

**Hard rules**

1. `auth` is the **only** authority band. No parallel `authority_mode` / `authority_scope` that can disagree.
2. `verdict.state` is the **only** verdict. `verdict_code`, `nine_signal.overall` derive or are omitted.
3. `apex.*` is never invented: number only if `compute_apex` (or real primitive source) ran; else `"UNMEASURED"`.
4. Token size target: **≤ 2 KB** after base64. No constitution text, no tool dumps, no soul profiles.
5. Caveats (macaroon-style attenuation, later): optional `caveats: ["ttl<3600", "auth<=LIMITED_MUTATE"]` — **attenuation only, never escalation**.

### 3.3 Response envelope fields (every tool)

```json
{
  "session_id": "SEAL-…",
  "session_token": "sct_v1.…",
  "authority": "LIMITED_MUTATE",
  "actor_verified": true,
  "verdict": { "state": "…", "dominant_reason": "…" },
  "apex_scalars": { "G": "UNMEASURED", "C_dark": "UNMEASURED", "W3": "UNMEASURED", "h": "UNMEASURED" },
  "authority_delta": null,
  "sesat_event": null
}
```

On trust change:

```json
"authority_delta": {
  "from": "FULL",
  "to": "LIMITED_MUTATE",
  "reason": "signature_not_verified | profile_degraded | floor_hold | ttl_half_life"
}
```

On failure (always top-level if not success):

```json
"sesat_event": {
  "severity": "YELLOW | ORANGE | RED",
  "failure_code": "JALAN_KUASA | …",
  "malu_delta": 0.2,
  "tebus_required": true,
  "blocked_actions": ["claim_success"]
}
```

---

## 4. Lifecycle

```
arif_init
  → build claim set from identity + authority band + apex (honest)
  → mint SCT
  → optionally cache row in store (sid → last_claims)  [non-authoritative]
  → return session_token + session_id

arif_* (observe | think | route | judge | forge | seal | triage)
  → accept session_token (preferred) OR session_id (legacy, deprecation window)
  → verify_sct(token):
       sig OK? exp OK? actor match?
  → standing := claims in token   # inhabit
  → run tool under standing.auth + standing.allowed
  → if standing changes: re-mint attenuated/upgraded token + authority_delta
  → always return fresh session_token for next hop
```

**Legacy window:** `session_id` alone → store lookup (current path) + emit warning  
`deprecation: "pass session_token; session_id-only expires YYYY-MM-DD"`.

---

## 5. Verification middleware

**Single function** (canonical home: `runtime/session_auth.py`):

```python
def resolve_standing(
    session_token: str | None,
    session_id: str | None,
    actor_id: str | None,
    tool: str,
    mode: str | None = None,
) -> Standing:
    """
    Returns Standing(valid, claims, reason, source="sct"|"store"|"ephemeral"|"deny")
    Priority: SCT verify → store rehydrate → ephemeral read-only (sense only) → deny
    """
```

Wire into:

| Tool | Today | After |
|------|-------|-------|
| `arif_observe` | `validate_session` | `resolve_standing` first |
| `arif_triage` | `_SESSIONS.get` | same |
| `arif_route` / bridge | mixed | same |
| `arif_judge` / forge / seal | mixed | same; forge/seal require `auth in FULL|SOVEREIGN` **and** non-UNMEASURED floors as already law |

**Ephemeral read-only:** keep for `observe` modes without token *only if* `actor_id` present and mode is pure sense — must **not** mint a FULL/LIMITED token; return `source=ephemeral` and no upgrade.

---

## 6. One mint, no dual birth

Today’s split:

- `_project_light()` builds one birth shape  
- `SessionState` / init handler rebuilds another  

**Law:** only `mint_session_capability(claims) -> (token, public_header)` may construct birth fields.  
`_project_light` and `SessionState` **call** it; they do not invent `session_birth.authority_mode`.

---

## 7. Slice plan (implement order)

### Slice 1 — Continuity spine (this week)

1. `runtime/sct.py`: `mint_sct`, `verify_sct`, `Standing`, claim schema  
2. `arif_init` returns `session_token`  
3. `validate_session` → `resolve_standing` (SCT first)  
4. `arif_observe` + `arif_triage` accept `session_token`  
5. Response always echoes next `session_token`  
6. Tests: init→triage→observe **without** store (delete row mid-flight; SCT still works)  
7. Honest `apex` = all `UNMEASURED` at birth unless real compute runs  

### Slice 2 — Single verdict + delta

1. Collapse projection to `verdict.state` + `dominant_reason`  
2. Emit `authority_delta` on any band change  
3. Top-level `sesat_event` on every non-OK  

### Slice 3 — Alias collapse

1. Public surface: one name per verb; aliases internal only  
2. `tool.mode` only  

### Slice 4 — Attenuation caveats (true macaroon)

1. Downstream can only **narrow** auth / TTL / allowed tools  
2. Never widen without new init + crypto proof  

---

## 8. Threat model (short)

| Threat | Mitigation |
|--------|------------|
| Stolen token | Short TTL + refresh; optional bind to client fingerprint later |
| Escalation via edit | HMAC; reject unsigned / bad sig |
| Replay after seal | `exp` + optional `jti` denylist on VOID/seal |
| Fake APEX in token | Kernel only mints; agents cannot mint; numbers only from measured path |
| Secret default `fallback-ephemeral-secret` | **P0:** require `ARIFOS_SESSION_SECRET` in prod; refuse mint if fallback |

---

## 9. Acceptance tests (Slice 1)

1. `init` → token present, `verify_sct` round-trips claims.  
2. Drop `_SESSIONS[sid]`; `observe(session_token=…)` still OK.  
3. Mutate token payload without re-sign → HOLD / RETAK, `sesat_event` top-level.  
4. `actor` mismatch → HOLD, reason explicit.  
5. Expired token → SABAR/HOLD, not silent OBSERVE.  
6. No invented G: birth `apex.G == "UNMEASURED"`.  
7. `allowed` never contains `arif_act`; only public names.  

---

## 10. Non-goals (Slice 1)

- Full third-party macaroon library  
- Ed25519 multi-party caveats (later; align with actor keys)  
- Replacing VAULT999 seals  
- Computing real G at init without action evidence  

---

## 11. Decision

| Option | Recommendation |
|--------|----------------|
| Keep patching `_project_light` / dual stores | Reject as primary strategy |
| SCT Slice 1 | **Accept** — keystone for inhabit model |
| Fake apex_scalars to “fill the field” | **Reject** (F2) |

**Next implement step:** `runtime/sct.py` + wire `arif_init` mint + `resolve_standing` on observe/triage.

---

*DITEMPA — continuity as law, not hope.*
