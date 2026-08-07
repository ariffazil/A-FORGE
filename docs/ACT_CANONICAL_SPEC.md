# SCT CANONICAL SPEC — Session Capability Token v1

**Status:** RATIFIED (observed from live issuer)  
**Version:** 1  
**Forged:** 2026-07-29  
**Authority:** arifOS kernel (port 8088)  

---

## 1. Wire Format

```
sct_v1.<base64url(payload_json)>.<hmac_sha256_hex>
```

### Segment Rules

| Segment | Encoding | Notes |
|---------|----------|-------|
| `sct_v1` | Literal ASCII | Fixed prefix, version indicator |
| `payload_b64` | Base64URL (no padding) | `sort_keys=True, separators=(",",":")` |
| `sig` | Hex string | Full HMAC-SHA256 hex digest (64 chars) |

**Token MUST have exactly 3 segments separated by `.`**  
**Prefix MUST be `sct_v1`**  
**Signature length MUST be ≥ 16 chars (truncation floor)**

### Legacy Format (verify-only, never mint)

```
arifos.v1.<b64>.<b64sig>
```

Accepted during verification only. Converted to sct_v1 claims. Never issued.

---

## 2. Algorithm

| Property | Value |
|----------|-------|
| **Algorithm** | HMAC-SHA256 |
| **Key source** | `ARIFOS_SESSION_SECRET` env var → `ARIFOS_SESSION_SECRET_FILE` → `/opt/arifos/app/.signing_key` → `~/.arifos/signing_key` |
| **Key format** | 32-byte binary OR UTF-8 text |
| **Key length** | Production: 32 bytes (binary) or ≥ 16 chars (text) |
| **Signature encoding** | Hex-encoded (lowercase), full digest |
| **Constant-time** | `hmac.compare_digest()` (Python) / `crypto.timingSafeEqual()` (Node) |

### Dev Mode

In non-strict dev mode only, if no key is configured, a per-process random key is generated.  
**Dev tokens are NOT valid across processes or restarts.**

---

## 3. Claims (sorted alphabetically, compact JSON)

| Claim | Type | Required | Description |
|-------|------|----------|-------------|
| `sct_v` | int | YES | Token version (must be 1) |
| `sid` | string | YES | Session ID |
| `actor` | string | YES | Canonical actor ID (normalized lowercase) |
| `auth` | string | YES | Authority band: OBSERVE_ONLY, LIMITED_MUTATE, FULL, SOVEREIGN |
| `av` | bool | YES | Actor verified flag |
| `stage` | string | YES | Pipeline stage: "000" |
| `lane` | string | YES | Execution lane: "AGI" |
| `iat` | int | YES | Issued-at timestamp (Unix epoch seconds) |
| `exp` | int | YES | Expiry timestamp (Unix epoch seconds) |
| `ttl` | int | YES | Time-to-live in seconds |
| `nbf` | int | YES | Not-before timestamp (Unix epoch seconds) |
| `kid` | string | YES | Key ID (currently "default") |
| `verdict` | object | YES | `{state: "OK", dominant_reason: null}` |
| `apex` | object | YES | `{G, C_dark, W3, h}` — "UNMEASURED" or numeric |
| `witness` | object | YES | `{active: int, diversity: "PARTIAL"/"NONE"/"FULL"}` |
| `allowed` | array | YES | List of permitted verb strings |

---

## 4. Authority Bands

| Band | Rank | Verbs |
|------|------|-------|
| `OBSERVE_ONLY` | 0 | arif_init, arif_observe, arif_think, arif_route |
| `LIMITED_MUTATE` | 1 | + arif_memory, arif_judge, arif_forge |
| `FULL` | 2 | + arif_seal |
| `SOVEREIGN` | 3 | + all (F13 override) |

---

## 5. Identity Normalization

### Canonical Function

```python
def normalize_actor_id(raw: str) -> str:
    return raw.strip().lower()
```

### Rules

- Actor IDs are **lowercase machine identifiers** (e.g., `arif`, `opencode`, `hermes`)
- Display names are **separate** (e.g., `ARIF`, `OpenCode`, `Hermes`)
- Comparison is **case-insensitive** after normalization
- Both `actor` (sct.py) and `actor_id` (McpPolicyGate) claim keys must be handled
- The canonical claim key is `actor`

---

## 6. Validation Order

1. **Format**: 3 segments, `sct_v1` prefix — reject malformed
2. **Signature**: HMAC-SHA256 with `ARIFOS_SESSION_SECRET`, constant-time comparison
3. **Version**: `sct_v` must be 1
4. **Expiry**: `now > exp` → reject
5. **Not-before**: `now < nbf` → reject
6. **Issued-at**: `now < iat - CLOCK_SKEW` → reject (future tokens)
7. **Actor**: Canonicalized comparison (if expected_actor provided)
8. **Authority**: Rank check (SCT authority ≥ required authority)
9. **Allowed verbs**: Check requested verb in allowed list

---

## 7. Error Taxonomy

| Error Code | Meaning |
|------------|---------|
| `ERR_SCT_MALFORMED` | Wrong segment count or prefix |
| `ERR_SCT_SIGNATURE_SHORT` | Signature < 16 hex chars |
| `ERR_SCT_SIGNATURE_INVALID` | HMAC mismatch |
| `ERR_SCT_NO_SECRET` | ARIFOS_SESSION_SECRET not configured |
| `SCT_MISSING` | No token provided |
| `SCT_EXPIRED` | Token past expiry |
| `SCT_NOT_YET_VALID` | Token before nbf |
| `SCT_VERSION` | Unsupported version |
| `SCT_AMBIGUOUS` | Multiple distinct tokens from different sources |
| `SCT_REQUIRED` | Token required but absent |
| `ACTOR_MISMATCH` | SCT actor ≠ caller |
| `INSUFFICIENT_AUTHORITY` | SCT authority rank < required rank |
| `UNKNOWN_AUTHORITY` | Authority band not recognised |

---

## 8. Key Resolution

```
Priority order:
1. ARIFOS_SESSION_SECRET (env var)
2. ARIFOS_SESSION_SECRET_FILE → read contents
3. /opt/arifos/app/.signing_key (32-byte binary)
4. ~/.arifos/signing_key (32-byte binary or text)
5. STRICT mode: raise RuntimeError
6. DEV mode only: per-process random key (not cross-process valid)
```

---

## 9. Known Limitations

| ID | Limitation | Mitigation |
|----|-----------|------------|
| L1 | 64-bit HMAC truncation at A-FORGE verifier | Upgrade both sides to full 64-char HMAC |
| L2 | No replay protection (no `jti` or `nonce`) | Short TTL (3600s default), SCT_AMBIGUOUS gate |
| L3 | `kid` always "default" — no key rotation | Documented; future upgrade path |
| L4 | McpPolicyGate uses separate `organSecret` ecosystem | Align or document divergence explicitly |
| L5 | Dev mode tokens not valid across processes | Strict mode enforced in production |

---

## 10. Issuer-Verifier Contract

| Property | Issuer (arifOS sct.py) | Verifier (A-FORGE sctIngress.ts) |
|----------|------------------------|----------------------------------|
| Secret | ARIFOS_SESSION_SECRET | ARIFOS_SESSION_SECRET |
| Algorithm | HMAC-SHA256 | HMAC-SHA256 |
| Digest | hexdigest() (full 64 chars) | hex.slice(0,16) (first 16 chars) |
| Comparison | hmac.compare_digest | crypto.timingSafeEqual |
| Actor key | "actor" (normalized) | "actor" or "actor_id" (case-insensitive) |
| Prefix | sct_v1 | sct_v1 |
| Version | sct_v==1 | sct_v==1 |

**Both sides MUST share ARIFOS_SESSION_SECRET.**  
**Truncation is at the verifier; issuer produces full digest.**

---

## 11. Migration Strategy

### Current → Target

| Phase | Action |
|-------|--------|
| **Phase 0** (DONE) | HMAC verification added to verifier |
| **Phase 1** (DONE) | Case-insensitive actor normalization |
| **Phase 2** (PLANNED) | Upgrade both sides to full 64-char HMAC |
| **Phase 3** (PLANNED) | Add `jti`/`nonce` for replay protection |
| **Phase 4** (PLANNED) | Add `kid`-based key rotation |
| **Phase 5** (FUTURE) | Evaluate Ed25519 migration path |

---

*DITEMPA BUKAN DIBERI — Forged from observed reality, not spec.*
