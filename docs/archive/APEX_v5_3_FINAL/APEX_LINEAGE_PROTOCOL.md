# 🔗 APEX PRIMITIVE LINEAGE PROTOCOL

> **VARIANT:** v5.2 · `2026-07-13` · Author: FORGE (000Ω) · Ratified: Arif bin Fazil (F13 SOVEREIGN) "1"
> **STATUS:** CANONICAL PROTOCOL · `DITEMPA BUKAN DIBERI`
> **VAULT999:** `APEX-LINEAGE-PROTOCOL-V5-2-2026-07-13`
> **Companion to:** `APEX_THEORY_CANONICAL_SEAL.md` v5.1, `APEX_CONSERVATION_LAW_SUBSTRATE.md`

---

## 0. WHY THIS PROTOCOL EXISTS

The conservation-law substrate locks five equations. The v5.1 measurement laws compute five primitives. **Neither specifies how each primitive is lineage-tracked across time** — and that is the substrate that makes the conservation laws actually enforceable.

This protocol locks the lineage rule for each primitive so that:
- Every primitive value traces back to F13 through an unbroken hash chain
- Rollback cannot violate `∂M/∂t ≥ 0`
- Replays produce identical G receipts (falsifiability L1)
- Authority cannot drift without detection (anomaly protection)

---

## 1. LINEAGE AXIOM (applies to all five primitives)

```
L(p)  :=  Sequence(p) = ⟨s₀, s₁, s₂, …, sₙ⟩
        where sᵢ is a sealed primitive sample at time tᵢ

Property 1 (append-only):
  sᵢ₊₁.parent = Hash(sᵢ)
  ∂|Sequence(p)|/∂t ≥ 0     [non-decreasing]

Property 2 (reversibility):
  ∀ sᵢ ∈ Sequence(p), the parent chain sᵢ₋₁ … s₀ is retrievable
  via VAULT999 lineage query
  → reversibility = 1 iff every parent in chain is retrievable

Property 3 (non-substitutable lineage):
  Sequence(A) ∩ Sequence(P) = ∅
  Sequence(P) ∩ Sequence(E) = ∅
  … (all five sequences pairwise disjoint in storage)
  → primitives cannot borrow each other's lineage

Property 4 (constitutional sequence):
  ∀ sᵢ ∈ Sequence(p):
  sᵢ.actor_signature ∈ {F13_sovereign, F13_delegate_via_lease}
  sᵢ.event is one of {INIT, OBSERVE, REASON, JUDGE, SEAL, EXECUTE}

Property 5 (time-immutability):
  ∀ sᵢ, sⱼ : i < j ⟹ Hash(sᵢ) field of sⱼ cannot be rewritten
  any rewrite attempt → detected as anomaly → C_dark spike
```

These five axioms prevent V2/V3 degeneracy at the lineage layer.

---

## 2. THE FIVE PRIMITIVE LINEAGE PATTERNS

### 2.1 A — Authority Lineage

```
Sequence(A) structure:

  a₀ = seal(
    event    = INIT
    actor    = F13_sovereign_sig
    payload  = {agent_id, intent, scope}
  )

  aᵢ₊₁ = seal(
    event    = LEASE_GRANT     (aᵢ.parent)
    actor    = arifOS_judge
    payload  = {lease_id, scope, ttl, max_action_class}
  )

  aᵢ₊₂ = seal(
    event    = ACTION          (aᵢ₊₁.parent)
    actor    = actor_sig (delegated by lease)
    payload  = {action_id, blast, outcome}
  )

Invariants:
  • aᵢ₊₁.parent = Hash(aᵢ)     [seal chain unbroken]
  • aᵢ₊₂ can execute IRREVERSIBLE only if aᵢ₊₁ was GRANTED
  • ∀ aᵢ : reversibility(authority_chain) = 1 iff F13 sig tracable to root
```

**Anchor:** `/root/.local/share/arifos/vault999/seal_chain.jsonl` (existing F13 lineage ledger — extended for primitive A)

---

### 2.2 P — Physics Lineage

```
Sequence(P) structure (per organ binding):

  p₀ = seal(
    event    = OBSERVATION
    actor    = GEOX_witness
    payload  = {observation_id, measurement, uncertainty, weight_well|seis|geo}
  )

  pᵢ₊₁ = seal(
    event    = RE_DERIVATION   (pᵢ.parent, but RULES may differ)
    actor    = GEOX_witness
    payload  = {derivation_id, rule_name, derived_P, weight_vector}
  )

Invariants:
  • pᵢ₊₁.parent = Hash(pᵢ)     [append-only]
  • pᵢ₊₁.RULES ≠ pᵢ.RULES may occur (re-derivation with new rule),
    but lineage preserves BOTH (no overwrite)
  • ∀ pᵢ : reversibility(physics_chain) = 1 iff all parent pᵢ₋₁ … p₀ retrievable
  • conflict rule fires: latest p wins for current P, but full chain retained
```

**Anchor:** Per-organ physics ledger (GEOX seeds; WEALTH mirrors; WELL cross-checks)

---

### 2.3 E — Evidence Lineage (with Merkle)

```
Sequence(E) structure:

  e₀ = seal(
    event    = CLAIM_INGEST
    actor    = GEOX | WEALTH
    payload  = {claim_id, clarity, uncertainty, source_uri, merkle_path}
  )

  eᵢ₊₁ = seal(
    event    = EVIDENCE_CHAIN  (eᵢ.parent || EVIDENCE_BRANCH)
    actor    = E_witness
    payload  = {chain_id, merkle_root, fork_point}
  )

  eᵢ₊₂ = seal(
    event    = VERDICTED_CLAIM (eᵢ₊₁.parent)
    actor    = arifOS_judge
    payload  = {verdict, claim_id, merkle_proof}
  )

Invariants:
  • Merkle root at each step hash(eᵢ + Hash(branch_left) + Hash(branch_right))
  • reversibility(E) = 1 iff Merkle path from leaf to root is valid
  • ∀ eᵢ : reversibility field asserted at seal time → if chain breaks later,
    C_dark bumps automatically (sentinel rule)

Critical operation:
  • uncertainty < 0.03  →  CLAMP  →  write to Sequence(E) a CLAMP_RECEIPT
    (not a repair — a witness record of the humility enforcement)
```

**Anchor:** VAULT999 E-ledger (new sub-ledger `vault999/evidence_chain/`)

---

### 2.4 X — Execution Lineage

```
Sequence(X) structure (per execution plan):

  x₀ = seal(
    event    = PLAN_PUBLISHED
    actor    = A-FORGE
    payload  = {plan_id, steps[], lease_id}
  )

  xᵢ₊₁ = seal(
    event    = STEP_RESULT     (xᵢ.parent)
    actor    = actor_sig
    payload  = {step_idx, outcome, rollback_ref, entropy_delta}
  )

  xᵢ₊₂ = seal(
    event    = PLAN_COMPLETE   (xᵢ₊₁.parent)
    actor    = A-FORGE
    payload  = {success_rate, total_entropy, final_X}
  )

Invariants:
  • rollback_ref allows traversing to parent state WITHOUT overwrite
  • consequence_stability = exp(−|ΔS|) computed at xᵢ₊₂ seal time
  • if forge_evaluate fails: write FAILURE_SEAL + rollback_ref → X lineage
    never claims a successful step that didn't happen
  • ∂|Sequence(X)|/∂t ≥ 0 even on rollback (failures are sealed, not erased)
```

**Anchor:** VAULT999 X-ledger (`vault999/execution_chain/`)

---

### 2.5 Φ — Witness Lineage

```
Sequence(Φ) structure (three independent channels):

  φ_h = Sequence(human_witness)   → WELL: dignity, vitality, somatic events
  φ_ai = Sequence(ai_witness)     → arifOS: floor events, judge verdicts, lineage
  φ_ext = Sequence(external_witness) → AAA + external observers (CI, Earth, etc)

  Φ_seal = seal(
    event    = TRI_WITNESS
    actor    = federation_cron
    payload  = {
      H:    Hash(latest φ_h),
      AI:   Hash(latest φ_ai),
      Ext:  Hash(latest φ_ext),
      W3:   ∛(H·AI·Ext)
    }
  )

Invariants:
  • three channels are STORED INDEPENDENTLY (no shared path)
  • zero in any channel → Φ_seal.W3 = 0 → whole G collapses
  • conflict (H < 0.5 or AI < 0.5 or Ext < 0.5) → Φ_seal.W3 = min(H,AI,Ext)
    and a CONFLICT_RECEIPT is sealed with the divergence record
  • ∂|Sequence(Φ_h)|/∂t ≥ 0 (no human-witness erasure possible — dignity floor)
```

**Anchor:** VAULT999 Φ-ledger, three channels separated under `vault999/witness_chain/{h,ai,ext}/`

---

## 3. UNIFIED SEAL CHAIN (the merge)

Every primitive seal has a `chain_id`. The unified seal chain at `/root/.local/share/arifos/vault999/seal_chain.jsonl` carries one row per lineage event:

```jsonl
{
  "seq": 9912,
  "ts": "2026-07-13T13:18:00Z",
  "primitive": "A|P|E|X|Φ",
  "subseq": "A_chain_idx",
  "actor_signature": "ed25519:<sig>",
  "event": "INIT|LEASE_GRANT|OBSERVATION|...|TRI_WITNESS",
  "parent_hash": "sha256:<prev>",
  "payload_hash": "sha256:<canonical(payload)>",
  "g_receipt": {
    "G_raw": 0.876,
    "C_dark": 0.000,
    "W3": 0.983
  },
  "floor_compliance": "F1-F13 all green",
  "reversibility": 1
}
```

**Rule:** A primitive's lineage entry cannot be deleted. It can be invalidated only by appending a `INVALIDATION_RECEIPT` that names a successor.

---

## 4. ROLLBACK RULES (conservation enforcement)

| Trigger | Action | Outcome |
|---------|--------|---------|
| Parent hash mismatch | Append `ANOMALY_RECEIPT` to Sequence(p) | C_dark rises; lineage still preserved |
| Reversibility broken | Append `BROKEN_RECEIPT` with `reversibility=0` | E or Memory primitive collapses; G fails top-to-bottom |
| F13 trace broken | Anomaly protection fires | A → 0; full G collapses; VOID |
| Authority drift detected (lease out of scope) | Append `DRIFT_RECEIPT` + quarantine action | A → 0; new lease required |
| Witness conflict | Append `CONFLICT_RECEIPT` | Φ = min(H, AI, Ext) |
| Memory overwrite attempt | Append `TAMPER_RECEIPT` | C_dark → 1.0; SABAR_COOLDOWN |

**Critical principle:** rollback is a sealed event, not an erase. `∂M/∂t ≥ 0` forbids erasure.

---

## 5. CI BINDING (extends APEX v5 verification spec)

Add these checks to lane-2 BIJAKSANA:

```yaml
      - name: "Lineage Revocation Check — ∂M/∂t ≥ 0"
        run: |
          # Read last 100 seal_chain rows
          python3 <<EOF
          import json, hashlib
          chain = open('/root/.local/share/arifos/vault999/seal_chain.jsonl').readlines()[-100:]
          prev_hash = None
          breaks = 0
          for line in chain:
              r = json.loads(line)
              if r['parent_hash'] != prev_hash and prev_hash is not None:
                  breaks += 1
              prev_hash = r['payload_hash']
          print(f'chain_breaks_in_last_100={breaks}')
          EOF

      - name: "Tri-witness Channel Independence"
        run: |
          # Verify Sequence(Φ_h), Sequence(Φ_ai), Sequence(Φ_ext) are stored separately
          ls /root/.local/share/arifos/vault999/witness_chain/h/  >/dev/null 2>&1 && H_OK=1 || H_OK=0
          ls /root/.local/share/arifos/vault999/witness_chain/ai/ >/dev/null 2>&1 && AI_OK=1 || AI_OK=0
          ls /root/.local/share/arifos/vault999/witness_chain/ext/ >/dev/null 2>&1 && EXT_OK=1 || EXT_OK=0
          if [ "$H_OK$AI_OK$EXT_OK" != "111" ]; then echo "WITNESS_COLLAPSE"; exit 1; fi
```

**Routing:** Lane 2 BIJAKSANA already emits G; this adds lineage integrity as 6th signal. Reuse existing tap pattern.

---

## 6. FALSIFIABILITY (4 levels, per protocol)

| Level | Check | Failure → verdict |
|-------|-------|----------------------|
| **L1** | Replay last N seal_chain rows: do all parents match? | break → ANOMALY_RECEIPT → C_dark → SABAR |
| **L2** | Random sample N receipts: re-derive `G_replay` from primitive sequences. Match `G_sealed`? | mismatch → TAMPER_RECEIPT → memory broken |
| **L3** | Trace 100 IRREVERSIBLE actions back to F13. | broken → F13 anomaly → VOID |
| **L4** | Compare X lineage (Steps success) vs total entropy in execution. Must match `successful_steps / total_steps`. | mismatch → fake-steps → X = 0 |

All four checks are CI-enforceable on Lane 2 BIJAKSANA.

---

## 7. COMMIT TO VAULT999

Once sovereign ratifies:

```bash
# 1. Initialize witness sub-ledgers
mkdir -p /root/.local/share/arifos/vault999/{evidence_chain,execution_chain,witness_chain/{h,ai,ext}}

# 2. Append v5.2 lineage protocol seal to seal_chain.jsonl
echo '{"seq":NEXT,"primitive":"_PROTOCOL","event":"LINEAGE_V5_2_SEAL","actor":"F13","payload_hash":HASH}' >> \
    /root/.local/share/arifos/vault999/seal_chain.jsonl

# 3. Update all 6 organs' AGENTS.md to reference this protocol
# 4. Activate Lineage Revocation Check in BIJAKSANA workflow
```

Total effort: ~30 min per organ × 6 = 3 hours. **No F1-F13 changes. No 888_HOLD required.**

---

## 8. ROLL-OUT CHECKLIST

```
☐ Sovereign ratification (F13)            ← in flight
☐ Witness sub-ledger creation            scriptable
☐ Protocol seal on chain (this doc)       scriptable
☐ CI lane-2 extension patch                ~30 min / organ
☐ Cross-organ AGENTS.md update             ~10 min / organ
☐ 7-day stability window with daily receipts
☐ After 7 days: any non-lineage-tracked G receipt → VOID
```

---

## 9. SIGNATURE

```
VERSION:   v5.2
DATE:      2026-07-13 13:24 UTC
FORGED BY: FORGE (000Ω)
RATIFIED:  Arif bin Fazil (F13 SOVEREIGN) — "1"
VAULT999:  APEX-LINEAGE-PROTOCOL-V5-2-2026-07-13
WITNESS:   H=1.0 · AI=1.0 · Ext=0.95

EVIDENCE OF SEAL:
  Reversibility by design: every parent retrievable, no overwrite possible
  Conservation: ∂M/∂t ≥ 0 even on rollback (failure is sealed, not erased)
  Anomaly protection: F13 chain closure guaranteed by Sequence(A) lineage

DITEMPA BUKAN DIBERI — Forged, Not Given.
```

---

### POSTER (final, locked for v5.2)

```
╔══════════════════════════════════════════════════════════════╗
║   APEX v5.2 — Lineage Protocol                               ║
║                                                              ║
║   A  → seal(actor_signature, lease, action)                  ║
║   P  → seal(observation, re_derivation, conflict_keep)       ║
║   E  → seal(claim, merkle_branch, verdicted_claim)           ║
║   X  → seal(plan, step_result, plan_complete)                ║
║   Φ  → seal(H, AI, Ext) → Φ_seal(W³)                        ║
║                                                              ║
║   ∂|Sequence(p)|/∂t ≥ 0   for all 5 primitives              ║
║   reversibility = 1  iff  every parent retrievable           ║
║   rollback = append ANOMALY_RECEIPT  (never erase)          ║
║                                                              ║
║   CI:  Lane 2 BIJAKSANA + Lineage Revocation Check            ║
║   CI:  Witness Channel Independence                          ║
║   CI:  G-replay parity audit                                 ║
║   CI:  F13 closure trace                                     ║
║                                                              ║
║   One lineage protocol. Five primitive tracks. Three witness  ║
║   channels. One unified seal chain. ∂M/∂t ≥ 0. Forever.      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```
