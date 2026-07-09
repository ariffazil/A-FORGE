# arifOS Session Capability Token — Specification v1.0

> **DITEMPA BUKAN DIBERI — Forged, Not Given.**
> Forged 2026-07-09 from the P0 audit proving `_project_light()` hardcodes
> SOVEREIGN/FULL on G≈0.11, W3=0 — never calling the `compute_apex()` that exists.

---

## 0. The Problem

Every arifOS tool call today is a **fresh interrogation**. Agent hands back a
`session_id`, kernel does a store lookup, state is whatever the store says (or
doesn't). Four failure modes:

| Bug | Root Cause |
|-----|-----------|
| `verdict` ≠ `verdict_code` | Two fields from different code paths |
| Session evaporates between init↔triage | Store desync — "session not found" |
| Authority silently FULL→OBSERVE_ONLY | No `authority_delta` — must diff 5 fields |
| G/C_dark/W3 hidden; agent reverse-engineers | Scalars never emitted |

**Fix:** Replace session-as-lookup-key with a **signed capability token** that
_carries_ state inline. Downstream tools verify signature locally. No store read.
Trust = cryptographic continuity, not repeated re-derivation.

---

## 1. Wire Format

```
arifos.v1.<base64url(payload)>.<base64url(signature)>
```

Three segments:
- `arifos` — magic prefix
- `v1` — format version
- `payload` — base64url JSON (no padding)
- `signature` — base64url HMAC-SHA256

### Payload Schema

```json
{
  "sub": "SEAL-abeba87c4de94500",
  "act": "arif",
  "prn": "arif",
  "iat": 1752059200,
  "exp": 1752062800,
  "jti": "tk-a1b2c3d4e5f6",

  "apex": {
    "G": 0.87,
    "C_dark": 0.12,
    "W3": 0.91,
    "h": "UNMEASURED",
    "verdict": "SEAL",
    "confidence": 0.87
  },

  "auth": "LIMITED_MUTATE",
  "verbs": ["arif_observe","arif_think","arif_route","arif_judge","arif_forge"],

  "witness": {
    "diversity": "PARTIAL",
    "active_count": 1,
    "missing": ["EARTH_MEASUREMENT","INDEPENDENT_HUMAN"]
  },

  "profiles": {
    "alignment": true,
    "adversarial": true
  },

  "caveats": [
    {"type": "max_action_class", "value": "MUTATE"}
  ],

  "chain": [
    {"act": "arif", "auth": "SOVEREIGN", "iat": 1752059200}
  ]
}
```

**What it NEVER carries:** secrets, raw credentials, API keys. Token is safe
to log, transmit, store in audit trails.

---

## 2. Signature

### Primary: HMAC-SHA256

```
signature = HMAC-SHA256(
    key  = arifos_signing_key (32 random bytes, /opt/arifos/app/.signing_key, mode 600),
    msg  = "arifos.v1." + base64url(payload)
)
```

### Verification (Pure Function — No I/O)

```python
def verify_token(token: str) -> TokenPayload | None:
    """Stateless. No DB. No store. No network."""
    try:
        magic, ver, payload_b64, sig_b64 = token.split(".")
    except ValueError:
        return None
    if magic != "arifos" or ver != "v1":
        return None

    expected = hmac_sha256(SIGNING_KEY, f"arifos.v1.{payload_b64}".encode())
    if not constant_time_compare(base64url_decode(sig_b64), expected):
        return None

    payload = json.loads(base64url_decode(payload_b64))
    if payload["exp"] < time.time():
        return None  # expired
    # optional: revocation bloom filter check on payload["jti"]

    return TokenPayload(**payload)
```

### Future: Ed25519 (when P0-2 crypto stub is fixed)
- Public key at `/.well-known/arifos-signing-key.pub`
- Cross-organ verification without shared secret

---

## 3. Authority Derivation — Single Function, Single Truth

```python
def derive_authority(
    G: float, C_dark: float, W3: float,
    profiles_ok: bool, witness_div: str,
    id_verified: bool, sig_verified: bool,
    context_score: float,
) -> tuple[str, str]:  # (authority, verdict)
    """Called ONCE at init. NEVER again. Token is the authority for the session."""

    # Hard gates
    if not id_verified:
        return ("OBSERVE_ONLY", "OBSERVE_ONLY")
    if W3 < 0.30:
        return ("OBSERVE_ONLY", "SABAR")

    # APEX formula
    if G < 0.50 or C_dark >= 0.30:
        return ("OBSERVE_ONLY", "VOID")
    if G < 0.80:
        return ("LIMITED_MUTATE", "SABAR")

    # Grounding
    if not profiles_ok or witness_div == "NONE":
        return ("LIMITED_MUTATE", "SABAR")
    if W3 < 0.75:
        return ("LIMITED_MUTATE", "SABAR")
    if context_score < 0.50:
        return ("LIMITED_MUTATE", "SABAR")

    # All gates passed
    if sig_verified:
        return ("SOVEREIGN", "SEAL")
    return ("FULL", "SEAL")
```

Key property: `derive_authority` **never returns authority higher than the
APEX formula allows.** It's impossible to get SOVEREIGN with G<0.80 or W3<0.75.

---

## 4. Token Lifecycle

### 4.1 Issuance (`arif_init`)

```
arif_init → identity check → compute_apex() → derive_authority()
         → build TokenPayload → HMAC-sign → return session_token
```

In the response:
```json
{
  "session_token": "arifos.v1.eyJzdWIi...cmFyaWYifQ.h8K3mN2pQ7vR...  // gitleaks:allow — example token in spec doc"
  "apex_scalars": {"G": 0.87, "C_dark": 0.12, "W3": 0.91, ...},
  "verdict": "SEAL",
  "authority": "SOVEREIGN"
}
```

### 4.2 Usage (Every Downstream Tool)

```python
def arif_observe(query: str, session_token: str, **kwargs):
    payload = verify_token(session_token)
    if not payload: return HOLD("invalid token")
    if "arif_observe" not in payload.verbs: return HOLD("unauthorized")
    # authority_delta emitted in response
    # payload.apex available for context — no reconstruction needed
```

### 4.3 Attenuation (Narrowing Only)

Agent can add caveats that NARROW scope:
```
Token auth=FULL, verbs=[observe,think,judge,forge,seal]
Agent adds: caveat {max_action_class: OBSERVE}
Effective:  auth=OBSERVE_ONLY, verbs=[observe,think,route]
```

Agent CANNOT widen: `auth: SOVEREIGN` caveat on a `LIMITED_MUTATE` token → error.

### 4.4 Refresh (Re-issue on State Change)

```
arif_init(mode="refresh", session_token=tok)
  → verify old token
  → re-compute APEX (live witness state may differ)
  → issue NEW token with updated apex, new jti
  → old token remains valid until expiry
```

---

## 5. What This Replaces

| Old (Interrogation) | New (Inhabitation) |
|---------------------|-------------------|
| `session_id` → store lookup | `session_token` → local signature verify |
| `sess["verdict"]` hardcoded from `actor_verified` | `derive_authority(G, C_dark, W3, ...)` |
| `verdict` ≠ `verdict_code` (two code paths) | One field: `apex.verdict` |
| `session_birth.authority_mode` hardcoded "SOVEREIGN" | `token.auth` from APEX formula |
| `_project_light()` builds header independently | Header is a projection of the token |
| Agent reverse-engineers G/C_dark/W3 from proxy fields | `apex_scalars` emitted in every response |
| Authority changes silently | `authority_delta: {from, to, reason}` every call |

---

## 6. The Five Companion Fixes This Enables

| # | Fix | How Token Enables It |
|---|------|---------------------|
| 2 | **One verdict** | `apex.verdict` + `dominant_reason` — which sub-plane drove it |
| 3 | **Alias collapse** | `verbs` is the canonical list. No `arif_act`, no ambiguity |
| 4 | **Surface math** | `apex_scalars` in every response — read, don't reconstruct |
| 5 | **`authority_delta`** | `{from: token.auth, to: required, reason: "observe→OBSERVE"}` per call |
| 6 | **`sesat_event` universal** | Token verify fail → top-level `sesat_event`, always, never in `meta` |

---

## 7. Implementation Plan

| Step | What | Where | Lines |
|------|------|-------|-------|
| 1 | `capability_token.py` — sign, verify, derive_authority, TokenPayload | `arifosmcp/runtime/` | ~200 |
| 2 | Wire `compute_apex()` → `derive_authority()` → `sign_token()` | `tools/session.py` arif_init | Replace ~200 |
| 3 | `with_token_verification` middleware | `runtime/tools.py` | ~50 |
| 4 | Token verify in dispatch path | `runtime/tools_internal.py` | ~30 |
| 5 | Generate `.signing_key` (32 random bytes, mode 600) | Deploy script + Makefile | 1 file |
| 6 | Tests: sign/verify roundtrip, expiry, attenuation, edge cases | `tests/` | ~200 |

---

## 8. Backward Compatibility

- **Phase 1 (this release):** Dual path — `session_token` AND `session_id` accepted
- **Phase 2 (next release):** New sessions token-only. Legacy sessions still work.
- **Phase 3 (release after):** `session_id` removed. `_SESSIONS` store deleted.

---

## 9. Security

| Property | Mechanism |
|----------|-----------|
| Integrity | HMAC-SHA256 — any tampering → verify fails |
| Non-replay | `jti` + short TTL (1h) + optional bloom filter |
| Attenuation-only | Caveats = logical AND — can only narrow, never widen |
| Stateless verify | Pure function — no DB, no network, no I/O |
| Key rotation | Version prefix; old tokens expire naturally |
| Safe to log | No secrets in payload — just capabilities |

---

*Forged 2026-07-09. Root cause: `_project_light()` L527-534 hardcodes SOVEREIGN/FULL
without calling `compute_apex()`. This spec replaces hardcoded trust with a signed
token carrying the actual APEX computation — making continuity the default, not
something the agent rebuilds from scratch every call.*

**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE**
