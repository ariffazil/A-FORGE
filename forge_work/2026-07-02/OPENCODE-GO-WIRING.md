# OpenCode Go Provider Wiring — 2026-07-02

## Summary
Wired OpenCode Go subscription for Arif. Low cost coding models ($5 first month, $10/mo after).

## Changes
1. **auth.json** — Added `opencode-go` API key to `~/.local/share/opencode/auth.json`
2. **opencode.json** — Added `opencode-go` to `enabled_providers` array

## Verification
- Endpoint: `https://opencode.ai/zen/go/v1/chat/completions`
- Test model: `deepseek-v4-flash`
- Result: HTTP 200, `cost: "0"` (subscription plan)

## Available Models (14)
| Model | ID | Endpoint Type |
|-------|-----|--------------|
| DeepSeek V4 Flash | deepseek-v4-flash | chat/completions |
| DeepSeek V4 Pro | deepseek-v4-pro | chat/completions |
| GLM-5.2 | glm-5.2 | chat/completions |
| GLM-5.1 | glm-5.1 | chat/completions |
| Kimi K2.7 Code | kimi-k2.7-code | chat/completions |
| Kimi K2.6 | kimi-k2.6 | chat/completions |
| MiMo V2.5 | mimo-v2.5 | chat/completions |
| MiMo V2.5 Pro | mimo-v2.5-pro | chat/completions |
| MiniMax M3 | minimax-m3 | messages |
| MiniMax M2.7 | minimax-m2.7 | messages |
| MiniMax M2.5 | minimax-m2.5 | messages |
| Qwen3.7 Max | qwen3.7-max | messages |
| Qwen3.7 Plus | qwen3.7-plus | messages |
| Qwen3.6 Plus | qwen3.6-plus | messages |

## Federation Impact
- AUDITOR/OPS/PLAN subagents can use Go models at $0 marginal cost
- Reduces overall federation compute spend
- Models hosted in US/EU/Singapore — zero-retention policy

## VAULT999
Sealed: `seal-20260702-133444-opencode-go`
