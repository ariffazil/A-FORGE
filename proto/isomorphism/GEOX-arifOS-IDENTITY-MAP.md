# GEOX-arifOS-IDENTITY-MAP — Cross-Substrate Identity Continuity

> **Status:** ANCHOR GEOMETRY (proto/isomorphism)
> **Epistemic:** OBS (grounded in source code, 2026-07-07)
> **Purpose:** Map how identity flows across all 5 federation substrates.
> **Failure if absent:** Identity drift → authority leak → sovereignty collapse.

---

## 1. The Problem

Identity is NOT the same across substrates. Each organ has its own identity
model. Without a canonical map, an agent can forge authority by switching
substrates — claiming identity A in Python, identity B in TypeScript.

This is the **substrate boundary attack**: the manifold leaks at the seams.

---

## 2. Identity Fields Per Substrate (OBS)

| Field | arifOS (Python) | A-FORGE (TS) | GEOX (Python) | WEALTH (TS) | WELL (Python) |
|---|---|---|---|---|---|
| `session_id` | ✅ kernel-born | ✅ proxy from kernel | ✅ pass-through | ✅ pass-through | ✅ pass-through |
| `actor_id` | ✅ F11 challenge | ✅ from session | ✅ from envelope | ✅ from envelope | ✅ from envelope |
| `actor_hash` | ✅ SHA-256 | ❌ not stored | ❌ not stored | ❌ not stored | ❌ not stored |
| `actor_signature` | ✅ kernel-signed | ❌ not used | ❌ not used | ❌ not used | ❌ not used |
| `lease_id` | ✅ minted | ✅ validated | ❌ no leases | ❌ no leases | ❌ no leases |
| `epoch_id` | ✅ seal chain | ❌ not used | ❌ not used | ❌ not used | ❌ not used |
| `kernel_epoch` | ✅ from health | ❌ not read | ❌ not read | ❌ not read | ❌ not read |
| `nonce` | ✅ per-session | ❌ not used | ❌ not used | ❌ not used | ❌ not used |
| `trace_id` | ✅ optional | ✅ optional | ✅ optional | ❌ not used | ❌ not used |

**Source paths:**
- arifOS: `/root/arifOS/arifosmcp/models/verdicts.py` (VerdictResult)
- A-FORGE: `/root/A-FORGE/src/interfaces/mcp/core.ts` (GOVERNANCE_FIELDS)
- GEOX: `/root/geox/src/geox_mcp/organ_governance.py` (lane enforcement)
- WEALTH: `/root/WEALTH/` (pass-through from A-FORGE/arifOS)
- WELL: `/root/WELL/` (pass-through)

---

## 3. Identity Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    arifOS KERNEL (Python :8088)                 │
│                                                                 │
│  session_id ──── kernel-born, UUID, 1800s TTL                  │
│  actor_id   ──── F11 challenge-response verified                │
│  actor_hash ──── SHA-256 of actor's public key or session nonce │
│  actor_sig  ──── kernel-signed attestation                      │
│  lease_id   ──── minted by kernel, scoped, TTL-bounded          │
│  epoch_id   ──── seal chain sequence number                     │
│  nonce      ──── per-session, prevents replay                   │
│                                                                 │
│  IDENTITY IS CANONICAL HERE.                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ callMCP / proxy
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                A-FORGE MCP (TypeScript :7072)                   │
│                                                                 │
│  session_id ──── forwarded from kernel (or minted via init)     │
│  actor_id   ──── from session lookup or STDIO_ACTOR env         │
│  lease_id   ──── validated against active leases                │
│  trace_id   ──── optional pass-through                          │
│                                                                 │
│  IDENTITY IS DERIVED. Trust = kernel said so.                   │
│  No independent identity proof.                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ callMCP / bridge
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           GEOX / WEALTH / WELL (Python/TS :8081/:18082/:18083) │
│                                                                 │
│  session_id ──── forwarded from A-FORGE or arifOS               │
│  actor_id   ──── forwarded from envelope                        │
│  trace_id   ──── optional pass-through                          │
│                                                                 │
│  IDENTITY IS INHERITED. No independent verification.            │
│  Trust = whoever called me is who they say they are.            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. The Gap

**arifOS** has 7 identity fields. **A-FORGE** uses 3. **GEOX/WEALTH/WELL** use 2.

The identity **thins** as it flows outward. This is correct for a hub-spoke
model — but it means:

1. A forged `session_id` in A-FORGE propagates to all downstream organs
2. `actor_hash` and `actor_signature` exist ONLY in the kernel
3. No organ independently verifies the identity chain
4. `lease_id` is kernel-bound — A-FORGE validates it, but GEOX/WEALTH/WELL don't check

**The thinning is the vulnerability.** Identity strength decays at each hop.

---

## 5. What Must Hold (IDENTITY INVARIANTS)

| # | Invariant | Status | Evidence |
|---|---|---|---|
| I-1 | `session_id` MUST originate from kernel | ✅ enforced | `forge_session_init` proxies to `arifos.arif_init` |
| I-2 | `actor_id` MUST be F11-verified before first use | ⚠️ partial | A-FORGE uses `STDIO_ACTOR` fallback for stdio transport |
| I-3 | `lease_id` MUST be validated before MUTATE | ✅ enforced | `validateLeaseForTool()` in core.ts |
| I-4 | `actor_hash` SHOULD propagate to downstream organs | ❌ missing | Only arifOS stores it |
| I-5 | Identity fields MUST NOT be forgeable by intermediate organ | ⚠️ partial | A-FORGE trusts kernel response, no independent proof |
| I-6 | `nonce` MUST prevent replay attacks | ✅ in kernel | arifOS generates per-session nonce |

---

## 6. Recommended Fixes (PRIORITY ORDER)

### P1: Actor Hash Propagation
Add `actor_hash` to A-FORGE's session envelope so downstream organs
can independently verify the identity chain. Currently only arifOS
stores it — A-FORGE discards it after kernel init.

### P2: Cross-Organ Attestation
GEOX/WEALTH/WELL should verify that `session_id` + `actor_id` in
their request envelope matches what the kernel attested. Currently
they blindly trust the caller.

### P3: Lease Propagation to Domain Organs
GEOX's `geox_claim(mode=seal)` should require a valid lease_id
from the kernel, not just a pass-through session_id. Currently
GEOX has its own `RiskTier` / `acrisk` system but no lease binding.

---

## 7. Verdict

Identity continuity is **2/3 anchored**. The kernel is strong.
The execution shell (A-FORGE) is derived but bounded.
The domain organs (GEOX/WEALTH/WELL) are inherited and unverified.

**Weakest link:** Domain organs accept identity without proof.

---

*Grounded: 2026-07-07 by FORGE (000Ω)*
*Source: actual code inspection, not speculation*
*Epistemic: OBS (observed in source)*
