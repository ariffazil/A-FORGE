# ACT Execution Flow — A-FORGE Event Sourcing

> **How ACT patterns flow through A-FORGE's execution engine.**
> **Forged:** 2026-06-21
> **Canonical SoT:** `arifOS/GENESIS/040_ACT_PLAYBOOK.md`

---

## 1. The Complete Execution Pipeline

```
                          ┌─────────────────────────────────────┐
                          │     LLM Agent / MCP Client          │
                          │  "I have a plan to execute"         │
                          └──────────────┬──────────────────────┘
                                         │ POST /execute
                                         ▼
                    ┌────────────────────────────────────────────┐
                    │         A-FORGE /execute endpoint          │
                    │         (server.ts:358)                    │
                    │                                            │
                    │  1. Classify action (actionClassifier.ts)  │
                    │  2. Session + Lease gate                   │
                    │  3. 888_HOLD gate                          │
                    │  4. Pre-Forge Constitutional Gate          │
                    │  5. ACT Gate (ActGateClient.ts)            │
                    │  6. Execute via MCP call                   │
                    │  7. Auto-seal to VAULT                     │
                    └──────────────┬────────────────────────────┘
                                  │
                    ┌──────────────▼──────────────────────────────┐
                    │         arifOS Kernel (8088)                │
                    │                                            │
                    │  Gate 2.5: ART reflex (art.py)             │
                    │    ├── Tool lifecycle check                │
                    │    ├── Blast radius screen                 │
                    │    └── ART 2.0: trust prediction           │
                    │                                            │
                    │  Gate 2.6: ACT reflex (act.py)             │
                    │    ├── Stage verification                  │
                    │    ├── Pattern vs risk matching            │
                    │    └── Human coordination                  │
                    │                                            │
                    │  Gate 3+: Floors, lease, drift...          │
                    └──────────────┬────────────────────────────┘
                                  │ SEAL / HOLD / REJECT
                                  ▼
                    ┌────────────────────────────────────────────┐
                    │         VAULT999                           │
                    │  "Every step recorded immutably"           │
                    └────────────────────────────────────────────┘
```

---

## 2. Default Deploy Pattern (3 Stages)

```
STAGE 1: DRY_RUN
┌─────────────────────────────────────────────────────────────────┐
│  Agent: arif_forge(mode="dry_run", manifest=...)        │
│    ↓                                                             │
│  ART: checks tool state, blast radius, trust                    │
│    ↓                                                             │
│  ACT: PROCEED (pattern=default_deploy, stage=1/3)               │
│    ↓                                                             │
│  A-FORGE: simulates operation, no side effects                   │
│    ↓                                                             │
│  Result: {ok: true, simulated_output: {...}}                    │
│    ↓                                                             │
│  Verification: output matches expected?                          │
│    ├── YES → Stage 2                                             │
│    └── NO  → HOLD (report deviation to human)                   │
└─────────────────────────────────────────────────────────────────┘
         │ STAGE 1 VERIFIED
         ▼
STAGE 2: DEPLOY
┌─────────────────────────────────────────────────────────────────┐
│  Agent: arif_forge(mode="engineer", manifest=...)       │
│    ↓                                                             │
│  ART: checks tool state (OBSERVED/TRUSTED), blast, reversibility│
│    ↓                                                             │
│  ACT: PROCEED (pattern=default_deploy, stage=2/3)               │
│    ↓                                                             │
│  A-FORGE: executes against full target                           │
│    ↓                                                             │
│  VAULT: auto-seals execution receipt                             │
│    ↓                                                             │
│  Verification: target state matches expectation?                 │
│    ├── YES → Stage 3                                             │
│    └── NO  → AUTO-ROLLBACK (compensation plan fires)            │
└─────────────────────────────────────────────────────────────────┘
         │ STAGE 2 VERIFIED
         ▼
STAGE 3: VERIFY
┌─────────────────────────────────────────────────────────────────┐
│  Agent: arif_forge(mode="query", verify=true)           │
│    ↓                                                             │
│  A-FORGE: runs verification checks                               │
│    ↓                                                             │
│  Result: {ok: true, verified: true, metrics: {...}}             │
│    ↓                                                             │
│  VAULT: seals complete deployment receipt                        │
│    ↓                                                             │
│  Notify: human informed of successful deployment                 │
└─────────────────────────────────────────────────────────────────┘

TIMELINE:
  ┌──────┐    ┌──────┐    ┌──────┐
  │DRYRUN│───→│DEPLOY│───→│VERIFY│───→ DONE
  └──────┘    └──────┘    └──────┘
     t=0        t+1        t+2        t+3
```

---

## 3. Dangerous Migration Pattern (5 Stages)

```
STAGE 1: PREFLIGHT + COMPENSATION APPROVAL
┌─────────────────────────────────────────────────────────────────┐
│  Agent: arif_forge(mode="dry_run", manifest=...,        │
│           compensation_plan=...)                                 │
│    ↓                                                             │
│  ART: TRUST_CRITICAL → SABAR (must verify first)                │
│    ↓                                                             │
│  ACT: CANARY_REQUIRED → HOLD until compensation approved        │
│    ↓                                                             │
│  AAA: surfaces compensation plan to human                        │
│    ↓                                                             │
│  Human: APPROVES / REJECTS compensation plan                     │
│    ↓                                                             │
│  VAULT: seals compensation approval receipt                      │
└─────────────────────────────────────────────────────────────────┘
         │ COMPENSATION APPROVED
         ▼
STAGE 2: CANARY (1%)
┌─────────────────────────────────────────────────────────────────┐
│  Agent: arif_forge(mode="engineer", scope="1%", ...)   │
│    ↓                                                             │
│  ART: checks tool state, blast radius                            │
│    ↓                                                             │
│  ACT: PROCEED (pattern=dangerous_migration, stage=2/5)          │
│    ↓                                                             │
│  A-FORGE: executes against 1% of target                          │
│    ↓                                                             │
│  Verification: monitor for failures, drift, unexpected state     │
│    ├── PASS → Stage 3                                            │
│    └── FAIL → rollback 1%, retry or abort                       │
└─────────────────────────────────────────────────────────────────┘
         │ CANARY PASSED
         ▼
STAGE 3: EXPAND (25%)
┌─────────────────────────────────────────────────────────────────┐
│  Agent: arif_forge(mode="engineer", scope="25%", ...)  │
│    ↓                                                             │
│  Human: must ACK before EXPAND                                   │
│    ↓                                                             │
│  A-FORGE: executes against 25% of target                         │
│    ↓                                                             │
│  Verification: full suite (integrity, health, performance)       │
│    ├── PASS → Stage 4                                            │
│    └── FAIL → rollback 25% to pre-migration state               │
└─────────────────────────────────────────────────────────────────┘
         │ EXPAND VERIFIED
         ▼
STAGE 4: FULL ROLLOUT (100%) ⚠️ IRREVERSIBLE
┌─────────────────────────────────────────────────────────────────┐
│  ART: TRUST_MEDIUM → HOLD (requires human ack for irreversible) │
│    ↓                                                             │
│  ACT: HUMAN_REQUIRED → block until F13 approves                 │
│    ↓                                                             │
│  Human: ACKs irreversible operation                              │
│    ↓                                                             │
│  VAULT: seals irreversible approval                              │
│    ↓                                                             │
│  A-FORGE: executes against remaining 75%                         │
│    ↓                                                             │
│  Result: this stage is IRREVERSIBLE — no automatic rollback     │
│    ├── Partial failure → contain, notify human                  │
│    └── Success → Stage 5                                        │
└─────────────────────────────────────────────────────────────────┘
         │ FULL ROLLOUT COMPLETE
         ▼
STAGE 5: POST-MIGRATION VERIFICATION
┌─────────────────────────────────────────────────────────────────┐
│  A-FORGE: runs complete verification suite                      │
│    ↓                                                             │
│  Checks: data integrity, system health, performance, security   │
│    ↓                                                             │
│  VAULT: seals complete migration receipt                        │
│    ↓                                                             │
│  Notify: human informed of migration outcome                    │
└─────────────────────────────────────────────────────────────────┘

TIMELINE:
  ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
  │PREFL │──→│CANARY│──→│EXPAND│──→│FULL  │──→│VERIFY│──→ DONE
  │+COMP │   │ 1%   │   │ 25%  │   │100%  │   │      │
  └──────┘   └──────┘   └──────┘   └──────┘   └──────┘
   t=0        t+1        t+2        t+3        t+4       t+5
                                         ⚠️ IRREV
            Each stage boundary requires:
              - Human ACK ✓
              - ART reflex ✓
              - ACT gate ✓
              - Verification ✓
```

---

## 4. Human-in-Loop Change Pattern (2+N Stages)

```
STAGE 1: PROPOSE
┌─────────────────────────────────────────────────────────────────┐
│  ART detects: TRUST_LOW, BLAST=HIGH, or WELL=low readiness     │
│    ↓                                                             │
│  ACT: HUMAN_REQUIRED → HOLD                                      │
│    ↓                                                             │
│  A-FORGE: freezes execution, creates approval ticket            │
│    ↓                                                             │
│  AAA: surfaces to human:                                         │
│    ├── Exact diff of proposed change                             │
│    ├── Expected outcome + blast radius                           │
│    ├── Rollback plan                                             │
│    └── Verification criteria                                     │
│    ↓                                                             │
│  Human: APPROVE / REJECT / MODIFY                                │
│    ↓                                                             │
│  VAULT: seals human decision                                     │
└─────────────────────────────────────────────────────────────────┘
         │ APPROVED
         ▼
STAGE 2: EXECUTE + VERIFY (LOOP × N changes)
┌─────────────────────────────────────────────────────────────────┐
│  For EACH change in the plan:                                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  a) Agent executes change (with ART + Kernel per call)  │    │
│  │     ↓                                                    │    │
│  │  b) Agent verifies expected outcome                     │    │
│  │     ↓                                                    │    │
│  │  c) Verification result:                                 │    │
│  │     ├── FAIL → AUTO-ROLLBACK that change                │    │
│  │     └── PASS → Human verifies                           │    │
│  │              ├── APPROVE → continue to next change      │    │
│  │              └── REJECT → rollback, notify, pause       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  After ALL changes:                                               │
│    ├── VAULT: seals complete change receipt                      │
│    └── Notify: human informed of completion                      │
└─────────────────────────────────────────────────────────────────┘

TIMELINE:
  ┌──────┐   ┌──────┐   ┌──────┐         ┌──────┐
  │PROP  │──→│CHG 1 │──→│CHG 2 │──→ ... →│DONE  │
  │      │   │→VERIF│   │→VERIF│         │      │
  └──────┘   └──────┘   └──────┘         └──────┘
   t=0        t+1        t+2              t+N
               ↑           ↑
          Human in loop  Human in loop
          per change     per change
```

---

## 5. Event Sourcing Detail — How A-FORGE Processes Each Stage

Each stage in any ACT pattern generates the same event sequence:

```
┌─────────────────────────────────────────────────────────────────┐
│                    A-FORGE Event Bus                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Event: "stage_start"                                            │
│  ├── pattern: "default_deploy"                                   │
│  ├── stage: 2/3                                                  │
│  ├── tool: "arif_forge"                                  │
│  └── session_id: "...", actor_id: "..."                          │
│                                                                   │
│       ↓                                                          │
│                                                                   │
│  Event: "stage_art_check"                                        │
│  ├── art_verdict: "PROCEED"                                      │
│  ├── trust_score: 0.85                                           │
│  ├── trust_band: "trust_high"                                    │
│  └── failure_risk: "low"                                         │
│                                                                   │
│       ↓                                                          │
│                                                                   │
│  Event: "stage_act_check"                                        │
│  ├── act_verdict: "PROCEED"                                      │
│  ├── pattern: "default_deploy"                                   │
│  ├── stage: 2/3                                                  │
│  └── human_required: false                                       │
│                                                                   │
│       ↓                                                          │
│                                                                   │
│  Event: "stage_execute"                                          │
│  ├── tool: "arif_forge"                                  │
│  ├── mode: "engineer"                                            │
│  ├── result: {ok: true, ...}                                     │
│  └── duration_ms: 1234                                           │
│                                                                   │
│       ↓                                                          │
│                                                                   │
│  Event: "stage_verify"                                           │
│  ├── verified: true                                              │
│  ├── metrics: {integrity: 1.0, health: 0.95}                    │
│  └── compensation_triggered: false                               │
│                                                                   │
│       ↓                                                          │
│                                                                   │
│  Event: "stage_complete"                                         │
│  ├── stage: 2/3                                                  │
│  ├── next_stage: 3                                               │
│  ├── vault_id: "v999-..."                                        │
│  └── human_notified: false                                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. ACT Pattern Selection Matrix

```
                B L A S T   R A D I U S
          LOW          MEDIUM        HIGH        INFRA
I   LOW   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
R        │ Default  │ │ Default  │ │ Default  │ │ Dangerous│
R   MED  │ Deploy   │ │ Deploy   │ │ Deploy   │ │Migration │
E        │ 0.95     │ │ 0.85     │ │+caution  │ │ 0.75     │
V        └──────────┘ └──────────┘ └──────────┘ └──────────┘
E
R   HIGH  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
S        │ Default  │ │ Default  │ │Dangerous │ │Dangerous │
I   IRREV│ Deploy   │ │ Deploy   │ │Migration │ │Migration │
B        │+dry-run  │ │+dry-run  │ │ 0.90     │ │ 0.95     │
I        └──────────┘ └──────────┘ └──────────┘ └──────────┘
L
I   HUMAN ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
T   PER   │ Default  │ │ Default  │ │Human-in- │ │Human-in- │
Y   CHANGE│ Deploy   │ │ Deploy   │ │Loop      │ │Loop      │
         │ 0.85     │ │ 0.80     │ │ 0.85     │ │ 0.90     │
          └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## 7. Key Files Referenced

| File | Role |
|------|------|
| `A-FORGE/src/interfaces/server.ts` | POST /execute — ACT gate integration |
| `A-FORGE/src/domain/governance/ActGateClient.ts` | TypeScript ACT gate client |
| `A-FORGE/src/domain/governance/ActPatterns.ts` | 3 canonical patterns + selector |
| `A-FORGE/src/domain/planner/PlanValidator.ts` | `selectActPattern()` integration |
| `arifOS/arifosmcp/runtime/act.py` | ACT runtime — stage/pattern/human checks |
| `arifOS/arifosmcp/runtime/act_library.py` | ACT program memory |
| `arifOS/arifosmcp/runtime/art.py` | ART 1.0 reflex |
| `arifOS/arifosmcp/runtime/art_predict.py` | ART 2.0 predictive trust module |
| `arifOS/arifosmcp/runtime/pre_execution_gate.py` | Gate 2.5 (ART) + Gate 2.6 (ACT) |
| `arifOS/GENESIS/040_ACT_PLAYBOOK.md` | ACT doctrine + canonical patterns |

---

**DITEMPA BUKAN DIBERI — Execution flow is forged, not configured.**
