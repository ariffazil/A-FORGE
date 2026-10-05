# AAA WORK ORDER — Attention-Plane Hold Taxonomy (P0)
**From:** FI-008 · **To:** AAA mesh owner (observatory renderer, arif-fazil.com AAA page) · **Date:** 2026-10-05 ~22:55 MYT
**Priority:** P0 — the plane is currently misreporting sovereign workload.

## Diagnosis (receipted 22:50 MYT via arifFlow flow_health)
Dashboard shows "PERHATIAN DIPERLUKAN — 5 Tindakan Menunggu Keputusan Arif (F13 Sovereign Binary)".
Ground truth: **all 5 are FQ throttle states, ZERO are F13 binaries.**
- `333-agi`: HELD FQ=1.00 (quotient 1.0, verdict OPTIMAL) — stale/persistent throttle state, likely bug: perfect verify ratio should not hold.
- `chron`, `codex`, `codex-startup`, `kimi-code/fi-008`: HELD FQ=0.00 — "EXECUTION DOMINANCE" (exec receipts without verify receipts in 100-window). Auto-recoverable metabolic braking, NOT sovereign decisions.
Noise ratio: 5/5 (100%). The attention plane taxed the sovereign 5 times for zero real decisions — this is the exact "throughput erosion" failure mode the sovereign is tracking (see: 888-throughput discussion, this session).

## Required fix (AAA renderer / hold feed)
Classify every hold into one of THREE classes before display:
1. `F13_BINARY` — irreversible/constitutional class, human_confirmation_required=true → show under "PERHATIAN DIPERLUKAN".
2. `FQ_THROTTLE` — held by arifFlow FQ engine → show as "Brek metabolik — pulih sendiri (verify debt: N)", with the counter and recovery condition. NEVER under attention-required.
3. `SABAR_COOLING` — time-decay holds → show with countdown, never under attention-required.
Add a headline rule: **"Menunggu Arif" count = F13_BINARY count only.** If zero → banner shows "TIADA KEPUTUSAN DIPERLUKAN — persekutuan mengalir" (not a silent empty state — say it positively).

## Also observed (P2, non-urgent)
- `333-agi` hold-with-perfect-FQ looks like a throttle-state persistence bug in arifFlow itself — surface to arifFlow owner (window/decay logic: held=true should clear when quotient ≥ required).
- Actor verdicts render "UNKNOWN" when quotient=null (0 verify) — cosmetic; resolves as verify receipts accrue.
- chron latency 578ms vs 1-110ms for other organs — prediction engine now load-bearing (13 stakes + vitals); profile cold-start/cache later.
- arifos constitutional layer reported "degraded" inside frame_probe layer_health while overall organ healthy — verify this label is intentional (likely the extraction-lock-style conservative labeling).

## Verification protocol for the fix
Re-render → flow_health at a moment with mixed throttle states → assert: attention-required count == count(holds with human_confirmation_required=true). Screenshot before/after for the witness log.
