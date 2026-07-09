# APA Forge Resources — What Agents Need to Build Sovereign Connectors

> **Purpose:** Single map of protocols, libraries, **real** codebase paths, OS deps, and agent skills for APA.  
> **Forged:** 2026-07-09 · **Companion:** `APA-AFORGE-ARCHITECTURE-DERIVATION.md`  
> **Rule:** Prefer stdlib + open RFCs. No cloud SDK custody. Secrets only in `/root/.secrets/`.

---

## 0. High-level map (operational)

| Layer | What you need | APA choice (live) |
|-------|---------------|-------------------|
| **Protocols** | IMAP, SMTP, CalDAV, ICS, HTTP/REST, JSON, TLS | RFCs + provider docs |
| **Runtime** | Python bridges + systemd | Python 3.13 host; caldav in `.venv-apa` |
| **Control plane** | Session, lease, floors, audit | arifOS + A-FORGE MCP |
| **Interface (LLM)** | MCP tools + schemas | A-FORGE `:7072` (`serve.ts` / `core.ts` / `proxyTools.ts`) |
| **Security** | Secret storage, capability, logging | `/root/.secrets/`, `forge_lease`, VAULT999 |

---

## 1. Protocols and specs (canonical refs)

| Surface | Spec | Use |
|---------|------|-----|
| IMAP | **RFC 3501** | email search/read |
| SMTP | **RFC 5321** | email send |
| CalDAV | **RFC 4791** | calendar CRUD |
| iCalendar | **RFC 5545** | ICS event bodies |
| HTTP/1.1 | **RFC 7230–7235** | GitHub/Slack/Drive REST |
| JSON | **RFC 8259** | envelopes, manifests |
| TLS | **RFC 8446** (1.3) / 5246 (1.2) | all remote links |

Provider docs (exit-friendly): Gmail IMAP/SMTP, Google CalDAV, GitHub REST API v3, Radicale (self-host CalDAV).

---

## 2. Libraries (minimal)

### 2.1 Python stdlib (prefer)

`imaplib` · `smtplib` · `email` · `ssl` · `json` · `logging` · `hashlib` · `datetime` · `uuid` · `http.server` · `urllib` (zero-dep HTTP if needed)

### 2.2 External (only when necessary)

| Lib | Where | Why |
|-----|-------|-----|
| **caldav** | `/root/A-FORGE/.venv-apa` | CalDAV without reimplementing WebDAV |
| **requests** (optional) | only if added later | REST clients; GitHub bridge may use urllib |

### 2.3 TypeScript (A-FORGE MCP)

Existing MCP SDK + `src/interfaces/mcp/*` — **do not** invent a second MCP server for APA.

---

## 3. Real codebase structure (not fantasy)

Ideal diagrams often invent `mcp/tools/forge_email.py`. **Live tree is:**

```
/root/A-FORGE/
├── scripts/                          # APA bridges (adapters only)
│   ├── email_bridge.py               # :18093 IMAP/SMTP
│   ├── calendar_bridge.py            # :18094 CalDAV
│   └── github_bridge.py              # :18095 REST
├── .venv-apa/                        # caldav isolated venv
├── src/interfaces/mcp/
│   ├── serve.ts                      # HTTP MCP + STATELESS_TOOLS
│   ├── core.ts                       # forge_session_init, etc.
│   ├── forgeTools.ts                 # forge_lease, registry…
│   └── proxyTools.ts                 # forge_github, etc.
├── forge_work/2026-07-09/            # APA design canon
│   ├── APA-v1-AUTONOMOUS-PROTOCOL-FOR-APPLICATIONS.md
│   ├── APA-GMAIL-SOVEREIGN-CONNECTOR.md
│   ├── APA-CALENDAR-SOVEREIGN-CONNECTOR.md
│   ├── APA-GITHUB-SOVEREIGN-CONNECTOR.md
│   ├── APA-AFORGE-ARCHITECTURE-DERIVATION.md
│   ├── APA-FORGE-RESOURCES.md          # THIS FILE
│   └── RESEARCH-COMPOSIO-APA-COMPETITIVE-MAP.md
└── (lease engine lives in A-FORGE TS + arifOS REST — not scripts/leases/)

/etc/systemd/system/
├── apa-email-bridge.service
├── apa-calendar-bridge.service
└── apa-github-bridge.service

/root/.secrets/
├── email/gmail.json                  # IMAP/SMTP app password
├── calendar/google.json              # CalDAV app password
└── env/github-bridge.env             # GITHUB_TOKEN for unit (mode 600)
```

**Mapping ideal → real:**

| Ideal path | Real path |
|------------|-----------|
| `bridges/*.py` | `scripts/*_bridge.py` |
| `mcp/tools/forge_*.py` | TS tools in `src/interfaces/mcp/` |
| `leases/lease_engine.py` | `forge_lease` in `forgeTools.ts` + arifOS mint |
| `vault999/receipts.log` | arifOS VAULT999 + MCP `_meta.chain_hash` |
| `systemd/*.service` | `/etc/systemd/system/apa-*-bridge.service` |

---

## 4. Runtime and OS

| Need | Live |
|------|------|
| OS | Linux VPS + **systemd** |
| Python | 3.13 system; calendar uses **`.venv-apa`** |
| Bind | **127.0.0.1 only** on 18093–18095 |
| Secrets | mode **600** files; agents **never print** values |
| A-FORGE MCP | `:7072` streamable HTTP |

---

## 5. Agent skills (what an agentic coder must load/know)

### 5.1 Conceptual packs (load order)

| Skill / doctrine | Path / load |
|------------------|-------------|
| Governed execution | `/root/.grok/skills/arif-governed-autonomous-execution/SKILL.md` |
| Kernel verbs vs hands | `/root/.grok/skills/kernel-verbs-aforge-hands/SKILL.md` |
| **APA sovereign connector** | `/root/.grok/skills/apa-sovereign-connector/SKILL.md` |
| Architecture derivation | `forge_work/…/APA-AFORGE-ARCHITECTURE-DERIVATION.md` |
| Connector specs | Gmail / Calendar / GitHub APA markdowns |

### 5.2 Capability matrix for coders

| Domain | Must know |
|--------|-----------|
| **Security** | lease = capability; OAuth vs lease; secrets inject-only in bridge |
| **Email** | IMAP search/fetch; SMTP send; MIME; App Password |
| **Calendar** | CalDAV + ICS; `caldav` lib; free/busy gaps |
| **GitHub** | REST v3; PAT scopes; thin verb set (not 846 tools) |
| **MCP** | tool schema; session ownership vs STATELESS OBSERVE; register in TS |
| **Audit** | receipt envelope; hash; never claim VAULT seal without path |

### 5.3 Real tools agents use (not invented names)

| Need | Use this (live) |
|------|-----------------|
| Edit bridges | filesystem + git in `/root/A-FORGE/scripts/` |
| Issue lease | `aforge__forge_lease` / session init |
| GitHub hands | `aforge__forge_github` (+ create_* for MUTATE) |
| Health | `curl 127.0.0.1:1809x/health` |
| MCP surface | `search_tool` then `use_tool` on `aforge__*` |
| Vault inspect | VAULT999 paths under arifOS / AAA seal chain |

Avoid inventing `forge_editor` / `forge_test` until they exist as real tools.

---

## 6. Build checklist for a new APA connector

1. **Manifest** in `forge_work/` (verbs, action_class, lease scopes, gates).  
2. **Bridge** `scripts/<name>_bridge.py` — stdlib-first, localhost HTTP `/health` + `/execute`.  
3. **Secrets path** under `/root/.secrets/<name>/` mode 600 template.  
4. **systemd** `apa-<name>-bridge.service` (127.0.0.1, Restart=on-failure).  
5. **MCP tool** in A-FORGE TS: session/lease gates then proxy to bridge.  
6. **OBSERVE** whitelist only if R0 and no secret exfil (see `serve.ts` STATELESS_TOOLS).  
7. **Smoke:** health → OBSERVE call → MUTATE only with lease + receipt.  
8. **Exit test:** change URL/provider in secret file without code change (CalDAV/IMAP pattern).

---

## 7. Anti-patterns (HARAM for APA coders)

- Cloud OAuth middleman as default auth.  
- Dumping full SaaS catalogs into LLM context.  
- Bridge that judges / seals (judgment is arifOS; execution is A-FORGE).  
- Logging secrets or app passwords.  
- Parallel “ideal” directory trees that drift from `scripts/` + `src/interfaces/mcp/`.

---

## 8. Quick start for agents

```bash
# Health triad
curl -s http://127.0.0.1:18093/health
curl -s http://127.0.0.1:18094/health
curl -s http://127.0.0.1:18095/health

# Design load
# APA-v1 + connector md + APA-AFORGE-ARCHITECTURE-DERIVATION.md + this file

# Session + lease + tool (GitHub example)
# forge_session_init → forge_lease → forge_github
```

---

**DITEMPA BUKAN DIBERI** — resources map reality first, then protocol.
