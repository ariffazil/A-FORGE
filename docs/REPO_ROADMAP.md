# GEOX Repository Roadmap
## Version: v2026.05.23-REFORGE | Seal: DITEMPA BUKAN DIBERI

> **Status:** CANONICAL — REFORGED from archive
> **Generated:** 2026-05-23
> **Authority:** arifOS FORGE (autonomous execution)
> **Seal:** DITEMPA BUKAN DIBERI

---

## Preamble

This document is the unified roadmap for GEOX, forged from the A-FORGE archive.
It contains the canonical implementation plans, integration guides, and strategic visions
that govern GEOX's development trajectory.

**Total archive content reforged:** 43063 chars

---

## A. Zero-Loophole Architecture v1 — Implementation Plan

# Zero-Loophole Architecture v1 — Implementation Plan

This document outlines the strict PR-by-PR sequence to implement the 5-Plane Zero-Loophole Architecture in `arifosmcp`, transitioning from open-access/shadow modes to full cryptographic enforcement without breaking existing `WEALTH` or `GEOX` pipelines.

## Phase 1: Foundation (Non-Blocking)

### PR-01: `audit(schema): add v1 identity/authority/decision models`
- **Files:** `arifosmcp/schemas/{identity.py, authority.py, capability.py, decision.py, execution.py, audit.py}`
- **Tests:** `tests/schemas/test_v1_models.py`
- **Acceptance Criteria:** Pydantic models rigorously validate against the v1 JSON specs (e.g., `sealed_decision_packet.v1`). No routing or behavioral changes. Pure additive schemas.

### PR-02: `governance(registry): add canonical tool registry with alias mapping`
- **Files:** `arifosmcp/registry/tool_registry.py`, `arifosmcp/registry/tool_manifest.yaml`
- **Tests:** `tests/registry/test_tool_registry.py`
- **Acceptance Criteria:** A single source of truth for all tools. Correctly resolves aliases (e.g., `agi_mind` -> `arifos_mind`). Emits telemetry warnings on alias usage. Non-blocking.

## Phase 2: Wrappers & Shadow Hashes (Observation Mode)

### PR-03: `forge(plane): add Identity Plane wrapper`
- **Files:** `arifosmcp/planes/identity_plane.py`, `arifosmcp/adapters/arifos_init_adapter.py`
- **Tests:** `tests/planes/test_identity_plane.py`
- **Acceptance Criteria:** Existing `arifos_init` routes through the new `identity_init` logic. Emits an `identity_token_id`. Legacy callers still succeed.

### PR-04: `forge(plane): add Authority Plane in issue-only mode`
- **Files:** `arifosmcp/planes/authority_plane.py`
- **Tests:** `tests/planes/test_authority_plane.py`
- **Acceptance Criteria:** Issues `authority_token_id` mapping the granted scope (read, reason, execute) based on current implicit risk logic. Attached to response payloads. Non-blocking.

### PR-05: `forge(plane): add Capability Plane and canonical resolver`
- **Files:** `arifosmcp/planes/capability_plane.py`, `arifosmcp/adapters/arifos_kernel_adapter.py`
- **Tests:** `tests/planes/test_capability_plane.py`
- **Acceptance Criteria:** All tool dispatches route through the registry resolver. The system logs the canonical target and schema hash. Aliases still function.

### PR-06: `security(validation): add Validation Plane skeleton`
- **Files:** `arifosmcp/planes/validation_plane.py`, `arifosmcp/adapters/arifos_judge_adapter.py`
- **Tests:** `tests/planes/test_validation_plane.py`
- **Acceptance Criteria:** `arifos_judge`, `arifos_sense`, `arifos_ops` wrapped. Emits `sealed_decision_packet` payload in a shadow `payload.v1_shadow` field. Verdicts remain unchanged.

### PR-07: `forge(execution): add Execution Plane shadow manifest`
- **Files:** `arifosmcp/planes/execution_plane.py`, `arifosmcp/adapters/arifos_forge_adapter.py`
- **Tests:** `tests/planes/test_execution_plane.py`
- **Acceptance Criteria:** `arifos_forge` / `code_engine` generate a shadow `manifest_hash` and compare it against the `decision_packet`. Logs validation failures silently. Execution proceeds normally.

## Phase 3: GEOX & Adversarial Advisory

### PR-08: `GEOX(provenance): add GEOX provenance wrapper`
- **Files:** `arifosmcp/GEOX/provenance.py`, `arifosmcp/GEOX/witness_hash.py`
- **Tests:** `tests/GEOX/test_provenance.py`
- **Acceptance Criteria:** Data ingestion tools (`well_load_bundle`, etc.) generate `witness_hash` and provenance metadata. Missing provenance triggers warnings, not halts.

### PR-09: `GEOX(provenance): attach hashes to GEOX compute outputs`
- **Files:** `arifosmcp/adapters/GEOX_adapter.py`
- **Tests:** `tests/GEOX/test_compute_hashes.py`
- **Acceptance Criteria:** GEOX compute and verification tools output `witness_hash`, `input_hash`, and `state_hash`. Backwards compatible with existing clients.

### PR-10: `security(validation): add Adversarial layer in advisory mode`
- **Files:** `arifosmcp/planes/adversary_plane.py`
- **Tests:** `tests/planes/test_adversary_plane.py`
- **Acceptance Criteria:** Simulates identity attacks, schema confusion, and cross-layer mismatches. Emits `adversarial_hash` and scores. Flags anomalies in logs only.

## Phase 4: Hard Enforcement (The Gates Close)

### PR-11: `security(gate): enforce identity-before-cognition`
- **Files:** `arifosmcp/runtime/rest_routes.py`, `arifosmcp/planes/identity_plane.py`
- **Tests:** `tests/security/test_identity_gate.py`
- **Acceptance Criteria:** **First hard gate.** `ANONYMOUS` actors are hard-blocked from `arifos_mind`, `arifos_memory`, `arifos_sense`. Must possess a `BOUND` identity token.

### PR-12: `governance(registry): enforce canonical registry paths`
- **Files:** `arifosmcp/registry/tool_registry.py`, `arifosmcp/runtime/rest_routes.py`
- **Tests:** `tests/security/test_canonical_gate.py`
- **Acceptance Criteria:** **Second hard gate.** Hidden/duplicate paths blocked. Schema mismatch results in immediate `VOID`. Aliases allowed for read-only only.

### PR-13: `forge(execution): enforce Judge <-> Forge hash lock`
- **Files:** `arifosmcp/planes/execution_plane.py`
- **Tests:** `tests/security/test_forge_lock.py`
- **Acceptance Criteria:** **Third hard gate.** `arifos_forge` strictly REJECTS execution if `decision_packet.verdict != SEAL` or if the `manifest_hash` (input, state, actor, session, nonce) fails validation.

### PR-14: `GEOX(provenance): enforce GEOX provenance for consequential outputs`
- **Files:** `arifosmcp/adapters/GEOX_adapter.py`
- **Tests:** `tests/GEOX/test_consequential_enforcement.py`
- **Acceptance Criteria:** `physics_judge_verdict`, `prospect_evaluate`, etc., return `HOLD` or `VOID` if upstream `witness_hash` or provenance is missing.

### PR-15: `security(gate): harden ACP escalation surface`
- **Files:** `arifosmcp/adapters/GEOX_adapter.py`
- **Tests:** `tests/security/test_acp_hardening.py`
- **Acceptance Criteria:** `physics_acp_grant_seal` strictly requires a `SEALED` identity state, human approval token, proposal hash lock, and current state snapshot.

## Phase 5: Pruning & Fail-Closed

### PR-16: `governance(registry): remove deprecated aliases from write/execute paths`
- **Files:** `arifosmcp/registry/tool_manifest.yaml`
- **Tests:** `tests/registry/test_alias_removal.py`
- **Acceptance Criteria:** Legacy aliases (e.g., `code_engine`, `apex_soul`) completely removed from mutating/executing surfaces to eliminate alias drift.

### PR-17: `security(gate): enable full fail-closed mode`
- **Files:** `arifosmcp/runtime/rest_routes.py`, `arifosmcp/planes/*.py`
- **Tests:** `tests/security/test_fail_closed.py`
- **Acceptance Criteria:** **Absolute zero-loophole posture.** Any request missing a schema, stage, identity, or operating outside the explicit call graph is instantly `VOID`. Silent fallbacks to `ANONYMOUS` are impossible.

---

## B. GEOX Simplified Manifest

# 🔥 GEOX Simplified — Earth Intelligence Core

## Manifesto: Chaos Reduction Complete

**Before:** 183 Python files, 19 markdown docs, 4+ MCP servers, scattered schemas
**After:** Lean Earth Intelligence — only what serves the mission

---

## Core Philosophy (DITEMPA BUKAN DIBERI)

> "Perfection is achieved not when there is nothing more to add, 
> but when there is nothing left to take away."
> — Antoine de Saint-Exupéry

**GEOX is:**
- A **Theory of Anomalous Contrast (ToAC)** engine
- An **AC_Risk** calculator with constitutional governance
- A set of **MCP tools** for subsurface decision support
- **4 MCP Apps** for interactive exploration

**GEOX is NOT:**
- A Petrel competitor
- A full-service seismic processing platform  
- A replacement for human interpreters
- A "sudo" system with unchecked power

---

## Directory Structure (Simplified)

```
GEOX/
├── GEOX/                          # ← Canonical Python package
│   ├── __init__.py
│   ├── server.py                  # ← ONE MCP server (AAA Grade)
│   ├── tool_registry.py           # ← Unified tool definitions
│   ├── ac_risk.py                 # ← ToAC calculation engine
│   └── apps/                      # ← 4 MCP Apps only
│       ├── ac_risk_console/
│       ├── basin_explorer/
│       ├── seismic_viewer/
│       └── well_context_desk/
├── data/                          # ← Sample data only
├── docs/                          # ← 3 documents only
│   ├── README.md                  # ← This is the only entry point
│   ├── ARCHITECTURE.md            # ← Technical deep dive
│   └── OPERATIONS.md              # ← Run & deploy guide
├── tests/                         # ← Constitutional validation
├── docker-compose.yml             # ← Single deployment file
└── pyproject.toml                 # ← Dependencies & metadata
```

---

## The 7 Tools (No More, No Less)

| Tool | Purpose | Status |
|------|---------|--------|
| `GEOX_compute_ac_risk` | ToAC calculation — THE CORE | ✅ Production |
| `GEOX_load_seismic_line` | Seismic with scale validation | ✅ Production |
| `GEOX_build_structural_candidates` | Multi-model interpretation | ✅ Production |
| `GEOX_verify_geospatial` | Coordinate grounding | ✅ Production |
| `GEOX_feasibility_check` | Constitutional firewall | ✅ Production |
| `GEOX_evaluate_prospect` | Prospect verdict with HOLD | ✅ Production |
| `GEOX_earth_signals` | Live Earth observations | ✅ Production |

**Removed:**
- ❌ `GEOX_interpret_single_line` — Too complex, overlaps with candidates
- ❌ `GEOX_digitize_well_log` — Scaffold, not ready
- ❌ `GEOX_georeference_map` — Preview quality, defer to v2

---

## Constitutional Laws (F1-F13)

Every tool enforces:
- **F2 Truth** — Uncertainty quantified
- **F4 Clarity** — Units validated  
- **F7 Humility** — Confidence bounded
- **F9 Anti-Hantu** — Physical grounding checked
- **F11 Authority** — Provenance logged
- **F13 Sovereign** — 888_HOLD gates active

---

## Quick Start

```bash
# Deploy
docker-compose up -d

# Test
curl http://localhost:8000/health

# Use
echo '{"u_phys": 0.3, "transform_stack": ["linear"]}' | \
  python -m GEOX.client compute_ac_risk
```

---

## What Was Removed (Chaos Audit)

| Category | Count | Action |
|----------|-------|--------|
| Duplicate MCP servers | 3 | Archived |
| Legacy tool files | 12 | Archived |
| Scattered schemas | 5 | Consolidated |
| Markdown docs | 16 | Consolidated to 3 |
| Scaffold features | 4 | Removed |
| Example/mock code | 8 | Moved to tests/ |

**Total Files Reduced:** ~140 → ~40 (71% reduction)

---

*DITEMPA BUKAN DIBERI — Forged, Not Given*
*Earth Intelligence: Revealed through subtraction*

---

## C. GEOX Design Forge Seal

# GEOX Design Forge — 999_SEAL
## Dimensional Architecture Manifest (000-999)

**Version:** 2026.04.11
**Status:** 999_SEAL — Heavy Witness
**Motto:** *Ditempa Bukan Diberi* — Forged, Not Given

---

## Executive Summary

The GEOX Design Forge implementation establishes the canonical 000-999 dimensional architecture for the Earth Intelligence Core. This manifest seals the complete transformation from a visualization tool to a physically grounded metabolic engine.

### Architecture Delivered

| Domain | Range | Focus | Component |
|--------|-------|-------|-----------|
| **DomainVoid** | 000-249 | Risk & Decision | Volumetrics, GCOS, 888_HOLD |
| **Domain1D** | 250-499 | Borehole Intelligence | Well logs, LAS, RATLAS |
| **Domain2D** | 500-749 | Planar Operations | Seismic, attributes, GCPs |
| **Domain3D** | 750-999 | Volume & Basin | GemPy, structural, Macrostrat |

---

## 1. Design System (Canonical DNA)

### Color Palette — The Void
```css
--GEOX-void-900: #0A0C0E    /* Deep void background */
--GEOX-amber-500: #F59E0B   /* Actionable intelligence */
--GEOX-emerald-500: #10B981 /* Success/999_SEAL */
--GEOX-crimson-500: #EF4444 /* Alert/888_VOID */
--GEOX-violet-500: #8B5CF6  /* AI/LLM integration */
--GEOX-cyan-500: #06B6D4    /* Scientific/technical data */
```

### Typography
- **UI Font:** Inter (weights 300-900)
- **Data Font:** JetBrains Mono (tabular numbers, precise alignment)

### Glassmorphism
```css
--GEOX-glass-bg: rgba(20, 24, 28, 0.72)
--GEOX-glass-blur: 16px
--GEOX-glass-border: rgba(255, 255, 255, 0.06)
```

### Scanline Aesthetic
- Signal-centric seismic visualization
- Radar sweep animation for active processing
- Subtle CRT scanline overlay for data authenticity

---

## 2. Scale-Aware Layer (Earth True Scale)

### Georeferencing Engine

The recursive georeferencing system calibrates every pixel to physical units:

#### 1D Calibration (Borehole)
- Depth to pixel transformation with datum awareness
- Time-depth model interpolation (Claerbout, Faust methods)
- Automatic age estimation via sedimentation rates
- Integration path to Macrostrat API

#### 2D Calibration (Maps/Sections)
- Affine transformation matrices
- Ground Control Point (GCP) management
- RMSE calculation for accuracy assessment
- Distance-based confidence weighting

#### 3D Calibration (Volumes)
- Inline/Xline to world coordinate conversion
- Corner point interpolation
- TWT to depth conversion with velocity models
- Regular grid high-confidence regions

### Chronostratigraphic Integration
- Automated stratigraphic hydration via Macrostrat API
- Age model selection (GTS2020, GTS2012, custom)
- Formation top confidence scoring
- Temporal consistency validation

---

## 3. Domain Components

### DomainVoid (000-249) — Risk & Decision
- **GCOS Gauge:** Interactive chance-of-success visualization
- **Volumetrics Distribution:** P10/P50/P10 bar charts with Monte Carlo aesthetic
- **Constitutional Floor Panel:** F1-F13 status monitoring
- **888_HOLD Gate:** Sovereign authority checkpoint with confirmation dialogs
- **Economic Metrics:** NPV, IRR, payback period summaries

### Domain1D (250-499) — Borehole Intelligence
- **SVG Log Tracks:** High-performance canvas-based rendering
- **Formation Strip:** Lithology-coded depth intervals
- **Multi-Track Display:** GR, Resistivity, Density curves
- **Depth Axis:** TVD/TVDSS/MD/TWT/Age reference switching
- **Interactive Picking:** Click-to-select with depth readout

### Domain2D (500-749) — Planar Operations
- **Seismic Canvas:** Wiggle, VA, and spectral display modes
- **Color Maps:** Grayscale, Seismic (BWR), RdGy, Spectral, Viridis
- **Horizon Tracking:** Interactive horizon picking
- **Attribute Generation:** RMS, Sweetness, Envelope, Phase
- **GCP Management:** Ground control point visualization
- **Viewport Controls:** Zoom, pan, trace range selection

### Domain3D (750-999) — Volume & Basin
- **Volume Rendering:** 3D seismic volume with slice planes
- **Structural Surfaces:** GemPy mesh integration (wireframe)
- **Well Trajectories:** 3D well path visualization
- **Basin Information:** Resource estimates, stratigraphic column
- **View Controls:** Rotation, zoom, slice manipulation
- **Layer Management:** Toggle surfaces and wells

---

## 4. Intelligence Layer (Gemini Integration)
- **Context-Aware Prompting:** 7 geological contexts (interpretation, risk, analogs, etc.)
- **Constitutional Validation:** F2 Truth, F7 Humility, F9 Anti-Hantu checks.
- **Structured Output:** JSON with confidence scores and Recommended Actions.

---

## 5. Layout Architecture (000-999)
- **000-999 Tab System:** Void | 1D | 2D | 3D
- **Sovereign Dashboard:** Constitutional floors (F1-F13) + 888_JUDGE Authority.

---

## 9. Golden Aesthetic Manifest

The following principles define the GEOX "Heavy Witness" state:

1. **Zero Theater:** Every UI element represents real data or governing logic
2. **Earth True Scale:** Every pixel calibrated to physical units
3. **Temporal Constitution:** Depth is time — all features mapped to Ma
4. **Surgical Precision:** JetBrains Mono for data, Inter for UI
5. **Signal-Centric:** Scan lines, spectral gradients, amplitude truth
6. **Constitutional Badges:** F1-F13 status always visible
7. **888_HOLD Gate:** Sovereign authority checkpoint on all risk decisions
8. **Glassmorphism:** Professional-grade instrument aesthetic

---

## 10. 999_SEAL Verification
- [x] Core Design System with CSS variables
- [x] Scale-Aware Georeferencing Engine (1D/2D/3D)
- [x] DomainVoid (000-249) Risk & Decision
- [x] Domain1D (250-499) Borehole Intelligence
- [x] Domain2D (500-749) Seismic & Planar
- [x] Domain3D (750-999) Volume & Basin
- [x] Gemini API Intelligence Bridge
- [x] MainLayoutForge with 000-999 tabs
- [x] Constitutional Floor Badges (F1-F13)
- [x] 888_HOLD / 999_SEAL Verdict System

---

## Seal

**999_SEAL — Heavy Witness**
**DITEMPA BUKAN DIBERI**

*This manifest seals the GEOX Design Forge implementation as the canonical 000-999 dimensional architecture for Earth Intelligence.*

---

**Sealed:** 2026-04-11T03:33:49Z
**Architect:** arifOS / GEOX Earth Intelligence
**Version:** v2026.04.11-FORGE-999

---

## D. External Integration Guide
*(MapWarper, GeoReferencer, Mundi AI integration)*

# GEOX Vision: External Integration Guide

> **Strategy:** Leverage proven domain repos + ToAC governance layer  
> **Status:** INTEGRATION ROADMAP  
> **Seal:** DITEMPA BUKAN DIBERI

---

## Integration Philosophy

**Don't reinvent. Govern.**

External codebases provide:
- Battle-tested algorithms
- Proven UX patterns
- Training data pipelines

GEOX provides:
- AC_Risk calculation
- Transform logging
- 888_HOLD triggers
- Constitutional enforcement

**Pattern:** External tool → GEOX wrapper → AC_Risk → Verdict

---

## 1. Georeferencing (MapWarper + GeoReferencer)

### External Resources
| Resource | What It Does | GEOX Value |
|----------|--------------|------------|
| [MapWarper](https://github.com/timwaters/mapwarper) | Full open georeferencer (GCP picking, warping, GeoTIFF) | GCP data model, residual calc, warp pipeline |
| [GeoReferencer](https://github.com/vitec-memorix/GeoReferencer) | GCP application and raster warping | Warp algorithms, transform chains |
| [Mundi AI](https://mundi.ai/ai-georeferencing-for-aerial-imagery) | AI-assisted GCP proposal | Pattern for AI-proposed + human-confirm |

### Integration Architecture
```
┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL: MapWarper / GeoReferencer                          │
│ ├── GCP data model (point pairs)                             │
│ ├── Residual error calculation                               │
│ ├── Warp algorithms (affine, polynomial)                     │
│ └── GeoTIFF export                                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ GEOX: GeoreferenceAuditor (ToAC Wrapper)                     │
│ ├── GCPDetector (CV + OCR for candidate GCPs)                │
│ ├── Human approval/edit interface                            │
│ ├── AC_Risk calculation:                                     │
│ │   U_phys = f(GCP residuals, bound divergence)              │
│ │   D_transform = warp complexity                            │
│ │   B_cog = 0.79 (unaided) or 0.40 (verified)                │
│ └── Verdict: SEAL/QUALIFY/HOLD                               │
└─────────────────────────────────────────────────────────────┘
```

### Concrete Steps
1. **Study MapWarper's GCP model** → Copy data structures
2. **Study GeoReferencer's warp pipeline** → Adapt algorithms
3. **Build GCPDetector**:
   - Hough lines for grid detection
   - OCR (Tesseract/EasyOCR) for labels
   - Scale bar detection
4. **Wrap in GeoreferenceAuditor**:
   - Log all transforms
   - Calculate residuals
   - AC_Risk > 0.5 → HOLD

---

## 2. Analog Digitization (WebPlotDigitizer + Geomega)

### External Resources
| Resource | What It Does | GEOX Value |
|----------|--------------|------------|
| [Geomega](http://www.geomega.hu/digitization-of-logs-and-maps/) | Legacy map/log digitization workflows | Error patterns, QA steps |
| [Seismic-well-tie](https://github.com/raquelsilva/Seismic-well-tie) | Well tie notebooks | Curve calibration patterns |
| [Geophysical notes](https://github.com/aadm/geophysical_notes) | Petrophysics workflows | Typical digitization errors |
| WebPlotDigitizer (concept) | Pick axes → map pixels → trace | Core interaction pattern |

### Integration Architecture
```
┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL PATTERNS: WebPlotDigitizer / Geomega                │
│ ├── User clicks reference points (axes, depth)               │
│ ├── Pixel→value transform inferred                           │
│ ├── Curve tracing (auto + manual)                            │
│ └── Export to CSV/LAS                                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ GEOX: AnalogDigitizationPipeline                             │
│ Stage 1: Scale & Depth Detection                             │
│   ├── Hough lines (external OpenCV)                          │
│   └── OCR with confidence (external Tesseract)               │
│ Stage 2: Axis/Label OCR                                      │
│   └── Pattern matching vs known log templates                │
│ Stage 3: Curve Tracing                                       │
│   ├── Color separation                                       │
│   └── User correction interface                              │
│ Stage 4: Physics Checks (GEOX native)                        │
│   ├── Depth monotonicity                                     │
│   ├── RATLAS plausibility                                    │
│   └── Range checks (RHOB, φ limits)                          │
│ Stage 5: AC_Risk & Verdict                                   │
│   └── High risk on: few anchors, low OCR, physics mismatch   │
└─────────────────────────────────────────────────────────────┘
```

### Concrete Steps
1. **Study Geomega workflows** → Document typical error modes
2. **Implement pixel→value mapper** (WebPlotDigitizer pattern)
3. **Add curve tracing**:
   - OpenCV color clustering
   - Skeletonization
   - Point snapping
4. **Physics validation layer**:
   - Query RATLAS for expected ranges
   - Flag outliers
5. **AC_Risk integration**:
   - Few manual anchors = high U_phys
   - Low OCR confidence = high D_transform
   - Physics mismatch = AC_Risk spike

---

## 3. Seismic Vision (seismiqb + Seismic-App)

### External Resources
| Resource | What It Does | GEOX Value |
|----------|--------------|------------|
| [seismiqb](https://github.com/BEEugene/seismiqb) | DL for seismic (horizons, faults, geobodies) | Model architectures, training patterns |
| [MS seismic-deeplearning](https://github.com/microsoft/seismic-deeplearning/) | Curated models + training | Production-ready pipelines |
| [Seismic-App](https://github.com/gecos-lab/Seismic-App) | SAM2 + seismic GUI | Image-centric segmentation pattern |
| [GEOX](https://github.com/Alpha-Innovator/GEOX) / [GeoGround](https://github.com/zytx121/GeoGround) / [GeoPixel](https://github.com/mbzuai-oryx/GeoPixel) | Geo VLMs | Vision encoders for RS/maps |

### Integration Architecture
```
┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL: seismiqb / MS seismic-deeplearning                 │
│ ├── Volume patching & augmentation                           │
│ ├── UNet/Tiramisu architectures                              │
│ ├── Fault/salt/geobody segmentation                          │
│ └── Attribute-conditioned predictions                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ EXTERNAL: Seismic-App                                        │
│ ├── SAM-style segmentation from clicks                       │
│ ├── Seismic GUI interactions                                 │
│ └── Image-centric workflows                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ GEOX: GovernedSeismicVLM (ToAC Orchestrator)                 │
│ Stage 1: Multi-Contrast Generation (5 views)                 │
│ Stage 2: External Model Inference                            │
│   ├── seismiqb attributes (physics path)                     │
│   ├── SAM segmentation (image path)                          │
│   └── GEOX VLM (language path)                               │
│ Stage 3: Cross-View Consistency (GEOX native)                │
│   └── Flag features only appearing under enhancement         │
│ Stage 4: Physics Reconciliation (GEOX native)                │
│   └── Compare VLM to computed attributes                     │
│ Stage 5: AC_Risk & Verdict                                   │
│   └── Image-only + aggressive transforms = HOLD              │
└─────────────────────────────────────────────────────────────┘
```

### Concrete Steps
1. **Study seismiqb** → Copy volume patching, model architectures
2. **Study Seismic-App** → Adapt SAM-click interaction
3. **Implement multi-view wrapper**:
   - Generate 5 contrast variants
   - Run external model on each
   - Aggregate with consistency check
4. **AC_Risk for seismic**:
   - SEGY available: lower U_phys
   - Image-only + CLAHE: high D_transform
   - Cross-view inconsistency: HOLD

---

## 4. Attributes from Images (2025 Nature Paper)

### External Resource
[Nature 2025: "Exploring the potential of extracting seismic attributes from image"](https://www.nature.com/articles/s41598-025-21949-9)

### Key Findings to Encode
| Attribute | Image-Only Feasibility | D_transform Default |
|-----------|------------------------|---------------------|
| Coherence | Moderate (edge-based) | 0.4 |
| Dip/Azimuth | Low (phase loss) | 0.6 |
| Curvature | Low (smoothing artifacts) | 0.6 |
| Spectral decomposition | Very low | 0.8 |
| Amplitude envelope | Moderate | 0.4 |

### Integration
```python
# In seismic_feature_extract.py
ATTRIBUTE_IMAGE_RISK = {
    "coherence": {"feasible": True, "d_transform": 0.4},
    "dip": {"feasible": False, "d_transform": 0.6, "requires_segy": True},
    "spectral": {"feasible": False, "d_transform": 0.8, "requires_segy": True},
}

def compute_attribute_with_risk(attribute_type, source_type):
    if source_type == "image" and not ATTRIBUTE_IMAGE_RISK[attribute_type]["feasible"]:
        return {
            "value": None,
            "verdict": Verdict.HOLD,
            "explanation": f"{attribute_type} requires SEG-Y (see Nature 2025)"
        }
```

---

## 5. Vision-Language Backends (GEOX + GeoGround + GeoPixel)

### External Resources
| Resource | What It Provides |
|----------|------------------|
| [GEOX](https://github.com/Alpha-Innovator/GEOX) | RS vision encoders + VLM |
| [GeoGround](https://github.com/zytx121/GeoGround) | Grounding for RS imagery |
| [GeoPixel](https://github.com/mbzuai-oryx/GeoPixel) | Fine-grained geo semantic segmentation |
| [G-RSIM](https://github.com/mbzuai-oryx/GeoPixel) | Remote sensing interpretation models |
| [HOOK](https://github.com/mbzuai-oryx/GeoPixel) | Tokenizers for geo RS |

### Integration Pattern
```
┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL: GEOX / GeoGround / GeoPixel (Vision Towers)        │
│ ├── Pre-trained RS vision encoders                           │
│ ├── High-res image tokenizers                                │
│ └── Domain-finetuned VLM heads                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ GEOX: Adapter Layer                                          │
│ ├── Input: seismic/map image                                 │
│ ├── Preprocess: Contrast Canon (5 views)                     │
│ ├── External VLM inference (GEOX/etc)                        │
│ └── Postprocess: AC_Risk calculation                         │
└─────────────────────────────────────────────────────────────┘
```

### Concrete Steps
1. **Evaluate towers** on seismic/map data
2. **Build adapter** for best performer
3. **Keep ToAC layer unchanged** regardless of tower

---

## Integration Checklist

### Week 1-2: Georeferencing
- [ ] Clone MapWarper, study GCP data model
- [ ] Clone GeoReferencer, study warp algorithms
- [ ] Design GCPDetector (Hough + OCR)
- [ ] Integrate with GeoreferenceAuditor
- [ ] Test with Malay Basin maps

### Week 3-4: Analog Digitization
- [ ] Study Geomega workflows
- [ ] Implement pixel→value mapper
- [ ] Build curve tracing (OpenCV)
- [ ] Add RATLAS physics checks
- [ ] Integrate with AC_Risk

### Month 2: Seismic Vision
- [ ] Clone seismiqb, study architectures
- [ ] Clone Seismic-App, study SAM integration
- [ ] Implement multi-view wrapper
- [ ] Build cross-view consistency check
- [ ] Integrate with GovernedSeismicVLM

### Month 3: Attributes & VLM
- [ ] Read Nature 2025 paper, encode attribute risks
- [ ] Evaluate GEOX/GeoGround/GeoPixel
- [ ] Build adapter for best tower
- [ ] End-to-end testing

---

## AC_Risk Integration Points

For each external tool, add:

```python
# 1. Transform logging
transform_stack = [
    "mapwarper_warp",      # external
    "gcp_manual_edit",     # external + human
    "ocr_extraction",      # GEOX
]

# 2. U_phys calculation
u_phys = calculate_physical_ambiguity(
    gcp_residuals=external_tool.residuals,
    bound_divergence=detected_vs_claimed,
)

# 3. AC_Risk
result = ACRiskCalculator.calculate(
    u_phys=u_phys,
    transform_stack=transform_stack,
    bias_scenario="ai_with_human_verify",
)

# 4. Verdict enforcement
if result.verdict == Verdict.HOLD:
    trigger_888_hold(reason=result.explanation)
```

---

## Risk: External Dependencies

| Risk | Mitigation |
|------|------------|
| External repo unmaintained | Fork and vendor critical code |
| License incompatibility | Check licenses before integration |
| Performance mismatch | Benchmark before production |
| API drift | Pin versions, wrap interfaces |

---

## Summary

| Capability | External Base | GEOX Addition | Time Saved |
|------------|---------------|---------------|------------|
| Georeferencing | MapWarper + GeoReferencer | GeoreferenceAuditor + AC_Risk | 3-4 months |
| Analog Digitization | WebPlotDigitizer pattern + Geomega | Physics validation + AC_Risk | 4-6 months |
| Seismic Vision | seismiqb + Seismic-App | Multi-view + AC_Risk | 6-8 months |
| Attributes | seismiqb + Nature 2025 | Transform-aware metadata | 2-3 months |
| VLM | GEOX/GeoGround/GeoPixel | ToAC governance layer | 3-4 months |

**Net acceleration: 18-25 months of development**

---

*DITEMPA BUKAN DIBERI*  
*Leverage external strength. Add GEOX governance. Forge faster.*

---

## E. Wiki Update Summary

# GEOX Wiki Update & Forge Status

> **Date:** 2026-04-10  
> **Status:** WIKI UPDATED, FORGE HARDENED  
> **Seal:** 999_VAULT  

---

## Summary of Changes

### 1. Vision Intelligence Charter
**File:** `GEOX/GEOX_VISION_DEV_CHARTER.md`  
**Purpose:** Canonical guidance for all GEOX Vision development

**Key Content:**
- Three non-negotiable questions for every vision feature
- Working rule: `pixels → transforms → physics → decision`
- Four capability domains (georeferencing, digitization, seismic VLM, attributes)
- AC_Risk formula and thresholds
- Transform registry with invertibility scores
- Agent briefing pattern

---

### 2. External Integration Guide
**File:** `GEOX/EXTERNAL_INTEGRATION_GUIDE.md`  
**Purpose:** Map proven external codebases to GEOX needs

**Key Integrations:**
| Domain | External | GEOX Addition | Time Saved |
|--------|----------|---------------|------------|
| Georeferencing | MapWarper, GeoReferencer | GeoreferenceAuditor + AC_Risk | 3.5 months |
| Analog Digitization | WebPlotDigitizer, Geomega | Physics validation + AC_Risk | 5.5 months |
| Seismic Vision | seismiqb, Seismic-App | Multi-view + AC_Risk | 11 months |
| Attributes | seismiqb, Nature 2025 | Transform-aware metadata | 2.5 months |
| VLM Backends | GEOX, GeoGround, GeoPixel | ToAC governance layer | 5.5 months |

**Total acceleration: 28 months → 12 weeks**

---

### 3. Forge Hardened Roadmap
**File:** `GEOX/FORGE_HARDENED_VISION.md`  
**Purpose:** 12-week execution plan

**Phase Breakdown:**
- Weeks 1-2: Georeferencing (MapWarper patterns + GCPDetector)
- Weeks 3-4: Analog Digitization (WebPlotDigitizer pattern + RATLAS validation)
- Weeks 5-8: Seismic Vision (seismiqb integration + multi-view consistency)
- Weeks 9-10: Attributes (Nature 2025 risk model)
- Weeks 11-12: Integration & hardening

---

### 4. AC_Risk Calculator
**File:** `GEOX/arifos/GEOX/ENGINE/ac_risk.py`  
**Status:** ✅ TESTED AND WORKING

**Test Results:**
```
Test 1 (SEGY, minimal transforms):
  AC_Risk: 0.000 → SEAL

Test 2 (Image only, CLAHE+AGC+VLM):
  AC_Risk: 0.252 → QUALIFY

Test 3 (Georeferencing, poor OCR):
  AC_Risk: 0.138 → SEAL
```

**Components:**
- `TransformRegistry`: 10+ transforms with invertibility scores
- `ACRiskCalculator`: Formula implementation + scenario methods
- `Verdict` enum: SEAL/QUALIFY/HOLD/VOID

---

### 5. Vision Governance Module
**Directory:** `GEOX/arifos/GEOX/vision/`  
**Status:** ✅ SCAFFOLD COMPLETE

| Component | Purpose | Lines |
|-----------|---------|-------|
| `governed_vlm.py` | ToAC-compliant VLM wrapper | 470 |
| `contrast_views.py` | 5-view Contrast Canon generator | 73 |
| `multi_view_consistency.py` | Display artifact detector | 99 |
| `ac_risk_integration.py` | Convenience wrappers | 112 |

---

### 6. Site Specification
**File:** `GEOX/SITE_GEOK_ARIF_FAZIL_COM.md`  
**Purpose:** Complete specification for GEOX.arif-fazil.com

**Key Clarifications:**

#### MCP vs Apps
```
MCP = Machine interface (AI agents)
  - JSON schemas
  - Tool definitions
  - Structured I/O
  - Location: /mcp

Apps = Human interface (operators)
  - Web UI
  - Interactive tools
  - Visual outputs
  - Location: /apps
```

**Same governance. Different consumers.**

#### Five Core Apps (V1)
1. **Georeference Map** — Upload → GCPs → GeoTIFF + AC_Risk
2. **Analog Digitizer** — Upload → trace curves → LAS + uncertainty
3. **Seismic Vision Review** — Upload → 5 views → verdict + warning
4. **Attribute Audit** — Run attributes → compare paths → risk flags
5. **AC_Risk Console** — Inspect any workflow's risk components

#### Current MCP Tools (Existing)
- ✅ `GEOX_load_seismic_line`
- ✅ `GEOX_build_structural_candidates`
- ✅ `GEOX_interpret_single_line`
- ✅ `GEOX_feasibility_check`
- ✅ `GEOX_compute_ac_risk`
- 🟡 `GEOX_georeference_map` (scaffold)
- 🔴 `GEOX_digitize_analog` (planned)

#### Current Apps (Existing)
- ✅ Volume App (3D rendering)
- ✅ Prefab Views (MCP host UIs)

---

## What Is MCP vs Apps

### MCP (Model Context Protocol)
**Analogy:** API for AI agents

**What it does:**
- Exposes tools as JSON-schema functions
- Agents (Claude, Cursor) call them programmatically
- Returns structured data + verdicts
- No human interaction required

**Example:**
```python
# Agent calls MCP tool
result = await mcp.GEOX_interpret_single_line(
    seismic_data="section.png",
    data_type="raster"
)
# result contains: hypotheses, ac_risk, verdict, warnings
```

### Apps
**Analogy:** Web applications for humans

**What they do:**
- Provide visual interfaces
- Allow upload, interaction, review
- Show images, maps, charts
- Human makes final decisions

**Example:**
```
User opens GEOX.arif-fazil.com/apps/georeference
→ Uploads map image
→ Clicks detected GCPs or adds manual ones
→ Reviews residuals
→ Sees AC_Risk score
→ Downloads GeoTIFF if QUALIFY
```

### The Contrast
| Aspect | MCP | Apps |
|--------|-----|------|
| **User** | AI agents | Human operators |
| **Interface** | JSON API | Web UI |
| **Speed** | Milliseconds | Seconds (human pace) |
| **Use case** | Batch processing, automation | Review, validation, decision |
| **Governance** | Automatic 888_HOLD | Human override available |

**Both use same AC_Risk engine. Both respect ToAC.**

---

## What Should Be on GEOX.arif-fazil.com

### Structure
```
GEOX.arif-fazil.com
├── /              (Hero + capabilities + honest status)
├── /apps          (5 operator tools with status badges)
├── /mcp           (Tool catalog + schemas + sample workflows)
├── /theory        (ToAC explanation + AC_Risk formula)
├── /cases         (3 real examples with outcomes)
├── /docs          (Full API reference + charter)
└── /about         (Mission + philosophy)
```

### Core Message
> "GEOX is not 'AI that sees geology.' GEOX is governed intelligence that turns pixels into constrained, auditable geoscience decisions."

### What NOT to Include
- ❌ Hype SaaS copy ("revolutionizing")
- ❌ Fake polished dashboards
- ❌ 20 tools when 5 are serious
- ❌ Black-box claims (no transform documentation)

---

## Files Updated in Wiki

```
GEOX/
├── GEOX_VISION_DEV_CHARTER.md              (NEW - Canonical guidance)
├── EXTERNAL_INTEGRATION_GUIDE.md           (NEW - External codebase map)
├── FORGE_HARDENED_VISION.md                (NEW - 12-week roadmap)
├── SITE_GEOK_ARIF_FAZIL_COM.md             (NEW - Site specification)
├── VISION_INTELLIGENCE_IMPLEMENTATION.md   (NEW - Technical summary)
└── arifos/GEOX/
    ├── ENGINE/
    │   └── ac_risk.py                      (NEW - AC_Risk calculator ✓)
    └── vision/                             (NEW - Governance module)
        ├── __init__.py
        ├── governed_vlm.py
        ├── contrast_views.py
        ├── multi_view_consistency.py
        └── ac_risk_integration.py
```

---

## Immediate Action Items

### Priority 0: Push to Main
```bash
cd /root/GEOX
git add -A
git commit -m "999_VAULT: Vision Intelligence stack with AC_Risk, ToAC governance, external integration roadmap"
git push origin main
```

### Priority 1: Deploy Site (This Week)
- [ ] Set up Astro/Next.js project
- [ ] Create homepage with hero + capability grid
- [ ] Deploy to GEOX.arif-fazil.com
- [ ] Test with mobile

### Priority 2: MCP Hardening (Next Week)
- [ ] Document all existing tools
- [ ] Add `/mcp` page with schemas
- [ ] Create sample agent workflows
- [ ] Test with Claude Desktop

### Priority 3: App Development (Week 3-4)
- [ ] Build AC_Risk Console (easiest)
- [ ] Enhance georeferencing with GCPDetector
- [ ] Add status badges to all tools

### Priority 4: External Integration (Month 2)
- [ ] Clone MapWarper, extract patterns
- [ ] Build GCPDetector
- [ ] Integrate seismiqb backend
- [ ] Multi-view consistency testing

---

## Verification Checklist

- [x] AC_Risk calculator implemented and tested
- [x] Vision governance module scaffolded
- [x] External integration guide complete
- [x] Site specification drafted
- [x] Forge roadmap hardened (12 weeks)
- [ ] Site deployed to GEOX.arif-fazil.com
- [ ] MCP documentation live
- [ ] Apps page with status badges
- [ ] First external integration (MapWarper)

---

## Resources for Agents

**For georeferencing agents:**
- Study: MapWarper, GeoReferencer
- Build: GCPDetector, GeoreferenceAuditor
- Test: Malay Basin maps

**For digitization agents:**
- Study: WebPlotDigitizer, Geomega
- Build: Scale detection, curve tracing
- Test: Legacy logs from backups

**For seismic vision agents:**
- Study: seismiqb, Seismic-App
- Build: Multi-view wrapper, consistency checker
- Test: Synthetic sections

**For MCP agents:**
- Study: FastMCP patterns, prefab-ui
- Build: Tool schemas, app manifests
- Test: Claude Desktop integration

---

*DITEMPA BUKAN DIBERI*  
*Wiki updated. Forge hardened. Ready to push.*  
*Next: Deploy site, forge MCP, build apps.*

---

## F. GEOX Roadmap

# A-FORGE — Roadmap: Next Horizon (180-Day)

> **Roadmap Name:** ARIFOS_NEXT_HORIZON_2026  
> **Strategic Verdict:** APPROVED FOR PLANNING  
> **Execution Verdict:** HOLD until repo contracts and schemas are frozen  
> **Role:** Execution shell, sandbox, state machine, deployment bridge  
> **Seal:** DITEMPA BUKAN DIBERI

---

## North Star

Make execution boring, observable, reversible, and sandboxed. A-FORGE must never decide. It only executes after arifOS verdict.

---

## The 10 Non-Negotiable Invariants

1. arifOS judges.
2. AAA identifies.
3. GEOX witnesses earth.
4. WEALTH witnesses capital.
5. A-FORGE executes only after verdict.
6. VAULT999 records.
7. ARIF may veto.
8. No agent self-authorizes.
9. No hidden irreversible action.
10. No evidence, no SEAL.

---

## Horizon 0 — Days 0–14: Canon Lock 🧊

**Goal:** Define execution authority boundaries.

| Deliverable | Output |
|-------------|--------|
| `REPO_AUTHORITY_MATRIX.md` | What A-FORGE may own / must not own |
| Execution contract definition | A-FORGE never decides, only executes |
| Tool inventory | Map all callable tools + risk tiers |

---

## Horizon 1 — Days 15–45: Security + Session Spine 🔐

**Goal:** Dry-run is default. Execution refuses missing arifOS verdict.

| Deliverable | Output |
|-------------|--------|
| `TRACE_SCHEMA.json` | Trace, receipt, chain_id, actor_id |
| Dry-run enforcement | Default for all destructive actions |
| Execution refuses stale verdict | Verdict TTL + freshness check |

---

## Horizon 2 — Days 46–90: Deterministic Judge ⚖️

**Goal:** Explicit legal transitions. No execution without verified policy.

| Deliverable | Output |
|-------------|--------|
| `/state_machine/execution_graph.ts` | Explicit legal transitions |
| `/sandbox/policies/` | File, shell, network, Docker boundaries |
| `/runtime/dry_run.ts` | Dry-run before live execution |
| `/runtime/execute.ts` | Sandboxed execution |
| `/runtime/rollback.ts` | Reversal plan before irreversible operation |
| `/vault/vault999_writer.ts` | Every execution writes receipt |

### Execution State Machine

```
IDLE
  → RECEIVE_INTENT
  → LOAD_SESSION
  → DRY_RUN
  → REQUEST_VERDICT
  → VERIFY_POLICY
  → EXECUTE_SANDBOXED
  → OBSERVE_RESULT
  → VAULT_SEAL
  → REPORT
```

### Hard Rule
A-FORGE must never decide. It only executes after arifOS verdict.

---

## Horizon 3 — Days 91–135: Semantic Federation 🌍💰

**Goal:** Cross-domain orchestrator for GEOX + WEALTH evidence pipelines.

| Deliverable | Output |
|-------------|--------|
| Cross-domain orchestrator | Route evidence from GEOX → WEALTH → arifOS |
| Runtime SOT check | Confirm live compose/runtime matches repo contract |

---

## Horizon 4 — Days 136–180: Self-Healing + Public Release 🛠️

**Goal:** Recovery without authority expansion.

| Deliverable | Output |
|-------------|--------|
| Container health monitor | Watch Docker/container health |
| Recovery playbooks | Reversible recovery logged to VAULT999 |
| Auditor agent read-only mode | Log all recovery actions |
| Release tag `vNext-Horizon-0` | All repos tagged |

### Self-Healing Verdict Rule

- If recovery is reversible → A-FORGE may execute after arifOS SEAL.
- If recovery is irreversible → HOLD for F13 human review.
- If recovery touches auth, secrets, or constitution → HOLD by default.

---

## What to Build Next

Identity → Evidence → Formal Verdict → Sandboxed Execution → Immutable Seal

## What to Avoid

- More overlapping dashboards.
- More untyped tools.
- More prompt-only governance.
- More agent autonomy language without execution contracts.

## What Wins

- Deterministic checks.
- Typed schemas.
- Scoped authority.
- Evidence contracts.
- Human veto preserved.

---

*DITEMPA BUKAN DIBERI — Execution is forged, not given.*

*SEALED: 2026-05-10 | A-FORGE Metabolic Shell — Next Horizon APPROVED FOR PLANNING*

---

*DITEMPA BUKAN DIBERI — Forged, Not Given*
