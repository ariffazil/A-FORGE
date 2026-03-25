# GEOX Runtime Contracts
## "The Three Laws of GEOX — Encoded, Not Proclaimed"

> These are not guidelines or best practices. They are runtime invariants. Violation terminates the pipeline or escalates to 888 HOLD.

---

## Contract 1: Reality-First (Earth → Language)

**Canonical name**: `GEOX_CONTRACT_EARTH_FIRST`

### Trigger Condition
Any language-level claim about the physical Earth — porosity, pressure, depth, temperature, net pay, maturity — is produced during `synthesise()` as a `GeoInsight.text`.

### Enforcement Mechanism
1. `GeoXValidator.extract_predictions(text, location)` is called on every insight text
2. Every extracted `GeoPrediction` must include: `value`, `units`, `coordinates`, `timestamp`, `expected_range`, `confidence`
3. Uncertainty must be within `[0.03, 0.15]` (F7 Humility) unless `f7_override=True` with `override_justification` populated
4. `verify_prediction()` runs each prediction against the tool ensemble (minimum 1 Earth tool: `EarthModelTool` or `SimulatorTool`)
5. `ProvenanceRecord` must be attached with `source_type` in `["LEM", "simulator", "literature", "sensor"]`

### Failure Mode
- Prediction outside tool-returned range → `ValidationResult.verdict = "contradicted"`
- Any insight has `status = "contradicted"` → `AggregateVerdict.overall = "VOID"`
- `GeoResponse.verdict = "VOID"` triggers 888 HOLD

### Recovery Path
1. Flag insight for human review
2. Request additional tool data (more sensors, different LEM)
3. Reduce claim scope (widen expected_range, increase uncertainty)
4. Downgrade to SABAR if insufficient data rather than assert a contradicted claim

### Code Location
`geox_validator.py :: GeoXValidator.extract_predictions()`, `verify_prediction()`, `validate_batch()`

---

## Contract 2: Perception Bridge (Vision ≠ Truth)

**Canonical name**: `GEOX_CONTRACT_PERCEPTION_BRIDGE`

### Trigger Condition
Any `GeoInsight` whose supporting `GeoPrediction` was produced by `SeismicVLMTool` or `EOFoundationModelTool` (i.e., `ProvenanceRecord.source_type = "VLM"`).

### Enforcement Mechanism
1. **Structural invariant**: `SeismicVLMTool.run()` and `EOFoundationModelTool.run()` always return quantities with `uncertainty >= 0.15`. This is enforced in the tool implementation, not in post-processing.
2. **metadata invariant**: All VLM tool results include `metadata["multisensor_required"] = True` and `metadata["rgb_decisive"] = False`
3. **Validator rule**: VLM-sourced insights that are not corroborated by ≥1 non-VLM tool → `status = "ambiguous"` maximum. They cannot be `"supported"` from VLM evidence alone.
4. **Risk bump**: Any insight with VLM-only provenance has its `risk_level` bumped up one tier during `synthesise()`. `low → medium`, `medium → high`, `high → critical`.

### Failure Mode
- VLM tool returns `uncertainty < 0.15` → `GeoToolResult.success = False`, tool result rejected
- VLM insight without non-VLM corroboration → `status = "ambiguous"`, never `"supported"`
- Bumped risk_level may trigger `human_signoff_required = True` and 888 HOLD

### Recovery Path
1. Run `EarthModelTool` or `SimulatorTool` on the same location
2. If Earth tool confirms → upgrade `status` to `"supported"` (corroboration achieved)
3. If Earth tool contradicts → `status = "contradicted"` → VOID path

### Code Location
`geox_agent.py :: GeoXAgent.synthesise()` (VLM risk bump)
`geox_tools.py :: SeismicVLMTool.run()`, `EOFoundationModelTool.run()` (uncertainty floor)
`geox_validator.py :: GeoXValidator.validate_batch()` (corroboration check)

---

## Contract 3: Governed Emergence

**Canonical name**: `GEOX_CONTRACT_GOVERNED_EMERGENCE`

### Trigger Condition
Any `GeoResponse` is produced. GEOX outputs influence capital allocation, drilling decisions, and institutional risk. Therefore governance applies to every output without exception.

### Enforcement Mechanism
1. **Immutable provenance**: `GeoResponse.provenance_chain` is populated from all tool calls. Cannot be cleared. If `config.provenance_required = True`, a `GeoResponse` with empty `provenance_chain` is invalid.
2. **Risk gating**:
   - `risk_level = "low"` → auto-proceed
   - `risk_level = "medium"` → `human_signoff_required = True`, 888 HOLD
   - `risk_level = "high"` → `human_signoff_required = True`, `regulator_notify = True`, 888 HOLD
   - `risk_level = "critical"` → `legal_review = True`, 888 HOLD, no auto-action under any circumstances
3. **Vault seal**: `audit_sink` (vault_ledger, pipeline stage 999) is called after every `evaluate_prospect()`. The seal includes: request_id, requester_id, all tool calls, raw outputs, validator verdicts, final GeoResponse, human_signoff status.
4. **F13 Sovereign**: Arif (888_JUDGE) retains ultimate veto. Any 888_JUDGE veto is logged immutably to vault_ledger and halts the pipeline. No downstream system may override a 888_JUDGE veto.
5. **F9 Anti-Hantu**: GEOX never asserts certainty it does not have. All outputs carry epistemic tags (CLAIM / PLAUSIBLE / HYPOTHESIS / ESTIMATE / UNKNOWN) in `arifos_telemetry`.

### Failure Mode
- `provenance_chain` missing → `GeoResponse` rejected at validator
- Risk gate triggers 888 HOLD → no auto-action, human must review
- vault_ledger seal fails → GeoResponse is withheld, error returned to client

### Recovery Path
- 888 HOLD: authorized reviewer examines GeoResponse + provenance chain → approve / reject / request more data → decision sealed in vault_ledger
- Seal failure: retry audit_sink up to 3 times, then escalate to 888_JUDGE

### Code Location
`geox_agent.py :: GeoXAgent.summarise()` (risk gating, 888 HOLD, telemetry)
`geox_agent.py :: GeoXAgent.execute()` (audit_sink per tool call)
`geox_schemas.py :: GeoResponse` (provenance_chain field, human_signoff_required)

---

## Floor Compliance Matrix

| Floor | Name | INIT | THINK | EXPLORE | HEART | REASON | AUDIT | SEAL |
|-------|------|:----:|:-----:|:-------:|:-----:|:------:|:-----:|:----:|
| F1 | Amanah (Reversibility) | ✓ | — | ✓ | — | — | ✓ | ✓ |
| F2 | Truth (≥0.99) | — | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| F4 | Clarity (units/entropy) | — | — | — | ✓ | ✓ | — | ✓ |
| F7 | Humility ([0.03,0.15]) | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| F9 | Anti-Hantu | ✓ | — | — | — | ✓ | ✓ | ✓ |
| F11 | Authority (requester ID) | ✓ | — | — | — | — | ✓ | — |
| F12 | Injection Guard | ✓ | ✓ | — | — | — | — | — |
| F13 | Sovereign (human veto) | — | — | — | — | — | ✓ | ✓ |

---

## Verdict Mapping

| Condition | Verdict | Meaning |
|-----------|---------|---------|
| ≥80% insights supported, 0 contradicted | **SEAL** | Earth and language agree. Proceed with confidence. |
| 50–79% supported, or ≥1 ambiguous (no contradicted) | **PARTIAL** | Partial Earth support. Human review recommended. |
| <50% supported, no contradicted | **SABAR** | Insufficient data. Do not proceed. Gather more. |
| ≥1 insight contradicted by Earth tools | **VOID** | Earth and language disagree. 888 HOLD mandatory. |

---

## 888 HOLD Escalation Path

```
GeoResponse produced with human_signoff_required = True
            │
            ▼
arifos_telemetry.hold = "888 HOLD"
vault_ledger.seal(status="HOLD", ...)
            │
            ▼
GeoXReporter generates audit package:
  - Markdown report with 888 HOLD banner
  - JSON audit for vault_ledger
  - Human brief for reviewer
            │
            ▼
Authorized reviewer notified (out-of-band: email / Telegram / dashboard)
            │
    ┌───────┴───────┐
    ▼               ▼
APPROVE           REJECT / MORE DATA
    │               │
    ▼               ▼
vault_ledger   vault_ledger
seal(APPROVED)  seal(REJECTED)
    │               │
    ▼               ▼
Downstream     Return to
auto-action    SABAR state,
permitted      re-execute with
               new constraints
```

---

## arifOS Telemetry Block Format

Every GEOX `GeoResponse` includes this block in `arifos_telemetry`:

```json
{
  "telemetry_version": "2.1",
  "pipeline": "000→111→333→555→777→888→999",
  "stage": "999 SEAL",
  "floors": ["F1", "F2", "F4", "F7", "F9", "F11", "F12", "F13"],
  "confidence": 0.82,
  "verdict": "SEAL",
  "epistemic_status": "CLAIM",
  "P2": 1.0,
  "hold": "CLEAR",
  "uncertainty_range": [0.03, 0.15],
  "seal": "DITEMPA BUKAN DIBERI",
  "request_id": "...",
  "response_id": "...",
  "tool_calls": 4,
  "insights_count": 3,
  "human_signoff_required": false
}
```

When 888 HOLD is active: `"hold": "888 HOLD"`, `"stage": "888 AUDIT"`.
