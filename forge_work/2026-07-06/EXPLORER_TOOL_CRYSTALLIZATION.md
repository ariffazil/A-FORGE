# 🔭 EXPLORER TOOL CRYSTALLIZATION

> **Schema + Fitness Mapping + Retirement Plan**
> Extends `EXPLORER_SUBMODES.md` (ratified 2026-07-06) with concrete tool schema and 14-tool audit.
> DITEMPA BUKAN DIBERI — Forged, Not Given.

---

## 0. Summary (one paragraph)

EXPLORER_SUBMODES.md defined the *what* — every explorer tool must expose OBSERVE/HYPOTHESIZE/FALSIFY/VERIFY. This artifact defines the *how* — a concrete EXPLORER_TOOL schema with fitness metrics, governance invariants, and a 14-tool audit that grades each tool against the explorer standard. The audit finds **zero fully-compliant explorer tools today**. 13 of 14 are LEGACY_UPGRADE — they need 1-3 missing submodes added. 1 (arif_observe) is ACTIVE as a kernel primitive but doesn't need full explorer status. **The biggest gap is systematic**: FALSIFY is missing from 12 of 14 tools. Every explorer tool needs a "what would break this?" mode.

---

## 1. EXPLORER_TOOL Schema — Canonical Definition

Every explorer tool in the federation must conform to this schema. This is the
extension of §3 in EXPLORER_SUBMODES.md — adding fitness, governance, and
evolution metadata so tools can survive the forge-and-retire cycle.

### 1.1 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "arifos:federation:explorer-tool:v1:2026-07-06",
  "title": "EXPLORER_TOOL",
  "description": "Canonical schema for all explorer tools across GEOX, WEALTH, WELL, A-FORGE, and arifOS.",
  "type": "object",
  "required": [
    "id", "name", "domain", "organ", "version",
    "submodes", "fitness", "governance", "status"
  ],

  "properties": {

    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z_]+[a-z]$",
      "description": "Canonical tool identifier. Snake_case, organ prefix."
    },

    "name": {
      "type": "string",
      "description": "Human-readable tool name."
    },

    "domain": {
      "type": "string",
      "enum": ["earth", "capital", "wellness", "forge", "kernel", "meta"],
      "description": "Reality domain the tool explores."
    },

    "organ": {
      "type": "string",
      "enum": ["GEOX", "WEALTH", "WELL", "A-FORGE", "arifOS", "AAA"],
      "description": "Federation organ that owns this tool."
    },

    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version."
    },

    "description": {
      "type": "string",
      "description": "One-sentence description of what the tool explores."
    },

    "submodes": {
      "type": "object",
      "description": "Four-mode explorer interface. Each submode is independently graded.",
      "required": ["observe", "hypothesize", "falsify", "verify"],
      "properties": {
        "observe":    { "$ref": "#/$defs/submode" },
        "hypothesize": { "$ref": "#/$defs/submode" },
        "falsify":    { "$ref": "#/$defs/submode" },
        "verify":     { "$ref": "#/$defs/submode" }
      }
    },

    "fitness": {
      "type": "object",
      "description": "Fitness metrics for the forge-and-retire lifecycle.",
      "required": ["reality_gain", "governance_alignment", "composability", "drift_score"],
      "properties": {
        "reality_gain": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Uncertainty reduction per explorer loop. 0 = no gain, 1 = complete resolution."
        },
        "governance_alignment": {
          "type": "object",
          "required": ["domain_law", "epistemic_rung", "claim_grammar"],
          "properties": {
            "domain_law":    { "type": "boolean", "description": "Output carries domain-specific laws/constraints." },
            "epistemic_rung": { "type": "boolean", "description": "Output tagged with OBS/DER/INT/SPEC." },
            "claim_grammar":  { "type": "boolean", "description": "Output has evidence_for/evidence_against/missing_tests." }
          }
        },
        "composability": {
          "type": "object",
          "properties": {
            "cross_domain_lineage": {
              "type": "array",
              "items": { "type": "string" },
              "description": "List of domains this tool can share lineage with."
            },
            "risk_sharing": {
              "type": "boolean",
              "description": "Can forward risk signals to other organs."
            }
          }
        },
        "drift_score": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "How far the live tool has drifted from its registered spec. 0 = identical, 1 = completely different."
        }
      }
    },

    "governance": {
      "type": "object",
      "required": ["self_certification", "required_approval_tier"],
      "properties": {
        "self_certification": {
          "type": "boolean",
          "const": false,
          "description": "INVARIANT: Explorer tools must never self-certify. arifOS kernel judges."
        },
        "required_approval_tier": {
          "type": "string",
          "enum": ["T1", "T2", "T3"],
          "description": "Autonomy tier required for execution."
        },
        "judge_dependency": {
          "type": "string",
          "description": "Required arifOS judge path or seal verdict type."
        }
      }
    },

    "status": {
      "type": "string",
      "enum": ["ACTIVE", "LEGACY_UPGRADE", "RETIRED"],
      "description": "Lifecycle status. LEGACY_UPGRADE means tool works but needs submode expansion."
    },

    "evolution": {
      "type": "object",
      "properties": {
        "fitness_score": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Composite fitness score. Below 0.50 → RETIRE candidate."
        },
        "next_review": {
          "type": "string",
          "format": "date",
          "description": "Next scheduled fitness review."
        },
        "replacement": {
          "type": "string",
          "description": "Replacement tool id if status is RETIRED."
        },
        "upgrade_plan": {
          "type": "string",
          "description": "Brief description of what submodes need adding to reach ACTIVE."
        }
      }
    }
  },

  "$defs": {
    "submode": {
      "type": "object",
      "required": ["enabled", "fitness_requirement"],
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Whether this submode is currently implemented."
        },
        "fitness_requirement": {
          "type": "string",
          "enum": ["mandatory", "optional", "not_applicable"],
          "description": "mandatory = must have for ACTIVE status. optional = nice to have. not_applicable = kernel primitives."
        },
        "interface": {
          "type": "string",
          "description": "Brief description of input/output contract for this submode."
        }
      }
    }
  }
}
```

### 1.2 Schema Invariants (non-negotiable)

| Invariant | Violation Consequence |
|-----------|----------------------|
| `self_certification` must be `false` | Tool is BLOCKED until governance chain attaches arifOS judge |
| Every `ACTIVE` tool must have ≥3 submodes enabled with `mandatory` fitness | Downgraded to `LEGACY_UPGRADE` |
| `fitness_score < 0.50` automatically triggers retirement review | Tool enters 30-day deprecation window |
| Cross-domain composability must declare at least one lineage pair | Tool is siloed — flagged for integration |
| Drift > 0.30 requires surface re-pin | Tool is removed from callable registry until re-pinned |

---

## 2. Fourteen-Tool Audit — Current State Mapping

Each tool is graded on:
- ✅ = submode fully implemented
- ◐ = partially implemented (works but missing explorer rigor)
- ❌ = not implemented
- ⚪ = not_applicable (kernel primitive)

### 2.1 Tool-by-Tool Map

| # | Tool | Domain | OBSERVE | HYPOTHESIZE | FALSIFY | VERIFY | Status |
|---|------|--------|---------|-------------|---------|--------|--------|
| 01 | `geox_seismic_compute` | earth | ✅ attribute | ❌ | ❌ | ◐ anomalous_contrast | **LEGACY** |
| 02 | `geox_biostrat_falsify` | earth | ❌ | ❌ | ✅ 8-gate | ❌ | **LEGACY** |
| 03 | `geox_well_tie_compute` | earth | ✅ LAS/SEGY | ❌ | ❌ | ✅ correlation | **LEGACY** |
| 04 | `geox_geological_cognition_run` | earth | ✅ image pipe | ◐ multi-horizon | ❌ | ◐ render audit | **LEGACY** |
| 05 | `geox_contradiction_engine` | earth | ❌ | ❌ | ✅ contradiction | ❌ | **LEGACY** |
| 06 | `geox_prospect` | earth | ◐ evidence | ◐ scenarios | ❌ | ◐ POS/EMV | **LEGACY** |
| 07 | `wealth_monte_carlo_simulate` | capital | ❌ | ✅ scenarios | ❌ | ◐ stats | **LEGACY** |
| 08 | `wealth_collapse_signature_scan` | capital | ✅ narrative | ✅ profiles | ❌ | ❌ | **LEGACY** |
| 09 | `wealth_wisdom_evaluate` | capital | ✅ proposal | ✅ 6-dim | ❌ | ✅ floors | **LEGACY** |
| 10 | `well_validate_vitality` | wellness | ✅ biometric | ❌ | ❌ | ◐ homeostasis | **LEGACY** |
| 11 | `well_assess_homeostasis` | wellness | ✅ state | ❌ | ❌ | ✅ decision_class | **LEGACY** |
| 12 | `forge_evaluate` | forge | ✅ spec | ❌ | ◐ scar consult | ✅ G-score | **LEGACY** |
| 13 | `forge_registry_status` | forge | ✅ full audit | ❌ | ❌ | ✅ fingerprint | **LEGACY** |
| 14 | `arif_observe` | kernel | ✅ strong | ⚪ | ⚪ | ✅ labeling | **ACTIVE** |

### 2.2 Summary Statistics

| Metric | Count | % |
|--------|-------|---|
| Total tools audited | 14 | 100% |
| ACTIVE | 1 | 7% |
| LEGACY_UPGRADE | 13 | 93% |
| RETIRED | 0 | 0% |
| Tools with ✅ OBSERVE | 9 | 64% |
| Tools with ✅ HYPOTHESIZE | 4 | 29% |
| Tools with ✅ FALSIFY | 3 | 21% |
| Tools with ✅ VERIFY | 4 | 29% |
| Tools with ❌ FALSIFY | 9 | 64% |
| Tools missing ≥2 submodes | 9 | 64% |

### 2.3 Critical Finding: The FALSIFY Gap

**FALSIFY is the least-implemented submode across the federation.** 12 of 14 tools
either lack it entirely (9) or have it only partially (3). This is the structural
weakness because without built-in falsification:

- Tools CANNOT detect when they're wrong
- The mirror loop persists (agent paraphrases its own hypotheses)
- The kernel must do all the red-teaming (waste of constitutional energy)
- Cross-domain contradictions are never surfaced at the tool level

**Fix:** Every LEGACY_UPGRADE tool needs a `mode="falsify"` path that actively tries
to break its own output using domain-specific constraints.

---

## 3. Retirement Candidates (Pruning Targets)

Based on the pruning principles from the crystallization analysis:

### 3.1 Immediate Merge Candidates

| Tools to Merge | Into | Rationale |
|----------------|------|-----------|
| `geox_seismic_compute` + `geox_well_tie_compute` + `geox_geological_cognition_run` | One `geox_explorer_seismic` with O/H/F/V | Three tools cover different phases of the same seismic cognition cycle. Merging forces them to share falsification and verification. |
| `geox_biostrat_falsify` + `geox_contradiction_engine` | One `geox_explorer_contradiction` with O/H/F/V | Both are falsification engines. One for biostrat, one general. Generalize the falsification pattern and retire the single-domain version. |
| `wealth_monte_carlo_simulate` + `wealth_collapse_signature_scan` | One `wealth_explorer_scenario` with O/H/F/V | Both explore scenario space. Monte Carlo explores quantitative futures; collapse scan explores narrative futures. Same explorer cycle, different data. |

### 3.2 Immediate Retirement Candidates

| Tool | Reason | Replacement |
|------|--------|-------------|
| (none identified) | All 14 tools serve distinct explorer functions. Merging reduces surface count; retiring would lose capability. | — |

**No tool merits outright retirement today.** The problem isn't too many tools —
it's too many *unstructured* tools. Merging the 3 groups above would collapse
14 → 11 endpoints without losing functionality, and each merge would produce
a stronger explorer.

### 3.3 Aliases to Collapse

| Alias | Canonical | Action |
|-------|-----------|--------|
| `wealth_emv_compute` | `wealth_compute_emv` | Deprecate alias |
| `wealth_evoi_compute` | `wealth_compute_evoi` | Deprecate alias |
| `wealth_monte_carlo` | `wealth_monte_carlo_simulate` | Deprecate alias |
| `wealth_reason_agent` | `wealth_agent_path` | Deprecate alias |
| `wealth_system_registry_status` | `wealth_registry_status` | Deprecate alias |
| `forge_systemctl` | `forge_shell('systemctl ...')` | Already marked DEPRECATED |

---

## 4. Evolution Roadmap — Phase 1 (Next 30 Days)

### Week 1: Schema Ratification

- [ ] Ratify this schema through arifOS 888_JUDGE
- [ ] Register EXPLORER_TOOL schema in tool_registry.json
- [ ] Add schema validation gate to A-FORGE forge_register

### Week 2: Prototype the Missing Submode Pattern

Pick one tool — recommended: **geox_prospect** — and add:
- `mode="falsify"` — what would kill this prospect? (dry hole scenarios, seal failure, charge timing)
- `mode="hypothesize"` upgrade — generate 3 ranked prospect scenarios (P10/P50/P90 with geological justification)

Document the pattern as a template for other tools.

### Week 3: Merge First Group

Merge `geox_seismic_compute` + `geox_well_tie_compute` + `geox_geological_cognition_run`
into `geox_explorer_seismic` with unified O/H/F/V interface.

### Week 4: Fitness Law Enforcement

- Add `fitness_score` to every tool in registry
- Flag tools with score < 0.50 for retirement
- Add drift monitoring to A-FORGE surface guard

---

## 5. Per-Tool Detailed Upgrade Prescriptions

### GEOX Tools

**01. geox_seismic_compute** — Status: LEGACY_UPGRADE
```
Add:
- hypothesize mode: "Given these logs and wavelet, what are 3 alternative
  synthetic seismograms with different wavelets/phases?"
- falsify mode: "Does the synthetic match the observed? If not, which
  assumption is wrong: wavelet phase, velocity model, or well-tie?"
Keep: observe (attribute), verify (anomalous_contrast)
```

**02. geox_biostrat_falsify** — Status: LEGACY_UPGRADE
```
Add:
- observe mode: "Ingest raw biostrat report, extract zones, attach metadata"
- hypothesize mode: "Given observed fossils, what are 3 possible zone
  assignments? Rank by likelihood."
- verify mode: "Cross-reference against GPTS2020, compute APEX G-score"
Keep: falsify (8-gate — this is already excellent)
```

**03. geox_well_tie_compute** — Status: LEGACY_UPGRADE
```
Add:
- hypothesize mode: "Generate 3 synthetic seismograms with different
  wavelets (Ricker 20Hz, Ormsby 10-40Hz, statistical). Rank best match."
- falsify mode: "Identify which intervals have unexplained residuals.
  Is it wavelet phase, velocity error, or formation mis-tie?"
Keep: observe (LAS/SEGY ingest), verify (correlation QC)
```

**04. geox_geological_cognition_run** — Status: LEGACY_UPGRADE
```
Add:
- falsify mode: "Cross-check pixel-derived horizons against SEG-Y
  trace audit. Flag horizons that don't align with amplitude physics."
- hypothesize upgrade: "Rank horizon/fault interpretations by confidence.
  Attach alternative interpretations for low-confidence features."
Keep: observe (image pipeline), verify (render audit — upgrade to APEX)
```

**05. geox_contradiction_engine** — Status: LEGACY_UPGRADE
```
Add:
- observe mode: "Ingest two data sources directly and prepare for comparison"
- hypothesize mode: "Given the contradiction, what are 3 possible resolutions?"
- verify mode: "Which resolution is most consistent with all available data?"
Keep: falsify (core contradiction detection)
```

**06. geox_prospect** — Status: LEGACY_UPGRADE
```
Add:
- falsify mode: "PROSPECT_KILLER checklist:
   1. Seal failure — top seal capacity < column height?
   2. Charge timing — migration after trap formation?
   3. Reservoir quality — porosity destroyed by depth?
   4. Structural risk — fault reactivation breached closure?"
- hypothesize upgrade: "Generate 3 ranked geological scenarios with
  explicit risking for each element (charge, reservoir, seal, trap, timing)"
Keep: observe (evidence ingestion), verify (POS/EMV — upgrade to APEX G-score)
```

### WEALTH Tools

**07. wealth_monte_carlo_simulate** — Status: LEGACY_UPGRADE
```
Add:
- observe mode: "Ingest market data / historical returns automatically"
- falsify mode: "What scenario distribution would FALSIFY the thesis?
  What would make the base case impossible?"
Keep: hypothesize (scenario generation), verify (statistics — upgrade to APEX)
```

**08. wealth_collapse_signature_scan** — Status: LEGACY_UPGRADE
```
Add:
- falsify mode: "What evidence would suggest this ISN'T a collapse?
  Generate a healthy-narrative counterprofile."
- verify mode: "Compute APEX G-score for collapse diagnosis.
  Tri-witness: human analyst + AI model + external market data."
Keep: observe (narrative ingestion), hypothesize (profile generation)
```

**09. wealth_wisdom_evaluate** — Status: LEGACY_UPGRADE
```
Add:
- falsify mode: "What if the opposite decision is wiser? Generate
  counterfactual wisdom scores for the alternative path."
Keep: observe, hypothesize (6-dimension scoring), verify (floor check)
```

### WELL Tools

**10. well_validate_vitality** — Status: LEGACY_UPGRADE
```
Add:
- hypothesize mode: "What are 3 alternative explanations for this
  readiness score? (e.g., measurement error, acute stress, chronic fatigue)"
- falsify mode: "Does self-reported readiness match behavioral signals?
  Would other sensors disagree?"
Keep: observe (biometric intake), verify (homeostasis cross-check)
```

**11. well_assess_homeostasis** — Status: LEGACY_UPGRADE
```
Add:
- hypothesize mode: "Given current state, what are 3 possible next-state
  trajectories? (stable, degrading, recovering) Rank by evidence."
- falsify mode: "What would disprove the current homeostasis verdict?
  Would a different threshold system produce a different classification?"
Keep: observe (state ingestion), verify (decision_class routing)
```

### A-FORGE Tools

**12. forge_evaluate** — Status: LEGACY_UPGRADE
```
Add:
- hypothesize mode: "Generate 2 alternative evaluation paths with different
  threshold calibrations. Show how each would change the verdict."
Keep: observe (spec intake), falsify (scar consult — minor upgrade),
      verify (G-score — this is already APEX-grade)
```

**13. forge_registry_status** — Status: LEGACY_UPGRADE
```
Add:
- hypothesize mode: "Predict drift evolution for the next 30 days based
  on current trajectory."
- falsify mode: "Cross-check registry against actual tool behavior.
  Flag tools that claim capability they don't deliver."
Keep: observe (full audit), verify (fingerprint)
```

### Kernel Tools

**14. arif_observe** — Status: **ACTIVE** (as kernel primitive)
```
No change needed. arif_observe is the kernel's OBSERVE layer.
It does not need HYPOTHESIZE/FALSIFY — those belong to organ-level
explorers. arif_observe feeds evidence INTO explorers; it doesn't
replace them.
```

---

## 6. Fitness Score Proxy — Quick Reference

Use this for rapid triage of any tool against the explorer standard:

```
FITNESS = (submodes_enabled / 4) × 0.40
        + (governance_alignment_score / 3) × 0.25
        + (composability_links ≥ 1 ? 0.20 : 0)
        + (drift < 0.30 ? 0.15 : 0)

Thresholds:
  ≥ 0.80 → ACTIVE
  0.50–0.79 → LEGACY_UPGRADE
  < 0.50 → RETIRE candidate
```

---

## 7. Authority and Ratification

| Field | Value |
|-------|-------|
| Forged by | FORGE (000Ω) under Arif's crystallization directive |
| Extends | `EXPLORER_SUBMODES.md` (2026-07-06, Antigravity) |
| Ratification needed | arifOS 888_JUDGE SEAL for schema binding |
| Next review | 2026-08-06 (30 days) |
| Supersedes | All single-mode tool specs that lack explorer submodes |

---

*Forged: 2026-07-06 · Forge Work Path: `/root/A-FORGE/forge_work/2026-07-06/EXPLORER_TOOL_CRYSTALLIZATION.md`*
*DITEMPA BUKAN DIBERI — Explorer tools are forged, not given.*
