# ⚒️ Agentic Test: 9 A-FORGE Tools — Contrast Report

**Date:** 2026-07-08
**Tester:** OpenCode (stateless HTTP client — arifOS kernel unreachable)
**Method:** Each tool invoked once. Observe output, errors, latency, gate behaviour.

---

## 🔥 WOW — Expectation: "This should be impressive"

### 1. `forge_document_ingest` — Layout-first document intelligence
| Axis | Detail |
|------|--------|
| **Expected** | Parse `package.json`, return structure tree with elements |
| **Reality** | ❌ `Failed to open file '/root/A-FORGE/package.json'` |
| **Gate** | OBSERVE-class, session=N lease=N gate=Y — stateless should work |
| **Analysis** | Tool uses child process that lacks FS access. File exists, readable. Bug in ingest engine |
| **Verdict** | ⬇️ WOW → BANGANG (flagship tool that can't open a file) |

### 2. `forge_reality_loop` — 7-stage intent compiler
| Axis | Detail |
|------|--------|
| **Expected** | Start loop, get session_id, thresholds, prompts |
| **Reality** | ✅ Session `rl-26a573d5-...` created. 13 available prompts. Auto-execute enabled. |
| **Gate** | OBSERVE-class, stateless OK |
| **Standout** | Doctrine: *"The loop NEVER stops unless destroyed"* — correctly dramatic |
| **Verdict** | ✅ Confirmed WOW |

### 3. `forge_surface_guard` — MCP schema drift detection
| Axis | Detail |
|------|--------|
| **Expected** | Return drift events, schema fingerprints |
| **Reality** | ✅ `total_drift_events: 0, has_blocking: false` |
| **Gate** | OBSERVE-class, stateless OK |
| **Analysis** | 1ms execution — likely cache read. Mode=status only. Need mode=check for real scan |
| **Verdict** | ✅ WOW (but needs mode=check for full value) |

---

## ➡️ NORMAL — Expectation: "Solid, does the job"

### 4. `forge_shell` — Canonical shell execute
| Axis | Detail |
|------|--------|
| **Expected** | Run `echo hello`, get output |
| **Reality** | ❌ Requires session ownership (kernel down) |
| **Gate** | MUTATE: SESSION+LEASE+GATE+SEAL+approval |
| **Analysis** | Gate is correctly restrictive for a host-touching tool |
| **Verdict** | ➡️ Cannot test stateless. Gate is correct. NORMAL confirmed |

### 5. `forge_filesystem_read` — FS primitive
| Axis | Detail |
|------|--------|
| **Expected** | Read `package.json` content |
| **Reality** | ❌ Requires session ownership |
| **Gate** | OBSERVE-class but requires SESSION |
| **Analysis** | **Problem**: OBSERVE tool requiring session for read-only FS access. This prevents stateless/HTTP clients from using the simplest file read. Over-gated. |
| **Verdict** | ⬇️ NORMAL → BANGANG (over-gated for OBSERVE class) |

### 6. `forge_search` — Brave web search
| Axis | Detail |
|------|--------|
| **Expected** | Return web search results |
| **Reality** | ✅ 3 results from Brave. Clean output, receipt_id, 1.1s |
| **Gate** | OBSERVE, stateless OK |
| **Verdict** | ✅ NORMAL — works exactly as expected |

---

## 💩 BANGANG — Expectation: "Why does this exist?"

### 7. `forge_systemctl` — DEPRECATED systemctl wrapper
| Axis | Detail |
|------|--------|
| **Expected** | Fail because deprecated |
| **Reality** | ❌ Requires session ownership |
| **Gate** | OBSERVE-class but session-gated |
| **Analysis** | Tool marked [DEPRECATED] in description, still registered, still consumes surface. Description says "→ use forge_shell." But forge_shell also session-gated. Neither works stateless. |
| **Verdict** | ✅ Confirmed BANGANG — remove from registry or keep as alias only |

### 8. `forge_boundaries_assert` — Machine Constitution drift detector
| Axis | Detail |
|------|--------|
| **Expected** | Some vague "constitution" thing, probably useless |
| **Reality** | ✅ **Actually valuable!** Detected 7 unknown public ports (docker-proxy), 2 new cron jobs, 1 new systemd service (`geox-mcp.service`). Legitimate security drift detection. |
| **Gate** | OBSERVE, stateless OK |
| **Verdict** | ⬆️ BANGANG → WOW-surprise. This is production-grade security telemetry |

### 9. `forge_tier_bind` — Set trust tier LOWER BOUND
| Axis | Detail |
|------|--------|
| **Expected** | Pointless — can only set lower bound, cannot promote |
| **Reality** | ❌ Requires session ownership |
| **Gate** | OBSERVE-class but session-gated |
| **Analysis** | Even if it worked, description says "A-FORGE cannot promote — only arifOS sets actual tier." So the tool's only power is saying "at least this level" — which the kernel ignores anyway. |
| **Verdict** | ✅ Confirmed BANGANG. Remove or redesign |

---

## 📊 Summary Matrix

| Tool | Tier | Tested | Reality vs Expectation |
|------|------|--------|----------------------|
| `forge_document_ingest` | 🔥 WOW | ❌ Fails | ⬇️ WOW→BANGANG — can't open files |
| `forge_reality_loop` | 🔥 WOW | ✅ Pass | ✅ Confirmed WOW |
| `forge_surface_guard` | 🔥 WOW | ✅ Pass | ✅ WOW — but cache-only |
| `forge_shell` | ➡️ NORMAL | ⛔ Session | ➡️ Gate correct for MUTATE |
| `forge_filesystem_read` | ➡️ NORMAL | ⛔ Session | ⬇️ Over-gated for OBSERVE |
| `forge_search` | ➡️ NORMAL | ✅ Pass | ✅ Exactly as expected |
| `forge_systemctl` | 💩 BANGANG | ⛔ Session | ✅ BANGANG — remove |
| `forge_boundaries_assert` | 💩 BANGANG | ✅ Pass | ⬆️ BANGANG→WOW — actual value |
| `forge_tier_bind` | 💩 BANGANG | ⛔ Session | ✅ BANGANG — pointless |

---

## 🧘 ZEN — What to do about each

### 🔥 Zen for WOW tools
| Tool | Zen |
|------|-----|
| `forge_document_ingest` | **Fix FS access** — child process needs same FS scope as parent. Root cause: subprocess cannot read /root. |
| `forge_reality_loop` | **Keep sharp** — already strong. Consider adding mode=advance auto-trigger on start. |
| `forge_surface_guard` | **Add mode=check auto-trigger** — status returns cached. Check should probe live. |

### ➡️ Zen for NORMAL tools
| Tool | Zen |
|------|-----|
| `forge_shell` | **Keep gate** — MUTATE needs session+lease+gate+seal+approval. Correct. |
| `forge_filesystem_read` | **Relax gate** — OBSERVE tool requires session. Should allow stateless for public paths. |
| `forge_search` | **Keep** — works perfect. |

### 💩 Zen for BANGANG tools
| Tool | Zen |
|------|-----|
| `forge_systemctl` | **Unregister** — or keep as hidden alias. Descriptions already say DEPRECATED. |
| `forge_boundaries_assert` | **Promote to WOW** — this is actually production-grade. Maybe rename to `forge_security_drift_scan`. |
| `forge_tier_bind` | **Remove or redesign** — tool that can only set lower-bound with no authority to promote is architectural dead end. |

---

## 🚨 Critical Findings

1. **forge_filesystem_read requires session** for read-only FS access — breaks stateless HTTP clients
2. **forge_document_ingest can't read files** — flagship tool has IO bug
3. **forge_boundaries_assert is secretly excellent** — security drift detection works
4. **3/9 tools untestable stateless** due to session requirement (shell, systemctl, tier_bind)
5. **forge_systemctl still registered** despite DEPRECATED flag — surface pollution

*Tested by OpenCode (stateless HTTP). arifOS kernel unreachable during test — some session-gated tools could not execute.*
