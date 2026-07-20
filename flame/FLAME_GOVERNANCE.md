# 🔥 FLAME — Governance & Control
> **Forged:** 2026-07-20 · **Version:** 1.0.0 · **Cost:** RM0
> **Single source of truth:** `/root/A-FORGE/flame/flame_config.json`

## Two Lanes. Zero Confusion.

```
AGENT LANE (governed, constitutional)
  TokenRouter → MiniMax → MiMo → Groq → Gemini → Cerebras → SEA-LION → Ollama → HOLD
  F1-F13 gated. arifOS kernel. Never self-authorizes.

TOOL LANE (FLAME, free-loop, RM0)
  Groq(2) → SEA-LION(3) → Gemini(1) → Cerebras(1) → Ollama(1)
  Hit-rate adaptive. Zero governance authority. Workers only.
```

## Control Rules

| Rule | Enforcement |
|------|------------|
| FLAME NEVER touches paid models | Hard gate in `flame_router.py` — only `cost_band: free` |
| FLAME NEVER serves agents | `call_llm()` in arifOS kernel uses separate cascade |
| Model IDs synced from FLAME | `flame_config.json` is authoritative — all configs derive from it |
| Dead models auto-removed | Health probe demotes non-responding tiers |
| Hit-rate tracked per model | `flame_hitrate.jsonl` — 50-call rolling window |
| Dynamic reordering | Every 5 min: promote fastest, demote slowest |

## Unified Model Registry (8 verified)

| # | Provider | Model | Speed | Tags |
|---|----------|-------|-------|------|
| 1 | Groq | llama-3.1-8b-instant | 560 t/s | fastest, high-volume |
| 2 | Groq | llama-3.3-70b-versatile | 280 t/s | deep-reasoning |
| 3 | SEA-LION | aisingapore/Qwen-SEA-LION-v4-32B-IT | — | bm-native, malay |
| 4 | SEA-LION | aisingapore/Llama-SEA-LION-v3-70B-IT | — | bm-native, deep |
| 5 | SEA-LION | aisingapore/Gemma-SEA-LION-v4-27B-IT | — | bm-native, fast |
| 6 | Gemini | gemini-2.5-flash | — | general, 1M ctx |
| 7 | Cerebras | gemma-4-31b | wafer | multimodal, vision |
| 8 | Ollama | qwen2.5-coder:3b | CPU | local, survival |

## Propagation Map

```
flame_config.json  (SOURCE OF TRUTH)
  ├── OpenCode opencode.json          (provider models synced)
  ├── OpenClaw openclaw.json          (provider + fallback synced)
  ├── Hermes config.yaml              (provider + fallback synced)
  ├── arifOS llm_client.py            (agent cascade — SEPARATE)
  └── AGENT_MODEL_MAP.json            (registry entry)
```

## Commands

```bash
flame "prompt"              # Single inference
flame --mode probe          # Health check all 8 models
flame --mode stats          # Hit-rate dashboard
flame --mode seal           # Integrity seal
flame --batch file.txt      # Batch processing
free-llm "prompt"           # Alias
```

## Constitutional Boundary

FLAME is for WORKERS only: summarizers, classifiers, embedders, batch processors, ETL pipelines, scrapers, transformers. FLAME does not judge. FLAME does not seal. FLAME does not hold constitutional authority. FLAME does not touch paid models.

Agents use the governed cascade. Workers use FLAME. Never the reverse.
