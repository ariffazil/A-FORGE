# Agent Onboarding Protocol — arifOS Federation

> **DITEMPA BUKAN DIBERI** — Forged, Not Given.
> **Authority:** F13 SOVEREIGN (Arif) — ratified 2026-07-09
> **Status:** ACTIVE — replaces all prior ad-hoc registration

---

## 1. Problem Statement

Agents currently register with `identity_proof: "pending"` — a cryptographic nothing.
This means any process can claim any agent_id and receive authority bounds.
The kernel's Ed25519 verification (`crypto_auth.py`) exists but is bypassed by
registration paths that accept "pending" as valid proof.

**Impact:** Identity spoofing is structurally possible at the registry layer.

---

## 2. The Three Gates of Onboarding

Every agent MUST pass through three gates before it receives authority:

```
GATE 1: KEY GENERATION    — Agent generates Ed25519 keypair
GATE 2: CHALLENGE-RESPONSE — Agent proves key ownership
GATE 3: REGISTRATION       — Public key bound to agent_id in registry
```

No gate can be skipped. No gate can be self-authorized.

---

## 3. Gate 1 — Key Generation

### Who generates keys?

| Agent Type | Key Generator | Location |
|------------|--------------|----------|
| Internal (FORGE, AUDITOR, OPS, PLAN) | `agent-keygen.sh` on VPS | `/root/A-FORGE/IDENTITY/keys/<agent_id>/` |
| External (Hermes, OpenClaw, VPS agents) | Agent runs locally, sends public key | Agent's own secure storage |
| Sovereign (Arif) | Manual, pre-existing | `/root/AAA/IDENTITY/keys/arif_public.pem` |

### Key Requirements

- **Algorithm:** Ed25519 (RFC 8032)
- **Format:** PEM (PKCS#8 for private, SPKI for public)
- **Private key:** NEVER leaves the agent's secure storage
- **Public key:** Submitted to federation registry
- **Naming:** `<agent_id>_ed25519.pem` (public), `<agent_id>_ed25519_private.pem` (private)

---

## 4. Gate 2 — Challenge-Response Ceremony

### Flow

```
Agent                     arifOS Kernel (crypto_auth.py)
  |                              |
  |--- register_request -------->|  (agent_id, public_key_pem)
  |                              |
  |<--- challenge ---------------|  (nonce, ttl=120s)
  |                              |
  |--- challenge_response ------>|  (signature = Ed25519.sign(agent_id:nonce))
  |                              |
  |<--- registration_receipt ----|  (agent_id, authority_bounds, registered_at)
```

### Rules

1. Nonce is single-use (replay protection)
2. Nonce expires in 120 seconds
3. Signature must verify against submitted public key
4. If verification fails → agent is REJECTED, logged to `governance_alerts.log`
5. Three consecutive failures → agent_id is BLOCKED for 1 hour

---

## 5. Gate 3 — Registration

### What gets stored in `agent_identities.json`:

```json
{
  "agent_id": {
    "agent_id": "FORGE",
    "agent_type": "opencode",
    "role": "governed_coder",
    "authority": { ... },
    "identity_proof": {
      "type": "ed25519",
      "public_key_fingerprint": "sha256:abc123...",
      "registered_at": "2026-07-09T00:00:00Z",
      "verification_method": "challenge_response",
      "verified_by": "arifOS_kernel"
    },
    "trust_tier": "OBSERVED",
    "last_seen": "...",
    "lease_ids": []
  }
}
```

### Trust Tiers (from darjat_engine.py)

| Tier | Meaning | How to Reach |
|------|---------|-------------|
| UNVERIFIED | No crypto proof | Default for "pending" |
| OBSERVED | Key registered, few sessions | After Gate 3 |
| TRUSTED | Clean history, no scars | After 10+ clean sessions |
| VERIFIED | Scar weight < 0.1, high G score | After governance review |
| ELDER | F13 ed25519 signature required | Sovereign appointment only |

---

## 6. External Agent Onboarding (Hermes, OpenClaw, VPS)

### Step-by-step

```bash
# 1. External agent generates keypair (on their machine)
openssl genpkey -algorithm Ed25519 -out hermes_private.pem
openssl pkey -in hermes_private.pem -pubout -out hermes_public.pem

# 2. Transfer public key to VPS (secure channel)
scp hermes_public.pem root@af-forge:/tmp/

# 3. Run onboarding ceremony on VPS
python3 /root/A-FORGE/scripts/identity/agent-onboard.py \
  --agent-id hermes \
  --agent-type external \
  --role telegram_agent \
  --public-key /tmp/hermes_public.pem \
  --authority '{"observe": true, "dry_run": true, "propose_patch": true, "mutate_files": "lease_required", "shell_exec": "888_HOLD", "git_commit": "888_HOLD"}'

# 4. Agent stores private key securely (never on VPS)
```

### For agents that can't run locally (Telegram bots, etc.)

The sovereign (Arif) can approve manual registration:
```bash
python3 /root/A-FORGE/scripts/identity/agent-onboard.py \
  --agent-id hermes \
  --sovereign-approval \
  --public-key /path/to/hermes_public.pem
```

This bypasses challenge-response but logs `verification_method: "sovereign_approval"`.

---

## 7. Governance Alerts

Every time `G_threshold` is raised (due to high scar weight), a log entry is written to:

```
/root/A-FORGE/data/governance_alerts.log
```

Format:
```json
{"timestamp": "...", "agent_id": "...", "event": "g_threshold_raised", "old_threshold": 0.80, "new_threshold": 0.92, "scar_weight": 0.45, "reason": "3 consecutive F11 breaches"}
```

Weekly audit: Arif reviews this log to identify the most problematic agents.

---

## 8. Anti-Patterns (HARAM)

- ❌ Registering with `identity_proof: "pending"`
- ❌ Accepting string claims ("I am Arif") as identity proof
- ❌ Storing private keys on the VPS (for external agents)
- ❌ Skipping challenge-response for "convenience"
- ❌ Allowing agents to self-promote trust tiers
- ❌ Reusing nonces across sessions

---

## 9. Migration Plan

### Phase 1: Mark existing "pending" agents as UNVERIFIED
All agents with `identity_proof: "pending"` are downgraded to `trust_tier: "UNVERIFIED"`.
They retain their authority bounds but cannot perform T3 actions until re-onboarded.

### Phase 2: Re-onboard active agents
Active agents (FORGE, AUDITOR, OPS, PLAN) run through the 3-gate ceremony.

### Phase 3: Block unverified T3 actions
After 2026-07-16, any T3 action from an UNVERIFIED agent is auto-blocked.

---

## 10. Files

| File | Purpose |
|------|---------|
| `/root/A-FORGE/IDENTITY/ONBOARDING_PROTOCOL.md` | This document |
| `/root/A-FORGE/scripts/identity/agent-keygen.sh` | Key generation script |
| `/root/A-FORGE/scripts/identity/agent-onboard.py` | Registration ceremony |
| `/root/A-FORGE/data/agent_identities.json` | Agent registry |
| `/root/A-FORGE/data/governance_alerts.log` | G_threshold change log |
| `/root/A-FORGE/IDENTITY/keys/` | Public key store |
| `/root/arifOS/arifosmcp/runtime/crypto_auth.py` | Ed25519 verification |

---

## 11. Falsification Criteria

This protocol is considered **FAILED** if:
1. An agent with `trust_tier: "UNVERIFIED"` can execute a T3 action
2. A forged public key (not matching any registered agent) passes verification
3. A replayed nonce is accepted
4. `governance_alerts.log` fails to record a G_threshold change

---

*Ratified: 2026-07-09 by F13 SOVEREIGN*
*DITEMPA BUKAN DIBERI*
