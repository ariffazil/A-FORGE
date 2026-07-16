<!-- SOT-MANIFEST
project: arifOS Federation — A-FORGE
tool: forge_visual_qa
floor: F2 TRUTH (Closed-Loop Visual Governance)
owner: Muhammad Arif bin Fazil (F13 SOVEREIGN)
created: 2026-07-16
patched: 2026-07-16 — v1.2: Full W³ Tri-Witness Extension + Anti-Collusion + Routing Spec
status: DRAFT — awaiting wiring into A-FORGE tool surface
core_axiom: Code is not evidence; pixels are.
-->

# MCP Tool Contract: forge_visual_qa

**System:** arifOS Federation
**Floor:** F2 Truth (Closed-Loop Visual Governance)
**Core Axiom:** Code is not evidence; pixels are.
**Version:** v1.2 — Sovereignty + Scar + W³ Tri-Witness + Anti-Collusion + Routing

---

## 0. Compile-Into-Runtime Routing

```
insight:    Visual claims require pixel evidence, not code assertions
organ:      Reality (compute lane) + Governance (floor enforcement)
failure:    Code passes tests but renders wrong → silent F2 violation
action:     Closed-loop render→screenshot→validate→iterate with entropy gate
telemetry:  visual_qa_verdict, visual_qa_entropy_delta, visual_qa_iterations
```

| Field | Mapping |
|-------|---------|
| Brain/Hands | Hands (A-FORGE executes renders, arifOS judges verdict) |
| Action Class | `EXECUTE_REVERSIBLE` (render + screenshot are ephemeral) |
| Lease Required | Yes — `forge_lease_request` with scope `visual_qa` |
| Judge Required | For PASS_CANDIDATE → route through `forge_judge_proxy` → `arif_judge` before SEALED_DEPLOY |
| Seal Required | For SEALED_DEPLOY → `arif_seal` with `composite_hash` as evidence |
| Organ Boundary | A-FORGE renders + captures. arifOS judges + seals. |
| Witness Boundary | W₁ (vision) and W₂ (linter) are DECOUPLED. Neither can write W₃. |

---

## 1. Description

Executes closed-loop visual governance. Renders HTML, captures a physical screenshot, validates via **three independent witnesses** (W³), and iterates until visual deviations are below the threshold.

**Enforces F2 TRUTH invariant:** No success state can be returned without pixel-based evidence, confirmed entropy reduction (ΔS < 0), Tri-Witness consensus (W₁+W₂ confirmed, W₃ pending), and a mandatory 888_HOLD flag.

**Enforces F1 AMANAH invariant:** The verdict `PASS` does not exist. The forge cannot grant itself a terminal success state. Only `PASS_CANDIDATE` (awaiting human) and `SEALED_DEPLOY` (post-888 cryptographic approval) are valid terminal states.

**Enforces anti-collusion invariant:** No single witness can forge the composite seal. VAULT999 only accepts `composite_hash = SHA256(w1.hash ∥ w2.hash ∥ w3.hash ∥ verdict)`.

---

## 2. Input Constraints

*The payload must contain the targeted DOM/CSS structure. Empty payloads trigger a HARD_FAULT.*

| Parameter | Type | Default | Constraint |
| :--- | :--- | :--- | :--- |
| `url` | String | (Required) | The target URL to render and validate. |
| `dom_payload` | String | (Required) | The structural syntax. `minLength: 32`. |
| `design_spec` | String | null | Path to design spec file or inline constraints JSON. |
| `max_iterations` | Number | 3 | Limits render-validate cycles. `min: 1`, `max: 5`. |
| `mode` | String | `iterate_and_fix` | `validate_only`, `iterate_and_fix`, or `full_loop`. |

**Visual Constraints Object (Required):**

| Constraint | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `max_nav_links` | Number | 5 | Maximum navigation links allowed. |
| `min_contrast_ratio` | Number | 4.5 | Minimum WCAG contrast ratio. |
| `max_allowed_deviation_score` | Number | 0.05 | Normalized threshold (0-1). Below or equal → PASS_CANDIDATE. |
| `required_elements` | Array | `["nav", "main", "footer"]` | DOM elements that must be present. |
| `forbidden_elements` | Array | `[]` | DOM elements that must NOT be present. |
| `max_status_opacity` | Number | 0.5 | Maximum opacity for status indicators. |
| `min_hero_font_ratio` | Number | 2.0 | Minimum hero font size ratio relative to body. |

---

## 3. Output Constraints

*No success without `screenshot_hash`, `vision_validation_score`, and fully populated `tri_witness_ledger`.*

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `verdict` | String | `PASS_CANDIDATE`, `SEALED_DEPLOY`, `HOLD`, or `FAIL`. **`PASS` does not exist.** |
| `iterations` | Number | Completed render-validate-iterate cycles. |
| `deviations` | Array | Objects containing `id`, `description`, `severity` (0-1), `location_hint`, `source` (W1/W2/MERGED). |
| `code_diff` | String | Unified diff of applied fixes (empty if `validate_only`). |
| `screenshot_path` | String | **[MANDATORY]** Path or URI to the physical render. |
| `screenshot_hash` | String | **[MANDATORY]** SHA256 hash of screenshot. Pattern: `^[a-f0-9]{64}$`. |
| `vision_validation_score` | Number | Normalized score (0-1). 1.0 = perfect adherence. |
| `entropy_delta` | Number | `prev_deviations_count - curr_deviations_count`. **Must be < 0 for PASS_CANDIDATE.** |
| `requires_888_hold` | Boolean | **[MANDATORY]** Must be `true` for PASS_CANDIDATE. |
| `tri_witness_ledger` | Object | **[MANDATORY]** W³ consensus state with independent hashes. See §9. |
| `composite_hash` | String | **[MANDATORY]** `SHA256(w1.hash ∥ w2.hash ∥ w3.hash ∥ verdict)`. This is what VAULT999 seals. |
| `integration_receipts` | Object | Cross-system receipts: `vault999_seal_candidate`, `arif_judge_ticket_id`, `well_operator_check_id`. |

---

## 4. Runtime Physics (Execution Logic)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    forge_visual_qa LOOP (v1.2)                            │
│                                                                           │
│  INPUT: dom_payload + url + constraints + mode                            │
│    │                                                                      │
│    ▼                                                                      │
│  [I1] VALIDATE INPUT                                                      │
│    dom_payload missing or < 32 chars? → HARD_FAULT (FAIL)                │
│    │                                                                      │
│    ▼                                                                      │
│  ┌─── ITERATION N ─────────────────────────────────────────────────┐      │
│  │                                                                  │      │
│  │  RENDER (headless) → screenshot_path                             │      │
│  │    │                                                             │      │
│  │    ▼                                                             │      │
│  │  HASH → screenshot_hash (SHA256)                                 │      │
│  │    │                                                             │      │
│  │    ├──────────────────────┬──────────────────────┐               │      │
│  │    ▼                      ▼                      │               │      │
│  │  W₁ VALIDATE            W₂ VALIDATE              │               │      │
│  │  (Vision Model)         (DOM Linter)             │               │      │
│  │  pixels → OBS/INT       DOM/spec → DER           │               │      │
│  │    │                      │                      │               │      │
│  │    ▼                      ▼                      │               │      │
│  │  w1.verdict             w2.verdict               │               │      │
│  │  w1.hash                w2.hash                  │               │      │
│  │  w1.score               w2.score                 │               │      │
│  │    │                      │                      │               │      │
│  │    └──────────┬───────────┘                      │               │      │
│  │               ▼                                  │               │      │
│  │         MERGE DEVIATIONS                         │               │      │
│  │         curr_deviations = dedup(W1 ∪ W2)         │               │      │
│  │               │                                  │               │      │
│  │               ▼                                  │               │      │
│  │         [I3] ENTROPY CHECK                       │               │      │
│  │         entropy_delta >= 0 after iter 1?         │               │      │
│  │         → HARD-FAULT to HOLD                     │               │      │
│  │               │                                  │               │      │
│  │               ▼                                  │               │      │
│  │         DECISION                                 │               │      │
│  │         deviations ≤ threshold?                  │               │      │
│  │         W₁ PASS + W₂ PASS?                       │               │      │
│  │         → PASS_CANDIDATE (W₃ = PENDING)          │               │      │
│  │               │                                  │               │      │
│  │               ▼                                  │               │      │
│  │         [I7] SCAR CONSULTATION                   │               │      │
│  │         deviation pattern → forge_scar consult   │               │      │
│  │         scar found? → use historical fix         │               │      │
│  │         no scar? → generate new fix              │               │      │
│  │               │                                  │               │      │
│  │               ▼                                  │               │      │
│  │         [I4] ITERATE                             │               │      │
│  │         mode allows fixes? → apply, loop         │               │      │
│  │         max_iterations? → forced HOLD            │               │      │
│  │                                                                  │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                           │
│  ┌─── W₃ SOVEREIGN GATE (post-loop) ──────────────────────────────┐      │
│  │                                                                  │      │
│  │  PASS_CANDIDATE emitted (W₁=PASS, W₂=PASS)                      │      │
│  │    │                                                             │      │
│  │    ▼                                                             │      │
│  │  arif_judge → human reviews screenshot + W₁ + W₂ + entropy      │      │
│  │    │                                                             │      │
│  │    ├── APPROVE → w3.verdict = PASS                               │      │
│  │    │   w3.hash = signed_receipt                                   │      │
│  │    │   w3.actor_id = "ARIF"                                      │      │
│  │    │   w3.timestamp = ISO8601                                    │      │
│  │    │   composite_hash = SHA256(w1.hash ∥ w2.hash ∥ w3.hash ∥ v) │      │
│  │    │   → verdict = SEALED_DEPLOY                                  │      │
│  │    │   → arif_seal(composite_hash) → VAULT999                     │      │
│  │    │                                                             │      │
│  │    └── REJECT → w3.verdict = FAIL                                │      │
│  │        → verdict = HOLD (return to agent with reason)            │      │
│  │                                                                  │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                           │
│  OUTPUT: verdict + composite_hash + tri_witness_ledger                    │
│    + screenshot_hash + vision_validation_score + entropy_delta            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Step-by-step:

1. **I1 (Input Validation):** If `dom_payload` is missing or < 32 chars → `FAIL` (Error: `DOM_PAYLOAD_MISSING`).
2. **Render:** Execute headless render of `dom_payload` at `url`. Generate `screenshot_path` and `screenshot_hash` (SHA256).
3. **W₁ Validate (Physical/Vision):** Vision model analyzes screenshot against `constraints`. Returns `w1.verdict`, `w1.hash = screenshot_hash`, `w1.score = vision_validation_score`. **Label: OBS/INT only. No DOM mutation authority.**
4. **W₂ Validate (Structural/Syntax):** Deterministic DOM linter validates `dom_payload` against `required_elements`, `forbidden_elements`, structural rules. Returns `w2.verdict`, `w2.hash = SHA256(lint_report)`. **Purely algorithmic — no model, no guessing. Label: DER.**
5. **Merge Deviations:** Combine W₁ + W₂ deviations. Deduplicate by `id`. Compute `curr_deviations` and `entropy_delta`.
6. **Entropy Check (I3):** If `entropy_delta >= 0` after iteration 1 → Hard-fault to `HOLD`.
7. **Decision:** If `curr_deviations ≤ threshold` AND `w1.verdict == PASS` AND `w2.verdict == PASS` → emit `PASS_CANDIDATE` with `w3.verdict = "PENDING_888_HOLD"`.
8. **I7 Scar Consultation:** Before generating fixes, query `forge_scar(mode="consult", fingerprint=deviation_pattern_hash)`.
9. **Iteration (I4):** If deviations remain and `mode` allows fixes, apply `code_diff` and loop. If `max_iterations` reached → `HOLD`.
10. **W₃ Sovereign Gate:** After `PASS_CANDIDATE`, route to `arif_judge` → human reviews → signs receipt → `composite_hash = SHA256(w1.hash ∥ w2.hash ∥ w3.hash ∥ verdict)` → `arif_seal` → VAULT999.

---

## 5. Formalized Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| **I1** | No visual claim without a screenshot | `output` MUST include `screenshot_path` (minLength: 8). Missing → `FAIL`. |
| **I2** | Screenshot is the only admissible evidence | Vision model operates on pixels only. No code-level assertions accepted as visual proof. |
| **I3** | ΔS < 0 per iteration | `entropy_delta` must be < 0 for progress. ΔS ≥ 0 after iter 1 → `HOLD`. |
| **I4** | Maximum iterations bounded | After `max_iterations` (default 3, max 5) → forced `888_HOLD`. |
| **I5** | Human authority is final | `PASS` does not exist. `PASS_CANDIDATE` always sets `requires_888_hold = true`. No auto-deploy. |
| **I6** | Hash-chain receipt | `composite_hash` (SHA256) MUST be present for any verdict to allow `arif_seal`. |
| **I7** | Scar consultation before fix generation | Before generating `code_diff`, agent MUST query `forge_scar(mode="consult")` for deviation patterns. |
| **I8** | Tri-Witness consensus required | `tri_witness_ledger` MUST be fully populated. W₁+W₂ confirmed before PASS_CANDIDATE. W₃ only after human ack. |
| **I9** | Anti-collusion: witness decoupling | W₁ sees pixels only. W₂ sees DOM/spec only. W₃ sees both + history. Neither W₁ nor W₂ can write W₃ fields. |
| **I10** | Composite seal | VAULT999 seals `composite_hash = SHA256(w1.hash ∥ w2.hash ∥ w3.hash ∥ verdict)`, not any single witness hash. |

---

## 6. Failure Modes

| Failure | Trigger | Verdict | Recovery |
|---------|---------|---------|----------|
| `DOM_PAYLOAD_MISSING` | `dom_payload` absent or < 32 chars | `FAIL` | Provide valid DOM/CSS payload |
| `ENTROPY_NON_DECREASING` | `entropy_delta >= 0` after iteration 1 | `HOLD` | Human review — auto-fix is diverging |
| `MAX_ITERATIONS_REACHED` | Iterations exceed `max_iterations` | `HOLD` | Human review — threshold may be too strict |
| `VISION_MODEL_UNAVAILABLE` | Vision model returns error | `HOLD` | W₁ channel collapsed — cannot form W³ |
| `DOM_LINTER_FAILURE` | DOM linter returns error | `HOLD` | W₂ channel collapsed — cannot form W³ |
| `RENDER_FAILURE` | Headless browser crashes | `FAIL` | Check URL accessibility, retry |
| `HASH_MISMATCH` | `screenshot_hash` doesn't match file | `FAIL` | Re-render, re-hash — evidence integrity breach |
| `SCAR_MATCH_FOUND` | Deviation pattern matches known scar | `HOLD` | Historical fix failed before — human review required |
| `WITNESS_COUPLING_DETECTED` | W₁ or W₂ attempts to write W₃ fields | `FAIL` | Governance violation — escalate to 888_HOLD |
| `COMPOSITE_HASH_MISSING` | `composite_hash` not computed | `FAIL` | Cannot seal to VAULT999 without composite |

---

## 7. Integration with arifOS Governance Loop

```
forge_visual_qa (A-FORGE, Hands)
    │
    ├── PASS_CANDIDATE (W₁=PASS, W₂=PASS, W₃=PENDING)
    │     │
    │     ▼
    │   tri_witness_ledger populated
    │   composite_hash NOT YET COMPUTED (W₃ unsigned)
    │     │
    │     ▼
    │   forge_judge_proxy → arif_judge (arifOS, Brain)
    │     │
    │     ├── Human APPROVES
    │     │     └── W₃ = PASS, w3.hash = signed_receipt
    │     │     └── composite_hash = SHA256(w1.hash ∥ w2.hash ∥ w3.hash ∥ verdict)
    │     │     └── verdict = SEALED_DEPLOY
    │     │     └── arif_seal(composite_hash) → VAULT999
    │     │
    │     └── Human REJECTS
    │           └── W₃ = FAIL
    │           └── verdict = HOLD (return to agent with rejection reason)
    │
    ├── HOLD (entropy, iterations, scar, W₁/W₂ failure)
    │     │
    │     └── Escalate to human (F13 SOVEREIGN)
    │
    └── FAIL (structural breach, witness coupling)
          │
          └── Log error, return to caller
```

**Key rule:** A-FORGE renders and validates. arifOS judges and seals. The forge never marks its own homework. `PASS` is not a valid verdict — only `PASS_CANDIDATE` (pending human) or `SEALED_DEPLOY` (post-human).

---

## 8. Scar Consultation Layer (I7 — Temporal Memory)

Before applying auto-fixes in `iterate_and_fix` or `full_loop` mode, the agent MUST:

1. Hash the deviation pattern: `fingerprint = SHA256(sorted(deviation.id + deviation.location_hint))`
2. Call `forge_scar(mode="consult", fingerprint=fingerprint)`
3. If matching scar found:
   - Retrieve `historical_fix` from scar record
   - If `historical_fix.outcome == "FAILED"` → skip auto-fix, escalate to `HOLD`
   - If `historical_fix.outcome == "PARTIAL"` → use historical fix as starting point, flag for review
4. If no scar → proceed with new fix generation
5. After fix attempt: call `forge_scar(mode="seal")` to record outcome

**Why this matters:** Without scar consultation, the agent repeats the same CSS/layout fixes that failed in previous sessions. The scar database is the agent's memory of punished failures.

```
SCAR CONSULTATION FLOW:

  deviation_detected
       │
       ▼
  hash_pattern(deviation)
       │
       ▼
  forge_scar(mode="consult", fingerprint)
       │
       ├── MATCH + outcome=FAILED → HOLD (don't repeat the failure)
       ├── MATCH + outcome=PARTIAL → use historical fix, flag for review
       └── NO MATCH → generate new fix
                │
                ▼
           forge_scar(mode="seal") after attempt
```

---

## 9. Tri-Witness Validation (W³ — Anti-Collusion Consensus Gate)

### 9.1 The Three Witnesses

| Witness | Channel | Substrate | Label | What it validates | Hash anchor |
|---------|---------|-----------|-------|-------------------|-------------|
| **W₁** | Physical/Perception | Multimodal Vision Model | OBS/INT | Pixels against visual constraints (contrast, layout, element presence) | `w1.hash = screenshot_hash` |
| **W₂** | Structural/Syntax | Deterministic DOM Linter | DER | HTML tags exist in payload, no forbidden elements, required structure present | `w2.hash = SHA256(lint_report)` |
| **W₃** | Sovereign/Human | arif_judge + Human | JUDGE | "Does this look right to my eyes?" + entropy history + W₁/W₂ evidence | `w3.hash = signed_receipt` |

### 9.2 Decoupling Invariants (Anti-Collusion)

```
W₁ SEES:   pixels only. Screenshot + constraints → score + verdict.
W₁ CANNOT: mutate DOM, write W₂ fields, write W₃ fields, claim final PASS.

W₂ SEES:   DOM/spec only. Payload + design_spec → structural pass/fail.
W₂ CANNOT: render screenshots, write W₁ fields, write W₃ fields, claim final PASS.

W₃ SEES:   both W₁ + W₂ + entropy history + screenshot + DOM.
W₃ CANNOT: be written by W₁ or W₂. Only human action via arif_judge.

COLLUSION DETECTION:
  IF any tool attempts to set w3.* fields AND caller is NOT arif_judge
    → FAIL + governance violation
    → escalate to 888_HOLD
```

### 9.3 `tri_witness_ledger` Schema

```typescript
interface TriWitnessLedger {
  w1: {
    verdict: "PASS" | "HOLD" | "FAIL";
    hash: string;        // SHA256 of screenshot — /^[a-f0-9]{64}$/
    score: number;       // vision_validation_score (0-1)
    evidence: string;    // e.g. "vision model: 0.92 adherence, 3 deviations"
    label: "OBS" | "INT";
  };
  w2: {
    verdict: "PASS" | "HOLD" | "FAIL";
    hash: string;        // SHA256 of lint_report — /^[a-f0-9]{64}$/
    score: number;       // structural compliance (0-1)
    evidence: string;    // e.g. "nav,main,footer present; no forbidden elements"
    label: "DER";
  };
  w3: {
    verdict: "PENDING_888_HOLD" | "PASS" | "FAIL";
    hash: string;        // signed human receipt — /^[a-f0-9]{64}$/
    actor_id: string;    // operator identity (e.g. "ARIF")
    timestamp: string;   // ISO8601
    evidence: string;    // e.g. "human approved via cockpit SEAL button"
    label: "JUDGE";
  };
  composite_hash: string; // SHA256(w1.hash ∥ w2.hash ∥ w3.hash ∥ verdict)
}
```

### 9.4 Composite Seal

```typescript
// VAULT999 seals THIS, not any single witness hash
composite_hash = SHA256(
  w1.hash + w2.hash + w3.hash + final_verdict
);

// No single witness can forge the seal.
// W₁ has no access to w2.hash or w3.hash.
// W₂ has no access to w1.hash or w3.hash.
// Only the governance loop (arif_judge → arif_seal) assembles all four.
```

### 9.5 W³ Formula

```
W³ = ∛(W₁ × W₂ × W₃)

Where:
  W₁ = w1.score (0-1) — vision_validation_score
  W₂ = w2.score (0-1) — structural compliance
  W₃ = 0 (PENDING_888_HOLD) until human approves → 1.0 (SOVEREIGN_APPROVED)
```

**Zero in any channel collapses consensus.** If W₁=0 (vision fails) or W₂=0 (DOM is structurally wrong), the result cannot be PASS_CANDIDATE regardless of other scores.

---

## 10. Deployment Gate (888 → 999)

```
IF   tri_witness_ledger.w1.verdict == "PASS"
AND  tri_witness_ledger.w2.verdict == "PASS"
AND  tri_witness_ledger.w3.verdict == "PASS"    ← only after human ACK
AND  entropy_delta < 0
AND  composite_hash is computed
THEN:
  verdict = "SEALED_DEPLOY"
  → arif_seal(composite_hash) → VAULT999

IF   tri_witness_ledger.w1.verdict == "PASS"
AND  tri_witness_ledger.w2.verdict == "PASS"
AND  tri_witness_ledger.w3.verdict == "PENDING_888_HOLD"
AND  entropy_delta < 0
THEN:
  verdict = "PASS_CANDIDATE"
  requires_888_hold = true
  → arif_judge → human reviews

ELSE:
  verdict = "HOLD" or "FAIL"
  → escalate to human
```

---

## 11. Routing Spec: Hermes Constitutional Sequence (W³ Orchestration)

Hermes (or any orchestration agent) MUST obey this strict routing order:

### Step 1: W₁ — Vision (OBS/INT)

```
Tool:       forge_visual_qa → vision sub-call (MiniMax / GPT-4V / Claude)
Input:      screenshot_path, constraints
Output:     w1.verdict, w1.hash = screenshot_hash, w1.score = vision_validation_score
Label:      OBS/INT only — no DOM mutation authority
Substrate:  Multimodal pixels
```

### Step 2: W₂ — Structural/Spec (DER)

```
Tool:       forge_dom_lint (deterministic linter)
Input:      dom_payload, design_spec, required_elements, forbidden_elements
Output:     w2.verdict, w2.hash = SHA256(lint_report), w2.score
Label:      DER — purely algorithmic, no model, no guessing
Substrate:  DOM/CSS/spec
```

### Step 3: W₃ — Sovereign/Human (JUDGE)

```
Tool:       arif_judge → WELL operator console
Input:      final screenshot, dom_payload, w1 evidence, w2 evidence, entropy history
Output:     w3.verdict, w3.hash = signed_receipt, w3.actor_id, w3.timestamp
Label:      JUDGE — only W₃ can authorize deployment
Substrate:  Human + OS governance
```

### Routing Invariants (Binding for All Orchestrators)

```
ORCHESTRATOR MUST:
  1. Call W₁ and W₂ in parallel or sequence, but NEVER allow either to write W₃.
  2. Refuse any tool that attempts to set w3.* fields.
  3. Refuse any deployment if tri_witness_ledger.w3 is missing or unsigned.
  4. Treat any attempt by W₁ or W₂ to claim "final PASS" as a GOVERNANCE VIOLATION.
  5. Compute composite_hash ONLY after all three witnesses are populated.
  6. Route composite_hash to arif_seal ONLY after W₃ = PASS.
```

### Anti-Collusion Enforcement

```
COLLUSION PREVENTION:
  - W₁ sees pixels only. Cannot access DOM or W₂/W₃ data.
  - W₂ sees DOM/spec only. Cannot access screenshots or W₁/W₃ data.
  - W₃ sees both + history. Cannot be written by W₁ or W₂.
  - composite_hash requires all three — no single witness can forge the seal.
  - VAULT999 only accepts composite_hash, not any individual witness hash.
```

---

## 12. Verdict Semantics (v1.2)

| Verdict | Meaning | W³ State | Next Action |
|---------|---------|----------|-------------|
| `PASS_CANDIDATE` | Deviations ≤ threshold AND ΔS < 0 AND W₁+W₂ confirmed | W₁=PASS, W₂=PASS, W₃=PENDING | Route to `arif_judge` → await human via `888_HOLD`. |
| `SEALED_DEPLOY` | Post-human cryptographic approval | W₁=PASS, W₂=PASS, W₃=PASS | `arif_seal(composite_hash)` → VAULT999. Deployment authorized. |
| `HOLD` | Entropy non-decreasing OR max iterations OR scar match OR W₁/W₂ failure | Any channel may be degraded | Escalate to human (F13 SOVEREIGN). No auto-fix. |
| `FAIL` | Structural breach (missing payload, render failure, witness coupling) | N/A | Return error to caller. No retry without new input. |

**`PASS` does not exist.** The forge cannot grant itself a terminal success state.

---

## Appendix A: TypeScript Interface (for A-FORGE wiring)

```typescript
type Verdict = "PASS_CANDIDATE" | "SEALED_DEPLOY" | "HOLD" | "FAIL";

interface WitnessResult {
  verdict: string;
  hash: string;           // SHA256, /^[a-f0-9]{64}$/
  score: number;          // 0-1
  evidence: string;
  label: string;          // OBS | INT | DER | JUDGE
}

interface W3Result extends WitnessResult {
  actor_id: string;
  timestamp: string;      // ISO8601
}

interface TriWitnessLedger {
  w1: WitnessResult;      // Vision — OBS/INT
  w2: WitnessResult;      // DOM Linter — DER
  w3: W3Result;           // Sovereign — JUDGE
  composite_hash: string; // SHA256(w1.hash ∥ w2.hash ∥ w3.hash ∥ verdict)
}

interface ForgeVisualQAInput {
  url: string;
  dom_payload: string;           // minLength: 32
  design_spec?: string;
  constraints: {
    max_nav_links: number;       // default: 5
    min_contrast_ratio: number;  // default: 4.5
    max_allowed_deviation_score: number; // default: 0.05
    required_elements?: string[];
    forbidden_elements?: string[];
    max_status_opacity?: number;
    min_hero_font_ratio?: number;
  };
  max_iterations?: number;       // default: 3, min: 1, max: 5
  mode?: "validate_only" | "iterate_and_fix" | "full_loop";
}

interface VisualDeviation {
  id: string;
  description: string;
  severity: number;              // 0-1
  location_hint?: string;
  source: "W1_VISION" | "W2_LINTER" | "MERGED";
}

interface ForgeVisualQAOutput {
  verdict: Verdict;
  iterations: number;
  deviations: VisualDeviation[];
  code_diff: string;
  screenshot_path: string;       // MANDATORY, minLength: 8
  screenshot_hash: string;       // MANDATORY, SHA256
  vision_validation_score: number;
  entropy_delta: number;
  requires_888_hold: boolean;    // MANDATORY, true for PASS_CANDIDATE
  tri_witness_ledger: TriWitnessLedger; // MANDATORY
  composite_hash: string;        // MANDATORY for SEALED_DEPLOY
  integration_receipts?: {
    vault999_seal_candidate?: string;
    arif_judge_ticket_id?: string;
    well_operator_check_id?: string;
  };
  error?: string;
}
```

---

## Appendix B: Zod Schema (for A-FORGE MCP registration)

```typescript
import { z } from "zod";

const VerdictSchema = z.enum(["PASS_CANDIDATE", "SEALED_DEPLOY", "HOLD", "FAIL"]);

const WitnessResultSchema = z.object({
  verdict: z.enum(["PASS", "HOLD", "FAIL"]),
  hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be SHA256 hex"),
  score: z.number().min(0).max(1),
  evidence: z.string(),
  label: z.enum(["OBS", "INT", "DER", "JUDGE"]),
});

const W3ResultSchema = WitnessResultSchema.extend({
  verdict: z.enum(["PENDING_888_HOLD", "PASS", "FAIL"]),
  actor_id: z.string(),
  timestamp: z.string().datetime(),
  label: z.literal("JUDGE"),
});

const TriWitnessLedgerSchema = z.object({
  w1: WitnessResultSchema,
  w2: WitnessResultSchema,
  w3: W3ResultSchema,
  composite_hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be SHA256 hex"),
});

const VisualDeviationSchema = z.object({
  id: z.string(),
  description: z.string(),
  severity: z.number().min(0).max(1),
  location_hint: z.string().optional(),
  source: z.enum(["W1_VISION", "W2_LINTER", "MERGED"]),
});

const VisualConstraintsSchema = z.object({
  max_nav_links: z.number().default(5),
  min_contrast_ratio: z.number().default(4.5),
  max_allowed_deviation_score: z.number().min(0).max(1).default(0.05),
  required_elements: z.array(z.string()).default(["nav", "main", "footer"]),
  forbidden_elements: z.array(z.string()).default([]),
  max_status_opacity: z.number().min(0).max(1).default(0.5),
  min_hero_font_ratio: z.number().min(1).default(2.0),
});

const ForgeVisualQAInputSchema = z.object({
  url: z.string().url(),
  dom_payload: z.string().min(32, "DOM payload must be at least 32 characters"),
  design_spec: z.string().optional(),
  constraints: VisualConstraintsSchema,
  max_iterations: z.number().int().min(1).max(5).default(3),
  mode: z.enum(["validate_only", "iterate_and_fix", "full_loop"]).default("iterate_and_fix"),
});

const ForgeVisualQAOutputSchema = z.object({
  verdict: VerdictSchema,
  iterations: z.number().int(),
  deviations: z.array(VisualDeviationSchema),
  code_diff: z.string(),
  screenshot_path: z.string().min(8),
  screenshot_hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be SHA256 hex"),
  vision_validation_score: z.number().min(0).max(1),
  entropy_delta: z.number(),
  requires_888_hold: z.literal(true),
  tri_witness_ledger: TriWitnessLedgerSchema,
  composite_hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be SHA256 hex"),
  integration_receipts: z.object({
    vault999_seal_candidate: z.string().optional(),
    arif_judge_ticket_id: z.string().optional(),
    well_operator_check_id: z.string().optional(),
  }).optional(),
  error: z.string().optional(),
});
```

---

## Appendix C: Patch Changelog

| Patch | Date | What Changed | Why |
|-------|------|-------------|-----|
| v1.0 | 2026-07-16 | Initial contract | F2 visual governance gap — code is not evidence, pixels are |
| v1.1 | 2026-07-16 | **Sovereignty Patch** — removed `PASS`, added `PASS_CANDIDATE` + `SEALED_DEPLOY` | The forge cannot grant itself a terminal success state (F1 AMANAH) |
| v1.1 | 2026-07-16 | **Scar Consultation** — added I7 invariant + `forge_scar` before fix generation | Prevents repeating punished failures from prior sessions |
| v1.1 | 2026-07-16 | **Tri-Witness W³** — added I8 + `tri_witness_ledger` with W1/W2/W3 channels | Vision model cannot be sole arbiter |
| v1.2 | 2026-07-16 | **W³ Full Extension** — proper witness schemas with independent hashes | Each witness must hash independently before composite seal |
| v1.2 | 2026-07-16 | **Anti-Collusion Physics** — added I9 + I10 invariants | W₁/W₂ decoupled, cannot write W₃, composite_hash required for VAULT999 |
| v1.2 | 2026-07-16 | **Routing Spec** — Hermes constitutional sequence for W³ orchestration | Prevents hallucinated consensus — witnesses must be sequenced correctly |
| v1.2 | 2026-07-16 | **Deployment Gate** — explicit 888→999 flow with composite_hash | VAULT999 seals composite, not individual witness |
| v1.2 | 2026-07-16 | Added `source` field to `VisualDeviation` | Tracks whether deviation came from W₁ (vision) or W₂ (linter) |

---

*DITEMPA BUKAN DIBERI — Code is not evidence; pixels are. The forge does not mark its own homework. No single witness can forge the seal.*
