# ADR-0001: Embedding Model Selection for OpenClaw Memory

## Status
Accepted

## Context
OpenClaw requires an embedding provider for memory search functionality. The system needs:
- Dimension: 1024 (for compatibility with sqlite-vec)
- Provider: Ollama (local-first, no external API dependency)
- Model: Must support multilingual text encoding

## Decision
Selected **bge-m3** (BAAI General Embedding Multilingual) as the embedding model.

### Rationale
1. **Dimension Match**: bge-m3 outputs 1024-dimensional vectors, matching OpenClaw's sqlite-vec requirements
2. **Multilingual**: Supports 100+ languages for diverse content
3. **Performance**: 566M parameters, F16 quantization, ~1.2GB size
4. **License**: Open source (MIT), suitable for personal use
5. **Local-First**: Runs entirely on-premises via Ollama

## Consequences
- Memory usage: ~1.2GB for model weights
- Inference: CPU/GPU accelerated via Ollama
- Storage: Embeddings stored in `~/.openclaw/memory/main.sqlite`
- Fallback: None (strictly local)

## Configuration
```json
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "enabled": true,
        "provider": "ollama",
        "model": "bge-m3"
      }
    }
  }
}
```

## Date
2026-04-08

## Author
OpenClaw Infra Agent (arifOS constitutional kernel)
