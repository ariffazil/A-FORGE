> ⚠️ **NOT CURRENT AUTHORITY** — This document is archived.
> 
> It was demoted to `INTERNAL REFERENCE` in the 2026-05-25 PHOENIX-73E cleanup.
> **Do not cite as current policy.** Current policy: `FEDERATION_STATUS.md` + `REPO_ROLE_MAP.md`.
>
> ---
> 
# TODO — A-FORGE Metabolic Shell

> **Roadmap:** ARIFOS_NEXT_HORIZON_2026  
> **Execution Status:** HOLD until contracts frozen  
> **Last Updated:** 2026-05-10  
> **Seal:** DITEMPA BUKAN DIBERI

---

## ✅ Embodiment Attestation (Completed Earlier Today)

- [x] arifOS embodiment contracts deployed
- [x] Model registry fix

---

## 🔴 P0 — Horizon 0: Canon Lock (Days 0–14)

**Gate: No new features until contracts are frozen.**

### Authority Freeze
- [ ] **Create `REPO_AUTHORITY_MATRIX.md`** — what A-FORGE may own / must not own
- [ ] **Tool inventory** — map all callable tools + risk tiers
- [ ] **Merge `h1-roadmap` branch into `main`** — P0 from prior TODO, still open
- [ ] **Runtime SOT check** — confirm live compose/runtime matches repo contract

---

## 🟠 P1 — Horizon 1: Security + Session Spine (Days 15–45)

**Gate: No execution without actor, scope, verdict, trace.**

### Trace + Verdict Integration
- [ ] **Consume `TRACE_SCHEMA.json`** from arifOS — trace, receipt, chain_id, actor_id
- [ ] **Execution refuses missing arifOS verdict** — no verdict = no execution
- [ ] **Execution refuses stale verdict** — verdict TTL + freshness check
- [ ] **Dry-run default** — all destructive actions require dry_run=true

### Sandbox Enforcement
- [ ] **Implement sandbox profiles** — reflex / tactical / strategic / sovereign
- [ ] **File system boundaries** — readonly, scratch-only, full
- [ ] **Network boundaries** — null, localhost-only, federation-only, open
- [ ] **Tool whitelists/blacklists** per profile

---

## 🟡 P2 — Horizon 2: Deterministic Judge (Days 46–90)

**Gate: Explicit legal transitions. No execution without verified policy.**

### Execution State Machine
- [ ] **Create `/state_machine/execution_graph.ts`** — explicit legal transitions
- [ ] **Implement full state machine:**
  ```
  IDLE → RECEIVE_INTENT → LOAD_SESSION → DRY_RUN → REQUEST_VERDICT
  → VERIFY_POLICY → EXECUTE_SANDBOXED → OBSERVE_RESULT → VAULT_SEAL → REPORT
  ```
- [ ] **Rollback atomicity** — revert state on mid-stream floor violation
- [ ] **Checkpoint manager** — create, restore, list checkpoints

### Vault Integration
- [ ] **Create `/vault/vault999_writer.ts`** — every execution writes receipt
- [ ] **Receipt includes:** execution_plan_id, stage, input_hash, output_hash, floor_violations

---

## 🟢 P3 — Horizon 3: Semantic Federation (Days 91–135)

**Gate: Cross-domain evidence pipeline works end-to-end.**

- [ ] **Cross-domain orchestrator** — route evidence from GEOX → WEALTH → arifOS
- [ ] **Runtime SOT check** — live compose/runtime matches repo contract
- [ ] **Metabolic telemetry API** — D-M-E loop metrics for arifOS throttling

---

## 🔵 P4 — Horizon 4: Self-Healing + Release (Days 136–180)

**Gate: Recovery never escalates privilege.**

### Self-Healing
- [ ] **Container health monitor** — watch Docker/container health
- [ ] **Recovery playbooks** — reversible recovery logged to VAULT999
- [ ] **Auditor agent read-only mode** — log all recovery actions

### Self-Healing Verdict Rules
- [ ] Reversible recovery → arifOS SEAL → A-FORGE executes
- [ ] Irreversible recovery → HOLD for F13 human review
- [ ] Auth/secrets/constitution recovery → HOLD by default

### Release
- [ ] **Public docs cleanup**
- [ ] **Release tag `vNext-Horizon-0`**

---

**DITEMPA BUKAN DIBERI — Execution is forged, not given.**
