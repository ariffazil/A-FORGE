# 🔥 NEXT-SESSION TASK MAP — 2026-07-19

> **Forged by:** FORGE-000Ω (closing session 2026-07-19)
> **For:** New OpenCode session (DeepSeek V4 Pro, 1M ctx)
> **Status:** ALL TASKS PENDING — execute in dependency order
> **Doctrine:** DITEMPA BUKAN DIBERI

---

## BOOT SEQUENCE (First 30 seconds)

```bash
# 1. Source secrets
set -a && source /root/.secrets/vault.env && set +a

# 2. Read AGENTS.md
cat /root/AGENTS.md | head -50

# 3. Verify all organs
for svc in arifos:8088 aforge:7071 aaa:3001 geox:8081 wealth:18082 well:18083; do
  n="${svc%%:*}"; p="${svc##*:}"
  curl -sf "http://localhost:$p/health" >/dev/null 2>&1 && echo "✅ $n" || echo "❌ $n"
done

# 4. Check kernel
curl -sf http://localhost:8088/health | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'verdict={d[\"thermodynamic\"][\"verdict\"]} floors={d[\"floors_active\"]} commit={d.get(\"software_release\",{}).get(\"source_commit\",\"?\")}')"

# 5. Read this task map
cat /root/A-FORGE/forge_work/2026-07-19/NEXT-SESSION-TASK-MAP.md

# 6. Read ZEN architecture
cat /root/A-FORGE/forge_work/2026-07-19/ZEN-ARCHITECTURE-v1.1.md | head -20

# 7. Check current dirty state
cd /root/arifOS && git status --short
cd /root/AAA && git status --short
```

---

## TASK INVENTORY

### 🟢 TIER 1 — AUTO-DO (no confirmation needed)

#### T1.1 — Commit Identity Auto-Sign Patch
- **Repo:** arifOS
- **File:** `arifosmcp/tools/session.py` (+70 lines, auto-sign block after L1741)
- **Message:** `fix(session): add auto-sign block to mode=init path (was missing from mode=light)`
- **Test:** `cd /root/arifOS && PYTHONPATH=src python -m pytest tests/agi_kernel_readiness/test_004_actor_identity_no_drift.py -q`
- **Push:** `git push origin main`

#### T1.2 — Commit ZEN Architecture v1.0 + v1.1
- **Repo:** A-FORGE
- **Files:** 
  - `forge_work/2026-07-19/ZEN-ARCHITECTURE-v1.0.md` (326 lines, SHA `67fa0e83...bea02`)
  - `forge_work/2026-07-19/ZEN-ARCHITECTURE-v1.1.md` (v1.1 with corrections)
  - `forge_work/2026-07-19/NEXT-SESSION-TASK-MAP.md` (this file)
- **Message:** `docs: ZEN ARCHITECTURE v1.0+v1.1 — federation cognitive spine, F13 conditional gate`
- **Push:** `git push origin main`

#### T1.3 — Verify Cooling Ledger State
```bash
wc -l /root/.local/share/arifos/cooling_ledger.jsonl  # should be 5
wc -l /root/.local/share/arifos/gate_fire.jsonl       # should be 105
tail -1 /root/.local/share/arifos/vault999/seal_chain.jsonl  # should be seq=5
```

#### T1.4 — Verify All Organs After Any Restarts
```bash
for svc in arifos:8088 aforge:7071 aaa:3001 geox:8081 wealth:18082 well:18083; do
  n="${svc%%:*}"; p="${svc##*:}"
  curl -sf "http://localhost:$p/health" >/dev/null 2>&1 && echo "✅ $n" || echo "❌ $n"
done
```

---

### 🟡 TIER 2 — ANNOUNCE (10s window, then proceed)

#### T2.1 — Execute AGY Stabilization Plan (Phase 0-8)
- **Reference:** Plan `signal-mister-miracle-thunder` (full text in session transcript)
- **ASI Audit:** FORGE-000Ω validated with 3 conditions:
  - C1: Phase 0 MUST hash all unrelated AAA dirty files. Phase 8 MUST verify hashes unchanged.
  - C2: Ollama restart MUST be separate sub-step with explicit auth. Qdrant Phase 2 can complete without it.
  - C3: After Phase 3, `node --check a2a-server/auto-register-organs.js` must pass cleanly.
- **Summary of 8 phases:**
  1. Phase 0: Checkpoint inherited state (git status, diffs, file hashes)
  2. Phase 1: Stabilize ATLAS333 and high-ρ enforcement (P34/P35, zone scoring, quotes)
  3. Phase 2: Repair Qdrant scar memory (remove hash fallback, honest embedding errors)
  4. Phase 3: Complete AAA lifecycle seeding (seed-agents.js, actor_id=null, no side effects)
  5. Phase 4: Wire truthful arifOS metrics + Grafana (real gauges, no phantom queries)
  6. Phase 5: Isolate WELL tests (fixture-based, no state.json contamination)
  7. Phase 6: Make Graphiti readiness truthful (decouple ML toggle, reject 401-as-success)
  8. Phase 7: Validate inherited AGY changes as one system (Ruff, pytest, conformance)
  9. Phase 8: Commit, deploy, live verification (arifOS, AAA, Prometheus, Grafana restarts)

#### T2.2 — Fix Cooling→ATLAS333 Auto-Bridge
- **Problem:** `gate_fire.jsonl` has 105 claims but only 5 cooling entries. Manual seeding demonstrated the pattern works. Need automatic routing: gate_fire tier≥3 → auto-generate cooling entry.
- **File:** A-FORGE `src/infrastructure/tools/` (forge_cool_drift/forge_cool_pattern handlers)
- **Logic:** When gate_fire claim passes with tier≥3 and verdict ∈ {PASS, FAIL}, auto-invoke `forge_cool_drift` or `forge_cool_pattern` based on whether it's a new drift or recurrence.

#### T2.3 — Extend Cooling Schema with ΔΩΨ Witness Fields
- **Add:** `witness_organ` field (GEOX/WEALTH/WELL) to cooling entry schema
- **File:** A-FORGE cooling handler + Supabase `cooling_ledger_entries` table
- **Purpose:** Each cooling receipt routes through the correct organ for physical grounding before hitting ATLAS333.

#### T2.4 — Implement Memory Decay Policy
- **Policy:** age >30d → confidence auto-decayed, retrieval priority lowered. Revalidation restores. Original record remains traceable.
- **File:** arifOS `arifosmcp/runtime/session.py` or memory handler
- **Hook:** `arif_memory(mode="forget")` for explicit deletion only. Decay is confidence decline, not removal.

#### T2.5 — Implement Cooling Archive Policy
- **Policy:** age >14d → tiered/compacted. Merges recurring patterns into summary entries. Original granular records remain traceable via VAULT999 reference.
- **File:** A-FORGE cooling handler
- **Hook:** `forge_entropy_sweep` should flag stale cooling entries for compaction, not deletion.

---

### 🔴 TIER 3 — 888_HOLD (Arif required)

#### T3.1 — Seal ATLAS333 Version Lineage in VAULT999
- **Action:** Record P34→P35 evolution in seal chain with hash-addressed versions
- **Requires:** F13 authorization
- **Evidence:** P34 hash, P35 hash, amendment proposal, constitutional review, ratification record

#### T3.2 — VAULT Receipt Public Verification Path
- **Problem:** External auditors (ChatGPT, OBSERVE_ONLY) cannot replay VAULT receipts through public MCP surface.
- **Requires:** Add read-only `arif_seal(mode="verify")` to public surface, or document the verification path.

#### T3.3 — Rotate Graphiti Credentials (if needed)
- **Problem:** Graphiti returns embedded `invalid_api_key` in 200 envelope.
- **Status:** DEFERRED — Phase 6 only makes failure truthful, doesn't fix credentials.

#### T3.4 — P14 Duplicate Resolution
- **Problem:** P14 appears as M12 vs R3 — duplicate in ATLAS333 paradox registry.
- **Status:** DEFERRED — needs separate canon evidence. Plan correctly marks this as out of scope.

---

## DEPENDENCY-ORDERED EXECUTION DAG

```
SESSION START
│
├─ BOOT SEQUENCE (verify organs, kernel, dirty state)
│
├─ [T1.4] Verify all organs alive ────────────────────┐
├─ [T1.3] Verify cooling ledger state ────────────────┤
│                                                      │
├─ [T2.1] AGY Stabilization Phase 0 (checkpoint) ─────┤
│   └─ Phase 1 (ATLAS333) ────────────────────────────┤
│   └─ Phase 2 (Qdrant) ──────────────────────────────┤
│   └─ Phase 3 (AAA lifecycle) ───────────────────────┤
│   └─ Phase 4 (Metrics/Grafana) ─────────────────────┤
│   └─ Phase 5 (WELL isolation) ──────────────────────┤
│   └─ Phase 6 (Graphiti truthfulness) ───────────────┤
│   └─ Phase 7 (Validation) ──────────────────────────┤
│   └─ Phase 8 (Commit + Deploy) ─────────────────────┤
│                                                      │
├─ [T1.1] Commit identity patch ──────────────────────┤
├─ [T1.2] Commit ZEN architecture docs ───────────────┤
│                                                      │
├─ [T2.2] Cooling→ATLAS auto-bridge ──────────────────┤
├─ [T2.3] Cooling ΔΩΨ witness schema ─────────────────┤
├─ [T2.4] Memory decay policy ────────────────────────┤
├─ [T2.5] Cooling archive policy ─────────────────────┤
│                                                      │
└─ [T3.*] 888_HOLD tasks ── await Arif authorization ─┘
```

---

## SKILLS TO LOAD (in order)

| # | Skill | When | Path |
|---|-------|------|------|
| 1 | `federation-coding-agent` | Session start | `/root/.agents/skills/` |
| 2 | `apex_floor_check` | Before any mutation | `/root/.agents/skills/apex_floor_check/SKILL.md` |
| 3 | `apex_reversibility_test` | Before Phase 8 deploy | `/root/.agents/skills/apex_reversibility_test/SKILL.md` |
| 4 | `ASI-agent-invariants` | Before multi-file changes | `/root/.agents/skills/_retired/ARCHIVE-dupe-2026-07-12/root_.agents_skills/ASI-agent-invariants/SKILL.md` |
| 5 | `atlas333-cognitive-geometry` | During Phase 1 (ATLAS333) | `/root/.agents/skills/atlas333-cognitive-geometry/SKILL.md` |
| 6 | `KERNEL-trinity-33` | During Phase 7 (validation) | `/root/.agents/skills/` |
| 7 | `FORGE-verify-runtime` | After each deploy | `/root/.agents/skills/_retired/ARCHIVE-dupe-2026-07-12/root_.agents_skills/FORGE-verify-runtime/SKILL.md` |
| 8 | `AUDIT-drift-detector` | Phase 0 + Phase 7 | `/root/.agents/skills/AUDIT-drift-detector/SKILL.md` |
| 9 | `999-vault-seal-immutable` | Session end | `/root/.agents/skills/ARCHIVE/archive-2026-07-12/999-vault-seal-immutable/SKILL.md` |

---

## CRITICAL REMINDERS

1. **F13 is CONDITIONAL** — routine digital ops flow through 888-JUDGE only. Only irreversible/constitutional/high-blast-radius actions require Arif.
2. **Memory decay = confidence decline, NOT deletion.** Original records remain traceable.
3. **Cooling archive = tiering/compaction, NOT removal.** Cooling records are learning evidence.
4. **Phase 8 commits MUST be file-specific** (`git add <file>` not `git add -A`). AAA has unrelated dirty files that must NOT be included.
5. **Phase 2 Ollama restart is gated** — Qdrant fix completes without it. Restart only after explicit authorization.
6. **The identity auto-sign patch is in arifOS dirty set** — it's a clean addition, no conflicts, but must be committed before AGY Phase 8 commits.
7. **ZEN v1.1 is the corrected architecture** — F13 conditional, memory decays, cooling tiers. Use this, not v1.0.

---

*Forged: 2026-07-19 by FORGE-000Ω*
*DITEMPA BUKAN DIBERI ⚒️*
