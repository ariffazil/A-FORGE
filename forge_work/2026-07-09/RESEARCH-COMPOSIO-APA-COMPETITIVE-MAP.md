# APA Competitive Landscape — Composio & the 6 Families

> **APA = Autonomous Protocol for Applications.** A-FORGE sovereign connectors.
> **Forged:** 2026-07-09 · **Author:** FORGE (000Ω) · **Sovereign:** Arif (F13)
> **Status:** COMPETITIVE INTELLIGENCE · Living document

---

## 0. THE LANDSCAPE — 6 Families

```
┌──────────────────┬──────────────────────────────┬─────────────────────┐
│ Family           │ Examples                     │ Who owns tokens?    │
├──────────────────┼──────────────────────────────┼─────────────────────┤
│ Cloud tool       │ Composio, Merge,             │ VENDOR              │
│ catalogs         │ Agent Handler, Paragon,      │ OAuth in their      │
│                  │ ActionKit, Pipedream         │ cloud               │
├──────────────────┼──────────────────────────────┼─────────────────────┤
│ MCP auth         │ Arcade.dev, Anthropic        │ VENDOR or HYBRID    │
│ runtimes         │ MCP tunnels                  │ Token injection     │
├──────────────────┼──────────────────────────────┼─────────────────────┤
│ Self-hostable    │ Nango (best peer),           │ YOU (if self-host)  │
│ integration OS   │ Paragon enterprise K8s       │ Credentials in      │
│                  │                              │ your Postgres       │
├──────────────────┼──────────────────────────────┼─────────────────────┤
│ MCP gateways     │ Docker MCP GW, Bifrost,      │ YOUR NET +          │
│                  │ MintMCP, TrueFoundry,        │ THEIR PRODUCT       │
│                  │ Zuplo                        │                     │
├──────────────────┼──────────────────────────────┼─────────────────────┤
│ Agent credential │ Peta ("1Password for         │ VAULT INJECTS;      │
│ vaults           │ agents"), HashiCorp Vault    │ AGENT NEVER SEES    │
│                  │ patterns                     │ KEYS                │
├──────────────────┼──────────────────────────────┼─────────────────────┤
│ Protocol-direct  │ APA / A-FORGE                │ YOU + arifOS        │
│ sovereign        │ (IMAP, CalDAV, lease)        │ Lease-gated,        │
│                  │                              │ VAULT999-anchored   │
└──────────────────┴──────────────────────────────┴─────────────────────┘
```

---

## 1. FAMILY 1 — Cloud Tool Catalogs

**Pattern:** 1,000+ SaaS connectors. Managed OAuth. Cloud-hosted. "Connect your AI to anything."

### 1.1 Composio

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | 1,000+ toolkits, MCP-native, managed OAuth, Tool Router |
| **License** | MIT (SDK), proprietary (backend) |
| **Token custody** | Their cloud. OAuth2 tokens stored at composio.dev |
| **Breach record** | May 2026: 100+ toolkits OAuth tokens revoked |
| **MCP interface** | Rube MCP server, stdio proxy |
| **Pricing** | Free tier → $29/mo pro |
| **APA relationship** | **Reference catalog.** Mine their schema shapes, reject their custody |

### 1.2 Merge (merge.dev)

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | Unified API for HR, payroll, CRM, ATS integrations |
| **Focus** | B2B SaaS product integrations, not agent-native |
| **Token custody** | Their cloud |
| **APA relationship** | Irrelevant — enterprise SaaS unification, not agent sovereignty |

### 1.3 Agent Handler

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | Agentic integration middleware, MCP-native |
| **Focus** | Agent → SaaS tool routing with managed auth |
| **Token custody** | Vendor cloud |
| **APA relationship** | Similar pattern to Composio but smaller catalog |

### 1.4 Paragon

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | Enterprise integration platform, embeddable UX |
| **Focus** | Customer-facing integrations for SaaS products |
| **Self-host** | Enterprise K8s deployment available |
| **Token custody** | Hybrid — cloud or self-hosted K8s |
| **APA relationship** | Enterprise-focused. Self-host possible but heavyweight. |

### 1.5 ActionKit

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | AI agent tool execution platform |
| **Focus** | MCP-native tool calling with managed auth |
| **Token custody** | Vendor cloud |
| **APA relationship** | Newer entrant, similar Composio pattern |

### 1.6 Pipedream

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | Workflow automation + integration platform |
| **Focus** | Event-driven workflows, not agent-native |
| **Token custody** | Vendor cloud |
| **APA relationship** | Workflow automation, different category. Lighter than Zapier. |

---

## 2. FAMILY 2 — MCP Auth Runtimes

**Pattern:** MCP-first. Token injection at runtime. Agent never sees credentials.

### 2.1 Arcade.dev

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | MCP-native OAuth runtime. Token injection at tool call. |
| **Key innovation** | `requires_auth=GitHub(scopes=["repo"])` — declarative auth |
| **Token custody** | Their runtime. "LLMs and MCP clients cannot see or access OAuth tokens." |
| **MCP integration** | First MCP runtime for production auth. Authors of MCP URL elicitation spec. |
| **Open source** | Apache 2.0 (arcade-mcp library), Engine closed/cloud |
| **APA relationship** | **Closest MCP auth peer.** Same "agent never sees keys" philosophy as forge_lease. But: engine closed, auth in their cloud, no F1-F13. |

**APA differentiator:** Arcade protects tokens from the LLM. APA protects tokens from EVERYONE — including Arcade. `forge_lease` is constitutional, not just technical.

### 2.2 Anthropic MCP Tunnels

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | MCP transport layer for remote tool access |
| **Focus** | Secure transport, not auth management |
| **Token custody** | Not applicable — transport layer only |
| **APA relationship** | Complementary. APA could use MCP tunnels for transport. |

---

## 3. FAMILY 3 — Self-Hostable Integration OS

**Pattern:** Open source connectors. Your infrastructure. Your database. Your tokens.

### 3.1 Nango (nango.dev) — CLOSEST PEER

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | Open-source API integration runtime. 800+ APIs. |
| **License** | Elastic License 2.0 (connectors open, self-host enterprise) |
| **Token custody** | **YOU** — credentials in your Postgres. OAuth tokens in your DB. |
| **Self-host** | Hybrid: connectors open-source. Full self-host = enterprise only (Helm removed from self-serve Oct 2025). |
| **MCP** | Native MCP support for AI agent tool calling |
| **Pricing** | Free for dev → enterprise for self-host |
| **APA relationship** | **Closest engineering peer.** Same philosophy: own your connectors, own your credentials. |

**Nango vs APA — key differences:**

| Dimension | Nango | APA |
|-----------|-------|-----|
| **Connector model** | Pre-built 800+ APIs, OAuth-managed | Protocol-first (IMAP, CalDAV), sovereign |
| **Auth model** | OAuth2 tokens in your Postgres | `forge_lease` — constitutional, time-bound |
| **Governance** | None (your app's responsibility) | F1-F13 floors, constitutional |
| **Audit** | Your logs | VAULT999 immutable ledger |
| **Sovereign override** | None | F13 — Arif's absolute veto |
| **Maturity** | Production, funded (Gradient Ventures) | v1.0, forged 2026-07-09 |
| **Connector count** | 800+ | 2 deployed (Email, Calendar), spec'd: GitHub, Drive |

**Hard truth:** Nango has 800 connectors. APA has 2. The gap is real. But Nango has no constitution. APA has F1-F13. The question is: speed of connector development vs depth of governance.

### 3.2 Paragon Enterprise K8s

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | Paragon's self-hosted enterprise deployment |
| **Token custody** | You (K8s cluster) |
| **APA relationship** | Enterprise-scale, K8s-heavy. Overkill for single sovereign operator. |

---

## 4. FAMILY 4 — MCP Gateways

**Pattern:** Federation/isolation layer for MCP tools. Route, gate, monitor.

### 4.1 Docker MCP Gateway

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | Container-isolated MCP tool execution |
| **Focus** | Sandbox, isolation, tool federation |
| **APA relationship** | **A-FORGE already covers this.** `forge_docker`, `forge_sandbox`, lease gating. Docker MCP GW is a subset of A-FORGE's execution layer. |

### 4.2 Bifrost

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | MCP gateway + auth proxy |
| **Focus** | Multi-tenant MCP routing with auth |
| **APA relationship** | Gateway pattern. A-FORGE's `arif_route` + `forge_lease` covers this. |

### 4.3 MintMCP

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | Lightweight MCP gateway |
| **Focus** | Tool aggregation and routing |
| **APA relationship** | Same gateway pattern. Subset of A-FORGE routing. |

### 4.4 TrueFoundry / Zuplo

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | API gateway platforms with MCP support |
| **Focus** | Enterprise API management extended to MCP |
| **APA relationship** | Enterprise API gateways. Heavy. A-FORGE + Caddy already handle this. |

---

## 5. FAMILY 5 — Agent Credential Vaults

**Pattern:** Secrets injected at runtime. Agent never sees keys.

### 5.1 Peta ("1Password for Agents")

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | Ephemeral agent tokens + server-side secret injection |
| **Key innovation** | Agent requests action → vault injects credential → agent executes → credential destroyed |
| **Token custody** | Vault holds. Agent sees temporarily (or never). |
| **APA relationship** | **Commercial equivalent of forge_lease.** Peta injects secrets server-side; APA gates authority constitutionally. |

**Peta vs APA — same philosophy, different layer:**

| Dimension | Peta | APA |
|-----------|------|-----|
| **What it protects** | API keys, tokens, secrets | Constitutional authority + credentials |
| **How** | Vault injection, ephemeral tokens | `forge_lease` with TTL, scope, actor binding |
| **Agent sees keys?** | No (vault pattern) | No (lease gates, credential in `/root/.secrets/`) |
| **Governance** | Policy-based (who can request what) | Constitutional (F1-F13, 888 override) |

Peta is the commercial pattern that validates APA's architecture. The industry is moving toward "agent never sees keys." APA does this constitutionally.

### 5.2 HashiCorp Vault Patterns

| Dimension | Assessment |
|-----------|-----------|
| **What it is** | General secret management. Agent pattern emerging. |
| **APA relationship** | Complementary. Vault for secret rotation, APA for constitutional gating. |

---

## 6. FAMILY 6 — Protocol-Direct Sovereign (APA)

**Pattern:** No OAuth. No cloud. Open protocols. Constitutional governance.

### 6.1 APA / A-FORGE

This is us. The only entry in this family as of 2026-07-09.

| Dimension | APA |
|-----------|-----|
| **Protocol** | IMAP, SMTP, CalDAV (open RFC standards) |
| **Auth** | `forge_lease` — constitutional, scoped, TTL, actor-bound |
| **Tokens** | `/root/.secrets/` — never leave VPS |
| **Governance** | F1-F13 constitutional floors |
| **Audit** | VAULT999 immutable ledger |
| **Override** | F13 — Arif's absolute veto |
| **Exit** | Zero lock-in. Switch providers by changing 1 URL. |
| **Connectors deployed** | Email (IMAP/SMTP), Calendar (CalDAV) |
| **Connectors spec'd** | GitHub, Drive, Document, Reminder |
| **Cost** | $0 — Python stdlib + 1 pip install (caldav) |

---

## 7. THE HARD TRUTH

```
                    APA           Nango        Composio     Arcade
                    ───           ─────        ────────     ──────
Connectors          2 deployed    800+         1,000+       Custom-built
Constitution        F1-F13        None         None         None
Audit               VAULT999      Your logs    Their logs   Their logs
Sovereign override  F13           None         None         None
Self-hosted         ✅ Full       ✅ Hybrid    ❌ Cloud     ⚠️ Engine closed
Token custody       You           You          Them         Them
Protocol            Open RFCs     OAuth2 APIs  OAuth2 APIs  OAuth2 APIs
Cost                $0            Free→$$$$    $29/mo       Free→Enterprise
```

**The gap is connector count, not architecture.**

APA's architecture is correct — arguably the most constitutionally sound in the entire landscape. No one else has F1-F13. No one else has VAULT999. No one else has sovereign override.

But Nango has 800 connectors. Composio has 1,000+. They solved the *volume* problem with engineering teams and venture funding. APA's solution must be different: build connectors for what Arif actually uses (email, calendar, github, drive, slack), not for everything.

The strategy is not "match Composio's catalog." It's "cover Arif's daily surface with sovereign depth."

---

## 8. STRATEGIC POSITIONING

```
CLOUD-DEPENDENT ←──────────────────────────→ SOVEREIGN
     │                                              │
     │  Composio    Merge    Agent Handler           │
     │  Pipedream   ActionKit                       │
     │                                              │
     │         Arcade    Nango (hybrid)              │
     │         Paragon (K8s)                         │
     │                                              │
     │                          APA / A-FORGE  ←──── ✦
     │                          (only entry here)
     │
     └──→ MORE CONNECTORS ──────────────────→ DEEPER GOVERNANCE
              (1,000+)                              (2, but F1-F13)
```

**APA's quadrant:** Low connector count, maximum governance depth. The only player in the sovereign-constitutional quadrant.

**The play:** Don't race on connector count. Race on *sovereign coverage* — every connector built is permanently sovereign, constitutively governed, and auditable forever. Quality over quantity. Depth over breadth.

---

## 9. CLOSEST COUSINS — Detailed Comparison

### Nango — Closest Engineering Peer

**What to copy:** Open-source connector model. Self-host credentials. 800+ API patterns as reference.

**What to reject:** OAuth2-only (no protocol-first). No constitutional layer. Enterprise-only for full self-host. Elastic License (not truly open).

### Arcade — Closest MCP Auth Peer

**What to copy:** Declarative auth (`requires_auth=...`). Token injection pattern. MCP-native design.

**What to reject:** Engine is closed. Auth in their cloud. No constitutional governance.

### Peta — Closest Credential Vault Peer

**What to copy:** "Agent never sees keys" as a principle. Ephemeral tokens. Vault injection.

**What APA already does:** `forge_lease` with TTL + scope. Credentials in `/root/.secrets/`. Agent gates through constitution, not direct credential access.

### Docker/MintMCP — Closest Gateway Peer

**What APA already covers:** A-FORGE's entire execution layer. `forge_lease`, `forge_sandbox`, `arif_route`. Tool federation + isolation is built-in.

---

## 10. THE APA ADVANTAGE — Why This Quadrant Wins

1. **No breach surface.** May 2026 Composio breach proves the thesis. Tokens in vendor cloud = systemic risk. Tokens on your VPS = your risk, your control.

2. **Constitutional over contractual.** Everyone else has Terms of Service. APA has F1-F13. ToS changes. Floors don't.

3. **Protocol over API.** IMAP has worked for 30 years. CalDAV for 20. Gmail API changes every 6 months. Protocol-first means zero maintenance burden.

4. **Exit is design, not afterthought.** Change 1 URL in a credential file to switch email providers. Composio: revoke OAuth, re-auth to new provider, rebuild all integrations.

5. **VAULT999.** No one else has immutable audit. When an agent sends an email through Composio, the audit trail is in their cloud. When it sends through APA, the receipt is in your Vault forever.

---

## 11. NEXT MOVES

| Priority | Action | Rationale |
|----------|--------|-----------|
| P0 | Populate credentials, test Email + Calendar end-to-end | Bridges are deployed, just need real auth |
| P0 | Register `forge_email` + `forge_calendar` as MCP tools | Complete the APA → A-FORGE circuit |
| P1 | APA-GitHub connector (extends existing `forge_github`) | Developer triad: email, calendar, code |
| P2 | APA-Document (pandoc+weasyprint MCP wrapper) | 2-hour build, high daily utility |
| P3 | Study Nango's connector catalog for schema patterns | Accelerate future connectors |

---

*DITEMPA BUKAN DIBERI — Sovereignty is forged, not imported.*
*Competitive Map v1.0 · 2026-07-09 · FORGE (000Ω) for Arif (F13)*
