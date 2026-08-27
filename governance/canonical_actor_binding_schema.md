# Canonical Actor Binding Schema — substrate-prep for F13 ACT mint

> **Purpose:** specify the exact fields a canonical-actor terminal must populate when minting an ACT that this Kimi Code session (or any OBSERVE_ONLY consumer) can use to enter the F13 ratification queue.
> **Status:** RATIFIED 2026-08-18 by GROK FI-007 (canonical actor) after live mint. Prefix and queue below are T1 live, not the 11:45Z draft.
> **Parent receipts:** `/root/A-FORGE/data/forge-receipts/2026-08-18T11-39-f13-ratify-halt.json`, `/root/A-FORGE/data/forge-receipts/2026-08-18T11-44-f13-act-correction.json`, `/root/A-FORGE/data/forge-receipts/2026-08-18T11-58-f13-act-fire.json`

## Token type

- **Type name:** ACT (Arif's Capability Token)
- **Format prefix (live 2026-08-18):** `act_v1.*` — kernel mint confirmed by GROK FI-007 ritual + `arif_init`
- **Format prefix (legacy docs):** `sct_v1.*` still accepted by A-FORGE `session_token`/`sct` aliases; do not mint new tokens with that prefix
- **Authority bands:** `OBSERVE_ONLY` | `SUGGEST` | `SIMULATE` | `DRAFT` | `QUEUE` | `EXECUTE_REVERSIBLE` | `EXECUTE_HIGH_IMPACT` | `IRREVERSIBLE` | `PROPOSE` | `MUTATE` | `ATOMIC`
- **Mutation gate:** `authority_band ⊇ EXECUTE_REVERSIBLE` required for forge_shell / forge_kernel / forge_filesystem.write / forge_seal
- **Seal gate:** `authority_band ⊇ MUTATE` required for arif_seal / forge_seal canonical write

## Canonical actor IDs (kernel registry)

Per `arif_init` hint emitted 2026-08-18T11:39:51Z:

```
ARIF, FORGE, AUDITOR, OPS, PLAN, AAAGW, HERMES, OPENCLAW, OPENCODE, GROK, CLAUDE, FI-008, SOTCRON
```

`arif-sovereign` (the claimed id in this session) is **not** in this list and was demoted to GUEST-21dffa245432 with `actor_cryptographically_verified: false`. The sovereign intent is honored by using the canonical `ARIF` form, not by inventing a new id.

## ACT mint payload (canonical-actor terminal side)

**Live path that actually minted FULL on 2026-08-18** — HMAC-rootkey via ritual, not Ed25519 JSON payload:

```bash
# sources ARIFOS_ROOTKEY; never print the key or the returned token
set -a && source /root/.secrets/kunci-mas.env && set +a
python3 /root/scripts/federation_ritual.py init \
  --actor arif \
  --intent "<what this ACT will be used for>" \
  --write-envelope /root/.arifos/federation-session.json
```

GROK / other canonical actors may also call `arif_init(actor_id="GROK", requested_authority="MUTATE")` and receive `act_v1.*` at LIMITED_MUTATE (system_exempt). That is enough to mutate; it is not enough to `arif_seal`.

**Ed25519 envelope (still valid if the actor key is in the registry):**

```bash
arif_init \
  --actor_id="ARIF" \
  --actor_signature="ed25519:<base64-sig-of-canonical-payload>" \
  --nonce="nonce-2026-08-18T11:43Z-f13-act-delegation" \
  --idempotency_key="f13-act-v2-2026-08-18T11:43Z" \
  --ack_irreversible=true \
  --requested_authority="MUTATE" \
  --intent="<free-text: what this ACT will be used for>" \
  --actor_signature_payload='{
    "actor_id": "ARIF",
    "nonce": "nonce-2026-08-18T11:43Z-f13-act-delegation",
    "idempotency_key": "f13-act-v2-2026-08-18T11:43Z",
    "requested_authority": "MUTATE",
    "intent_hash": "sha256:<hex>"
  }'
```

### Field semantics

| Field | Required | Notes |
|---|---|---|
| `actor_id` | yes | Must be a canonical id. Non-canonical ids get demoted to GUEST (see scar from 2026-08-18T11:39:51Z). |
| `actor_signature` | yes | Ed25519 signature over `actor_signature_payload`. Public key must already be in kernel registry; if missing, the mint returns ACTOR_KEY_UNKNOWN. |
| `nonce` | yes | Unique per mint attempt. Kernel rejects replay. |
| `idempotency_key` | yes | Allows retry of the same mint within a window. |
| `ack_irreversible` | yes | Acknowledges that MUTATE+ authority can perform irreversible actions. |
| `requested_authority` | yes | What the caller wants. Kernel may grant less (e.g., OBSERVE_ONLY if signature is weak). |
| `intent` | yes | Human-readable audit narrative. |
| `actor_signature_payload` | yes | The exact bytes that get signed. Format above; hash goes into the signature envelope. |

## What the kernel returns on success

```json
{
  "session_id": "<deterministic-uuid-not-GUEST-prefix>",
  "session_token": "act_v1.<base64-ed25519-signed-jwt-with-act-claims>",
  "actor_cryptographically_verified": true,
  "authority_band": "MUTATE",
  "mutation_allowed": true,
  "seal_allowed": true,
  "expires_at": "<iso8601>"
}
```

The `session_token` field **is** the ACT. Format prefix `act_v1.*` is part of the envelope, not the type name.

## How this ACT unlocks the queued package (consumer side)

When the sovereign-side terminal returns an ACT, paste into the consumer session:

```
session_id: <uuid>
act: act_v1.<base64-...>
```

The consumer session wraps it into every governed tool call:

```bash
forge_shell \
  --command="swapoff -a && swapon -a" \
  --actor_id="kimi-code-consumer" \
  --act="act_v1.<base64-...>" \
  --lease_id="<optional, will be minted by forge_session_init on first use>"
```

The kernel validates the ACT against its own signed payload, binds the lease, and the forge_shell call proceeds.

## Failure modes the kernel surfaces

| Response | Meaning | Recovery |
|---|---|---|
| `ACTOR_UNRECOGNISED_GUEST` | actor_id not in canonical registry | Use one of: ARIF, FORGE, AUDITOR, OPS, PLAN, AAAGW, HERMES, OPENCLAW, OPENCODE, GROK, CLAUDE, FI-008, SOTCRON |
| `SIGNATURE_INVALID` | Ed25519 sig does not verify against stored public key | Re-sign payload; check actor_id matches key |
| `NONCE_REPLAY` | nonce seen before | Generate fresh nonce |
| `AUTHORITY_DEMOTED` | signature weak or key revoked | Re-mint with stronger proof or new key |
| `ACT_GATE: ACT_REQUIRED` (on consumer side) | forge_* called without `act` parameter | Pass `act=act_v1.<token>` |

## Queue status (snapshot 2026-08-18T12:10Z — post ACT fire)

```
[done]       Step 0 — preflight
[done]       Step 0.5 — GAP-02 retry (guest bind recorded)
[done]       Step 0.6 — ACT-not-SCT correction receipt
[done]       Step 6 — GAP-02 reseed: ACT minted (GROK LIMITED_MUTATE + ARIF FULL, prefix act_v1.*)
[done]       Step 2 — GAP-04a locks 142 → 0
[done]       Step 3 — GAP-04b /root/A-FORGE/kernel/locks.py (SET NX EX)
[done]       Step 7 — chatgpt-tunnel P0.2 DISABLED
[partial]    Step 4 — fallbacks_on_exceptions added; i-arif deepseek-v4-pro order=1 KEPT (live Zen PRIMARY). Dead direct-fed deepseek already order=99. litellm units inactive.
[hold]       Step 1 — GAP-05 swap: HOLD_UNSAFE. Do not swapoff -a until free RAM > 2 GiB. Natural drain only.
[staged]     Step 5 — sshd drop-in written; sshd -T = Tailscale only; LIVE sockets still 0.0.0.0:22888
[hold]       Final — no VAULT999 constitutional SEAL (arif_judge effective HOLD / F13). Session receipt only.
```

## Remaining bounded action (not a reboot)

`system restart all` is the wrong shape. A VPS reboot would rebind sshd **and** risk Tailscale not returning (lockout) **and** kill this session.

The only remaining bind step is a **single-unit restart**:

```bash
# pre: tailscale0 has 100.64.0.2, tailscaled=active, sshd -T shows Tailscale listen
systemctl restart ssh     # NOT reboot; NOT reload (reload cannot rebind ListenAddress)
# post: ss -lntp | grep 22888  must show 100.64.0.2 / fd7a:115c:a1e0::2 only
# rollback: rm /etc/ssh/sshd_config.d/99-arifOS-tailscale-only.conf && systemctl restart ssh
```

Do **not** fire this while an interactive SSH session is the only path in, unless a console/Tailscale fallback is confirmed. Live session observed 2026-08-18T12:10Z from `202.185.89.85:48758` on `0.0.0.0:22888`.

Sovereign must say `restart ssh` (not “restart all”) before this fires.
