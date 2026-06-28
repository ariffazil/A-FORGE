# SESSION SCAFFOLD — 2026-06-28 → Next Agent
> **Forge:** FORGE (000Ω) · **Session:** AFK-YOLO SABAR
> **Status:** SEALED · **Next agent:** arif_init → read this → continue

---

## YOUR BOOTSTRAP (read first)

```
1. arif_init(mode="light", actor_id="your-agent-name")
2. Read this file: /root/A-FORGE/forge_work/2026-06-28/SESSION-CLOSURE-SCAFFOLD.md
3. Read session state: /root/.claude/projects/-root/memory/session-state.md
4. Reality check: curl 6 organ health endpoints
5. Proceed with P2 tasks below
```

---

## WHAT GOT DONE (you inherit this)

### P0 — Enforcement Spine Wired
| Fix | File | Commit |
|-----|------|--------|
| Interceptor decisions → VAULT999 | `ingress_middleware.py` | 0a2eef495 |
| Forge execution → VAULT999 | `forge.py` | 0a2eef495 |
| actor_verified for known identities | `session.py` + `tools.py` | e292ed9a8 |

### P1 — Guardrails
| Fix | File | Commit |
|-----|------|--------|
| Latency budget on check_laws | `forge.py` | 38c61f915 |
| Conflict resolver before dispatch | `forge.py` | 38c61f915 |

### Repo State
| Repo | HEAD | Dirty |
|------|------|-------|
| arifOS | e292ed9a8 | 0 |
| A-FORGE | bfcf632 | 0 |
| AAA | 19b0ffc8 | 0 |
| WEALTH | 85634b1 | 0 |
| WELL | 88dd088 | 0 |
| geox | 48e48378 | 0 |

### Deployment
- arifOS running from `/opt/arifos/app/` on `main` branch
- Verified: `actor_verified=true` for arif identities
- VAULT999 receipts at `/root/VAULT999/receipts_v2.jsonl`

---

## YOUR TASKS (Priority Order)

### P2-1: GEOX EGS Naming (30 min)
- Rename `egs_*` → `geox_egs_*` in GEOX (13 tools)
- Files: `geox/registry.py`, `geox/mcp_server.py` (or wherever tools are registered)

### P2-2: A-FORGE MCP Tool Listing (1 hr)
- Fix A-FORGE MCP on :7072 to return tool list
- Currently: `tools/list` returns empty

### P2-3: WELL Deprecated Tool (15 min)
- Remove or replace `well_13_signal_coverage` [DEPRECATED]
- Point to replacement: `well_signal_coverage`

### P2-4: Hidden Tool Surface Audit (2-3 hrs)
- GEOX: 31 hidden tools → classify each (canonicalize or delete)
- WELL: 77 autonomic tools → same audit

### P3: Test Tasks
- Test `arif_think` with TokenRouter active
- Verify WELL `assess_homeostasis` returns UNKNOWN on no-telemetry
- Run live traces: `arif_judge` + `geox_claim` + `wealth_emv`

---

## KNOWN ISSUES
- `/opt/arifos/app/` git index is corrupted — use direct file copy if git fails
- Branch was `master`, now switched to `main` — verify after pull
- 888_HOLD findings from security audit are non-blocking (6 findings, known)

---

## KEY PATHS
- MCP surface audit: `/root/A-FORGE/forge_work/2026-06-28/MCP-SURFACE-AUDIT.md`
- Gap documentation: `/root/A-FORGE/forge_work/2026-06-28/FORGE-REMAINING-GAPS.md`
- Session state: `/root/.claude/projects/-root/memory/session-state.md`
- interceptor: `/root/arifOS/arifosmcp/kernel/interceptor.py`
- Vault receipts: `/root/arifOS/arifosmcp/core/vault_receipt.py`
- VAULT999: `/root/VAULT999/receipts_v2.jsonl`

*DITEMPA BUKAN DIBERI — The forge passes the torch.*
