# APA Substrate Audit — ART → KERNEL → APA → ACT

> **Audit:** FORGE (000Ω) · **Date:** 2026-07-09 · **Sovereign:** Arif (F13)
> **Framework:** Constitutional Reflex Arc substrate mapping

---

## 0. THE MAPPING (what should exist)

| Layer | Substrate | Role | Semantic |
|-------|-----------|------|----------|
| **ART** | MD | Intent classification doctrine | Law, not logic |
| **KERNEL** | PY | Executable F1-F13 physics | Deterministic, testable |
| **APA** | MD + YAML + PY | Protocol: spec + manifest + bridge | Declarative + executable |
| **ACT** | PY | 7-phase execution discipline | Governed mutation |
| **Schemas** | JSON | Machine validation | Tool contracts |
| **Constitution** | MD | F1-F13 source of truth | Immutable law |

---

## 1. WHAT EXISTS (audit against mapping)

| Layer | Expected | Actual | Status |
|-------|----------|--------|:------:|
| **ART** | `ART-CLASSIFICATION.md` | `/root/.agents/skills/CONSTITUTIONAL_REFLEX/SKILL.md` (510 lines, MD) | ✅ EXISTS |
| **KERNEL** | `kernel/floors.py`, `kernel/judge.py`, `kernel/lease_engine.py` | `/root/A-FORGE/leases/lease_engine.py` (120 lines, PY) | ⚠️ PARTIAL |
| | | arifOS kernel handles floors + judge on :8088 | ✅ EXISTS |
| **APA Spec** | `APA-v1-AUTONOMOUS-PROTOCOL.md` | `/root/A-FORGE/forge_work/2026-07-09/APA-v1-AUTONOMOUS-PROTOCOL-FOR-APPLICATIONS.md` | ✅ EXISTS |
| **APA Manifest** | `APA-GITHUB-MANIFEST.yaml` | **MISSING** | ❌ GAP |
| | `APA-GMAIL-MANIFEST.yaml` | **MISSING** | ❌ GAP |
| | `APA-CALENDAR-MANIFEST.yaml` | **MISSING** | ❌ GAP |
| **APA Bridge** | `bridges/github_bridge.py` | `/root/A-FORGE/bridges/github_bridge.py` (247 lines) | ✅ EXISTS |
| | `bridges/email_bridge.py` | `/root/A-FORGE/bridges/email_bridge.py` (211 lines) | ✅ EXISTS |
| | `bridges/calendar_bridge.py` | `/root/A-FORGE/bridges/calendar_bridge.py` (473 lines) | ✅ EXISTS |
| **ACT** | `act/executor.py`, `act/phases.py` | Only in doctrine (CONSTITUTIONAL_REFLEX) | ❌ GAP |
| **Schemas** | `schemas/forge_github_create_issue.json` | Inline in MCP tool wrappers (PY) | ⚠️ HYBRID |
| **Constitution** | `000_CONSTITUTION.md` | `/root/arifOS/static/arifos/theory/000/000_CONSTITUTION.md` | ✅ EXISTS |

---

## 2. GAPS IDENTIFIED

### GAP 1: YAML Manifests (CRITICAL)

Every connector should have a YAML manifest that declares:
- verbs and their action classes
- lease scopes
- blast radius
- F1-F13 gate matrix
- protocol and provider

**Currently:** All this information is embedded in Markdown specs and Python code. No machine-parseable manifest exists.

**Impact:** An agent cannot programmatically discover a connector's capabilities without reading human prose. A new connector cannot be validated against a schema.

### GAP 2: ACT Executor (HIGH)

The 7-phase execution chain (DRY-RUN → SIMULATE → PREFLIGHT → EXECUTE → VERIFY → ROLLBACK → RECEIPT) exists only as doctrine. There is no executable act/ module that enforces these phases.

**Currently:** MCP tool wrappers do basic lease + ACK checks. No dry-run, no simulation, no rollback capability.

**Impact:** Irreversible actions (merge_pr, send email, delete event) have no rehearsal phase before execution.

### GAP 3: Separate JSON Schemas (MEDIUM)

MCP tool schemas are defined inline in Python. Standards-compliant MCP servers expect separate JSON Schema files.

**Currently:** Tool schemas in `forge_github.py` as Python dicts. Works for our MCP server, but not portable.

### GAP 4: Folder Structure (LOW)

Files are scattered across `/root/A-FORGE/scripts/`, `/root/A-FORGE/bridges/`, `/root/A-FORGE/mcp/tools/`, `/root/A-FORGE/leases/`. The mapping suggests a cleaner structure.

---

## 3. CORRECT FOLDER STRUCTURE

```
/root/A-FORGE/
│
├── doctrine/                    ← ART (MD)
│   ├── ART-CLASSIFICATION.md
│   ├── ART-POWER-CLASSES.md
│   └── ART-REFLEX-ARC.md
│
├── kernel/                      ← KERNEL (PY)
│   ├── floors.py               ← F1-F13 enforcement
│   ├── judge.py                ← SEAL/HOLD/VOID verdicts
│   ├── lease_engine.py         ← Capability-based auth (✅ EXISTS)
│   └── vault999.py             ← Receipt anchoring
│
├── apa/                         ← APA (MD + YAML + PY)
│   ├── APA-PROTOCOL.md         ← Protocol spec (✅ EXISTS as APA-v1-...)
│   ├── manifests/              ← YAML manifests ← GAP
│   │   ├── github.yaml
│   │   ├── gmail.yaml
│   │   └── calendar.yaml
│   └── bridges/                ← PY bridges (✅ EXISTS)
│       ├── github_bridge.py
│       ├── email_bridge.py
│       └── calendar_bridge.py
│
├── act/                         ← ACT (PY) ← GAP
│   ├── executor.py             ← 7-phase execution engine
│   ├── phases.py               ← DRY-RUN, SIMULATE, PREFLIGHT, etc.
│   └── rollback.py             ← Reversal logic per verb
│
├── schemas/                     ← Schemas (JSON) ← GAP
│   ├── forge_github_create_issue.json
│   ├── forge_email_send.json
│   └── forge_calendar_create_event.json
│
├── mcp/                         ← MCP tools (PY)
│   └── tools/                   ← LLM-facing tool wrappers (✅ EXISTS)
│       ├── forge_email.py
│       ├── forge_calendar.py
│       └── forge_github.py
│
├── constitution/ → symlink to /root/arifOS/static/arifos/theory/000/
│
└── systemd/                     ← Service files (✅ EXISTS)
    └── apa-bridge@.service
```

---

## 4. PRIORITY — What to Fix First

| # | Gap | Why First | Effort |
|---|-----|-----------|:------:|
| 1 | **YAML Manifests** | Makes connectors machine-discoverable. Validates against APA spec. Enables automated tool registration. | 30 min |
| 2 | **ACT Executor** | Closes the rehearsal gap. IRREVERSIBLE verbs need dry-run before execute. | 1 day |
| 3 | **JSON Schemas** | Standards compliance. Portability. | 30 min |
| 4 | **Folder Reorg** | Clean structure. Symlinks for backward compat. | 30 min |

---

*DITEMPA BUKAN DIBERI — Audit is forged, not assumed.*
