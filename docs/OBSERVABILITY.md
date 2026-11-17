# Observability & Metabolic Telemetry (A-FORGE detail)
> **Moved verbatim from README.md** during the AGENTIC-README-DOCTRINE v1 restructure
> (2026-10-16). Source archive: `docs/archive/README-2026-10-16-pre-doctrine.md`.

A-FORGE instruments its own execution — every consequential action leaves joinable evidence:

- **Hash-chain shell ledger** — every governed shell decision appended with chain integrity (`forge_shell_ledger`, `forge_shell_status`, `forge_shell_alert_history`)
- **RSI control loop** — state vector `s_t = (identity, plant, memory, controller)`, impulse response `h(t)` of HOLD/scar events, dual-rate FQ (daily observational / 7-day constitutional) (`forge_rsi_state_vector`, `forge_rsi_impulse_response`, `forge_rsi_dual_rate_fq`)
- **World Model quality** — surprise scores, tool grades A–D, high-confidence wrong predictions (`forge_wm_stats`, `forge_wm_quality`, `forge_wm_gaps`)
- **Runtime consistency** — git source vs. installed wheel vs. import path, fail-closed on drift (`forge_runtime_verify`)
- **Journal + system telemetry** — PII-redacted journalctl reads, Netdata charts/alarms
- **Evidence packets and docket handoff** — runtime reality collected typed and handed to the kernel (`forge_collect_evidence`, `forge_docket_prep`)

**Known telemetry defects (measured 2026-10-11):** the invocation-telemetry writer's
interface does not accept a governance outcome — a kernel `HOLD` (`can_claim_success:false`)
was persisted as `ok:true`; the refusal cause (`A_THINK_GUARD`) appears 0× in the ledger.
See the README's Known Defects section and `.well-known/forge-state.json`.
