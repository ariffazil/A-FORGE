# ADR-00X: Composio as A-FORGE External Tool Substrate

> **Status:** PROPOSED
> **Date:** 2026-06-16
> **Decision Maker:** Arif (F13 SOVEREIGN)
> **Author:** FORGE (000Ω)

---

## 1. Problem Frame

arifOS federation has 7 organs with 130+ domain-specific tools, but **zero managed OAuth integrations** for external SaaS apps. If Arif wants his agent to send an email, post to Slack, create a Notion page, or file a Linear ticket — each integration must be built and maintained from scratch.

Composio provides 1,000+ pre-built tool schemas with managed OAuth for SaaS apps, exposed as a standard MCP SSE endpoint. The question: **where does it fit in the federation architecture?**

## 2. Decision

**Composio becomes an external tool adapter within A-FORGE**, gated by arifOS constitutional governance. It is NOT a new organ, NOT a replacement for any existing layer.

```
arifOS (governance) → A-FORGE (execution) → Composio MCP (external SaaS)
                                            ↓
                                    1,000+ tools
                                    Managed OAuth
                                    Cloud-hosted
```

## 3. Options Evaluated

| Option | Description | Verdict |
|--------|-------------|---------|
| **A: A-FORGE substrate** | Composio integrated as A-FORGE bridge, gated by arifOS | ✅ SELECTED |
| **B: Standalone organ** | New systemd service, new port, new Cloudflare tunnel | ❌ Over-engineered |
| **C: Client-side MCP** | Direct MCP config in Claude/OpenCode | ❌ Bypasses governance |

## 4. Architecture

### 4.1 Integration Points (Minimal Change)

| File | Change | Risk |
|------|--------|------|
| `src/domain/types/mcp-bridge.ts` | Add `"composio"` to `MCPNamespace`, add `COMPOSIO_MCP_URL` default | LOW |
| `src/infrastructure/bridges/composioBridge.ts` | **NEW** — Bridge to Composio MCP, following `geoxBridge.ts` pattern | LOW |
| `src/infrastructure/tools/ComposioTools.ts` | **NEW** — Dynamic tool registration from Composio schemas | MEDIUM |
| `src/interfaces/mcp/client.ts` | Add `composio` to `classifyToolAction` — all external tools are `MUTATE` by default | LOW |
| `src/domain/types/mcp-bridge.ts` | Add `EXTERNAL_SaaS` action class | LOW |

### 4.2 Tool Flow

```
User: "Send Arif an email summarizing federation health"
  │
  ▼
IntentRouter → detects "email" intent → routes to Composio
  │
  ▼
ComposioTools.listTools() → dynamic schema from Composio MCP
  │
  ▼
ToolRegistry.register(ComposioTool) → GMAIL_SEND_EMAIL schema
  │
  ▼
ToolRegistry.runTool("COMPOSIO_GMAIL_SEND_EMAIL", args, ctx)
  │
  ▼
┌─────────────────────────────────────────────┐
│  F13 SOVEREIGN GATE                          │
│  ├─ riskLevel: "dangerous" (external side)  │
│  ├─ requires: ack_irreversible              │
│  └─ requires: session_id with SEAL verdict  │
└─────────────────────────────────────────────┘
  │
  ▼ (approved)
ComposioBridge.callMCP("composio.GMAIL_SEND_EMAIL", args)
  │
  ▼
POST https://backend.composio.dev/v3/mcp/{server_id}
  │
  ▼
Result → VAULT999 log → AAA telemetry → User
```

### 4.3 Constitutional Gating

| Floor | Application to Composio Tools |
|-------|------------------------------|
| **F1 AMANAH** | External tool calls are IRREVERSIBLE. Must have `ack_irreversible: true` in execution context. |
| **F2 TRUTH** | External results labeled `source: composio_cloud`. Agent must not claim external data is local. |
| **F4 CLARITY** | Composio tool calls logged with full provenance: tool name, args, response, latency. |
| **F8 LAW** | Composio is a CLOUD DEPENDENCY. F8 health probe must check `composio.dev` availability. Degraded mode when down. |
| **F9 ANTI-HANTU** | Composio tools must NOT be presented as "arifOS tools." Label: `external:composio`. |
| **F13 SOVEREIGN** | All external side effects require sovereign approval OR pre-approved policy. |

### 4.4 Action Class Taxonomy Extension

Current: `OBSERVE | DERIVE | MUTATE | ATOMIC`

New: `OBSERVE | DERIVE | MUTATE | ATOMIC | EXTERNAL_SaaS`

`EXTERNAL_SaaS` = irreversible external side effect (email sent, message posted, issue created). Requires:
- Valid session with SEAL verdict
- `ack_irreversible: true`
- F8 health check passed (Composio reachable)
- Logged to VAULT999

### 4.5 Degradation Mode

When `composio.dev` is unreachable:
- `arif_organ_attest` includes Composio health probe
- AAA cockpit shows `COMPOSIO: DEGRADED` status
- External tool calls return `888_HOLD` with reason `ERR_COMPOSIO_UNREACHABLE`
- Internal federation tools continue normally
- No cascade failure — Composio is a leaf dependency, not a core

## 5. Implementation Phases

### Phase 0: Account Setup (Day 0)
- [ ] Create Composio account (or Arif creates it)
- [ ] Generate API key
- [ ] Configure MCP endpoint in environment
- **Acceptance:** `composio.mcp.list()` returns at least 1 server

### Phase 1: Bridge Layer (Week 1)
- [ ] Add `"composio"` namespace to `mcp-bridge.ts`
- [ ] Create `composioBridge.ts` following `geoxBridge.ts` pattern
- [ ] Create `ComposioTools.ts` — dynamic tool registration
- [ ] Add `EXTERNAL_SaaS` action class
- **Acceptance:** `npm test` passes. `ComposioBridge` can call Composio MCP and return tool schemas.

### Phase 2: Constitutional Gating (Week 1-2)
- [ ] Extend `classifyToolAction` for `EXTERNAL_SaaS`
- [ ] Add F8 health probe for Composio
- [ ] Add VAULT999 logging for external tool calls
- [ ] Add AAA cockpit health panel
- **Acceptance:** External tool calls are gated, logged, and auditable.

### Phase 3: First Integrations (Week 2)
- [ ] Gmail: `GMAIL_SEND_EMAIL`, `GMAIL_FETCH_EMAILS`
- [ ] Slack: `SLACK_POST_MESSAGE`
- [ ] GitHub: `GITHUB_CREATE_ISSUE`
- **Acceptance:** "Send Arif an email" works end-to-end with governance.

### Phase 4: Production Hardening (Week 3)
- [ ] OAuth token lifecycle monitoring
- [ ] Rate limit handling
- [ ] Error budget tracking
- [ ] AAA cockpit "External Tools" panel
- **Acceptance:** Production-ready with monitoring.

## 6. Cost

| Item | Cost |
|------|------|
| Composio Free Tier | $0/month (limited calls) |
| Composio Pro | ~$29/month (production use) |
| Development | ~2-3 days of forge work |
| Maintenance | Near-zero (Composio handles OAuth lifecycle) |

## 7. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cloud dependency | MEDIUM | F8 health probe + graceful degradation |
| OAuth token exposure | HIGH | Tokens stored in Composio cloud, not on VPS |
| Constitutional bypass | HIGH | Code-level enforcement in `ToolRegistry.runTool` |
| Cost overrun | LOW | Billing alerts + AAA telemetry |
| Privacy | MEDIUM | Document data flow, Arif accepts trade-off |

## 8. What This Does NOT Change

- arifOS governance remains sovereign
- VAULT999 remains self-hosted
- GEOX/WEALTH/WELL remain domain-specific
- A2A federation remains unchanged
- Constitutional floors F1-F13 remain unchanged

## 9. Acceptance Criteria

1. [ ] Composio MCP tools appear in A-FORGE tool registry
2. [ ] External tool calls are gated by F13 + F1
3. [ ] External tool calls are logged to VAULT999
4. [ ] F8 health probe covers Composio availability
5. [ ] AAA cockpit shows external tool health
6. [ ] Degradation mode works when Composio is down
7. [ ] `npm test` passes with new bridge
8. [ ] First end-to-end test: "Send email" → governance → Composio → VAULT999 log

---

**DITEMPA BUKAN DIBERI — This integration is forged, not given.**
