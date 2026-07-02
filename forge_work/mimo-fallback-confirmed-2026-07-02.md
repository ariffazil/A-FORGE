# MiMo Pro Monthly — Fallback Wiring Confirmed

**Date:** 2026-07-02 13:05 UTC
**Token prefix (validated):** `tp-sleu41...22wfbo` (51 chars) — matches Arif's Pro Monthly plan
**Plan:** Pro Monthly · 38B credits · 24% used · valid 2026-08-02 · auto-renew
**Verdict:** ✅ MiMo wired as fallback across all 3 agents

## Live Test Results

| Call | Model | HTTP | Time |
|------|-------|------|------|
| Basic chat | mimo-v2.5-pro | 200 | 2.95s |
| Tool-call (XML format) | mimo-v2.5-pro | 200 | 4.72s |
| Models list | — | 200 | 0.30s |

Note: MiMo emits `<tool_call>...` XML format, NOT OpenAI JSON tool_calls. OpenCode/openclaw handle this natively.

## Fallback Wiring (all 3 agents)

### OpenCode (`/root/.config/opencode/opencode.json`)
- **Main model:** `tokenplan-mimo/mimo-v2.5-pro` ← MiMo PRIMARY
- **Small model:** `bailian-token-plan/qwen3.6-flash` ← Qwen (exhausted today)
- **Provider URL:** `https://token-plan-sgp.xiaomimimo.com/v1` ✅ matches plan
- **Key env:** `{env:MIMO_API_KEY}` → `/root/.secrets/mimo.env` ✅
- **Subagents:** FORGE→glm-5.2, AUDITOR→deepseek-v4-pro, PLANNER→kimi-k2.7-code (all bailian; no auto-fallback)

### Hermes (`/root/.hermes/config.yaml`)
- **Provider `custom`:** MiMo `https://token-plan-sgp.xiaomimimo.com/v1` ✅
- **Provider key_env:** `MIMO_API_KEY` ✅
- **`fallback_providers`:** `[bailian, custom, minimax]` — MiMo IS in the fallback chain
- **`failover.enabled`:** true, max_retries=5 ✅

### OpenClaw (`/root/.openclaw/openclaw.json`)
- **Primary:** `xiaomi-coding/mimo-v2.5-pro` ✅
- **Fallbacks:** `[bailian-token-plan/deepseek-v4-pro, bailian-token-plan/glm-5.2, minimax/MiniMax-M3]`

## Actions Taken
1. ✅ Updated stale comment in `/root/.secrets/mimo.env` line 3:
   `Lite Monthly 4.1B → Pro Monthly 38B (24% used), valid 2026-08-02`
2. ✅ Verified MiMo live at `https://token-plan-sgp.xiaomimimo.com/v1`
3. ✅ Confirmed token `tp-sleu41...22wfbo` matches `/root/.secrets/mimo.env`

## Gaps / Recommendations (F13 discretion)
- OpenCode subagents (FORGE/AUDITOR/PLANNER) use bailian with NO auto-fallback.
  If Qwen exhausts again, those subagents fail until manually swapped to `tokenplan-mimo/mimo-v2.5-pro`.
- Suggested future: add OpenCode `small_model` switch to MiMo when Qwen quota < 10%.

DITEMPA BUKAN DIBERI
