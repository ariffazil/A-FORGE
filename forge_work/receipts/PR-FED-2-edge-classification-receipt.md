# PR-FED-2 Edge Classification Receipt

**Config SHA256**: `26b84d6b67b3b563e13ae05bcf12933e3943cb312242ff651f5abc2457721d80`
**Generated**: 2026-11-22
**Branch**: `pr-fed-2-deployment-identity`
**Mode**: OBSERVE/RECEIPT ONLY

---

## 1. TRUE Fallback Edge Denominator

| Edge Source | Count | Notes |
|-------------|-------|-------|
| Router-level (`router_settings.fallbacks`) | 89 | 33 primary groups, some with no active entries |
| Order-based (same `model_name`, different `order`) | 28 | Implicit fallback chains within model_list |
| **TOTAL** | **117** | **Plan claimed "86 edges" — UNVERIFIED, ACTUAL = 117** |

### Plan Claim vs Reality
- **Plan claimed**: "86 fallback edges / 19 same-domain"
- **Actual discovered**: 117 total edges (89 router + 28 order-based)
- **Same-domain (SAME_ENDPOINT)**: 12 edges (not 19)
- **SAME_CREDENTIAL**: 6 edges
- **SAME_INTERMEDIARY (OpenRouter↔HF)**: 0 edges (NO HuggingFace entries in config)
- **INDEPENDENT**: 68 edges
- **FALSE_LOOP (primary has no active entries)**: 31 edges

---

## 2. Router-Level Edge Classification (89 edges)

### FALSE_LOOP (31 edges) — Primary has NO active deployments

| Primary | Fallback | Reason |
|---------|----------|--------|
| qwen3.8-max | mimo-v2.6-flash | No active qwen3.8-max entries |
| qwen3.8-max | deepseek-v4-flash | No active qwen3.8-max entries |
| qwen3.8-max | sovereign-west | No active qwen3.8-max entries |
| qwen3.6-plus | mimo-v2.6-flash | No active qwen3.6-plus entries |
| qwen3.6-plus | deepseek-v4-flash | No active qwen3.6-plus entries |
| qwen3.6-plus | sovereign-west | No active qwen3.6-plus entries |
| mimo-v2.5-pro | mimo-v2.6-flash | No active mimo-v2.5-pro entries |
| mimo-v2.5-pro | sovereign-west | No active mimo-v2.5-pro entries |
| mimo-v2.6-pro-ultraspeed | sovereign-west | No active mimo-v2.6-pro-ultraspeed entries |
| mimo-v2.6-pro-payg | sovereign-west | No active mimo-v2.6-pro-payg entries |
| mimo-v2.6-flash-payg | sovereign-west | No active mimo-v2.6-flash-payg entries |
| mimo-v2.5 | glm-5.3 | No active mimo-v2.5 entries |
| mimo-v2.5 | sovereign-west | No active mimo-v2.5 entries |
| kimi-k3 | mimo-v2.6-flash | No active kimi-k3 entries |
| kimi-k3 | glm-5.3 | No active kimi-k3 entries |
| kimi-k3 | sovereign-west | No active kimi-k3 entries |
| kimi-k3.1-pro | mimo-v2.6-flash | No active kimi-k3.1-pro entries |
| kimi-k3.1-pro | glm-5.3 | No active kimi-k3.1-pro entries |
| kimi-k3.1-pro | sovereign-west | No active kimi-k3.1-pro entries |
| kimi-k3.1-pro-highspeed | mimo-v2.6-flash | No active kimi-k3.1-pro-highspeed entries |
| kimi-k3.1-pro-highspeed | glm-5.3 | No active kimi-k3.1-pro-highspeed entries |
| MiniMax-M3 | mimo-v2.6-flash | No active MiniMax-M3 entries |
| MiniMax-M3 | deepseek-v4-flash | No active MiniMax-M3 entries |
| MiniMax-M3 | sovereign-west | No active MiniMax-M3 entries |
| MiniMax-M3.1-Flash-Preview | mimo-v2.6-flash | No active MiniMax-M3.1-Flash-Preview entries |
| MiniMax-M3.1-Flash-Preview | deepseek-v4-flash | No active MiniMax-M3.1-Flash-Preview entries |
| MiniMax-M3.1-Flash-Preview | sovereign-west | No active MiniMax-M3.1-Flash-Preview entries |
| fed/vision | deepseek-v4-flash-vision | **HAS active entries** but SAME_ENDPOINT (see below) |
| qwen-auto | deepseek-flash | No active qwen-auto entries |
| qwen-auto | glm-5.3-flash | No active qwen-auto entries |
| qwen-auto | fed/sealion | No active qwen-auto entries |
| qwen-auto | sovereign-west | No active qwen-auto entries |

### SAME_ENDPOINT (8 edges) — Same API base + same credentials = NO resilience

| Primary | Fallback | Shared Endpoint | Evidence |
|---------|----------|-----------------|----------|
| forge-scout | mimo-v2.6-pro | `os.environ/MIMO_BASE_URL` + `MIMO_INDIVIDUAL_PLAN_API_KEY` | Both resolve to same MiMo token-plan endpoint |
| forge-scout-pro | mimo-v2.6-flash | `os.environ/MIMO_BASE_URL` + `MIMO_INDIVIDUAL_PLAN_API_KEY` | Same MiMo token-plan endpoint |
| forge-builder | emergency-deepseek-v4-pro | `https://api.deepseek.com/v1` + `DEEPSEEK_API_KEY` | Same DeepSeek direct endpoint |
| forge-economy | emergency-deepseek-v4-pro | `https://api.deepseek.com/v1` + `DEEPSEEK_API_KEY` | Same DeepSeek direct endpoint |
| opencode | deepseek-v4-flash | `https://api.deepseek.com/v1` + `DEEPSEEK_API_KEY` | Same DeepSeek direct endpoint |
| hermes-asi | deepseek-v4-flash | `https://api.deepseek.com/v1` + `DEEPSEEK_API_KEY` | Same DeepSeek direct endpoint |
| glm-5.2 | glm-5.3 | `os.environ/ZAI_API_BASE` + `ZAI_API_KEY` | Same ZAI endpoint |
| fed/vision | deepseek-v4-flash-vision | `https://api.deepseek.com/v1` + `DEEPSEEK_API_KEY` | Same DeepSeek direct endpoint |

### SAME_CREDENTIAL (6 edges) — Different endpoints, SAME API key = shared billing/auth failure domain

| Primary | Fallback | Primary Endpoint | Fallback Endpoint | Shared Key |
|---------|----------|------------------|-------------------|------------|
| i-arif | glm-5.3-flash | `https://api.z.ai/api/coding/paas/v4` | `os.environ/ZAI_API_BASE` | `ZAI_API_KEY` |
| asi-555 | glm-5.3 | `https://api.z.ai/api/coding/paas/v4` | `os.environ/ZAI_API_BASE` | `ZAI_API_KEY` |
| forge-777 | glm-5.3 | `https://api.z.ai/api/coding/paas/v4` | `os.environ/ZAI_API_BASE` | `ZAI_API_KEY` |
| forge-planner | glm-5.3-flash | `https://api.z.ai/api/coding/paas/v4` | `os.environ/ZAI_API_BASE` | `ZAI_API_KEY` |
| openclaw | glm-5.3-flash | `https://api.z.ai/api/coding/paas/v4` | `os.environ/ZAI_API_BASE` | `ZAI_API_KEY` |
| hermes-asi-vision | deepseek-v4-flash | (empty, defaults to DeepSeek) | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` |

### SAME_INTERMEDIARY (0 edges) — OpenRouter↔HuggingFace loops

**NONE FOUND** — No HuggingFace (`huggingface.co`, `hf-inference`, `hf/` model prefixes) entries exist in the config. The plan's concern about OpenRouter↔HF loops is not applicable to this config.

### INDEPENDENT (44 router-level edges) — Distinct endpoints, distinct credentials

Verified: No shared host, credential, or intermediary. Examples:
- `i-arif` (ZAI) → `mimo-v2.6-pro` (MiMo token-plan)
- `apex-888` (OpenRouter) → `glm-5.3` (ZAI)
- `forge-777` (ZAI) → `mimo-v2.6-flash` (MiMo)
- `forge-planner` (ZAI) → `sovereign-west` (Groq)
- `openclaw` (ZAI) → `deepseek-v4-flash` (DeepSeek direct)

---

## 3. Order-Based Edge Classification (28 edges)

### SAME_ENDPOINT (4 edges)

| Model Name | Primary Order → Fallback Order | Shared Endpoint |
|------------|-------------------------------|-----------------|
| fed/sealion | 1 → 2 | `https://api.sea-lion.ai/v1` + `SEA_LION_API_KEY` |
| i-arif | 3 → 4 | `https://api.deepseek.com/v1` + `DEEPSEEK_API_KEY` |
| sovereign-west | 0 → 1 | `https://api.groq.com/openai/v1` + `GROQ_API_KEY` |
| fed/verifier-independent | 1 → 2 | `http://127.0.0.1:11434/v1` + `OLLAMA_API_KEY` |

### INDEPENDENT (24 edges)

All other order-based chains connect distinct endpoints/credentials:
- `apex-888`: OpenRouter → ZAI → DeepSeek (3 hops, all INDEPENDENT)
- `asi-555`: ZAI → MiMo (INDEPENDENT)
- `forge-builder`: DeepSeek → OpenRouter → ZAI (INDEPENDENT)
- `forge-economy`: DeepSeek → OpenRouter (INDEPENDENT)
- `forge-777`: ZAI → MiMo → DeepSeek → ZAI → OpenRouter (5 hops, all INDEPENDENT)
- `hermes-asi`: DeepSeek → OpenRouter (INDEPENDENT)
- `deepseek-v4-flash`: DeepSeek direct → OpenRouter (INDEPENDENT)
- `deepseek-v4-flash-vision`: DeepSeek direct → OpenRouter (INDEPENDENT)
- `fed/vision`: DeepSeek → ZAI (INDEPENDENT)
- `deepseek-flash`: DeepSeek direct → OpenRouter (INDEPENDENT)
- `hermes-asi-vision`: DeepSeek → ZAI (INDEPENDENT)
- `i-arif`: ZAI → MiMo token-plan → DeepSeek → DeepSeek (SAME_ENDPOINT) → OpenRouter
- `emergency-deepseek-v4-pro`: DeepSeek direct → OpenRouter (INDEPENDENT)
- `fed/free`: Groq → Cloudflare → OpenRouter → Pollinations → Ollama (INDEPENDENT)

---

## 4. False Resilience Loops Identified

### Category A: FALSE_LOOP — Primary has zero active deployments (31 edges)
These fallback groups will NEVER be reached because the primary model_name has no active entries. They are dead configuration.

**Action**: Remove these 13 primary groups entirely from `router_settings.fallbacks`:
- `qwen3.8-max`, `qwen3.6-plus`, `mimo-v2.5-pro`, `mimo-v2.6-pro-ultraspeed`
- `mimo-v2.6-pro-payg`, `mimo-v2.6-flash-payg`, `mimo-v2.5`
- `kimi-k3`, `kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed`
- `MiniMax-M3`, `MiniMax-M3.1-Flash-Preview`, `qwen-auto`

### Category B: SAME_ENDPOINT — Zero resilience (12 edges)
Fallback points to the exact same API endpoint + credentials. If primary fails, fallback fails identically.

**Action**: Prune these 12 edges from fallback chains.

### Category C: SAME_CREDENTIAL — Shared billing/auth failure domain (6 edges)
Different endpoints but same API key. A 401/402 on the key kills BOTH primary and fallback.

**Action**: FLAG these 6 edges — keep but annotate as `same_credential: true` for monitoring. Consider splitting credentials.

---

## 5. OpenRouter↔HuggingFace Loop Check

**Result**: NO SUCH LOOPS EXIST in this config.

- OpenRouter entries: 11 (all using `os.environ/OPENROUTER_API_KEY`)
- HuggingFace entries: 0
- No model uses `hf/`, `huggingface/`, or `hf-inference` prefixes
- No API base points to `huggingface.co` or `api-inference.huggingface.co`

The plan's "86 edges / 19 same-domain" figure included a hypothetical OpenRouter↔HF concern that does not manifest in the actual deployed config.