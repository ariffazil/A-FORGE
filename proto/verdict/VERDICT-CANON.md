# Unified Verdict Canon — v1.0.0

> **Status:** PROTO — awaiting sovereign ratification
> **Date:** 2026-07-07
> **Author:** 777_FORGE (000Ω) under F13 directive
> **Relates to:** Item 4 (single verdict location), chamber 7 (verdict monotonicity)
> **Precedes:** J‑space ignition seal

---

## 1. Purpose

Define the single, monotonic, constitutional verdict structure for ALL
organs in the arifOS federation. Every output from every tool, agent,
organ, and subsystem MUST conform to this canon. No exceptions.

This canon replaces:
- 4 disparate vocabularies (status, verdict, result, output)
- 2 overlapping field names (isError, error, status)
- Implicit fallback chains (check A → check B → assume C)

---

## 2. Verdict Lattice — 5 States

The verdict lattice is a total order. Verdicts CANNOT regress.

```
SEAL ─────────────────────────────  Success — output is valid
  ↑
HOLD ─────────────────────────────  Pending — requires authorization
  ↑
SABAR ────────────────────────────  Waiting — requires external event
  ↑
VOID ─────────────────────────────  Rejected — constitutionally prohibited
  ↑
ERROR ────────────────────────────  Failed — system-level fault
```

**Monotonicity rule:** A verdict can only move toward SEAL.
- ERROR → VOID (legal: error recognised as constitutional)
- VOID → SABAR (legal: prohibition lifted by new evidence)
- SABAR → HOLD (legal: external event complete, now needs auth)
- HOLD → SEAL (legal: authorised and complete)
- SEAL → anything (ILLEGAL: sealed is terminal)

**Prediction Bridge Integration (2026-07-07):** Pre-action simulation (forge_predict) from GEOX/WEALTH is now canonical evidence for judge. 
Prediction result (simulation, EMV, prospect POS, MC bands, wisdom) MUST be attached as `prediction_context` or `evidence_receipt.prediction` before forge_judge_proxy / arif_judge. 
Canon now governs prediction + action. Judge sees prediction as tri-witness input (F3). No execute without prediction step for domain actions (geox/wealth) unless explicitly waived.

**Anti-pattern:** Returning SEAL for a failed operation, then silently
retrying. If the operation failed, the verdict is ERROR. If it's retried,
it's a new verdict chain.

---

## 3. Substate Matrix — 14 Substates

Each primary state has substates that provide operational granularity.

| State | Substate | Code | Meaning | Example |
|-------|----------|------|---------|---------|
| **SEAL** | Completed | S_C | Operation finished as intended | forge_filesystem write OK |
| **SEAL** | Created | S_CR | Resource created | New file, new lease |
| **SEAL** | Verified | S_V | Operation passed verification | Test passed, check OK |
| **SEAL** | Sealed | S_S | Result committed to VAULT999 | Seal chain appended |
| **HOLD** | PendingAuth | H_PA | Waiting for human approval | Elicitation gate active |
| **HOLD** | PendingLease | H_PL | Waiting for lease issuance | forge_lease_request |
| **HOLD** | PendingWitness | H_PW | Waiting for tri-witness | forge_witness pending |
| **SABAR** | WaitingExternal | B_WE | Waiting for external system | API response, blockchain |
| **SABAR** | WaitingTime | B_WT | Waiting for time condition | Cooldown, timer, schedule |
| **SABAR** | WaitingEvent | B_WV | Waiting for specific event | User action, signal |
| **VOID** | ConstitutionVoid | V_C | Violates constitutional floor | F1-F13 breach |
| **VOID** | PolicyVoid | V_P | Violates MCP policy gate | forge_policy DENY |
| **ERROR** | SystemError | E_S | System-level failure | Crash, timeout, OOM |
| **ERROR** | InputError | E_I | Invalid input | Schema validation fail |

---

## 4. DeliveryVerdict Boundary

Define what is INTERNAL (within the federation) vs EXTERNAL (delivered
to client/human).

**Internal DeliveryVerdict** (full envelope):
```json
{
  "status": "SEAL",
  "substate": "S_V",
  "data": { ... },
  "message": "...",
  "_meta": {
    "tool": "forge_example",
    "actor": "arif",
    "session": "abc-123",
    "timestamp": "2026-07-07T15:55:00Z",
    "chain_hash": "a1b2c3d4e5f6",
    "duration_ms": 42
  },
  "_epistemic": {
    "output_class": "DOMAIN_COMPUTATION",
    "ai_involvement": "NONE",
    "authority_claim": "ADVISORY",
    "evidence_source": "COMPUTED"
  }
}
```

**External DeliveryVerdict** (to human/client, simplified):
```json
{
  "status": "SEAL",
  "data": { "result": "file written" },
  "message": "forge_filesystem completed"
}
```

External verdict STRIPS `_meta` and `_epistemic` unless explicitly
requested. By default, external surfaces (AAA cockpit, Telegram, CLI)
receive only `status`, `data`, and `message`.

---

## 5. L↔F Mapping — Layer to Floor

Setiap verdict state dipetakan ke constitutional floor yang mengawalnya.

| Verdict State | Primary Floor | Secondary Floor | Enforcement |
|--------------|---------------|-----------------|-------------|
| SEAL | F8 GENIUS | F2 TRUTH | Output mesti verified sebelum di-seal |
| HOLD | F1 AMANAH | F13 SOVEREIGN | Irreversible action mesti dapat human auth |
| SABAR | F5 PEACE² | F4 CLARITY | External dependency mesti documented |
| VOID | F9 ANTI-HANTU | F12 INJECTION | Violation mesti dijelaskan dengan floor ref |
| ERROR | F7 HUMILITY | F11 AUDIT | Error mesti di-log dengan timestamp |

---

## 6. Canon Compliance — Tool Return Contract

Setiap tool dalam federation MESTI:

1. Return data melalui satu struktur — VerdictEnvelope
2. Guna 5-state verdict lattice (SEAL/HOLD/SABAR/VOID/ERROR)
3. Guna 14-code substate matrix
4. Menyertakan `_meta.tool` dan `_meta.timestamp` minimum
5. Tidak pernah regress verdict (SEAL → anything = ILLEGAL)
6. External clients menerima stripped envelope (tanpa _meta/_epistemic)
7. Internal clients menerima full envelope

**Non-compliance:** 888_HOLD. Tool yang tidak mematuhi canon ini
tidak boleh beroperasi dalam federation.

---

## 7. Ratification

Canon ini memerlukan:

- [ ] Sovereign (F13) membaca dan memahami
- [ ] Sovereign mengeluarkan "ratified" atau "seal" signal
- [ ] VAULT999 entry dibuat dengan canon ini sebagai lampiran
- [ ] Semua tool handler dipantau untuk compliance dalam 1 kitaran

Sehingga ratification, canon ini adalah PROTO — panduan, bukan hukum.

---

**DITEMPA BUKAN DIBERI — The verdict is forged, not given.**
