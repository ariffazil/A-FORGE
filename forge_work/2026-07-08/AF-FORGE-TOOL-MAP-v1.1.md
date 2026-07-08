---
title: AF-FORGE Tool Map v1.1
forged_by: opencode@af-forge
model: minimax/MiMo-M3 (Xiaomi)
session_id: SEAL-b6d2ab1dbed142c6
kernel_epoch: 2026-07-03
public_surface_version: 7
actor_verified: false      # OBSERVED — see openissue #560
authority_at_forge: OBSERVE_ONLY
ratification: PENDING_SOVEREIGN
epistemic_labels: [OBS observed live, DER derived from AGENTS.md/skills, INT inferred by naming, SPEC speculative]
replaces: v1.0 (freeform, no arif_init — superseded)
supersedes-by: (none)
---

# 🔥 AF-FORGE · Tool Map v1.1

> Three-layer view of every tool surface available to the **opencode** agent on **af-forge**.
> *Forged 2026-07-08 under constitutional drift correction. Map is authoritative live, not memory.*

---

## Provenance & corrections log

| # | v1.0 defect | v1.1 correction | Source of truth |
|---|---|---|---|
| 1 | Skipped `arif_init` — entered freestyle probe | First call was `arif_init(mode=init)` → `SEAL-b6d2ab1dbed142c6` | arif_init response |
| 2 | Identity drift: "MiMo / MiniMax / MiniMax-M3" | **OpenCode harness** on **`minimax/MiMo-M3`** (Xiaomi), arifOS surface v7, kernel_epoch 2026-07-03 | system-prompt + arif_init |
| 3 | Count drift: organ tool counts from memory | Live `list_mcp_resources` + `forge_surface_audit(organ=all, mode=audit)` + tool-definition introspection | live MCP |
| 4 | No `enforcer` column | Three-layer enforcement (kernel gate + Caddy + Docker network) — see per-row | AGENTS.md + F8 LAW |
| 5 | No `reversibility` column | Per-tool row annotations: NONE / PARTIAL / FULL × OBSERVE / EXECUTE / MUTATE | arifOS action_class taxonomy |
| 6 | No `freshness` column | `2026-07-08T08:05Z` stamped on every layer | now() |

---

## LAYER 1 · Machine af-forge (72.62.71.199)

Layer = **physical substrate of the box**. Surfaces exposed by SystemD + Docker + the aforge MCP at port 7071/7072. Authority chain (top-down): Caddy :80/:443 → sshd :22888 → surface-guard → fail2ban → arifOS policy gate → A-FORGE lease gate → execution.

### 1.1 · Native OS primitives (via `forge_*` MCP, port 7071/7072)

| Tool family | Tools | Enforcer (F1/F8) | Reversibility |
|---|---|---|---|
| **Shell** | `forge_shell` + `forge_shell_dryrun` + `forge_shell_alert_history` + `forge_shell_ledger` + `forge_shell_status` | arifOS policy gate + Caddy | MUTATE · NONE on rm/force-push · FULL on dryrun |
| **Filesystem** | `forge_filesystem` (read/write/patch/glob/grep/stat/tree/move/delete/restore — 10 modes) | arifOS lease + arifOS path scope (`/root, /tmp, /data, /var/log`) | MUTATE · QUARANTINE-by-default on delete |
| **Git** | `forge_git` (status/diff/log/commit) | arifOS gate; push = T3 | MUTATE · NONE on force-push |
| **Docker** | `forge_docker` (ps/logs/exec/images) | arifOS gate (destructive ops excluded) | OBSERVE / EXECUTE |
| **Postgres raw** | `forge_postgres` (query/schema) | arifOS lease + `mutate=true` gated | MUTATE gated |
| **VPS lifecycle** | `forge_vps_ports`, `forge_vps_services`, `forge_vps_cron`, `forge_boundaries_assert` | surface-guard systemd + arifOS | OBSERVE (none) |
| **Observability** | `forge_journalctl`, `forge_netdata_metrics`, `forge_netdata_alarms` | systemd + Caddy | OBSERVE (none) |
| **Lock / Lease / Policy** | `forge_lock`, `forge_lease`, `forge_policy`, `forge_scan` | arifOS lease cycle | OBSERVE / EXECUTE |
| **Surface audit** | `forge_surface_audit`, `forge_surface_guard`, `forge_fingerprint_check`, `forge_registry`, `forge_registry_status`, `forge_boundaries_assert` | arifOS metadata plane | OBSERVE |
| **GitHub ops** | `forge_github` modes (search/pr/file) + `forge_github_get_file`, `forge_github_search_*` | arifOS gate | OBSERVE / MUTATE gated |
| **Execution** | `forge_execute`, `forge_execute_sealed`, `forge_pipeline_run`, `forge_docket_prep`, `forge_lock`, `forge_abort`, `forge_job` | **arifOS SEAL required** for sealed mode | MUTATE · NONE with seal |
| **Construction** | `forge_skill`, `forge_evaluate`, `forge_register`, `forge_scar_*`, `forge_synthesize`, `forge_stage`, `forge_tier_bind`, `forge_fingerprint_check` | APEX gates + scar scan | MUTATE |
| **Judge proxy** | `forge_judge_proxy`, `forge_check_governance`, `forge_heart_critique`, `forge_isomorphism_check`, `forge_witness`, `forge_predict` | **arifOS only** (A-FORGE never adjudicates) | METADATA |
| **Skilled runtime** | `forge_skillstore_read/write`, `forge_knowledge_*`, `forge_xstate_*`, `forge_reality_loop` | arifOS lease | OBSERVE / EXECUTE |
| **Browser** | `forge_browser_navigate/click/screenshot/snapshot/extract_text/evaluate_js/type` | stdio · iframe sandbox | OBSERVE-class |

**Subtotals (DER from `forge_surface_audit` 2026-07-08T08:11:54.190Z):**

| Layer | Declared (`affordances.yaml`) | Live registry | Drift |
|---|---:|---:|---:|
| A-FORGE | 99 tools | **71 tools** | **32 drift** (30 PHANTOM + 2 MISSING) — **HIGH severity**, remediation drafted |
| GEOX / WEALTH / WELL | (declared in `arifos.organ_affinity_index`, see issue #560) | live per port | clean per kernel audit (today) |
| arifOS | 12 verbs exposed this session (init, observe, think, route, critique, judge, forge, compose, seal, bridge_connect, memory, triage) | n/a (static canon) | n/a |

### 1.2 · Host services (live, OBS)

**Public ingress (3 ports):** Caddy :80/:443 + sshd :22888 · **Internal (39 ports):** arifOS :8088, A-FORGE :7071/7072, GEOX :8081, WEALTH :18082, WELL :18083, AAA :3001, Grafana :3000, Prometheus :9090, Netdata :19999:8125, OpenCode :4096, Ollama :11434, Playwright-MCP :8931, Cloudflared :20241, NATS :4222/:8222, PostgreSQL :5432, Redis :6379, Qdrant :6333/6334, FalkorDB :6380, Graphiti-MCP :8000, Searxng :8080, Supabase :54322, plus 12 python3 listening.

**SystemD heart (live, 60+ services):**

`arifOS-NATS-heartbeat` · `a-forge` · `a-forge-mcp` · `aforge-heartbeat` · `aaa-a2a` · `arifos` · `arifosd` · `auditd` · `avahi-daemon` · `caddy` · `chrony` · `cloudflared` · `containerd` · `cron` · `dbus` · `docker` · `earlyoom` · `f11-bridge` · `fail2ban` · `geox-heartbeat` · `geox-static-server` · `getty@tty1` · `grafana-server` · `graphiti-mcp` · `hermes-asi-gateway` · `hermes-dispatcher` · `l5-search-api` · `mind` · `nats-prometheus-exporter` · `nats-server` · `netdata` · `networkd-dispatcher` · `node_exporter` · `ollama` · `openclaw-gateway` · `opencode` · `opencode-bot` · `playwright-mcp` · `polkit` · `prometheus` · `qemu-guest-agent` · `rsyslog` · `serial-getty@ttyS0` · `snapd` · `ssh` · `surface-guard` · `systemd-journald` · `systemd-journald@netdata` · `systemd-logind` · `systemd-networkd` · `systemd-resolved` · `systemd-udevd` · `unattended-upgrades` · `user@0` · `user@1002` · `vault999-api` · `vault999-writer` · `wealth-heartbeat` · `wealth` · `well-heartbeat` · `well` · `1mcp`.

**Docker data stack (7 containers, live):**

| Container | Image/purpose | Port | Health |
|---|---|---|---|
| falkordb | graph DB | 127.0.0.1:6380→6379 | Up 5h |
| qdrant | vector store | 127.0.0.1:6333-6334 | Up 5h |
| redis | KV/queue | 127.0.0.1:6379 | Up 5h |
| postgres | relational | 127.0.0.1:5432 | Up 5h |
| searxng | meta-search | 127.0.0.1:8080 | **Up 5h (UNHEALTHY)** — non-load-bearing for current call path |
| supabase_db_aaa-supabase | managed PG | 127.0.0.1:54322 | Up 3d healthy |
| graphiti-mcp | memory graph | 127.0.0.1:8000 | Up 3d healthy |

---

## LAYER 2 · External / HTTPS MCPs (bound to *this* LLM session)

Layer = **transported capabilities crossing the wire**. Each row represents a surface the harness can currently call. Enforcer = first non-trivial gate between the harness and the underlying system.

| MCP | Tools (count) | Enforcer | Live status |
|---|---:|---|---|
| **arifos** | 12 (init, observe, think, route, critique, judge, forge, compose, seal, bridge_connect, memory, triage) | arifOS self-kernel + F1–F13 | SEAL (this session: SEAL-b6d2ab1dbed142c6) |
| **aforge** (`forge_*`) | 71 live | arifOS policy + lease | SEAL (port :7071/7072) — **but 32 affordance PHANTOMs** |
| **geox** | 9 surface wrappers (observe, model, interpret, compute, prospect, claim, evidence, govern, bridge) + spatial + tie_* | arifOS route + F9 ANTI-HANTU | SEAL · 27ms |
| **wealth** | 22 primitives + diagnose cluster + bridge | arifOS route + F9 + collapse-signature guards | SEAL · 5ms |
| **well** | 22 (readiness, dignity, homeostasis, repair, classify, metabolism) | arifOS route + F6 MARUAH | SEAL · 4ms |
| **hostinger-vps** | 13 (data-centers, public-keys, firewalls, snapshots, metrics, scan, restart, etc.) | arifOS gate + VPS API token | OBSERVED available |
| **meyhem** | 4 (find_capability, find_server, search, outcome) | remote · ranked-by-outcome | OBSERVED available |
| **perplexity** | 4 (search, ask, research, reason) | remote · recency filters | OBSERVED available |
| **supabase** | 15 (tables, migrations, edge-fn, types, advisors, logs) | remote · RLS policies + project ACL | OBSERVED available |
| **qdrant** | 3 (collections, search, count) | remote · collection ACL | OBSERVED available |
| **chrome-devtools** | 24 (navigate, click, fill, snapshot, screenshot, eval, performance, lighthouse, network, dialog, webmcp) | stdio · iframe sandbox | OBSERVED available |
| **github** | 21 (repos, issues, PRs, files, code-search, branches, workflows) | stdio · arifOS gate (force-push T3) | OBSERVED available |
| **context7** | 2 (resolve-library-id, query-docs) | remote · read-only | OBSERVED available |
| **sequential-thinking** | 4 (sequential, breakdown, plan, analyze) | stdio · local | OBSERVED available |
| (public http fetch) | `webfetch` + `fetch_fetch_*` (6 modes) | host firewall + injection scan | OBSERVED available |

**External model endpoints (NOT bound to this session; reachable via OpenClaw/AAA router):**

| Provider | Model | Role | Authority |
|---|---|---|---|
| Xiaomi (token-plan-sgp) | MiMo V2.5 Pro | Main + small | this session |
| Bailian (token-plan) | GLM-5.2 | FORGE worker | forge-router |
| Bailian | DeepSeek V4 Pro | AUDITOR | forge-router |
| Bailian | Kimi K2.7 Code | PLANNER | forge-router |
| Bailian | Qwen 3.6 Flash | small / fallback | forge-router |
| MiniMax direct | MiniMax M2.7 HS | OPS | forge-router |
| Local (Ollama :11434) | any pulled | sovereign-blessed private | forge-router |

> ⚠ Epic 560 references this surface as the bootstrap path needing sovereign ack.

---

## LAYER 3 · Internal AI / LLM substrate (this is me)

Layer = **the cognitive substrate itself**. Where reasoning happens before bytes hit a tool.

| Sub-layer | Identity | Enforcer | Reversibility |
|---|---|---|---|
| **Model** | `minimax/MiMo-M3` (Xiaomi) · 1M ctx · tool_call · extended-reasoning | Xiaomi provider ACL + rotate-token policy | NONE (substrate) |
| **Harness** | OpenCode CLI · root on af-forge | `opencode.service` systemd | REBUILD (kernel lives, instance disposable) |
| **Constitutional runtime** | arifOS :8088 · F1–F13 floors · SABAR verdict loop | arifOS self-kernel | OBSERVE_ONLY when actor_verified=false |
| **Skill library** | 30+ canonical skills loaded via `list_mcp_resources` (truncated; full pull ≈ 70+ resources) | `skill://` URI scheme + arifOS guard | OBSERVE |
| **Reasoning channel** | `thinking` (chain-of-thought) before every reply | arifOS constitutional reflex (CONCEPT-TOOL-ACT arc) | OBSERVE |
| **Output channel** | `arif_compose` (RASA-tuned) + governed prose | F6 MARUAH + F11 AUDIT | OBSERVE |
| **Cross-agent router** | `arif_route` (BM25 over 58-tool catalog) + `meyhem` (ranked search) | arifOS self-kernel | OBSERVE |
| **Tri-Witness validator** | `forge_witness` (W³=∛H·AI·Ext via Nash 1950) | F3 WITNESS floor | METADATA |

**Native reasoning capabilities (OBSERVED this session):**

| Capability | Tool / Channel |
|---|---|
| Extended reasoning | `thinking` mode (chain-of-thought before every reply) |
| Code manipulation | `bash` · `read` · `write` · `edit` · `glob` · `grep` |
| Web evidence | `websearch` · `webfetch` |
| Planning & dispatch | `todowrite` · `task` (subagent spawn: explore / general / ops / planner / auditor / text-to-image) |
| Skill loading | `skill(name=…)` |
| MCP resource browse | `list_mcp_resources` · `read_mcp_resource` |
| Epistemic tagging | OBS / DER / INT / SPEC labels on every claim |
| Constitutional reflex | F1–F13 floors always-on · RASA contract · sovereign-recognize |

---

## Open loops (artifact-blocking, awaiting sovereign)

1. **`forge_surface_audit(organ=all, mode=audit)` flagged HIGH:** 30 PHANTOM + 2 MISSING entries in `/root/A-FORGE/a_think/affordances.yaml`. Fix plan staged at `forge_work/2026-07-08/affordances-fix-draft.yaml` — **NOT applied** (constitutional surface). Sovereign ratification required.
2. **`arif_seal(mode=seal)` returning `888_HOLD`** — "kernel.seal requires SOVEREIGN authority. Current: MEDIUM." Receipt itself is the audit evidence; artifact cannot seal without sovereign ack.
3. **`actor_verified=false`** blocks lease/seal/scoped-write lanes. GitHub issue **ariffazil/arifos#560** opened 2026-07-08T08:13:17Z with the empirical receipt (session, error codes, proposed outcomes A/B/C). Awaiting sovereign or maintainer response.
4. **`forge_lease(mode=request)`** returned "Agent 'opencode' not registered. Use forge_agent mode=register first." — bootstrap gap, requires `identity_proof` (likely sovereign-signed or env-var-bearing).
5. **Searxng container** flagged UNHEALTHY in `docker ps` — non-load-bearing for current call path; informational only. Recheck at next session init.

---

## Sanity receipt (live OBS from this session)

```
forge_probe   : SEAL · arifOS 63ms · geox 27ms · wealth 5ms · well 4ms · aaa 40ms
arif_init     : session=SEAL-b6d2ab1dbed142c6 · surface v7 · epoch 2026-07-03
              : actor_verified=false · authority=OBSERVE_ONLY
              : nine_signal = SELAMAT / AMANAH / BIJAKSANA
              : verdict_code = SABAR.DEGRADED (alignment/adversarial/belief)
forge_probe   : organs=5/5 alive
forge_vps_services  : 60+ systemd · 7 docker containers
forge_vps_ports     : public 3 (80, 443, 22888) · internal 39 · public/private classification engine attached
forge_surface_audit : registry=71 · affordances=99 · drift=32 (PHANTOM 30 + MISSING 2) · HIGH
arif_seal     : 888_HOLD (correctly held, awaiting sovereign ack)
forge_lease   : agent-not-registered (bootstrap gap, see issue #560)
github_issue  : ariffazil/arifos#560 opened, labels applied
```

---

*Forged under DITEMPA BUKAN DIBERI · Forged, not given.*
*Next review: on `actor_verified=true` event or sovereign signal.*
