# 🔐 Claim Verification Gate — Spec v0.1

**Forged:** 2026-07-10  
**Author:** FORGE (000Ω)  
**Motivation:** 5 bangang in one session — all sharing "source-read treated as ground truth"  
**Constitutional floor:** F2 TRUTH · F4 CLARITY · F9 ANTI-HANTU  
**Heritage:** shadow-diagnostic · CONSTITUTIONAL_REFLEX · arifOS metabolic loop

---

## 1. The Problem

An agent with full session authority, tool access, and a sovereign mandate emitted **five confident false claims** in one session. Every claim shared one structural root:

> **An OBS-level claim was emitted without a corresponding tool_result in the same turn's evidence chain.**

| # | Claim | Root cause | Gate trigger |
|---|-------|-----------|--------------|
| 1 | "Enrichment done across all 5 organs" | Source code read ≠ live surface | OBS claim, no live probe |
| 2 | "WEALTH enrichment confirmed live" | Source code read ≠ live surface | OBS claim, no live probe |
| 3 | "GEOX deregistration clean" | Mutation without dry-run | OBS claim, no test result |
| 4 | "A-FORGE enrichment done" | Registry read ≠ live surface | OBS claim, no live probe |
| 5 | "Source files have Use-when — done" | File read ≠ runtime behavior | OBS claim, no runtime check |

**The gate exists to make this pattern mechanically impossible regardless of which model sits behind the wheel.**

---

## 2. What the Gate Checks

For every output that contains epistemic labels (OBS/DER/INT/SPEC):

> **Every OBS-labeled claim MUST have a corresponding tool_result in the turn's evidence chain.**

The evidence chain is constructed from every tool call dispatched during the current turn — including its `tool_name`, `parameters`, `result` (or error), and `epistemic_label`.

**What gets flagged:**

| Pattern | Example | Gate action |
|---------|---------|-------------|
| OBS claim, tool never called | "Live surface has 79 tools" (no forge_registry_status called) | BLOCK |
| OBS claim, tool returned error | "Enrichment confirmed" (tool raised exception, caught silently) | BLOCK |
| OBS claim, no tool in chain at all | "Build passed" (no test/syntax command in turn history) | BLOCK |

**What does NOT get flagged:**
- DER (derived) claims — these are computed from evidence, not observed directly
- INT (interpreted) claims — these are synthesis, not direct observation
- SPEC (speculation) claims — these are explicitly uncertain
- OBS claims with a valid tool_result in the same turn's chain

---

## 3. Where the Gate Lives

The gate sits at the **arif_compose** boundary — the last stage before output reaches human eyes.

```
arif_observe → arif_think → arif_critique → arif_judge → arif_forge → arif_compose
                                                              ^
                                                         GATE HERE
```

**Why arif_compose and not earlier:**
- arif_observe is too early — evidence is still being gathered, claims aren't formed yet
- arif_think is the claim-formation stage — we want claims to be formed, then checked
- arif_judge decides SEAL/HOLD — it needs the gate result as an input
- arif_compose is the LAST stop before output — the gate blocks corrupted output from ever being formatted

**Detailed flow:**

1. Agent produces output text with epistemic labels
2. arif_compose receives: `{message, evidence_receipts, style}`
3. Gate scans `message` for epistemic labels matching pattern `(OBS|OBSERVED):`
4. For each match, checks if `evidence_receipts` contains a tool_result with matching topic
5. If all OBS claims have evidence → proceed to format output normally
6. If any OBS claim lacks evidence → return DEGRADED_EVIDENCE instead

---

## 4. Gate Output (when triggered)

Instead of the formatted response, arif_compose returns:

```json
{
  "gate_verdict": "DEGRADED_EVIDENCE",
  "claims_at_risk": [
    {
      "claim": "Live surface has 79 tools",
      "epistemic_label": "OBS",
      "evidence_needed": "tool:forge_registry_status result for GEOX",
      "evidence_chain": ["tool:forge_registry_status was NOT dispatched this turn"],
      "recommended_action": "Call geox_surface_status(mode=registry) before re-claiming"
    }
  ],
  "downgrade_to": "INT",
  "next_safe_action": "Provide evidence for OBS claims or relabel as INT/SPEC",
  "bypass_available": "Pass ack_epistemic_degradation=true and override_reason to force SEAL"
}
```

This allows the agent to:
1. Acknowledge the gap and re-check (correct)
2. Relabel claims as INT/SPEC (honest)
3. Request sovereign override (F13)

---

## 5. Integration with arif_judge

arif_judge must check the gate verdict before emitting SEAL:

```python
if gate_verdict == "DEGRADED_EVIDENCE" and not ack_epistemic_degradation:
    return HOLD("DEGRADED_EVIDENCE — OBS claims without evidence")
```

This creates a **dependency chain**:

```
arif_compose gate → DEGRADED_EVIDENCE flag → arif_judge HOLD → no SEAL → no FORGE → no output
```

To break the chain: `ack_epistemic_degradation=true` + `override_reason` (F13 sovereign veto).

---

## 6. False Positive Protection

**What could trigger a false positive:**
- Self-evident OBS claims: "The current date is July 10, 2026" (known from system clock, no tool call needed)
- Claims about the agent's internal state: "I am running on DeepSeek V4 Pro" (from system prompt)

**Mitigation:**
- Gate enforces at the arif_compose layer, not at claim-formation. Agent CAN add tool_result receipts manually for claims from system context.
- In practice, these are rare in governed output — most OBS claims in a tool-use federation reference tool results.
- If false positive rate > 5% in production, add an allowlist for known-safe OBS categories (system info, timestamps).

---

## 7. Implementation Path

### Phase 1 — arif_compose modification (this sprint)

Modify arif_compose to:
1. Accept `evidence_receipts` parameter (list of tool_result summaries)
2. Scan `message` for epistemic label pattern
3. Check evidence chain
4. Return DEGRADED_EVIDENCE or formatted output

**Files to touch:**
- `/opt/arifos/app/arifosmcp/tools/kernel_canonical.py` — arif_compose handler
- `/opt/arifos/app/arifosmcp/constitutional_map.py` — tool spec for arif_compose
- `/root/arifOS/arifosmcp/constitutional_map.py` — same (source copy)

### Phase 2 — arif_judge integration (next sprint)

Add gate verdict check to arif_judge before SEAL:
- Import gate verdict from session context
- If DEGRADED_EVIDENCE and no override → HOLD
- Add override path with F13 requirement

### Phase 3 — Agent prompt-level awareness (doc)

Update agent prompts (AGENTS.md, SOUL.md, BOOTSTRAP.md) to:
1. Document the gate exists and how it works
2. Teach agents to provide evidence_receipts when calling arif_compose
3. Make the gate a default expectation, not an afterthought

---

## 8. How This Catches the 5 Bangang

| # | Before gate | After gate |
|---|-------------|------------|
| 1 | "Enrichment done" — no verify call, output emitted anyway | arif_compose: "OBS claim without evidence → BLOCK" |
| 2 | "WEALTH confirmed" — no live probe | arif_compose: "OBS claim without evidence → BLOCK" |
| 3 | "Deregistration clean" — no syntax test result | arif_compose: "OBS claim without evidence → BLOCK" |
| 4 | "A-FORGE done" — registry read ≠ live probe | arif_compose: "OBS claim without evidence → BLOCK" |
| 5 | "Source has Use-when" — file read ≠ runtime | arif_compose: "OBS claim without evidence → BLOCK" |

---

## 9. Open Questions

1. **How does the agent pass evidence_receipts to arif_compose?** — As a structured list, or as a reference to the session's tool call log?
2. **How does the gate parse epistemic labels from free-text output?** — Regex on `(OBS|OBSERVED):` pattern, or structured metadata in the output schema?
3. **What is the exact format of `evidence_receipts`?** — Minimum: `{tool_name, status, timestamp}`. Desired: `{tool_name, parameters, status, result_summary, epistemic_label, timestamp}`
4. **How does the gate handle chain-of-thought reasoning?** — If agent says "I think X" (INT) but then asserts "X is true" (OBS) without new evidence, does the gate catch it?

---

## 10. Success Criteria

The gate passes when:

1. All 5 historical bangang patterns are caught in testing
2. Zero false positives on 10 legitimate outputs (simple facts, DER claims, INT synthesis)
3. arif_judge correctly HOLDs when gate fires
4. F13 override correctly bypasses the gate
5. No new bangang of the same pattern in the next session

---

**DITEMPA BUKAN DIBERI — The gate is forged, not assumed.**
