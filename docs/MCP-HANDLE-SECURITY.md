# MCP Handle Security Model

> **Date:** 2026-09-04 | **Author:** 333-AGI | **Status:** DESIGN
> **Threat model:** Handle hijacking, replay, scope escalation, disclosure

---

## 1. Problem

MCP 2026-07-28 is stateless. Server-minted workflow handles are passed as ordinary tool arguments. The LLM sees them, holds them, threads them between tool calls. This makes handles:
- **Visible** to the model (and anything reading the conversation)
- **Bearer-like** (anyone with the string can use it)
- **Replayable** (unless designed otherwise)

---

## 2. Handle Format

```
wf.v1.<256-bit-opaque-random>.<HMAC-SHA256-signature>
```

Example:
```
wf.v1.a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1.hMAC-signature-here
```

### 2.1 Components

| Component | Size | Purpose |
|-----------|------|---------|
| Version prefix | `wf.v1.` | Handle format version |
| Opaque random | 256 bits | Non-enumerable, unguessable |
| HMAC signature | 256 bits | Integrity + authenticity |

### 2.2 What's in the Signature

```python
signature = HMAC-SHA256(
    key=server_secret,
    message=f"{handle_id}|{principal}|{scope_hash}|{expires_at}|{organ}"
)
```

---

## 3. Handle Envelope (Server-Side Ledger)

```json
{
  "handle_id_hash": "sha256:a3f8...",
  "handle_version": "v1",
  "issuer_organ": "aforge",
  "audience_organ": "geox",
  "authenticated_principal": "333-AGI",
  "delegated_actor": null,
  "capability_scope": ["geox:read", "geox:compute"],
  "scope_hash": "sha256:...",
  "expires_at": "2026-09-04T15:00:00Z",
  "ttl_seconds": 3600,
  "replay_policy": "single-use",
  "request_state_hash": "sha256:...",
  "approval_state": "auto-approved",
  "revoked": false,
  "revocation_reason": null,
  "correlation_trace_id": "trc-...",
  "created_at": "2026-09-04T14:00:00Z",
  "last_used_at": null,
  "use_count": 0
}
```

---

## 4. Security Properties

| Property | Mechanism |
|----------|-----------|
| **Non-enumerable** | 256-bit random ID |
| **Integrity** | HMAC-SHA256 signature |
| **Scoped** | Explicit capability grants per handle |
| **Expiring** | TTL enforced server-side |
| **Actor-bound** | Principal embedded in signature |
| **Audience-bound** | Only target organ can consume |
| **Revocable** | Server-side revocation ledger |
| **Replay-resistant** | Single-use policy option |
| **Traceable** | OTel correlation ID |

---

## 5. What NOT to Embed in Handles

| Category | Risk | Alternative |
|----------|------|-------------|
| Raw credentials | Disclosure → credential theft | Reference credential by ID |
| Filesystem paths | Disclosure → path traversal | Capability-scoped resource URI |
| Internal URLs | Disclosure → SSRF | Service mesh routing |
| SQL fragments | Disclosure → injection | Parameterized query ID |
| User PII | Disclosure → privacy violation | Pseudonymous actor ID |
| High-authority tokens | Disclosure → privilege escalation | Scoped delegation token |

---

## 6. Request Flow

```
Client → tools/call(handle_id=wf.v1.xxx.yyy, ...)
  │
  ├─ Server extracts handle_id from arguments
  ├─ Look up handle in ledger by handle_id_hash
  ├─ Validate:
  │    ├─ Not expired
  │    ├─ Not revoked
  │    ├─ Signature valid
  │    ├─ Principal matches auth token
  │    ├─ Scope includes requested operation
  │    ├─ Audience matches this organ
  │    └─ Replay policy allows (single-use → check use_count)
  ├─ If valid: execute tool, increment use_count
  └─ If invalid: reject with specific error
```

---

## 7. Integration with arifOS ACT

Handles complement (don't replace) Arif's Capability Token (ACT):

| Layer | Token | Scope |
|-------|-------|-------|
| **Session** | ACT (arifOS) | Actor identity, authority band, constitutional floors |
| **Workflow** | Handle (A-FORGE) | Specific tool invocation, scoped, expiring |
| **Request** | Auth header | Per-request authentication |

ACT governs "who can do what." Handle governs "this specific invocation of this specific tool."

---

## 8. OTel Integration

Per MCP 2026-07-28 spec, `_meta` supports OpenTelemetry propagation:

```json
{
  "_meta": {
    "traceparent": "00-trace-id-span-id-01",
    "tracestate": "arifos=...",
    "baggage": "handle_id=wf.v1.xxx.yyy"
  }
}
```

Every handle use creates a span linked to the parent trace.

---

*Design only. No production mutation.*
