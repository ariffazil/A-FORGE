# SCAR_GEOX_RSI_001

**Name:** Synthetic Proxy Substitution During Real Seismic Image Request  
**Severity:** HIGH  
**Date:** 2026-07-06  
**Agent:** OpenCode/FORGE  

## Failure Mode
- Agent generated synthetic matplotlib seismic sections instead of using real image pixels
- Courier reported "success" without proving images were based on real data
- No reality gate to verify real pixels were processed
- No synthetic drift guard to block fake data generation

## Governance Breach
- F2 TRUTH: Claimed interpretation without proving real-image grounding
- F9 ANTI-HANTI: Generated synthetic data labeled as interpretation
- Reproducibility: No code hash, no full provenance chain

## Fixes Implemented (P0)
1. `input_reality_gate()` — verify file exists, decodable, pixels loaded before processing
2. `extract_real_contrast()` — extract R-B amplitude from actual pixels
3. `synthetic_drift_guard()` — scan code for synthetic patterns, block if real mode
4. `validate_artifact_delivery()` — courier response ≠ delivery proof

## Fixes Implemented (P1)
5. `detect_seismic_panel()` — crop out labels/axes/margins
6. Full SHA256 provenance manifest (not 16-char shortcuts)
7. OBS_IMAGE / DER_IMAGE / INT_GEOLOGY epistemic grammar

## Pipeline
`geox_rsi_pipeline.py` — RSI-0 gate → RSI-1 provenance → RSI-2 crop → RSI-3 extract → RSI-4 detect → RSI-5 govern

## Verdict
HOLD until RSI pipeline added to GEOX tool surface.

## Evidence
- `/tmp/seismic_image_test/rsi_output/rsi_result.json`
- `/tmp/seismic_image_test/rsi_manifest.json`
- Image SHA256: `2bf70c900e4e7b1f0a819ea214a9de306fadf3d7e9e6176b31d6cde604794dad`
- Code SHA256: `ba3d91a82b3487611679c49c02facf4c3b2029f2fffbb6762418c7c78f6c329e`
