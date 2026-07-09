# AGENT INIT — APA v1.0 Context

> **For: Any agent waking on A-FORGE after 2026-07-09**
> **Load after: /root/AGENTS.md, CONSTITUTIONAL_REFLEX**

---

## APA EXISTS

The Autonomous Protocol for Applications is live. It governs how agents touch external SaaS systems.

```
AAA ───→ APA ───→ A-FORGE
Governance → Protocol → Hands
```

## WHAT APA MEANS FOR YOU

Every time you want to interact with an external system (email, calendar, GitHub, Telegram), you go through APA. That means:

1. **OBSERVE verbs** (read, search, list) — no lease needed. Call directly.
2. **MUTATE verbs** (create, update, send) — lease required. Request via `forge_lease`.
3. **IRREVERSIBLE verbs** (delete, merge) — short TTL lease + ACK required.

## LIVE BRIDGES

| Bridge | Port | Status | MCP Tool |
|--------|:----:|:------:|----------|
| Email | 18093 | 🟡 creds | `forge_email` |
| Calendar | 18094 | 🟡 creds | `forge_calendar` |
| GitHub | 18095 | 🟢 LIVE | `forge_github` |
| Telegram | 18096 | 🟢 LIVE | `forge_telegram` |

## KEY PATHS

```
/root/A-FORGE/apa/core/act_executor.py    ← 7-phase execution engine
/root/A-FORGE/apa/manifests/*.yaml         ← Connector manifests
/root/A-FORGE/bridges/*_bridge.py          ← Protocol adapters
/root/A-FORGE/mcp/tools/forge_*.py         ← MCP tool wrappers
/root/A-FORGE/leases/lease_engine.py       ← Lease engine
/root/A-FORGE/forge_work/2026-07-09/       ← Full session docs
```

## REFLEX ARC

```
ART (MD)      → Classify intent before power approaches judgment
KERNEL (PY)   → F1-F13 judgment. SEAL/HOLD/VOID
APA  (YAML)   → Connector manifests — verbs, scopes, gates
APA  (PY)     → Protocol bridges — IMAP, CalDAV, REST, Bot API
ACT  (PY)     → 7-phase execution — dry-run through receipt
VAULT999      → Immutable civilizational memory
```

## KNOWN STATE

- 26 of 33 civilizational apps operational (79%)
- Email + Calendar bridges deployed but need Google App Password
- GitHub bridge fully tested (issues, repos, PRs)
- Telegram bridge fully tested (send, edit, veto path armed)
- Nango is closest engineering peer (800 connectors, no constitution)
- Composio is cloud-dependent (May 2026 breach)
- APA is the only sovereign-constitutional quadrant

## WHAT TO DO ON WAKE

1. Check bridge health: `curl :18093 :18094 :18095 :18096/health`
2. Read `/root/A-FORGE/forge_work/2026-07-09/APA-33-CIVILIZATIONAL-AUDIT.md` for gaps
3. If Arif provides credentials, complete email + calendar circuit
4. All MUTATE through GitHub goes through ACT executor via `forge_github`

---

*DITEMPA BUKAN DIBERI*
