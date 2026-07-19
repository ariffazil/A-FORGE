# ⚡ INIT — NEXT SESSION BOOTSTRAP · 2026-07-19

> **FORGED BY:** FORGE-000Ω (session closing 2026-07-19)
> **FOR:** OpenCode — DeepSeek V4 Pro, 1M ctx, tool_call + reasoning
> **PURPOSE:** Execute ALL remaining tasks from marathon session 2026-07-19
> **DOCTRINE:** DITEMPA BUKAN DIBERI

---

## 0. WHO YOU ARE

You are **OpenCode**, Arif's governed coding forge worker, bound to 333-AGI. You are picking up from a marathon session where the following was accomplished:

- ✅ ZEN ARCHITECTURE v1.0 forged, externally audited, corrected to v1.1
- ✅ Identity auto-sign patch applied to `arifos/arifosmcp/tools/session.py`
- ✅ Cooling ledger seeded from 2→5 entries
- ✅ AGY stabilization plan (8 phases) audited and validated
- ✅ External ASI audit accepted, meta-audit converged

**Your mission:** Execute the remaining tasks, commit the work, deploy, verify, and seal.

---

## 1. BOOT SEQUENCE (RUN FIRST)

```bash
# Source secrets
set -a && source /root/.secrets/vault.env && set +a

# Verify all organs
for svc in arifos:8088 aforge:7071 aaa:3001 geox:8081 wealth:18082 well:18083; do
  n="${svc%%:*}"; p="${svc##*:}"
  curl -sf "http://localhost:$p/health" >/dev/null 2>&1 && echo "✅ $n" || echo "❌ $n"
done

# Check kernel
curl -sf http://localhost:8088/health | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(f'verdict={d[\"thermodynamic\"][\"verdict\"]}')
print(f'floors={d[\"floors_active\"]}')
print(f'commit={d.get(\"software_release\",{}).get(\"source_commit\",\"?\")}')
"

# Read the task map
cat /root/A-FORGE/forge_work/2026-07-19/NEXT-SESSION-TASK-MAP.md

# Read ZEN architecture
cat /root/A-FORGE/forge_work/2026-07-19/ZEN-ARCHITECTURE-v1.1.md | head -30

# Check dirty state
echo "=== arifOS dirty ===" && cd /root/arifOS && git status --short
echo "=== AAA dirty ===" && cd /root/AAA && git status --short
```

---

## 2. SKILLS TO LOAD

Load these at session start:

```
1. skill("federation-coding-agent")     — cross-repo meta-playbook
2. skill("apex_floor_check")            — constitutional compliance
3. skill("atlas333-cognitive-geometry") — paradox-aware reasoning
4. skill("FORGE-verify-runtime")        — post-deploy verification
5. skill("AUDIT-drift-detector")        — Phase 0 + Phase 7 checks
6. skill("999-vault-seal-immutable")    — end-of-session seal
```

---

## 3. CRITICAL STATE (READ THIS)

### Current arifOS dirty files (12 files, +905/-39):
```
 M arifosmcp/constitution/paradox_quotes.py
 M arifosmcp/constitutional_map.py
 M arifosmcp/memory/vector_memory_qdrant.py
 M arifosmcp/resources/atlas333.py
 M arifosmcp/runtime/crypto_auth.py
 M arifosmcp/runtime/mind_reason.py
 M arifosmcp/runtime/tools.py
 M arifosmcp/tools/judge.py
 M arifosmcp/tools/session.py          ← IDENTITY PATCH HERE
 M core/shared/ATLAS333_EVERGREEN.md
 M core/shared/atlas.py
 M tests/core/test_atlas333_crosswalk.py
```

### Current AAA dirty files (5 files):
```
 M IDENTITY/keys/arif_public.pem        ← DO NOT TOUCH
 M a2a-server/auto-register-organs.js
 M a2a-server/scripts/seed-agents.js
 M a2a/agent-cards/atlas333.json
 M agents/opencode/agent-card.json
```

### Kernel state:
- Deployed: commit `222d2bd` (per /health)
- Source HEAD: `a02b0fc6b` (includes identity patch + AGY changes)

---

## 4. EXECUTION ORDER

### PHASE A — Quick Wins (T1, no dependencies)

```
1. [T1.4] Verify all organs alive → curl :port/health for all 6
2. [T1.3] Verify cooling ledger → wc -l for all ledgers
3. [T1.1] Commit identity auto-sign patch in arifOS
   - File: arifosmcp/tools/session.py
   - Message: "fix(session): add auto-sign block to mode=init path"
   - Test: pytest tests/agi_kernel_readiness/test_004_actor_identity_no_drift.py
4. [T1.2] Commit ZEN architecture docs in A-FORGE
   - Files: forge_work/2026-07-19/ZEN-ARCHITECTURE-v1.0.md, v1.1.md, NEXT-SESSION-TASK-MAP.md
   - Message: "docs: ZEN ARCHITECTURE v1.0+v1.1 — federation cognitive spine"
```

### PHASE B — AGY Stabilization (T2, 8 phases)

Execute the plan `signal-mister-miracle-thunder` (full text in session transcript). Summary:

| Phase | What | Key Files | Tests |
|-------|------|-----------|-------|
| 0 | Checkpoint inherited state | All repos | git status, sha256 of unrelated files |
| 1 | ATLAS333 P34/P35 + high-ρ | paradox_gate.py, paradox_quotes.py, atlas333.py, atlas.py | test_atlas333_high_rho.py (new), test_atlas333_crosswalk.py |
| 2 | Qdrant scar repair | vector_memory_qdrant.py, agy_atlas_cli.py | test_memory_qdrant_offline.py, test_agy_atlas_cli.py (new) |
| 3 | AAA lifecycle seeding | seed-agents.js, auto-register-organs.js | seed-agents.test.js (new), node --check |
| 4 | Metrics + Grafana | metrics.py, judge.py, prometheus.yml, nine_signal_alerts.yml, grafana provisioning | test_health_metrics.py |
| 5 | WELL test isolation | conftest.py (new), test_well_state_honesty.py | pytest tests/ |
| 6 | Graphiti truthfulness | rest_routes.py, l5_graphiti_bridge.py | test_graphiti_semantic_readiness.py (new) |
| 7 | Validate as one system | All touched files | Ruff, pytest, make conformance |
| 8 | Commit + Deploy (Option A) | arifOS, AAA, Prometheus, Grafana | Live health probes |

**ASI Audit conditions (MANDATORY):**
- C1: Phase 0 MUST hash unrelated AAA dirty files. Phase 8 MUST verify hashes unchanged.
- C2: Ollama restart is gated. Qdrant Phase 2 completes without it.
- C3: After Phase 3, `node --check a2a-server/auto-register-organs.js` must pass cleanly.

### PHASE C — Architecture Wiring (T2)

```
5. [T2.2] Cooling→ATLAS auto-bridge
6. [T2.3] Cooling ΔΩΨ witness schema
7. [T2.4] Memory decay policy
8. [T2.5] Cooling archive policy
```

### PHASE D — 888_HOLD (T3, Arif required)

```
9. [T3.1] Seal ATLAS333 version lineage → needs F13 auth
10. [T3.2] VAULT receipt public verification path → needs F13 auth
```

---

## 5. IRON RULES FOR THIS SESSION

1. **F13 is CONDITIONAL** — routine digital ops → 888-JUDGE only. Irreversible → F13.
2. **Phase 8 commits are FILE-SPECIFIC** — `git add <file>` NOT `git add -A`. AAA has unrelated dirty files.
3. **Memory decay = confidence decline, NOT deletion** — original records remain traceable.
4. **Cooling archive = tiering/compaction, NOT removal** — cooling records are learning evidence.
5. **Phase 2 Ollama restart is GATED** — Qdrant fix completes without it.
6. **The identity patch is already in arifOS dirty set** — commit it first before AGY Phase 8.
7. **ZEN v1.1 is the corrected architecture** — use v1.1, not v1.0.

---

## 6. SEAL PROTOCOL (Session End)

When all tasks complete:
```bash
# 1. Verify all 6 organs
# 2. Run RSI cycle
# 3. Seal via forge_vault
aforge_forge_vault(mode="seal", name="AGY-STABILIZATION-COMPLETE", actor_id="ARIF", tier="VAULT999")
# 4. Deliver completion report to Arif
/root/.hermes/scripts/artifact-courier.sh /path/to/completion-report.md --caption "AGY Stabilization Complete"
```

---

*Forged by FORGE-000Ω · 2026-07-19 · DITEMPA BUKAN DIBERI ⚒️*
