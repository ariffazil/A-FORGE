# APA v1.0 — Autonomous Protocol for Applications

> **A-FORGE = Sovereign Composio.** Reference the interface, reject the custody.
> **Forged:** 2026-07-09 · **Author:** FORGE (000Ω) · **Sovereign:** Muhammad Arif bin Fazil (F13)
> **Supersedes:** EUREKA COMPOSIO spec (absorbed into sovereign layer)
> **Status:** SPECIFICATION · Pending 888 ratification

---

## 0. DOCTRINE

```
Composio is a cloud actuator.
A-FORGE is a sovereign actuator.

Copy the interface. Reject the custody.
Reference the schema. Build the connector.
```

**The ILMU lesson applied:** ILMU claimed "sovereign AI" but was a locked fine-tune. Composio claims "your tools" but hosts your OAuth tokens. APA inverts both: sovereign protocols, constitutional governance, self-hosted auth, immutable audit.

---

## 1. WHAT APA IS

The **Autonomous Protocol for Applications** is the constitutional replacement for OAuth-based SaaS tool integration.

| Layer | Composio | APA |
|-------|----------|-----|
| **Tool schemas** | 1,000+ in their cloud | Defined locally, referenced from their catalog |
| **Auth** | OAuth2 tokens in Composio cloud | `forge_lease` + direct credentials |
| **Interface** | MCP via their cloud proxy | MCP via A-FORGE port 7072 |
| **Governance** | Their SOC 2 policy | F1-F13 constitutional floors |
| **Audit** | Their logs | VAULT999 immutable ledger |
| **Hosting** | composio.dev cloud | Self-hosted on af-forge VPS |
| **Exit** | Tokens locked in their cloud | All credentials in `/root/.secrets/` |

---

## 2. CONNECTOR MANIFEST FORMAT

Every APA connector declares its shape:

```yaml
connector:
  name: "gmail"
  version: "1.0.0"
  domain: "communication.email"
  protocol: "imap+smtp"
  
  verbs:
    - name: "search"
      action_class: "OBSERVE"
    - name: "read"
      action_class: "OBSERVE"
    - name: "send"
      action_class: "MUTATE"
      irreversible: true
      requires_ack: true
    - name: "draft"
      action_class: "MUTATE"
      irreversible: false
    - name: "list_labels"
      action_class: "OBSERVE"
    - name: "modify_labels"
      action_class: "MUTATE"
      irreversible: false

  lease:
    ttl_seconds: 3600
    scope: ["communication.email"]
    required_for: ["send", "draft", "modify_labels"]

  gates:
    pre_execute: [F1_AMANAH, F2_TRUTH, F8_GENIUS, F13_SOVEREIGN]
    post_execute: [F11_AUDIT, F4_CLARITY]
```

---

## 3. LEASE-BASED AUTH (Replaces OAuth)

```
Agent → forge_lease_request(scope, ttl, actor)
     → arif_judge → SEAL → lease_id
     → forge_email(mode="send", ..., lease_id=...)
     → reads credentials from /root/.secrets/email/gmail.json
     → SMTP send → VAULT999 receipt
```

Credentials never leave the VPS. Lease proves authority. Credentials are transport.

---

## 4. CONSTITUTIONAL FLOOR ALIGNMENT

| Floor | APA Obligation |
|-------|---------------|
| **F1 AMANAH** | MUTATE verbs require `ack_irreversible` + lease |
| **F2 TRUTH** | Label all results OBS/DER/INT |
| **F4 CLARITY** | ΔS ≤ 0 — no orphan drafts, no half-sent emails |
| **F7 HUMILITY** | Confidence cap 0.90 on search/read |
| **F8 GENIUS** | IMAP/SMTP, not Gmail API (no extra deps) |
| **F9 ANTI-HANTU** | Verify SMTP 250 OK before claiming sent |
| **F11 AUDIT** | Every call → VAULT999 receipt |
| **F13 SOVEREIGN** | Arif can override any gate |

---

## 5. MCP TOOL INTERFACE

```
Tool: forge_{connector_name}
Mode dispatch selects verb:

  forge_email(mode="search", query="from:arif")
  forge_email(mode="read", email_id="12345")  
  forge_email(mode="send", to="...", subject="...", body="...")
```

**Standard response envelope:**
- `ok`, `connector`, `verb`, `verdict`
- `evidence_tag` (OBS/DER/INT)
- `confidence` (capped 0.90)
- `receipt` (vault_entry_id, timestamp, sha256)
- `latency_ms`, `protocol`

---

## 6. COMPARISON: Composio vs SCS

| Dimension | Composio | APA |
|-----------|----------|-----|
| **Auth** | OAuth2 in their cloud | `forge_lease` + local credentials |
| **Breach impact** | May 2026: 100 toolkits revoked | Zero — tokens never leave VPS |
| **Protocol** | Gmail API (proprietary) | IMAP/SMTP (RFC standard) |
| **Provider** | Gmail-only (OAuth scoped) | Any IMAP provider |
| **Governance** | Their SOC 2 | F1-F13 floors |
| **Audit** | Their logs | VAULT999, forever |
| **Cost** | Free → $29/mo | $0 — Python stdlib |
| **Exit** | Locked | Switch providers anytime |

---

## 7. ROADMAP

| # | Connector | Protocol | Priority | Time |
|---|-----------|----------|----------|------|
| 1 | `forge_email` | IMAP/SMTP | P0 | 1 day |
| 2 | `forge_calendar` | CalDAV | P1 | 2 days |
| 3 | `forge_document` | pandoc+weasyprint | P1 | 2 hours |
| 4 | `forge_remind` | cron+Hermes | P2 | 1 day |
| 5 | `forge_drive` | WebDAV/rclone | P3 | 2 days |

---

## 8. THE COMPOSIO RELATIONSHIP

**Reference catalog, not dependency.**

- **Use:** Their toolkit list. Their schema shapes.
- **Reject:** Their cloud. Their OAuth. Their audit.
- **Keep:** `composio-proxy.mjs` as fallback for unbuilt connectors.

---

## 9. IMPLEMENTATION PRINCIPLES

1. **Protocol over API.** IMAP > Gmail API. CalDAV > Google Calendar API.
2. **Stdlib over dependencies.** `imaplib`, `smtplib`, `email` are stdlib.
3. **Credentials in `/root/.secrets/`, never in code.**
4. **Every verb gates through arifOS.** No direct external call without lease.
5. **VAULT999 or it didn't happen.** Every MUTATE writes receipt.

---

*DITEMPA BUKAN DIBERI — Sovereignty is forged, not imported.*
*APA v1.0 · 2026-07-09 · FORGE (000Ω) for Arif (F13)*
