# Eureka Gaps — APA · 2026-07-09

> **F2 labels:** OBS = measured this session · DER = follows from OBS · HYP = plausible, unproven  
> These are gaps that **might be real civilizational bottlenecks**, not a todo dump.

---

## G1 — Bridge green ≠ agent power  **[OBS]**

**Symptom:** Telegram :18096 READY; agents still have no `forge_telegram` MCP tool.  
**Physics:** APA without MCP binding is a localhost daemon, not an agent organ.  
**Why eureka:** Teams celebrate health checks and think the civilization can act.  
**Fix direction:** Every READY bridge must ship the same day as `forge_<name>.py` + lease gate.  
**Score:** High — blocks F13 veto *as APA*, Hermes outbound *as APA*.

---

## G2 — Dual filesystem truth (scripts vs bridges)  **[OBS]**

**Symptom:** email/calendar/github under both `scripts/` and `bridges/`; telegram only under `bridges/`; units point inconsistently.  
**Physics:** Two paths = two futures = silent drift.  
**Why eureka:** Spec said “do not invent parallel trees” while the tree forked anyway.  
**Fix direction:** One canonical dir (`bridges/`), symlink or delete the other; units + skill + docs agree.  
**Score:** High — F4 entropy factory.

---

## G3 — Secrets in systemd Environment=  **[OBS]**

**Symptom:** Telegram token in unit drop-in (visible to `systemctl cat`, journals, accidental agent dumps).  
**Physics:** Custody failure at the iron layer makes all APA lease theatre secondary.  
**Why eureka:** We built “never in LLM” while putting secrets in the most dumpable unit surface.  
**Fix direction:** `EnvironmentFile=-/root/.secrets/env/telegram-bridge.env` mode 600 only; rotate if exposed.  
**Score:** Critical hygiene — do before more verbs.

---

## G4 — Listen vs speak ownership (Hermes ∩ APA)  **[DER]**

**Symptom:** Hermes ASI gateway already owns Telegram ingress; APA owns outbound bot API on same civilization.  
**Physics:** One bot token cannot safely dual long-poll; inbound control path ≠ outbound lease path.  
**Why eureka:** “Telegram bridge” without a listen/speak constitution re-creates split-brain.  
**Fix direction:** Spec already says Hermes listens / APA speaks (Phase-1). Enforce in code + ops. Phase-2: single webhook owner.  
**Score:** High — architectural, not cosmetic.

---

## G5 — Lease engine vs live MCP lease path  **[HYP/DER]**

**Symptom:** `leases/lease_engine.py` and APA docs exist; GitHub MUTATE still depends on A-FORGE `forge_lease` policy — unclear single SOT.  
**Physics:** Two lease brains = agent can pass one and fail the other, or bypass both.  
**Why eureka:** “forge_lease is the capability primitive” only if one enforcement plane is real.  
**Fix direction:** T1 probe: does MCP MUTATE hard-fail without lease? If soft-only on bridge, production `APA_REQUIRE_LEASE_ID=1` everywhere.  
**Score:** Medium-High — truth-seeking before more connectors.

---

## G6 — ACT executor not on the hot path  **[HYP]**

**Symptom:** `apa/core/act_executor.py` (7-phase) exists; bridges may short-circuit DRY_RUN→EXECUTE without calling it.  
**Physics:** Spec theatre if ACT machine is a library nobody imports.  
**Why eureka:** Civilization claims 7-phase ACT while runtime is 1-phase HTTP.  
**Fix direction:** Either bridge calls act_executor, or A-FORGE MCP wraps every MUTATE in act_executor — pick one SOT.  
**Score:** Medium — prove with one GitHub MUTATE trace.

---

## G7 — Δ surface filter not encoded  **[DER]**

**Symptom:** Doctrine “no Slack” lives in prose; tool-creation gate can still spawn non-Δ connectors.  
**Physics:** Agents optimize for completeness (catalog size) not lived sovereignty.  
**Why eureka:** Without a machine check, next agent will forge Notion “because Composio has it.”  
**Fix direction:** Pre-flight in skill + tool-creation-gate: require `delta_surface:` + sovereign ack for new APA connectors.  
**Score:** Medium — prevents entropy explosion.

---

## G8 — Receipt hash without vault append  **[HYP]**

**Symptom:** Envelopes include `result_sha256` / `vault_anchor_material`; unclear who calls seal_chain / arif_seal on MUTATE.  
**Physics:** F11 requires memory, not JSON fields that die in the agent context window.  
**Why eureka:** “Auditability” that never appends is decorative.  
**Fix direction:** One mandatory post-MUTATE hook (A-FORGE or arifOS) that seals hash+lease+verb.  
**Score:** Medium-High for civilizational claims.

---

## G9 — Seal chain CLI witness blind spot  **[OBS → fixed this seal]**

**Symptom:** `seal_chain.js write` ignored `payload.witness` (only `opts.witness`) → SEAL downgraded to HOLD.  
**Physics:** Session seals fail structural INV-3 even when human+AI+external present in payload.  
**Fix installed:** Read witness from `opts` → `payload.witness` → `payload.payload.witness`.  
**Score:** Was High for session sealing; now mitigated — re-verify on next write.

---

## G10 — Email/Calendar credential gap as false “APA complete”  **[OBS]**

**Symptom:** Summary said APA v1.0 forged; two of four connectors cannot touch reality.  
**Physics:** Process up ≠ organ alive.  
**Why eureka:** Status dashboards that count listeners, not credentials, lie upward.  
**Fix direction:** Cockpit/AAA should show READY vs AWAITING_CREDENTIALS as first-class.  
**Score:** Medium — honest ops.

---

## G11 — Human 11 / Agent 11 / Machine 11 not wired to runtime registry  **[HYP]**

**Symptom:** Beautiful 33-surface doctrine; no machine-readable map agents load at boot.  
**Physics:** Next agent re-derives from chat memory and drifts.  
**Fix direction:** Single JSON `delta_agent_machine_33.json` loaded by INIT; APA connectors reference `delta_surface` keys.  
**Score:** Medium — multi-session continuity.

---

## Ranked forge order (if only three moves)

1. **G3** secrets out of systemd + rotate if needed  
2. **G1** `forge_telegram` + manifest (close the green bridge loop)  
3. **G2** single bridge path SOT  

Then G5/G6 (lease+ACT on hot path), G4 (Hermes coexistence), G8 (real seal on MUTATE).

---

*Labels are honesty devices. Re-probe T1 before treating any HYP as law.*
