# Prediction Pipeline — Pre-Action Simulation

> **Status:** ACTIVE — 2026-07-07
> **Sovereign Directive:** "Wire existing predictions ke actor — sebelum forge_execute, run relevant organ prediction"
> **Doctrine:** Verdict tanpa prediction = governed blindness. Build prediction first.

---

## 0. What This Is

The prediction pipeline connects existing organ prediction capabilities to A-FORGE's execution pipeline. Before any irreversible action, the system simulates consequences using the relevant organ's world model.

```
User/Agent requests action
  → A-FORGE classifies action domain
  → Routes to relevant organ for prediction
  → Organ returns predicted consequences
  → Judge evaluates: prediction + action + authority
  → SEAL/HOLD/VOID based on combined assessment
  → If SEAL: execute
  → If HOLD: wait for conditions
  → If VOID: blocked
```

---

## 1. The Missing Half

LeCun's 6 modules for autonomous intelligence:

| Module | Status | Implementation |
|--------|--------|---------------|
| Perception | ✅ | Organs (GEOX, WELL, WEALTH) |
| Cost | ✅ | APEX: G = A·P·E·X·Φ |
| Actor | ✅ | forge_execute |
| Memory | ✅ | VAULT999 + seal chain |
| **World Model** | ❌→✅ | **THIS: wire organ predictions to actor** |
| **Planner** | ❌ | True planning (not tool sequencing) |

The world model already exists inside organs. It just isn't connected to the actor.

---

## 2. Existing Prediction Capabilities

### GEOX — Earth Prediction

| Tool | What it predicts | Epistemic |
|------|-----------------|-----------|
| `geox_model(mode=basin)` | Basin evolution over geological time | INT |
| `geox_model(mode=routing)` | Sediment routing and deposition | INT |
| `geox_model(mode=surfaces)` | Stratigraphic surface emergence | INT |
| `geox_model(mode=sequences)` | Sequence stratigraphy prediction | INT |
| `geox_model(mode=3d_model)` | 3D structural model | DER |
| `geox_prospect` | Volumetrics, POS, EVOI | DER |
| `geox_compute(mode=petrophysics)` | Vsh, porosity, Sw, perm | DER |

### WEALTH — Capital Prediction

| Tool | What it predicts | Epistemic |
|------|-----------------|-----------|
| `wealth_monte_carlo_simulate` | Value projection with uncertainty | DER |
| `wealth_compute_emv` | Expected monetary value | DER |
| `wealth_compute_irr` | Internal rate of return | DER |
| `wealth_kelly_sizing` | Optimal bet fraction | DER |
| `wealth_markowitz_frontier` | Optimal portfolio allocation | DER |
| `wealth_two_stage_recourse` | Stochastic optimization with recourse | DER |
| `wealth_robust_portfolio` | Worst-case optimal allocation | SPEC |
| `wealth_fiscal_breakeven` | Malaysia fiscal sustainability threshold | DER |

### WELL — Human Prediction

| Tool | What it predicts | Epistemic |
|------|-----------------|-----------|
| `well_assess_homeostasis` | Human regulatory state | INT |
| `well_validate_vitality` | Readiness for action | INT |
| `well_compute_metabolic_flux` | Cognitive entropy rate | DER |

---

## 3. The Prediction Pipeline

### Step 1: Domain Classification

When A-FORGE receives an action request, classify its domain:

```typescript
function classifyPredictionDomain(action: ActionRequest): PredictionDomain {
  const target = action.target.toLowerCase();
  const tool = action.tool_name.toLowerCase();
  
  if (target.includes("basin") || target.includes("seismic") || target.includes("well") || 
      target.includes("reservoir") || tool.includes("geox")) {
    return "earth";
  }
  if (target.includes("invest") || target.includes("portfolio") || target.includes("capital") ||
      target.includes("npv") || target.includes("cashflow") || tool.includes("wealth")) {
    return "capital";
  }
  if (target.includes("sleep") || target.includes("fatigue") || target.includes("vitality") ||
      tool.includes("well")) {
    return "human";
  }
  return "general";
}
```

### Step 2: Route to Organ for Prediction

```typescript
async function predictConsequences(
  domain: PredictionDomain,
  action: ActionRequest,
): Promise<PredictionResult> {
  switch (domain) {
    case "earth":
      // Route to GEOX for geological consequence prediction
      return await callOrgan("geox", "geox_model", {
        mode: "basin",
        arguments: { scenario: action.intent, target: action.target },
      });
    case "capital":
      // Route to WEALTH for financial consequence prediction
      return await callOrgan("wealth", "wealth_monte_carlo_simulate", {
        initial_value: action.metadata?.value ?? 0,
        growth_rate: action.metadata?.growth ?? 0,
        volatility: action.metadata?.volatility ?? 0.1,
        periods: 12,
      });
    case "human":
      // Route to WELL for human readiness prediction
      return await callOrgan("well", "well_assess_homeostasis", {
        mode: "sleep",
      });
    case "general":
      // No organ-specific prediction available
      return { domain: "general", prediction: null, epistemic: "UNKNOWN" };
  }
}
```

### Step 3: Judge Evaluates Prediction + Action

```typescript
async function judgeWithPrediction(
  action: ActionRequest,
  prediction: PredictionResult,
  authority: AuthorityToken,
): Promise<CanonicalVerdict> {
  // Combine action assessment with prediction
  const combinedEvidence = [
    ...action.evidence,
    { source: "prediction", domain: prediction.domain, data: prediction.prediction, epistemic: prediction.epistemic },
  ];
  
  // Route to arifOS for judgment
  return await callOrgan("arifos", "arif_judge", {
    actor: action.actor,
    intent: action.intent,
    domain: action.domain,
    reversibility_level: action.reversibility,
    blast_radius: action.blast_radius,
    evidence: combinedEvidence,
    measurement: {
      G: prediction.g_score ?? 0.5,
      C_dark: prediction.c_dark ?? 0.5,
      W3: prediction.w3 ?? 0.5,
      primitives: { A: 0.5, P: 0.5, E: 0.5, X: 0.5, Phi: 0.5 },
      witness: { human: 0.5, ai: 0.5, external: 0.5 },
      trace: ["pre-action-simulation"],
    },
  });
}
```

---

## 4. When Prediction Is Required

| Action Class | Prediction Required? | Why |
|-------------|---------------------|-----|
| OBSERVE | No | Reads don't change state |
| EXECUTE_REVERSIBLE | Recommended | Good practice, not mandatory |
| EXECUTE_IRREVERSIBLE | **YES** | Cannot undo — must predict first |
| EXTERNAL_SIDE_EFFECT | **YES** | Effects outside sandbox — must predict |

**Rule:** Irreversible actions without prediction = HOLD. Always.

---

## 5. What Prediction Does NOT Do

Prediction does NOT:
- Override sovereign authority (F13)
- Replace constitutional judgment (arifOS)
- Guarantee outcomes (F2 TRUTH — predictions are SPEC/DER, not OBS)
- Remove the need for tri-witness (F3)
- Make irreversible actions reversible (F1)

Prediction DOES:
- Inform the judge with consequence estimates
- Reduce governed blindness
- Add a world-model dimension to governance
- Connect organ intelligence to execution pipeline

---

## 6. Integration with Verdict Canon

When prediction is integrated, the verdict canon becomes **load-bearing**:

```
Before prediction: verdict governs action only
After prediction:  verdict governs prediction + action
```

This is why Arif said: "Build prediction first, THEN ratify verdict canon." The verdict canon is more meaningful when it governs a system that includes prediction.

---

*Prediction pipeline doctrine. DITEMPA BUKAN DIBERI — Predict before you act.*
