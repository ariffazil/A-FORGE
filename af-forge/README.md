# AF-FORGE Ω-Machine

> **Meta-machine that forges arifOS and GEOX**  
> **Motto**: *DITEMPA BUKAN DIBERI* — Forged, Not Given

---

## ⚠️ Scope & Non-Scope for AAA Certification

**This AAA certification applies to:**
- ✅ **AF-FORGE TypeScript** (`src/`, `test/`) — Production-grade, governance-enforced
- ✅ **FastMCP Server** (`mcp-server/`) — MCP-compliant gateway (HTTP/STDIO)
- ✅ **Deployment Configs** (`deployments/`) — Docker, Kubernetes, Cloud Run ready
- ✅ **Platform Integration Guides** (`docs/platform-guides/`) — OpenAI, Anthropic, Google

**Explicitly NOT included in this AAA certification:**
- ⚠️ **Python `arifosmcp`** — Beta/hardening phase (separate repository)
- ⚠️ **GEOX Python** — Experimental/research-grade (separate repository)

**AAA Level Clarification:**  
AF-FORGE AAA is **infra-governance level** (F3/F6/F9/F13 enforcement at request level, containerized, tested, deployable).  
Full **organizational AAA** requires additional work: Vault/SIEM integration for F13 logging, explicit 888 approval lifecycle, and auto-enforced telemetry footers.  
See [REMEDIATION_TRACKER.md](./docs/REMEDIATION_TRACKER.md) for gap closure plan.

---

## What is AF-FORGE?

AF-FORGE is the **build system and operational furnace** for the arifOS ecosystem:

- **arifOS**: Constitutional AI governance kernel (F1-F13)
- **GEOX**: Large Earth Model for geoscience  
- **AF-FORGE**: Meta-machine that builds both

---

## 3-Layer Memory Architecture

```
L3: VAULT999 — Immutable ledger (governance seals)
L2: WIKI — Ratified knowledge (this repo)
L1: STATE — Operational SQLite (sessions, handoffs)
```

**Key Correction**: VAULT999 is NOT working memory — it is the **flight recorder** for 999_SEAL events.

---

## Wiki Structure

```
wiki/
├── 00_OPERATORS/      # Who runs the forge
├── 10_RITUALS/        # How we operate
├── 20_BLUEPRINTS/     # What we build
│   ├── Memory_Stack.md    # ⭐ 3-layer architecture
│   └── Adapter_Bus.md     # 7-CLI integration
├── 30_ALLOYS/         # Dependencies
├── 40_HAMMERS/        # Tooling
├── 50_CRACKS/         # Failures
├── 60_TEMPERATURES/   # Metrics
├── 70_SMITH_NOTES/    # Wisdom
├── 80_FEDERATION/     # Cross-wiki links
├── 90_AUDITS/         # Sealed history
│   └── Memory_Manifest.json
└── SCHEMA.md          # Constitution
```

---

## 7-CLI Adapter Bus

Unifying Claude, OpenCode, Gemini, Kimi, Aider, Codex, Copilot under one constitutional framework.

---

## Constitutional Governance (F1-F13)

| Floor | Canon Name (000_THEORY) | AF-FORGE Label | Status |
|-------|------------------------|----------------|--------|
| F1 | Identity/Session Anchor | Identity/Session | ✅ Implemented |
| F2 | Scope/Authority Boundary | Tool Permissions | ✅ Implemented |
| F3 | Input Clarity | Input Clarity | ✅ Pre-check active |
| F4 | Entropy Control | Entropy/Risk | ✅ Implemented |
| F5 | Stability/Reversibility | ApprovalBoundary | ✅ Implemented |
| F6 | ASEAN/MY Dignity (Maruah) | Harm/Dignity | ✅ Pre-check active |
| F7 | Confidence Humility | Confidence Check | ✅ Post-check |
| F8 | Ontology (Grounding) | MemoryContract | ✅ Quarantine tier |
| F9 | Anti-Hantu (Injection) | Injection Resistance | ✅ Pre-check active |
| F10 | Ontology (Memory) | Memory Integrity | ✅ Verification |
| F11 | Coherence/Auditability | Coherence Check | ✅ Post-check |
| F12 | Continuity/Recovery | ContinuityStore | ✅ Session recovery |
| F13 | Human Sovereignty (888_HOLD) | 888_HOLD Gate | ✅ Implemented |

**Naming Notes:**  
- F6 "Harm/Dignity" = Canon "ASEAN/MY Dignity (Maruah)" — same semantic, different labeling  
- F8 "Grounding/MemoryContract" = Canon "Ontology (Grounding)" — implementation-specific naming  
- F10 "Memory Integrity" = Canon "Ontology (Memory)" — operational focus

See [AAA_DEPLOYMENT_GUIDE.md](./docs/AAA_DEPLOYMENT_GUIDE.md) for full governance details.

---

## Build Ritual

```
000_INIT → 111_SENSE → 222_MIND → 333_HEART → 444_JUDGE → 555_FORGE → 666_OPS → 777_APEX → 999_SEAL
```

---

## Quick Start

```bash
# Install
npm install

# Build
npm run build

# Test (59/62 passing, 95%)
npm test

# Run MCP server
python mcp-server/arifos_mcp_server.py --transport http --port 8000

# Deploy
docker-compose -f deployments/docker-compose.yml up -d
```

---

## Documentation

- [AAA Deployment Guide](./docs/AAA_DEPLOYMENT_GUIDE.md) — Production deployment
- [OpenAPI Specification](./docs/openapi.yaml) — API reference
- [Remediation Tracker](./docs/REMEDIATION_TRACKER.md) — Gap closure plan
- [Platform Guides](./docs/platform-guides/) — OpenAI, Anthropic, Google integration

---

*DITEMPA BUKAN DIBERI — 999 SEAL ALIVE*
