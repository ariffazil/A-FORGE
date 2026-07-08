# 📊 Web Exploration Tooling Contrast Matrix & Organ Census

*Generated at: 2026-07-08T03:11:28.281Z*

## 1. 7 Organs Health Census

| Organ | Port/Endpoint | Status | Connection | Health Summary |
|---|---|---|---|---|
| **arifOS (Ω)** | `http://localhost:8088/health` | ✅ 200 | Online | arifOS-mcp |
| **GEOX 🌍** | `http://localhost:8081/health` | ✅ 200 | Online | geox-unified |
| **WEALTH 💰** | `http://localhost:18082/health` | ✅ 200 | Online | ALIVE |
| **WELL 🫀** | `http://localhost:18083/health` | ✅ 200 | Online | well-mcp |
| **A-FORGE ⚒️** | `http://localhost:7071/health` | ✅ 200 | Online | A-FORGE-sense |
| **A-FORGE MCP** | `http://localhost:7072/health` | ✅ 200 | Online | A-FORGE-MCP |
| **AAA 🖥️** | `http://localhost:3001/health` | ✅ 200 | Online | healthy |

## 2. Quantitative Performance & Error Logging

| Tool Name | Latency (ms) | Output Size (chars) | Independent Sources | Status / Errors |
|---|---|---|---|---|
| `default_api:search_web` | 6000 ms | 5000 | 21 | None |
| `default_api:read_url_content` | 2000 ms | 38912 | 1 | None |
| `forge_search` | 685 ms | 6242 | 10 | None |
| `forge_research` | 252 ms | 7012 | 10 | None |
| `forge_minimax_search` | 9 ms | 1116 | 0 | None |
| `forge_fetch_url` | 635 ms | 51063 | 1 | None |
| `arif_observe (search)` | 1000 ms | 6248 | 0 | Constitutional HOLD: L13 (actor unverified) |

## 3. APEX Thermodynamic & Quantum Metrics

Enforced by the arifOS Federation doctrine under the Negentropy Principle ($G = A \cdot P \cdot E \cdot X \cdot \Phi$):

| Tool Name | Alignment (A) | Precision (P) | Evidence (E) | Execution (X) | Grounding ($\Phi$) | **APEX G** | **$C_{dark}$** | **$W^3$** |
|---|---|---|---|---|---|---|---|---|
| `default_api:search_web` | 0.30 | 0.90 | 0.50 | 0.40 | 0.70 | **0.038** | **0.018** | **0.00** |
| `default_api:read_url_content` | 0.30 | 0.90 | 0.90 | 0.60 | 0.95 | **0.139** | **0.012** | **0.00** |
| `forge_search` | 0.70 | 0.95 | 0.50 | 0.85 | 0.90 | **0.255** | **0.005** | **0.00** |
| `forge_research` | 0.70 | 0.90 | 0.60 | 0.90 | 0.80 | **0.272** | **0.007** | **0.00** |
| `forge_minimax_search` | 0.70 | 0.50 | 0.00 | 0.10 | 0.00 | **0.000** | **0.315** | **0.00** |
| `forge_fetch_url` | 0.80 | 0.90 | 0.95 | 0.60 | 0.95 | **0.390** | **0.032** | **0.00** |
| `arif_observe (search)` | 0.95 | 0.50 | 0.00 | 0.30 | 0.00 | **0.000** | **0.333** | **0.00** |

## 4. Contrast Analysis & Routing Recommendation

### Tool Types & Surface Analysis
- **Native Workspace Tools** (`default_api`): Highly optimized for direct synthesis to user, but bypass arifOS governance entirely ($A=0.30$).
- **Governed MCP Tools** (`forge_research`, `forge_search`): Extremely fast JSON interface, wraps replies in signed cryptographic envelopes. Recommended for high-speed agent pipelines.
- **Deep Scrapers** (`forge_fetch_url`): High APEX score ($G=0.390$) because it captures raw source documents directly ($L_2$ evidence), providing the best data for verification.
- **Sovereign Kernel** (`arif_observe`): Maximum alignment ($A=0.95$) but strictly blocks network execution if identity is unverified ($actor\_verified = false$).

### Routing Recommendations
1. **Raw Web Queries**: Route to `forge_search` (Brave Search API) for structural result arrays or `default_api:search_web` for interactive UI synthesis.
2. **Cognitive Synthesis / Quick Pointers**: Route to `forge_research` (Perplexity) to query multiple domains and receive an AI-curated summary in <300ms.
3. **Evidence Extraction**: Route to `forge_fetch_url` or `default_api:read_url_content` for full-text markdown extraction.
