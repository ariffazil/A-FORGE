# A-FORGE PUBLISH — Tier 3 Compiler Sidecar

> **DITEMPA BUKAN DIBERI** — Forged, not given.
> **Forged:** 2026-07-21 by FORGE (000Ω) under F13 SOVEREIGN directive
> **Substrate:** Python 3.12+ · ReportLab 4.4 · Typst 0.13 · WeasyPrint 68 · Playwright 1.61
> **Constitutional contract:** F1 AMANAH (reversible) · F2 TRUTH (epistemic labels) · F4 CLARITY (ΔS ≤ 0)

A governed PDF compilation engine for AAA-grade geological / engineering / financial
artifacts. The A-FORGE TypeScript shell invokes this sidecar via subprocess or HTTP;
GEOX, WELL, and WEALTH hooks pull physics-validated evidence directly from the
federation organs.

## Architecture

```
                   ┌──────────────────────────────────────────┐
                   │   AForgePublishCompiler (facade)        │
                   │   Strategy pattern · backend picker    │
                   └────────────────────┬─────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Typst Backend   │         │ ReportLab Backend│         │WeasyPrint Backend│
│  ─────────────   │         │ ─────────────    │         │ ─────────────    │
│  Best for math + │         │  Best for fast   │         │  Best for HTML   │
│  publications    │         │  programmatic    │         │  + CSS dashboard │
│  Requires: typst │         │  No external deps│         │  Requires: full  │
│  binary          │         │                  │         │  HTML pipeline   │
└──────────────────┘         └──────────────────┘         └──────────────────┘

        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   GEOX Hook      │         │   WELL Hook      │         │  WEALTH Hook     │
│  basin/evidence/ │         │  petrophysics +  │         │  NPV/IRR/EMV +   │
│  claim/falsify   │         │  vitality +      │         │  conservation +  │
│  via MCP JSON-   │         │  dignity         │         │  entropy         │
│  RPC :8081       │         │  via MCP :18083  │         │  via MCP :18082  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

## Epistemic Label Convention

Every claim, layer, and figure element MUST carry one of:

| Tag | Meaning | Examples |
|-----|---------|----------|
| `[OBS]` | Observed | EMAG2 magnetic, well picks, gravity station |
| `[DER]` | Derived | Kriged surface, computed density, calculated porosity |
| `[INT]` | Interpreted | Seismic horizon tie, structural fault pick, basin classification |
| `[SPEC]` | Speculative | Extrapolated basement, uncalibrated basins, legacy polygon |

## CLI

```bash
# Compile a YAML/JSON manifest into PDF
aforge-publish compile manifest.yaml --backend typst --out artifact.pdf

# Render Malay Basin Tier 3 from session_id
aforge-publish forge-basin --session SEAL-XXX --actor arif \
    --basin "Malay Basin" --backend typst --send-telegram

# Probe organ surface
aforge-publish probe geox --session SEAL-XXX --actor arif
aforge-publish probe well --session SEAL-XXX --actor arif
```

## Floor Compliance

- **F1 AMANAH** — Every compile produces a SHA256 receipt; source manifest preserved
- **F2 TRUTH** — Epistemic labels required on every figure element; falsification
  verdict (`geox_falsify`) must be referenced in the artifact
- **F4 CLARITY** — Single-pass compile; deterministic output given same inputs
- **F11 AUDIT** — Every artifact has `.receipt.json` alongside the PDF
- **F13 SOVEREIGN** — Artifact delivery targets Arif only via Hermes courier
