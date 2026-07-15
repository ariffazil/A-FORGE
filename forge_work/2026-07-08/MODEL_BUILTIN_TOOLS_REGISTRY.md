# MODEL BUILTIN TOOLS REGISTRY — arifOS Federation

> **Forged:** 2026-07-08 by FORGE (000Ω)
> **Purpose:** Track which models have native platform tools vs relying on OpenCode's 323-function tool surface.
> **Why it matters:** Routing a web-search task to a model without web_search = wasted tokens. Routing a code task to a model without code_interpreter = hallucinated code.

---

## The Two Tool Layers

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Provider Built-in Tools               │
│  Native to the API. Zero function-call overhead.│
│  web_search, code_interpreter, file_search...   │
│  Provider runs them server-side.                │
├─────────────────────────────────────────────────┤
│  Layer 2: OpenCode Federation Tools             │
│  Sent as JSON function definitions (323 total). │
│  forge_*, arif_*, wealth_*, well_*, geox_*...   │
│  Model decides when to call. 128 max per call.  │
└─────────────────────────────────────────────────┘
```

**Key insight:** Models with `endpoint: "responses"` use Layer 1 natively. Models with `endpoint: "chat_completions"` rely entirely on Layer 2.

---

## Registry — Provider Built-in Tools

### Responses API Models (Layer 1 active)

| Provider | Model | web_search | code_interpreter | file_search | web_extractor | image_search | Notes |
|----------|-------|:----------:|:----------------:|:-----------:|:-------------:|:------------:|-------|
| **azure-foundry** | gpt-4.1-mini | ✅ | ✅ | ⚠️ needs vs_* | ❌ | ❌ | tool_call: false (128 limit workaround) |
| **qwen-token** | qwen3.7-max | ✅ | ✅ | ❌ | ✅ | ✅ | tool_call: true (Qwen has no 128 limit) |
| **qwen-token** | qwen3.6-flash | ✅ | ✅ | ❌ | ✅ | ✅ | Fastest Responses model |
| **qwen-token** | qwen3.7-plus | ✅ | ✅ | ❌ | ✅ | ✅ | Mid-tier |
| **qwen-token** | qwen3.6-plus | ✅ | ✅ | ❌ | ✅ | ✅ | Mid-tier |
| **qwen-payg** | qwen3.7-max | ✅ | ✅ | ❌ | ✅ | ✅ | Pay-as-you-go variant |

### Chat Completions Models (Layer 2 only — no built-in tools)

| Provider | Model | tool_call | Reasoning | Context | Best for |
|----------|-------|:---------:|:---------:|---------|----------|
| **tokenplan-mimo** | mimo-v2.5-pro | ✅ | ✅ | 1M | Primary — code, reasoning, federation ops |
| **tokenplan-mimo** | mimo-v2.5 | ✅ | ✅ | 1M | Vision + reasoning |
| **qwen-token** | deepseek-v4-pro | ✅ | ✅ | 1M | Deep reasoning |
| **qwen-token** | kimi-k2.7-code | ✅ | ✅ | 256K | Code generation |
| **qwen-token** | glm-5.2 | ✅ | ✅ | 200K | FORGE agent model |
| **minimax** | MiniMax-M3 | ✅ | ✅ | 1M | Flagship workhorse |
| **minimax** | MiniMax-M2.7 | ✅ | ✅ | 200K | Fast + tool_call |
| **deepseek** | deepseek-v4-pro | ✅ | ✅ | 1M | Direct API (no proxy) |
| **opencode-go** | claude-sonnet-5 | ✅ | ✅ | 200K | Claude via OpenCode |
| **opencode-go** | gpt-5.5 | ✅ | ✅ | 128K | GPT via OpenCode |
| **opencode-go** | gemini-3.1-pro | ✅ | ✅ | 1M | Gemini via OpenCode |

---

## Routing Decision Matrix

```
Task: "Search the web and compute X"
  → azure-foundry/gpt-4.1-mini  (web_search + code_interpreter built-in)
  → qwen-token/qwen3.7-max      (web_search + code_interpreter + web_extractor)

Task: "Edit this code file"
  → tokenplan-mimo/mimo-v2.5-pro (forge_filesystem via Layer 2)

Task: "Analyze this seismic data"
  → tokenplan-mimo/mimo-v2.5-pro (geox_* tools via Layer 2)

Task: "Quick financial calculation"
  → azure-foundry/gpt-4.1-mini  (code_interpreter built-in, 200ms latency)

Task: "Deep reasoning with 1M context"
  → qwen-token/deepseek-v4-pro  (no built-in tools, but 1M ctx + reasoning)

Task: "Generate image"
  → qwen-image/qwen-image-2.0   (image output modality)
```

---

## The 128-Tool Limit Problem

Azure OpenAI enforces a **128-tool maximum** per request. OpenCode has **323 federation tools**. Sending all 323 to Azure = instant error.

**Current workaround:** `tool_call: false` on azure-foundry models. This means:
- ✅ Responses API built-in tools work (web_search, code_interpreter)
- ❌ OpenCode federation tools NOT available (can't call forge_*, arif_*, etc.)

**Future fix options:**
1. OpenCode tool filtering — only send relevant tools per request
2. Tool groups — declare tool sets (e.g., "research" = web_search only)
3. Provider-aware tool pruning — auto-detect provider limits

---

## Tool Capability Summary

| Capability | azure-foundry | qwen-token (Responses) | All others (Chat) |
|-----------|:---:|:---:|:---:|
| **Web search** | ✅ built-in | ✅ built-in | ❌ needs Layer 2 |
| **Code execution** | ✅ built-in | ✅ built-in | ❌ needs Layer 2 |
| **Web extraction** | ❌ | ✅ built-in | ❌ needs Layer 2 |
| **Image search** | ❌ | ✅ built-in | ❌ needs Layer 2 |
| **Federation tools** | ❌ blocked | ✅ Layer 2 | ✅ Layer 2 |
| **File operations** | ❌ | ❌ | ✅ forge_filesystem |
| **Git/Docker** | ❌ | ❌ | ✅ forge_git/docker |

---

*Registry updated: 2026-07-08. Review when new providers added.*
*DITEMPA BUKAN DIBERI*
