# Qwen Token Plan — Three-Agent Test Receipt

**Date:** 2026-07-02 13:01 UTC
**Token prefix (validated):** `sk-sp-D.IEYP.zv...` (114 chars)
**Verdict:** ❌ QUOTA EXHAUSTED — token valid, plan empty

## Test Results

| Agent | Endpoint | Model | HTTP | Error |
|-------|----------|-------|------|-------|
| OpenCode | /v1/chat/completions | qwen3.6-flash | 429 | insufficient_quota |
| Hermes | /v1/chat/completions | qwen3.7-max | 429 | insufficient_quota |
| OpenClaw | /v1/chat/completions | qwen3.6-plus | 429 | insufficient_quota |

## Token Locations (all same key)
- `/root/.secrets/qwen.env` → `QWEN_API_KEY`
- `/root/.openclaw/env.local` → `QWEN_API_KEY`
- `/root/.config/opencode/opencode.json` → `{env:QWEN_API_KEY}` (7 references)
- `/root/.openclaw/openclaw.json` → `${QWEN_API_KEY}` + bailian-token-plan/qwen3.7-max registered
- `/root/.hermes/config.yaml` → `key_env: QWEN_API_KEY`

## /models probe (HTTP 200) — token IS valid:
```
{"first_id":"model-id-0","data":[
  {"id":"qwen3.6-plus","object":"model"},
  {"id":"qwen-image-2.0","object":"model"},
  {"id":"qwen-image-2.0-pro","object":"model"},
  {"id":"wan2.7-image","object":"model"},
  ...
]}
```

## /chat/completions error:
```json
{"error":{"message":"Your token-plan quota has been exhausted.",
  "id":"07197bf5-5d11-4160-a16d-da58e8c444fe",
  "type":"insufficient_quota","code":"insufficient_quota"}}
```

## Action Required (F13)
- Top up Qwen Token Plan balance at https://home.qwencloud.com/
- OR swap in fresh `sk-sp-...` token

## Config State
- ✅ No drift — all three agents point to same envvar
- ✅ No rotation needed — token is valid, just out of credit
- ⏸️  Federation falls back to MiMo/MiniMax/DeepSeek/Kimi per model_rotation.md

DITEMPA BUKAN DIBERI
