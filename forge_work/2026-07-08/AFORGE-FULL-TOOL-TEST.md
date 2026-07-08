# A-FORGE Full Tool Test — Reality Actuator Audit

**When:** 2026-07-08 · **MCP:** `http://127.0.0.1:7072/mcp` · **actor_id:** `arif`

## Scoreboard
| Metric | N |
|--------|--:|
| Total tools | 99 |
| Result `403` | 74 |
| Result `ERR` | 2 |
| Result `GATE` | 4 |
| Result `OK` | 19 |
| REALITY_HIGH | 32 |
| REALITY_MED | 1 |
| OBSERVE | 66 |


---

## Live proof (post-rate-limit, via actor_id=arif)

| Proof | Result |
|-------|--------|
| `forge_shell` `touch /tmp/aforge-reality-alive` | SEAL · exit 0 · **MUTATE LOCAL** · seal_seq 14 · host file **EXISTS** |
| `forge_shell` `ls` that path | SEAL · file visible on host |
| `forge_shell` `echo AFORGE_PROOF` | SEAL · stdout matched · seal ledger |
| `forge_shell_dryrun` | SEAL · dry_run true · no mutation claim |
| `forge_execute` | GATE A_THINK_GUARD · R5 · needs human approval |
| `forge_git` | GATE · destructive requires human approval |
| `forge_filesystem_write` | GATE · no affordance card |
| `forge_vps_services` | GATE · no affordance card |
| `forge_docker` | schema requires mode=ps\|logs\|exec\|images (validation live) |
| Anonymous actor (no actor_id) | PolicyGate L1_IDENTITY:anonymous_actor |
| Raw bulk HTTP flood | 403 / 429 rate limits on non-allowlisted tools |

## Reality map — who can touch the machine

| Capability | arifOS kernel | A-FORGE hands |
|------------|---------------|---------------|
| Session / judge / seal law | YES (12 verbs) | proxies only |
| Shell on host | NO | **YES** `forge_shell` |
| Filesystem mutate | NO | YES (gated) `forge_filesystem_*` |
| Git / GitHub | NO | YES (gated) |
| Docker / systemctl / VPS | NO | YES (gated) |
| Browser automation | NO | YES (gated) |
| Execute sealed jobs | gate only `arif_forge` | **YES** `forge_execute*` |

## Final verdict

**A-FORGE is the physical/digital actuator.** arifOS is law.  
Host impact **proved** via `forge_shell` (file create + seal chain).  
Most of the 99-tool surface is correctly **gated** (affordance / GOVERN / lease / rate-limit) — not dead, not free-for-all.

Raw bulk scan without proper actor/session: **19 OK / 4 GATE / 2 ERR / 74×403** — treat 403 as transport policy, not “tool missing”.
With `actor_id=arif` on allowlisted paths: shell/registry/probe/health work; high-risk tools HOLD for approval.
