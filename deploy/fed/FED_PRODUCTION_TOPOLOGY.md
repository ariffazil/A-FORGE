# FED Production Topology

> Last verified: 2026-09-15. Source of truth for "which litellm is production."

## The Two Litellm Instances

There are **two** litellm instances in the federation. This is intentional — one is primary, one is failover.

| Instance | Location | Port | Role | Config |
|----------|----------|------|------|--------|
| **KVM8 litellm** | af-forge (100.64.0.2) | :4013 | **PRIMARY** | `/root/A-FORGE/litellm-config.yaml` |
| **KVM4 litellm** | kvm4-forge (100.64.0.5) | :4000 | **BACKUP** | KVM4's own config (not synced) |

## Traffic Paths

```
External clients (OpenClaw, web, Tailscale)
    │
    ▼
HAProxy :4000 (KVM8)
    │
    ├── PRIMARY ──→ KVM8 :4013 (local litellm)   ← new i-arif chain
    │
    └── BACKUP  ──→ KVM4 :4000 (remote litellm)  ← old config, passive only

Hermes (Telegram gateway)
    │
    ▼
:4012 (fed_zen passthrough, no auth injection)
    │
    └──→ KVM8 :4013 (local litellm)
```

### What uses what

| Client | Path | Litellm instance |
|--------|------|-----------------|
| Hermes (Telegram) | :4012 → :4013 | KVM8 (new) |
| HAProxy :4000 (primary) | :4013 | KVM8 (new) |
| HAProxy :4000 (backup) | KVM4 :4000 | KVM4 (old) |
| arifOS kernel | :4012 → :4013 | KVM8 (new) |
| OpenClaw (KVM4) | KVM4 local | KVM4 (old) |

## i-arif Chain (KVM8 — production primary)

7 entries, 7 unique upstream providers, 100% vision-capable.

| Order | Model | Provider | Upstream | Vision |
|-------|-------|----------|----------|--------|
| 1 | deepseek-flash | DeepSeek | api.deepseek.com | ✓ |
| 2 | qwen3.8-max | Qwen Individual | Token Plan | ✓ |
| 3 | qwen3.8-max | OpenCode Go | opencode.ai | ✓ |
| 4 | gemini-3.6-flash | Google | Google AI | ✓ |
| 5 | mimo-v2.5 | Xiaomi | xiaomimimo.com | ✓ |
| 6 | MiniMax-M3 | MiniMax | minimax.io | ✓ |
| 7 | glm-5.3-flash | Z.AI | api.z.ai | ✓ |

### Routing config

```yaml
routing_strategy: latency-based-routing
num_retries: 1
allowed_fails: 2
cooldown_time: 30
```

DeepSeek Flash has `min_tokens: 200` (reasoning model — needs headroom for thinking tokens).

### Cross-group fallbacks

If ALL i-arif entries fail, litellm falls back to these model groups:
`deepseek-flash` → `mimo-v2.5` → `MiniMax-M3` → `gemini-3.6-flash` → `glm-5.3-flash`

## HAProxy Config

File: `/etc/haproxy/haproxy.cfg`

Key detail: HAProxy **injects the master key** for all :4000 requests. Clients don't need to send auth.

## Why Two Instances?

1. **KVM8** = truth node. All core organs live here. Hermes connects directly.
2. **KVM4** = workshop. Has its own litellm for OpenClaw edge agent.
3. If KVM8 litellm goes down, HAProxy fails over to KVM4 automatically.
4. KVM4's config is **not synced** — it has the old i-arif chain. This is intentional: KVM4 is a workshop, not a court. Its config serves OpenClaw and as a cold backup.

## Maintenance

- **Config file**: `/root/A-FORGE/litellm-config.yaml` (KVM8)
- **Container**: `litellm-federation` (Docker, port 4013)
- **Restart**: `docker restart litellm-federation`
- **HAProxy reload**: `systemctl reload haproxy`
- **Health check**: `curl http://127.0.0.1:4000/health/liveliness`
- **SOT**: `/root/.config/federation-models.json` (204 models)

## History

- Pre-2026-09-15: KVM4 was primary (:4000 → KVM4). i-arif had9 entries, 4 sharing Qwen Token Plan upstream. 429 cascade = 9-28s latency.
- 2026-09-15: Swapped HAProxy primary to KVM8 :4013. Rebuilt i-arif chain to7 unique upstreams with DeepSeek Flash primary. Latency: 0.47s median.
