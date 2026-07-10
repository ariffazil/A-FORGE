# Skill Upgrade — OpenCode Session 2026-07-10

> **DITEMPA BUKAN DIBERI** — Skills forged, not inherited.

## Skills Gained

### 1. Federation README Truth Audit (new)

**Pattern:** Probe live MCP `tools/list` on every organ → cross-reference against README tool counts → fix discrepancies → commit + push.

**Trigger phrases:** "audit README", "verify README claims", "are the READMEs correct"

**Checklist:**
1. `curl -sf http://localhost:<port>/health` for each organ — note `tool_count`
2. Read each repo's `README.md` — grep for tool counts, version tags, URLs
3. Compare live vs claimed — flag any mismatch
4. Fix all discrepancies with precise edits
5. Commit with `docs:` prefix, push with forge gate

**Common failure modes:**
- Tool counts go stale when tools are added/removed but README isn't updated
- Version tags stick at old release dates
- URL case mismatches (GitHub repos are case-sensitive)
- README files missing from local disk (present on GitHub only)

**This session's haul:** 15 discrepancies across 7 repos. arifOS "12 canonical" (reality: 11). A-FORGE triple tool count (49/78/79 → 98). WEALTH 45→50. WELL 22→18.

---

### 2. Federation Gateway Validation Protocol (new)

**Pattern:** A federation gateway claim must be validated against live endpoints, not accepted at face value.

**Trigger phrases:** "validate the gateway", "is the federation gateway real", "audit federation gateway"

**Checklist:**
1. `GET /federation/status` — verify all organs probed, tools/prompts reported
2. `POST /federation/resource` — test each URI scheme: `wealth://`, `arifos://`, `well://`, `geox://`, `forge://`
3. `POST /federation/pipeline` — test a simple chain (e.g., `wealth_compute_npv`)
4. `GET /federation/prompts` — verify all workflow prompts resolve
5. Check server.js for actual route mounting (grep for `federation_gateway`, `federation_prompts`)
6. Note which organs block due to auth/session requirements (not the gateway's fault)

**This session's finding:** Gateway is real and live. Resource proxy works for wealth/arifos/well. GEOX blocked (needs session ID). Pipeline mechanism works but WEALTH blocks due to SESSION_VALIDATOR_UNAVAILABLE.

---

### 3. Identity Drift Resolution Protocol (upgraded)

**Pattern:** When carry_forward.json shows `DRIFT`, regenerate fingerprint baseline and update to `PASS`.

**Checklist:**
1. Check `carry_forward.json` for `identity_drift` field
2. Run `identity-drift-watchdog.sh` to identify drifted files
3. If drift is legitimate (SOT timestamp bumps, minor edits) → regenerate baseline
4. Update `carry_forward.json`: `identity_drift: PASS`, `next_safe_action: PROCEED_OR_SABAR`
5. Verify self-heal cycles show 0 failures

**This session:** 1 file drifted (AGENTS.md — SOT timestamp auto-bump). Baseline regenerated.

---

### 4. Entropy Sweep — Machine Optimization (upgraded)

**Added patterns:**
- `find /root -name "*.log" -mtime +7 -size +10M` — stale large logs
- `docker volume prune -f` — orphan volumes
- `apt-get clean` — APT cache
- `docker system df` — docker disk usage audit
- Git status check on all repos after forge gate (auto-bumped SOT files)

**This session's haul:** 5 stale logs (99MB+), 77MB APT cache, 205B docker volumes, 1 drifted baseline.

---

### 5. Git Forge Gate Push Workflow (new)

**Pattern:** The forge gate (`make push`/pre-push hook) auto-bumps SOT timestamps in AGENTS.md, BOUNDARY.md, README.md. These create local modifications that need a second commit + push.

**Checklist:**
1. Commit intended changes → `git push` triggers forge gate
2. Forge gate bumps SOT timestamps, runs security audit, cleans temp files
3. Post-push: `git status` shows dirty files (auto-bumped SOT)
4. `git add -A && git commit -m "chore: forge gate auto-bump SOT timestamps"`
5. `git push` again to clean state

---

## Skills Still Needed (Gaps)

| Gap | Description | Proposed Skill |
|-----|-------------|---------------|
| G1 | Cross-organ session continuity | `federation-session-handoff` — propagate session tokens across organ pipelines |
| G2 | MCP auth bridge | `mcp-session-bridge` — arifOS-issued session tokens recognized by all organs |
| G3 | Pipeline atomicity | `pipeline-atomic-executor` — all-or-nothing cross-organ execution with rollback |

---

## Agent-Card Update

**New capabilities to register:**
- `README-audit-protocol` — cross-reference live probes against static claims
- `federation-gateway-validation` — multi-endpoint gateway audit pattern
- `drift-resolution-protocol` — baseline regeneration + carry_forward update
- `forge-gate-workflow` — two-phase commit for forge gate pushes

*Forged: 2026-07-10 by FORGE (000Ω) under F13 SOVEREIGN directive*
