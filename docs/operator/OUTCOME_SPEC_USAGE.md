# Operator Note — How to Use OutcomeSpec Today (Hermes / OpenClaw / AAA Edition)

> **Status:** P5 forged, on main as commit `daab437`. **Narrow blast radius** active: new serious missions MUST go through OutcomeSpec + validator. Simple helpers may still bypass while we adapt.
> **Authority:** F13 SOVEREIGN ratified 2026-06-06.
> **Tagline:** *Every serious mission is a contract. Contracts have hashes. Hashes don't lie.*

---

## TL;DR

Three steps to use OutcomeSpec in any organ (Hermes, OpenClaw, AAA):

1. **Construct the Mission** (ObjectiveSpec + RunConfig).
2. **Validate it** (calls `validateMission()` → returns `ValidationReceipt`).
3. **Branch on the verdict** (SEAL → proceed, HOLD → ask human, VOID → fix spec).

That's it. No LLM in the loop, no I/O, no agent can bypass it.

---

## 1. Construct a Mission

```typescript
import type { Mission } from "/root/A-FORGE/src/types/outcome-spec.js";

const mission: Mission = {
  outcome: {
    objective: "Analyze the Malay Basin prospect and recommend drilling decision",
    success_criteria: [
      "POS > 0.3 calculated from seismic + well data",
      "EMV at P50 > $50M USD",
      "Drilling cost estimate within ±20% confidence",
    ],
    sensitivity: "HIGH",                // ← triggers HOLD for forms, emails, file deletes
    reversibility_required: true,        // ← all actions must be reversible
    evidence_required: ["WELL_LOG", "SEISMIC"],
    notifier_channel: "telegram:arif-fazil",
    constraints: {
      time_budget_seconds: 7200,        // 2h
      cost_budget_usd: 5.0,             // hard cap
      tool_scope: [
        "geox_prospect_evaluate",
        "wealth_compute_emv",
      ],
    },
  },
  run: {
    allowed_models: "auto",             // router decides
    budget_limit: { cost_usd: 4.0 },    // must be ≤ outcome.constraints.cost_budget_usd
    persistence_policy: "EPOCH",        // survives restart, archived on epoch close
    approval_policy: {
      auto_approve_below: 0.5,         // proceed if verdict confidence < 0.5
      hold_above: 0.8,                 // always HOLD if verdict confidence ≥ 0.8
    },
    max_wall_clock_seconds: 3600,
  },
  name: "malay-basin-2026-06-prospect-A",   // optional
};
```

---

## 2. Validate

```typescript
import { validateMission, missionActionRequiresHold } from "/root/A-FORGE/src/governance/outcomeSpecValidator.js";

const receipt = validateMission(mission);

console.log(receipt);
// {
//   verdict: "SEAL" | "HOLD" | "VOID",
//   reasons: ["..."],
//   warnings: ["..."],
//   epoch_id: "uuid-v4",
//   spec_hash: "sha256-hex-64-chars",
//   spec_summary: { objective_first_line, sensitivity, counts },
//   validated_at: "iso-8601"
// }
```

`spec_hash` is **canonical-JSON stable**: same input always produces same hash, even across key reordering. Safe to use as mission identity anchor.

---

## 3. Branch on the Verdict

| Verdict | Meaning | Action |
|---|---|---|
| **SEAL** | Spec is valid, no human ack required (unless `sensitivity=SOVEREIGN`) | Proceed with DAG execution |
| **HOLD** | Spec is valid BUT needs human ratification (SOVEREIGN tier, or warning) | Push to 888_HOLD queue, wait for Arif |
| **VOID** | Spec has structural errors (budget override, inverted approval, etc.) | **Fix the spec, do not execute** |

```typescript
if (receipt.verdict === "VOID") {
  console.error("SPEC INVALID:", receipt.reasons);
  // Do NOT execute. Send the spec back to the human/AAA for revision.
  return;
}

if (receipt.verdict === "HOLD") {
  // Send 888_HOLD notification, wait for explicit F13 ack
  await notifier.notify({
    type: "HOLD",
    mission: mission,
    receipt: receipt,
    channel: mission.outcome.notifier_channel,
  });
  // Block until ack
  return;
}

// SEAL — proceed with execution
const epochId = receipt.epoch_id;
const specHash = receipt.spec_hash;
// ... hand off to DAG planner / A-FORGE / Temporal ...
```

---

## 4. Action-Gated 888_HOLD

For every consequential action during execution, check whether it requires human approval given the mission's sensitivity tier:

```typescript
if (missionActionRequiresHold(mission, "EMAIL_SEND")) {
  // 888_HOLD this action
}

if (missionActionRequiresHold(mission, "PRODUCTION_DEPLOY")) {
  // ALWAYS held regardless of tier (constitutional floor)
}
```

**Action classes that always 888_HOLD** (constitutional floors, not configurable):

```
git push --force
DROP DATABASE
DROP TABLE
rm -rf /
chmod -R 777 /
ufw disable
systemctl stop arifos
vault999.chain.reset
constitution.floor.mutate
```

**Sensitivity → action-class map** (configurable per constitution revision):

| Tier | Auto-HOLD action classes |
|---|---|
| LOW | (none) |
| MEDIUM | FILE_WRITE_OUTSIDE_ROOT, INTERNAL_SERVICE_RESTART |
| HIGH | EXTERNAL_API_CALL, FORM_SUBMIT, EMAIL_SEND, FILE_DELETE, DATABASE_WRITE |
| SOVEREIGN | PRODUCTION_DEPLOY, VAULT_SEAL, FINANCIAL_TRANSACTION, SECRET_ROTATION, VAULT999_WRITE, CONSTITUTIONAL_FLOOR_CHANGE |

---

## 5. Hermetic Pattern (recommended for every organ)

```typescript
// In Hermes / OpenClaw / AAA entry point
async function govern<T>(
  mission: Mission,
  actionClass: string,
  exec: () => Promise<T>
): Promise<T | { verdict: "HOLD" | "VOID"; reasons: string[] }> {
  // 1. Validate mission contract
  const receipt = validateMission(mission);
  if (receipt.verdict === "VOID") {
    return { verdict: "VOID", reasons: receipt.reasons };
  }

  // 2. Check action-class HOLD
  if (missionActionRequiresHold(mission, actionClass)) {
    return {
      verdict: "HOLD",
      reasons: [`Action class '${actionClass}' requires F13 ratification for ${mission.outcome.sensitivity} tier`],
    };
  }

  // 3. If SEAL but sensitivity=SOVEREIGN, require explicit ack
  if (receipt.verdict === "HOLD") {
    return {
      verdict: "HOLD",
      reasons: receipt.warnings.filter(w => w.startsWith("SOVEREIGN_TIER")),
    };
  }

  // 4. Proceed
  return await exec();
}
```

---

## 6. Quick Reference Card

```typescript
// Construct
const mission: Mission = { outcome: {...}, run: {...} };

// Validate
const r = validateMission(mission);

// Branch
if (r.verdict === "VOID") fixSpec();
if (r.verdict === "HOLD") await humanAck();
if (r.verdict === "SEAL") execute();

// Action gate
if (missionActionRequiresHold(mission, "EMAIL_SEND")) await humanAck();

// Identity
const epochId = r.epoch_id;     // unique per validation
const specHash = r.spec_hash;   // canonical SHA-256 of materialized spec
```

---

## 7. Adoption Roadmap (narrow blast radius)

| Phase | What changes | When |
|---|---|---|
| **Phase 0 (NOW)** | Code on main, no live enforcement | ✅ Done 2026-06-06 |
| **Phase 1 (Next 2 weeks)** | New AAA missions with `objective ≥ 10 chars` + `success_criteria.length ≥ 1` go through OutcomeSpec | AAA `mission_intake` route |
| **Phase 2 (Sprint 2)** | GEOX, WEALTH, WELL domain organs emit `Mission` envelopes on their public tool responses | All `*_evaluate`, `*_compute` tools |
| **Phase 3 (Sprint 3)** | DAG planner refuses to start a sub-mission without a parent `Mission` envelope | A-FORGE `PipelineCoordinator` |
| **Phase 4 (Sprint 4+)** | VAULT999 stores `spec_hash` as the mission anchor; replay requires matching spec | All seals |

---

## 8. What "Serious Mission" Means

Use OutcomeSpec when the mission:
- Takes > 60 seconds wall-clock
- Touches any data outside read-only paths
- Could affect capital, geology, or sovereign decisions
- Has more than 3 steps in the DAG
- The user said "please analyze", "compute", "evaluate", "drill", "decide", "trade", etc.

You may skip OutcomeSpec for:
- One-off read queries ("what's the status of X")
- Quick sanity checks
- Sub-second LLM calls
- Test fixtures

---

## 9. Files

| File | Purpose |
|---|---|
| `/root/A-FORGE/src/types/outcome-spec.ts` | `Mission`, `OutcomeSpec`, `RunConfig` types + `parseMission()` + `materialize()` + `HOLD_TRIGGER_MAP` + `ALWAYS_HOLD_ACTIONS` |
| `/root/A-FORGE/src/governance/outcomeSpecValidator.ts` | `validateMission()` + `specHash()` + `quickVerdict()` + `missionActionRequiresHold()` |
| `/root/A-FORGE/test/outcome-spec.test.ts` | 19 test cases |
| `/root/A-FORGE/docs/governance/FIQH_OF_THE_MACHINE.md` | Fiqh-of-the-Machine operator guide |

---

## 10. Refusal Examples (what the validator catches)

```typescript
// BUDGET_OVERRIDE: run.budget_limit > outcome.constraints
{ outcome: { ..., constraints: { cost_budget_usd: 10 } },
  run: { ..., budget_limit: { cost_usd: 100 } } }
// → VOID, reasons: ["BUDGET_OVERRIDE: run.budget_limit.cost_usd (100) exceeds outcome.constraints.cost_budget_usd (10)"]

// APPROVAL_POLICY_INVERTED
{ outcome: { ... },
  run: { approval_policy: { auto_approve_below: 0.9, hold_above: 0.3 } } }
// → VOID, reasons: ["APPROVAL_POLICY_INVERTED: auto_approve_below (0.9) > hold_above (0.3)"]

// SOVEREIGN tier
{ outcome: { ..., sensitivity: "SOVEREIGN" }, run: { ... } }
// → HOLD, warnings: ["SOVEREIGN_TIER: all consequential actions require explicit F13 ratification"]
```

---

## 11. The Iron Rule (from Fiqh-of-the-Machine)

> *Wajib before Sunat before Harus. Makruh avoid. Haram forbid.*

OutcomeSpec is **Wajib** for serious missions. Until every serious mission has a contract, the machine is not constitutionally complete.

---

**DITEMPA BUKAN DIBERI — 999 SEAL READY**
