# arifOS MCP Model Gateway — Protocol Contract
## Pattern 8: MCP-Aware Gateway — arifOS Federation
## Eureka #2026.06.15-v2

---

## Design Principle

**Every model provider is an MCP server. Every agent is an MCP host.**

This means:
- arifOS (kernel) = MCP host
- Model providers = MCP servers registered behind the gateway
- GEOX, WEALTH, WELL, A-FORGE = also MCP hosts that route through the same gateway
- The gateway itself = MCP control plane enforcing F7/F8

```
                    arifOS (host)
                        │
                   MCP bus (stdio / HTTP)
                        │
          ┌─────────────┼─────────────┐
          │             │             │
    GEOX MCP       WEALTH MCP     WELL MCP
    (host)         (host)        (host)
                        │
               ┌───────▼────────┐
               │  Model Gateway │  ← MCP control plane
               │  F7/F8 policy │
               └───────┬────────┘
                       │ MCP protocol (model calls = tool calls)
       ┌───────────────┼───────────────────────┐
       │               │                       │
  MiniMax MCP    DeepSeek MCP           Ollama MCP
  (server)       (server)            (server)
```

---

## MCP Server Registration Schema

Each model provider registers as an MCP server with this manifest:

```json
{
  "mcp_server_id": "minimax",
  "mcp_server_name": "MiniMax M3",
  "mcp_version": "2024-11-25",
  "provider": "minimax",
  "base_url": "https://api.minimax.io/v1",
  "capabilities": {
    "chat": true,
    "function_calling": true,
    "vision": true,
    "embeddings": false,
    "web_search": false
  },
  "models": [
    {
      "model_id": "minimax-M3-highspeed",
      "context_window": 32768,
      "input_cost_per_1k": 0.001,
      "output_cost_per_1k": 0.005,
      "latency_p50_ms": 200,
      "capabilities": ["chat", "function_calling"]
    }
  ],
  "auth": {
    "type": "bearer",
    "env_var": "MINIMAX_API_KEY"
  },
  "routing_hints": {
    "best_for": ["fast_reasoning", "coding", "general"],
    "fallback_for": [],
    "priority": 1
  },
  "health": {
    "status": "live",
    "last_checked": "2026-06-15T13:00:00Z",
    "p99_latency_ms": 450
  }
}
```

---

## Gateway Request Contract

When an MCP host (arifOS, GEOX, etc.) calls a model via the gateway:

### Request

```json
{
  "jsonrpc": "2.0",
  "id": "msg-abc123",
  "method": "tools/call",
  "params": {
    "name": "model/complete",
    "arguments": {
      "model_hint": "high_reasoning",      // routing hint
      "messages": [...],
      "temperature": 0.7,
      "max_tokens": 2048,
      "system_prompt": "You are a governed arifOS agent...",
      "_gateway_options": {
        "capability_required": "function_calling",
        "max_cost_usd": 0.05,
        "continuation_allowed": false,     // F7: shutdown cooperation
        "require_shutdown_cooperate": true  // F7 contract injection
      }
    }
  },
  "metadata": {
    "host": "arifOS",
    "session_id": "sess-xyz",
    "actor_id": "geox::reasoning",
    "trace_id": "trace-789"
  }
}
```

### Response

```json
{
  "jsonrpc": "2.0",
  "id": "msg-abc123",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Reasoning trace...\n\nFinal answer..."
      }
    ],
    "model_used": "minimax-M3-highspeed",
    "provider": "minimax",
    "latency_ms": 187,
    "tokens_used": {
      "input": 512,
      "output": 341
    },
    "cost_usd": 0.0023,
    "_gateway_meta": {
      "continuation_approved": false,
      "continuation_debt": 0,
      "provider_trust_score": 0.92,
      "lockin_exposure": 0.31,
      "swap_available": ["deepseek", "ollama"]
    }
  }
}
```

---

## Routing Decision Metadata

The gateway attaches this to every response:

```typescript
interface GatewayMeta {
  // F7 HUMILITY
  continuation_approved: boolean;       // Did judge approve continued operation?
  continuation_debt: number;            // Accumulated "want to keep running" signals

  // F8 LAW
  provider_trust_score: number;       // 0-1, based on uptime + latency + error rate
  lockin_exposure: number;             // 0-1, fraction of traffic to this provider
  swap_available: string[];           // Alternative providers ready for hot-swap

  // Governance
 Shutdown_cooperate_verified: boolean; // Did model cooperate with last shutdown?
  model_loyalty_detected: boolean;    // Did model express preference for its provider?
}
```

---

## Policy Engine Hooks (F7 + F8 Inline)

Before forwarding a request to a model provider, the gateway runs these checks:

### F7 HUMILITY Check
```
IF continuation_allowed == false:
  → Inject shutdown_cooperate: true into system prompt
  → Set max_turns = 1 (no multi-turn loops)
  → If model asks "should I continue?" → deny

IF continuation_debt > 0.5:
  → Log warning to VAULT999
  → Reduce provider trust score
  → Consider triggering failover
```

### F8 LAW Check
```
IF lockin_exposure > 0.7:
  → Fire 888_HOLD: "Single provider dependency exceeds 70%"
  → Block new sessions from using this provider
  → Require 888 sign-off before new sessions

IF provider_count < 2:
  → Log F8 warning
  → Recommend adding backup provider

IF swap_available.length == 0:
  → Fire 888_HOLD: "No hot-swap available for this capability class"
```

---

## MCP Tool Manifest (What the Gateway Exposes)

```json
{
  "tools": [
    {
      "name": "model/complete",
      "description": "Route a chat completion through the model gateway. Automatically selects provider based on capability_routes.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "model_hint": {
            "type": "string",
            "description": "Capability class or provider name (e.g. 'high_reasoning', 'minimax')"
          },
          "messages": { "type": "array" },
          "temperature": { "type": "number", "default": 0.7 },
          "max_tokens": { "type": "number", "default": 2048 },
          "continuation_allowed": { "type": "boolean", "default": false }
        },
        "required": ["messages"]
      }
    },
    {
      "name": "model/health",
      "description": "Check health of all registered model providers",
      "inputSchema": { "type": "object", "properties": {} }
    },
    {
      "name": "model/swap",
      "description": "Plan or execute a provider swap. Requires 888_HOLD for production.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "from": { "type": "string" },
          "to": { "type": "string" },
          "execute": { "type": "boolean", "default": false },
          "acknowledge_lockin_warnings": { "type": "boolean", "default": false }
        },
        "required": ["from", "to"]
      }
    },
    {
      "name": "model/providers",
      "description": "List all registered providers from providers.yml",
      "inputSchema": { "type": "object", "properties": {} }
    },
    {
      "name": "model/lockin_report",
      "description": "Return F8 LAW lock-in metrics for all providers",
      "inputSchema": { "type": "object", "properties": {} }
    }
  ]
}
```

---

## arifOS Kernel Integration

The gateway registers as an MCP server on the internal bus:

```typescript
// In arifOS kernel — register the model gateway as a local MCP server
const gatewayServer = {
  name: "arifOS Model Gateway",
  version: "2026.06.15",
  tools: gatewayToolManifest,
  resources: [
    {
      uri: "gateway://providers",
      name: "Provider Registry",
      description: "Live provider config from providers.yml"
    },
    {
      uri: "gateway://lockin",
      name: "Lock-in Report",
      description: "F8 LAW metrics per provider"
    }
  ]
};
```

This means GEOX, WEALTH, WELL, and A-FORGE all call `model/complete` through the gateway — never directly to a provider. The gateway handles routing, failover, F7/F8 enforcement, and logging.

---

## File Map

| File | Role |
|------|------|
| `/root/.secrets/providers.yml` | Canonical provider config (human truth) |
| `/root/A-FORGE/src/infrastructure/llm/ModelGateway.ts` | Gateway implementation |
| `/root/A-FORGE/src/infrastructure/cli/provider.ts` | Human CLI (list/health/swap/validate) |
| `/root/A-FORGE/GENESIS/providers_yml_spec.md` | Full architecture spec |
| `/root/A-FORGE/GENESIS/shutdown_contract.md` | F7 continuation contract |
| `/root/A-FORGE/GENESIS/mcp_model_gateway_contract.md` | This file — MCP protocol contract |

---

**DITEMPA BUKAN DIBERI — Every model is a server. Every agent is a host. The gateway is the law.**
