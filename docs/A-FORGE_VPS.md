# AF Forge VPS Infrastructure Blueprint
### Governed AI Agent Stack — Product-Agnostic, arifOS-Native
***
## Executive Summary
AF Forge is a sovereign, self-hosted AI agent platform. Its VPS infrastructure must support four things concurrently: a **constitutional governance kernel** (arifOS), one or more **agent runtimes**, a **local or proxied LLM backend**, and a **data + observability plane**. This blueprint maps every foundational component, what runs native vs. containerized, how components wire together, and what VPS resource tiers are appropriate for each growth stage. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

The governing principle from arifOS itself: **governed behavior under uncertainty** — not total control. That maps directly to infrastructure: constrain the blast radius of each component, run isolated, log everything, design fallback into every critical path. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

***
## Mental Model: The Stack Has Four Planes
Before naming products, understand the planes: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

| Plane | What it does | Failure mode if absent |
|---|---|---|
| **Governance plane** | Enforces constitutional floors, audit log, 888_HOLD human veto | AI acts without safety checks; no audit trail |
| **Agent plane** | Receives tasks, orchestrates tool calls, manages lifecycle | No autonomous execution; manual only |
| **Data + memory plane** | Persistent state, vector store, key-value cache, job queue | Agent amnesia; can't learn or retry across sessions |
| **Infra plane** | Network, TLS, secrets, observability, process supervision | Silent failures; no visibility; secrets leak |

Every component you install belongs to one of these four planes. If a component serves none of them, it's noise. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

***
## Layer 1: What Runs Native (Host OS Level)
These components are **not containerized** — they are the substrate everything else sits on. Containerizing them adds unnecessary indirection and risk. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### Host OS
- **Ubuntu 22.04 LTS or 24.04 LTS** — most battle-tested for Docker Engine, systemd, and LLM tooling as of 2026. [ubuntu](https://ubuntu.com/about/release-cycle)
- **Recommendation (2026):** Default to **24.04 LTS** for new installs; consider **26.04 LTS** only after its first maintenance release window hardens (post‑GA, after 23 April 2026). [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/)
- Minimal install: no GUI, no unnecessary daemons. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Kernel: keep updated; enable `unattended-upgrades` for security patches only. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### Firewall (ufw / nftables)
- Default-deny inbound; allow only SSH (port 22 or custom), HTTPS (443), and your proxy port. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Never expose LLM inference port (Ollama default 11434), Postgres (5432), Redis (6379) directly — they must be internal only. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Rule: if a port is not explicitly needed by an external human or service, block it at host level. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### SSH Hardening
- Key-based auth only, no password login. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Consider non-standard port + fail2ban. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- This is your **last line of access** — treat as F11 (Auth for critical commands) in arifOS floor terms. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### Docker Engine (native, not containerized)
- Docker Engine runs as a host-level daemon — this is correct and expected. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Use **Docker Compose v2** (plugin, not standalone) for service orchestration. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Enable Docker's live-restore so containers survive daemon restarts. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Limit Docker socket exposure: only Caddy/Traefik reverse proxy container needs socket access for dynamic routing — no agent container should have it. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### Systemd Service Units
- Key long-running services (Docker daemon, Caddy if native, cron jobs) managed by systemd. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Use `Restart=on-failure` and `RestartSec=5s` for resilience. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Log to journald; forward to container log aggregator later. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

***
## Layer 2: Core Containerized Services
Run the following inside Docker Compose. They form the **always-on backbone** of AF Forge. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### 2.1 Governance Kernel — arifOS MCP Server
- **What:** FastAPI/Uvicorn ASGI server exposing MCP tools via Streamable HTTP at `/mcp`, SSE fallback. [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)
- **Port:** 8080 (internal only, routed via reverse proxy). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **Tools exposed:** `anchor_session` (000 INIT), `reason_mind` (AGI), `recall_memory`, `simulate_heart`, `critique_thought`, `VAULT_999`. [github](https://github.com/ollama/ollama/issues/10883)
- **Trinity servers** internally: VAULT (9000), AGI (9001), ASI (9002), APEX (9003). [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)
- **Image:** Python 3.11-slim + uv; official Dockerfile from `github.com/ariffazil/arifOS`. [discourse.ubuntu](https://discourse.ubuntu.com/t/ubuntu-24-04-4-lts-released/76854)
- **Wire:** All agent runtimes must call arifOS before any high-stakes action. arifOS is the **constitutional chokepoint**. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

```
arifOS MCP Server
├── /mcp        → Streamable HTTP (production)
├── /health     → Health probe
└── /metrics/json → Telemetry JSON (epoch, dS, peace2, kappa_r, confidence...)
```
### 2.2 Reverse Proxy + TLS Termination
- **What:** Single ingress point for all external traffic; handles TLS, routing, and auth headers. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **Best fit for AF Forge:** **Caddy** — auto-TLS via Let's Encrypt, zero-config, lowest resource usage, human-readable Caddyfile. [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)
- Use **Traefik** instead if you expect to spin up and down many agent containers dynamically (docker-label routing). [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)
- 2025–2026 comparisons still converge on **Caddy** for simple, human‑operated stacks and **Traefik** when you manage many dynamic services. [youtube](https://www.youtube.com/watch?v=FVmAS6moiT4)
- **Never** expose internal service ports (8080, 9000–9003, 11434, 5432, 6379) to the public internet — all traffic routes through this proxy only. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- The proxy container is the only one that mounts `/var/run/docker.sock` (for dynamic routing). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### 2.3 Database — PostgreSQL
- **What:** Primary persistent store for agent state, audit logs, task metadata, user data, embeddings (via pgvector extension). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **Pattern:** Single shared Postgres container with separate databases per service (arifOS audit DB, agent DB, etc.). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **pgvector:** Enables long-term semantic memory and RAG without adding a separate vector database at early stage. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **Volume:** Mount named Docker volume with regular backup (at minimum daily `pg_dump` to remote object storage). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **⚠ 888_HOLD (Irreversible):** Postgres data volume deletion or schema migration with DROP is irreversible — requires human ratification per F1/F13. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### 2.4 Cache + Message Queue — Redis
- **What:** Short-term key-value cache, session state, pub/sub for agent task events, job queues. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/summary-for-lts-users/)
- Redis replaces the need for a separate message broker (RabbitMQ, Kafka) at this scale. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Use **Redis keyspace notifications** for lightweight event-driven agent triggers. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/summary-for-lts-users/)
- Separate Redis databases (DB 0 for cache, DB 1 for queues) to isolate blast radius. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### 2.5 LLM Backend — Inference Runtime
- **What:** Serves local open-weight models as an OpenAI-compatible API endpoint. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **Product-agnostic name:** *Local Inference Runtime*. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **Options by resource tier:** [itsfoss](https://itsfoss.community/t/is-ubuntu-26-04-lts-for-april-2026/15358)

| Tier | Tool | Models | RAM req |
|---|---|---|---|
| CPU-only (light) | Ollama | Mistral 7B, Gemma 2 9B, Qwen 2.5 7B | 8–16 GB |
| CPU-only (mid) | Ollama / llama.cpp | Llama 3.1 13B, DeepSeek 14B | 16–32 GB |
| GPU (A4000 16GB VRAM) | Ollama + CUDA | Llama 3.1 8B @ 51 tok/s, DeepSeek 7B @ 52 tok/s | 16–32 GB RAM |
| GPU (RTX 4090 24GB VRAM) | Ollama + CUDA | Llama 3 70B quantized | 32–64 GB RAM |

- **Wire:** Expose only on internal Docker network (`ollama:11434`). Agent runtimes call it via internal DNS, never via public IP. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/schedule/)
- For Nvidia GPUs, ensure drivers and CUDA meet your inference runtime’s minimum requirements (for Ollama: Nvidia GPU with compute capability ≥5.0 and driver version 531+). [dasroot](https://dasroot.net/posts/2026/03/ollama-gpu-optimization-configuration-2026/)
- arifOS governance layer should wrap all model calls — model is "muscle", arifOS is "conscience". [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)
### 2.6 Agent Runtime
- **What:** The execution engine that receives tasks, calls tools, manages sub-agents, writes logs. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **Pattern:** Ephemeral runner containers per job; managed by a persistent Agent Manager. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/)
- **Agent Manager** responsibilities: schedule jobs, enforce tool whitelists, store task metadata in Postgres, push audit events to comms channel. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/)
- **Agent Runner** constraints: seccomp profile, no host network, CPU + memory limits, read-only filesystem except designated workspace volume. [youtube](https://www.youtube.com/watch?v=FVmAS6moiT4)
- **Tool access** is the critical governance surface: file system, shell, browser access must be explicitly granted per task type — not open by default. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### 2.7 Notification / Human-in-the-Loop Channel
- **What:** Push task events, audit logs, 888_HOLD approval requests to a human-monitored channel. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/)
- **Options:** Telegram bot, Matrix room, Discord webhook, Slack. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **Pattern:** Agent Manager → notifier sidecar → comms channel. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- For 888_HOLD (irreversible actions): agent pauses, writes hold record to Postgres, pushes approval request; resumes only on explicit human confirmation. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

***
## Layer 3: Observability Plane
No blind spots. Every plane must emit signals. This is the "cannot control all model quirks, but can monitor" layer. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### Metrics Stack
- **Prometheus** — scrapes metrics from all containers, stores time-series. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **Grafana** — dashboards for: agent invocation counts, cost per agent, p95 latency, error rates, LLM token usage. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **node-exporter** — host-level CPU, RAM, disk, network. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- **cAdvisor** — container-level resource usage. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
### LLM + Agent Observability (Grafana AI Observability)
- Track: invocation count by agent, cost in USD, p95 op duration, latency by provider. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Wire Prometheus to scrape arifOS `/metrics/json` endpoint for constitutional telemetry (epoch, dS, peace², kappa_r, confidence). [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)
### Log Aggregation
- All containers log to stdout → Docker log driver → Loki (Grafana's log backend) or simple log forwarder to file + rotation. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Immutable audit log: critical arifOS VAULT_999 seals written to Postgres with hash; never deletable. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/24.04/)

***
## Wiring Diagram (Text Form)
```text
INTERNET
    │
    ▼
[Reverse Proxy — Caddy/Traefik] ← TLS termination, routing, auth headers
    │
    ├──► [arifOS MCP Server :8080] ← Constitutional governance kernel
    │         │
    │         ├── VAULT :9000   (audit, seal, VAULT_999)
    │         ├── AGI   :9001   (reasoning, reason_mind)
    │         ├── ASI   :9002   (heart, simulate_heart)
    │         └── APEX  :9003   (critique, 888_HOLD logic)
    │
    ├──► [Agent Manager] ← Schedules jobs, enforces policy
    │         │
    │         ├── [Agent Runner (ephemeral container)] ← per-task, isolated
    │         │         ├── calls → [LLM Backend :11434] (internal only)
    │         │         ├── calls → [arifOS MCP] for governance checks
    │         │         ├── reads/writes → [Postgres] (task state)
    │         │         └── reads → [Redis] (cache, events)
    │         │
    │         └── [Notifier/Bot] → Telegram / Matrix (human-in-the-loop)
    │
    ├──► [Grafana :3000] ← Dashboards
    │         └── reads ← [Prometheus :9090]
    │                         ├── scrapes [node-exporter]
    │                         ├── scrapes [cAdvisor]
    │                         └── scrapes [arifOS /metrics/json]
    │
    └──► [Optional: UI / Admin Panel]

INTERNAL DOCKER NETWORK (no external exposure):
    Postgres :5432
    Redis     :6379
    Ollama    :11434
    arifOS trinity :9000–9003
```

***
## Native vs. Containerized Summary
| Component | Native (Host) | Container | Rationale |
|---|---|---|---|
| Host OS (Ubuntu 24.04 LTS) | ✅ Native | — | Substrate. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| Firewall (ufw/nftables) | ✅ Native | — | Must pre-date Docker. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| SSH daemon | ✅ Native | — | Last-resort access path. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| Docker Engine | ✅ Native | — | Docker cannot containerize itself. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| systemd service units | ✅ Native | — | Process supervision substrate. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| Reverse proxy (Caddy) | Possible native | ✅ Container (preferred) | Container = reproducible, updatable. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| arifOS MCP Server | — | ✅ Container | Reproducible Python env, uv lockfile. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| PostgreSQL | — | ✅ Container (+ volume) | Acceptable at single-VPS scale; volume persists. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| Redis | — | ✅ Container | Stateless enough; volume for AOF persistence. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| LLM Inference Runtime | — | ✅ Container | Ollama official image; GPU passthrough via **nvidia-container-toolkit**. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| Agent Manager | — | ✅ Container | Managed lifecycle, restartable. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| Agent Runner | — | ✅ Ephemeral Container | Per-task isolation; seccomp + resource limits. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| Prometheus | — | ✅ Container | Standard deployment pattern. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| Grafana | — | ✅ Container | Standard deployment pattern. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| node-exporter | ✅ Native or container | Either | Must see host-level metrics; native more accurate. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| Notifier/bot | — | ✅ Container | Sidecar, restartable. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |

***
## VPS Resource Tiers
Three staged options. Start minimal. Upgrade when you hit measurable limits. [ubuntu](https://ubuntu.com/about/release-cycle)
### Tier 1 — Dev / Proof of Concept (API-only LLM, no local model)
**Profile:** arifOS + agent runtime + Postgres + Redis + Caddy + basic observability. LLM calls go to Claude/GPT API. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

| Resource | Spec |
|---|---|
| CPU | 4 vCPU (dedicated, not burstable) |
| RAM | 8–16 GB |
| Storage | 80–120 GB NVMe SSD |
| Network | 1 Gbps, 4 TB/month minimum |
| OS | Ubuntu 24.04 LTS (recommended), 22.04 LTS also supported |
| GPU | None |
| Estimated cost | ~$20–40/mo (Hetzner, OVH, DigitalOcean and similar providers) |

Suitable for: single-user arifOS + OpenClaw or Hermes, Claude/GPT API as LLM backend, light automation. [ubuntu](https://ubuntu.com/about/release-cycle)
### Tier 2 — Production (Local 7B–13B model, multi-agent)
**Profile:** Everything in Tier 1 + Ollama running a 7B–13B local model (CPU inference). [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/schedule/)

| Resource | Spec |
|---|---|
| CPU | 8–16 vCPU (AVX2 support required for llama.cpp) |
| RAM | 16–32 GB |
| Storage | 200–400 GB NVMe SSD |
| Network | 1 Gbps, 8 TB/month |
| OS | Ubuntu 22.04/24.04 LTS |
| GPU | Optional: A4000 (16GB VRAM) for GPU inference |
| Estimated cost | ~$80–180/mo CPU-only; ~$200–250/mo with GPU |

Suitable for: Mistral 7B / Llama 3.1 8B at ~50 tok/s (GPU), multi-agent orchestration, small team use. [itsfoss](https://itsfoss.community/t/is-ubuntu-26-04-lts-for-april-2026/15358)
### Tier 3 — Scale (Local 70B model, GPU-accelerated, team use)
**Profile:** Full AF Forge with large local models, multiple agent teams, full observability. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

| Resource | Spec |
|---|---|
| CPU | 16–24 vCPU |
| RAM | 64–128 GB |
| Storage | 500 GB+ NVMe SSD |
| Network | 10 Gbps or unmetered |
| GPU | RTX 4090 (24GB VRAM) or A100 |
| Estimated cost | ~$300–500/mo (dedicated GPU server) |

Suitable for: Llama 3 70B, DeepSeek 70B quantized, multi-agent teams, production workloads. [dasroot](https://dasroot.net/posts/2026/03/ollama-gpu-optimization-configuration-2026/)

> **Recommendation:** Start at Tier 1. Instrument everything from Day 1. Upgrade to Tier 2 only when Prometheus shows sustained CPU >70% or RAM headroom <2 GB under load. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

***
## Governance Wiring — arifOS Integration Points
This is what makes AF Forge different from a generic agent VPS. [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)

| arifOS Floor | Infrastructure Hook |
|---|---|
| F1 (Reversible) | Postgres backup before any deploy; `pg_dump` + rollback point in 6-stage deploy. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| F2 (≥99% truth) | Agent runner output logged to immutable Postgres audit table; hash stored in VAULT_999. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| F4 (Clarity ΔS≤0) | arifOS `/metrics/json` emits `dS` (entropy delta); Prometheus scrapes and alerts on increase. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| F5 (Peace≥1.0) | Prometheus alert on `peace2 < 1.0` in telemetry JSON; Grafana dashboard for peace signal. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| F8 (Law & Safety) | Agent runner seccomp profile; tool whitelist enforced by Agent Manager; no shell access by default. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| F11 (Auth for critical) | 888_HOLD: agent pauses, writes hold record, pushes Telegram/Matrix approval request. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |
| F13 (Sovereign human veto) | Human approval required to resume 888_HOLD; no timeout override. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md) |

***
## Minimum Viable Boot Sequence
On first VPS provisioning, in this exact order: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

1. **Harden OS** — firewall, SSH key-only, fail2ban, unattended-upgrades. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
2. **Install Docker Engine** — Docker CE + Compose v2 plugin. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
3. **Clone arifOS repo** — `git clone github.com/ariffazil/arifOS`. [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)
4. **Spin up core stack** — Docker Compose: Postgres, Redis, arifOS MCP Server, Caddy. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
5. **Wire DNS + TLS** — point domain to VPS; Caddy auto-provisions cert. [jellywatch](https://jellywatch.app/blog/jellyfin-reverse-proxy-nginx-traefik-caddy-guide-2026)
6. **Verify arifOS health** — `curl https://yourdomain.com/health` → constitutional envelope active. [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)
7. **Add LLM backend** — Ollama container (CPU) or API proxy config for Claude/GPT. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/schedule/)
8. **Add Agent runtime** — Agent Manager + first Agent Runner config. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/)
9. **Add observability** — Prometheus + Grafana + node-exporter + cAdvisor. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
10. **Connect notifier** — Telegram bot or Matrix bridge for 888_HOLD human loop. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/26.04/)
11. **Run arifOS 6-stage deploy verification** — Validate → Test → Backup → Deploy → Verify → Complete. [documentation.ubuntu](https://documentation.ubuntu.com/release-notes/24.04/)

> **888_HOLD reminder:** Steps 3 and 4 are reversible. Step 7 onward with production data is not. Treat first live data ingestion as a ratification point. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

***
## What to Defer (Not Day 1)
Avoid adding these until Tier 1 is stable and monitored: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

- Kubernetes / K3s — unnecessary complexity at single-VPS scale; introduces control plane overhead. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Separate managed Postgres / Redis — adds cost and external dependency; containerized is fine at Tier 1–2. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Multiple VPS nodes / clustering — scale vertically first; horizontal adds distributed systems complexity. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
- Full GPU stack — only add when local inference is proven necessary via API cost data. [itsfoss](https://itsfoss.community/t/is-ubuntu-26-04-lts-for-april-2026/15358)
- Separate vector DB (Qdrant, Weaviate) — pgvector covers RAG at this scale. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

***
## Summary: The Four Governing Decisions
1. **Native:** OS, firewall, SSH, Docker Engine — these are the substrate. Never containerize the substrate. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
2. **Container:** Everything else — reproducible, isolated, restartable, versioned. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)
3. **arifOS is the chokepoint:** Every agent call that matters passes through arifOS MCP before action. Not optional. Not bypassed for convenience. [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)
4. **Start Tier 1, instrument from Day 1:** You cannot govern what you cannot see. Prometheus + Grafana on Day 1, even if dashboards are empty. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_a8372f00-fa6d-4dab-afd4-7a4b5ddb9b3d/e94f47ae-33fb-4371-a788-4cb16f121162/A-FORGE_VPS.md)

> **Governing principle:** Not "control all four planes at all times." Rather — govern the critical few levers (governance kernel, tool access, human veto, audit log), tolerate the rest, and design for drift. [hostim](https://hostim.dev/blog/reverse-proxy-showdown/)

***



---

## Ops Patterns — Sealed from Live Incidents

### Pattern: Postgres Backup Container Healthcheck (2026-04-19)

**Incident:** `af-forge-backup` reported unhealthy for 5+ hours despite Postgres being fully operational.

**Root cause:** `pg_isready` without `-h` defaults to the local Unix socket (`/var/run/postgresql`). On a cron-only backup container, no local Postgres process exists — no socket — so the probe always returns exit code 2 ("no response"), even when the target database is healthy over TCP.

**Diagnosis command that proved it:**
```bash
docker exec af-forge-backup pg_isready -h postgres -U arifos_admin -d arifos_vault
# postgres:5432 - accepting connections ← healthy over TCP
```

**Canonical healthcheck template for any future Postgres backup container:**
```yaml
healthcheck:
  test: ["CMD", "pg_isready",
         "-h", "postgres",
         "-U", "arifos_admin",
         "-d", "arifos_vault"]
  interval: 10s
  timeout: 10s
  retries: 3
  start_period: 10s
```

**Rules:**
- Always pass `-h <postgres_service>` — force TCP to the Docker network service, never rely on local Unix socket
- Match `-U` and `-d` to the vault DB credentials defined in stack `.env`
- Keep healthcheck as a liveness probe only — backup jobs themselves run via `cron` inside the container
- Backup containers are cron-only images; they do not run Postgres locally

**F1 note:** The unhealthy status was a false alarm (probe bug, not data loss). However, false alarms erode trust in health signals. A correct probe prevents alert fatigue and keeps 888_HOLD telemetry meaningful.

---
