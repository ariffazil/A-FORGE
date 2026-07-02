# Trinity Fallback Swap — Subagents → MiMo/MiniMax

**Date:** 2026-07-02 13:08 UTC
**Trigger:** Qwen Token Plan quota exhausted; MiMo Pro Monthly upgraded (38B credits)
**Verdict:** ✅ Trinity fallback live across federation

## Token Plan Trinity

| Layer | Provider | Plan | Status |
|-------|----------|------|--------|
| L1 Primary | Xiaomi MiMo (token-plan-sgp) | Pro Monthly, 38B credits, valid 2026-08-02 | ✅ 24% used |
| L2 Fallback | MiniMax (api.minimax.io) | Max tier, 5.1B tokens/mo, expires 2026-07-05 (auto-renew OFF) | ✅ live |
| L3 Cold | Bailian/Qwen (dashscope-intl) | Token Plan, exhausted | ⏸️ top-up needed |

## OpenCode Subagent Swap

| Agent | Before | After | Rationale |
|-------|--------|-------|-----------|
| **forge** | bailian-token-plan/glm-5.2 | **tokenplan-mimo/mimo-v2.5-pro** | matches main, Zen |
| **auditor** | bailian-token-plan/deepseek-v4-pro | **minimax/MiniMax-M3** | 1M ctx, deep reasoning, fits audit |
| **ops** | minimax/MiniMax-M2.7-highspeed | *(unchanged)* | already MiniMax, fast monitoring |
| **planner** | bailian-token-plan/kimi-k2.7-code | **tokenplan-mimo/mimo-v2.5-pro** | matches main, Zen |
| **small_model** | bailian-token-plan/qwen3.6-flash | **tokenplan-mimo/mimo-v2.5** | was dead-on-arrival (Qwen exhausted) |

## Live Tests (2026-07-02 13:01-13:08 UTC)

| Endpoint | HTTP | Time | Note |
|----------|------|------|------|
| MiMo mimo-v2.5-pro chat | 200 | 2.95s | primary L1 ✅ |
| MiMo tool_call (XML format) | 200 | 4.72s | works, custom format |
| MiniMax M3 chat | 200 | 1.87s | L2 ✅ |
| Qwen chat | 429 | — | insufficient_quota (expected) |
| MiMo /models | 200 | 0.30s | catalog live |

## Cross-Agent Trinity Verification

### OpenCode (`/root/.config/opencode/opencode.json`)
- Main + small: MiMo ✅
- Subagents: 2× MiMo + 2× MiniMax (M3 + M2.7-highspeed) ✅
- All bailian references for subagents → ELIMINATED

### Hermes (`/root/.hermes/config.yaml`)
- `fallback_providers: [bailian, custom/MiMo, minimax]` — 3-tier chain ✅
- `failover.enabled: true, max_retries: 5` ✅

### OpenClaw (`/root/.openclaw/openclaw.json`)
- Primary: `xiaomi-coding/mimo-v2.5-pro` ✅
- Fallbacks: `[bailian-deepseek-v4-pro, bailian-glm-5.2, minimax-M3]` ✅

## Notes

- MiMo emits `<tool_call>...</tool_call>` XML format, NOT OpenAI JSON tool_calls.
  OpenCode/openclaw handle this natively via provider adapter.
- MiniMax M3 has 1M context window — ideal for AUDITOR large-context audits.
- Auto-renewal on MiMo Pro is ON (next charge 2026-08-02).
- Auto-renewal on MiniMax Max is OFF (expires 2026-07-05 — F13 reminder).

DITEMPA BUKAN DIBERI
