# 🌉 WORKFLOW 3: HERMES → Domain Organs → arifOS
# Multi-Modal Bridge → Organs → Kernel
# External signal enters through HERMES, routes to the right organ,
# evidence flows to arifOS for judgment.

```yaml
workflow_id: wf-hermes-bridge
canonical_name: "Multi-Modal Bridge → Evidence → Judgment"
layers_traversed: [L3, L3, L1]
organs_touched: [HERMES, GEOX|WEALTH|WELL, arifOS]
metabolic_steps: [000, 111, 444, 888]
```

## Signal Types → Organ Routing

| Signal | Routes To | Tool | What Happens |
|--------|-----------|------|-------------|
| Seismic image | GEOX | `geox_seismic_interpret(mode="vision")` | Structural interpretation |
| Well log (LAS) | GEOX | `geox_well_ingest(mode="auto")` | Log ingestion + QC |
| Market alert | WEALTH | `capital_market(mode="fx")` | Price snapshot |
| "Arif says he's tired" | WELL | `well_assess_homeostasis(mode="fatigue")` | Fatigue check |
| PDF/Report | A-FORGE | `forge_document_ingest(mode="extract")` | Document parsing |

## Sequence (Example: Seismic Image from Telegram)

### Stage 1: INGEST — HERMES (L3)
```
Telegram → HERMES receives image
HERMES classifies signal_type: "seismic_image"
HERMES routes to: GEOX
```

### Stage 2: COMPUTE — GEOX (L3)
```
Tool: geox_seismic_interpret(mode="vision", image_data=<base64>)
MCP: https://geox.arif-fazil.com/mcp
→ Returns: horizon_picks, fault_interpretation, confidence
→ Epistemic: INTERPRETED (vision model output)
```

### Stage 3: JUDGE — arifOS (L1)
```
Tool: arif_judge(intent="Seismic interpretation ready for review",
  evidence=[hermes_signal_receipt, geox_interpretation_receipt])
→ Verdict: SEAL (evidence complete) | SABAR (needs human review)
```

## Guard Conditions
- HERMES never interprets — it routes. Evidence is GEOX/WEALTH/WELL's job.
- External signals carry INJECTION risk (F12). arifOS scans before SEAL.
- HERMES is the ONLY organ that talks to the outside world.
