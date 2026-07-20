# PLAN-2026-06-06-P1 — Browser MCP (7 Tools for A-FORGE)

> **Plan-ID:** PLAN-2026-06-06-P1-BrowserMCP
> **Lane:** AGI / Federation Agent Onboarding
> **Risk tier:** MUTATE (reversible) + 1 ATOMIC subprocess (`aforge_browser_type` → `form_submit` needs F13)
> **Estimated time:** 2–3 days focused (Arif-side review + code + tests + deploy)
> **Authority required:** F13 SOVEREIGN ratification before any mutation

**Status:** DRAFT — awaiting F13 ratification  
**Owner:** Antigravity (forger) under arifOS (governance)  
**Seal:** DITEMPA BUKAN DIBERI

---

## 1. Scope — 7 New A-FORGE MCP Tools

| Tool | Purpose | Reversibility | Floor gates |
|---|---|---|---|
| `aforge_browser_open` | Start ephemeral chromium session | R 0.6 (process) | F1, F4, F11 (URL/origin) |
| `aforge_browser_navigate` | Navigate to URL | R 0.9 | F1, F2, F11 (allowlist) |
| `aforge_browser_click` | Click CSS selector | R 0.7 | F1, F9 (no impersonation) |
| `aforge_browser_type` | Type into field | R 0.5; R 0.1 if `form_submit=true` | F1, F9, F11, **888_HOLD if submit** |
| `aforge_browser_extract` | Read DOM/text/data | R 1.0 (pure read) | F1, F2 |
| `aforge_browser_screenshot` | Capture PNG + DOM | R 1.0 | F1, F7 (PII redaction) |
| `aforge_browser_close` | Kill session | R 1.0 | F1 |

---

## 2. Acceptance Criteria (what "done" means)

1. ✅ All 7 tools registered in `src/mcp/core.ts` via `server.tool()` pattern (matches existing 8)
2. ✅ Each tool writes a `forge_browser_receipt` to VAULT999 (hash-chained) on completion
3. ✅ URL allowlist enforced via F11Auth (`src/governance/f11Auth.ts`); deny-by-default
4. ✅ Max 3 concurrent browser sessions (resource ceiling)
5. ✅ Per-session TTL: 5 min idle → auto-close
6. ✅ Screenshot redaction: detect+blur emails, phone numbers, faces (via `llava:7b` vision check)
7. ✅ All existing 17 test files still pass
8. ✅ New `test/BrowserTools.test.ts` covers: open/navigate/extract/close, URL deny, timeout, screenshot redaction
9. ✅ Build green (`tsc -p tsconfig.json`)
10. ✅ `curl http://localhost:7071/api/federation-probe` shows new tools in surface
11. ✅ `arif_route` from arifOS MCP can invoke `aforge_browser_navigate` end-to-end

---

## 3. Concrete File Changes

| # | File | Action | Lines |
|---|---|---|---|
| 1 | `src/tools/BrowserTools.ts` | NEW — 7 tool classes extending `BaseTool` | ~400 |
| 2 | `src/mcp/core.ts` | MODIFY — register 7 new tools (after existing 8) | +~50 |
| 3 | `src/governance/browserPolicy.ts` | NEW — URL allowlist, redaction config, session pool | ~150 |
| 4 | `src/governance/PolicyEnforcer.ts` | MODIFY — add `browser_policy` hook | +~30 |
| 5 | `package.json` | MODIFY — add `playwright: ^1.48.0` | +1 |
| 6 | `test/BrowserTools.test.ts` | NEW — node --test suite, 8 cases | ~250 |
| 7 | `src/tools/ToolRegistry.ts` | MODIFY — auto-register browser tools | +~10 |
| 8 | `docs/PLANS/PLAN-2026-06-06-P1-BrowserMCP.md` | NEW — this plan, sealed | ~150 |
| 9 | `src/llm/providerFactory.ts` | MODIFY — register vision-routing for screenshot redaction | +~20 |

**Total: ~1100 new lines, ~80 modified.** Smallest forge of P1–P7.

---

## 4. Architecture

```
arifOS kernel :8088
    │
    │ arif_route(target="aforge_browser_*")
    ▼
A-FORGE :7071 ──── src/mcp/core.ts
    │           │
    │           ├─ ToolRegistry ──► BrowserTools (7)
    │           │                       │
    │           │                       ├─ BrowserSessionPool (max 3, 5min TTL)
    │           │                       │     │
    │           │                       │     └─ playwright.chromium.launch()
    │           │                       │
    │           │                       └─ BrowserPolicyEnforcer
    │           │                             ├─ URL allowlist (F11)
    │           │                             ├─ F1 AMANAH → VAULT999 receipt
    │           │                             ├─ F7 PII redaction (llava:7b)
    │           │                             └─ F9 click anti-impersonation
    │           │
    │           └─ PolicyEnforcer ──► existing F1-F11 pipeline
    │
    └─► VAULT999 (port 5001) — forge_browser_receipt every tool call
```

---

## 5. Code Outline (key signature)

```ts
// src/tools/BrowserTools.ts (excerpt)
import { z } from "zod";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { BaseTool, type Tool } from "./base.js";
import { VAULT999 } from "../vault/VAULT999Client.js";
import { BrowserPolicyEnforcer } from "../governance/browserPolicy.js";

const NavigateInput = z.object({
  url: z.string().url(),
  wait_until: z.enum(["load","domcontentloaded","networkidle"]).default("domcontentloaded"),
  timeout_ms: z.number().max(30_000).default(10_000),
  session_id: z.string().uuid().optional(),
});

export class BrowserNavigateTool extends BaseTool {
  name = "aforge_browser_navigate";
  description = "Navigate ephemeral chromium session to a URL (F11-allowlisted).";
  inputSchema = NavigateInput;

  async execute(args, ctx) {
    // F1 AMANAH — receipt BEFORE action
    const intent = await VAULT999.appendIntent({
      action: "browser_navigate",
      target: args.url,
      actor: ctx.actor_id,
      session: ctx.session_id,
    });

    // F11 SOVEREIGNTY — URL allowlist
    const policy = await this.policy.checkURL(args.url, ctx);
    if (policy.verdict === "DENY") {
      return { verdict: "VOID", reasons: policy.reasons };
    }
    if (policy.verdict === "HOLD") {
      return { verdict: "HOLD", reasons: policy.reasons, hold_id: intent.id };
    }

    // Execute
    const session = await this.pool.getOrCreate(args.session_id, ctx);
    try {
      const response = await session.page.goto(args.url, { waitUntil: args.wait_until, timeout: args.timeout_ms });
      const title = await session.page.title();
      const finalUrl = session.page.url();

      // F1 AMANAH — receipt AFTER action
      await VAULT999.appendResult({
        intent_id: intent.id,
        status: "OK",
        title,
        finalUrl,
        status_code: response?.status()
      });
      return { verdict: "SEAL", status: "OK", title, url: finalUrl };
    } catch (err) {
      await VAULT999.appendResult({ intent_id: intent.id, status: "FAIL", error: String(err) });
      return { verdict: "VOID", status: "FAIL", error: String(err) };
    }
  }
}
```

---

## 6. Test Plan (8 Cases)

| # | Test | Expectation |
|---|---|---|
| 1 | `aforge_browser_open` → `aforge_browser_navigate` to https://example.com | SEAL, `title="Example Domain"` |
| 2 | Navigate to blocked URL (e.g. `file://`, internal IP) | VOID, F11 deny reason |
| 3 | `aforge_browser_extract` after navigate | Returns clean DOM text |
| 4 | Screenshot with detected PII (test page with fake email) | PNG returned, PII blurred in saved file |
| 5 | Session TTL — leave idle 6 min | Auto-closed, next call returns VOID with reason `session_expired` |
| 6 | 4 concurrent sessions | 4th rejected, reason `session_pool_full` |
| 7 | `aforge_browser_type` with `submit=true` on payment form | HOLD with `hold_id`, awaits F13 ack |
| 8 | VAULT999 chain integrity after 5 browser tool calls | 5 new `forge_browser_receipt` entries, Merkle chain valid |

---

## 7. Rollback Plan (reversible first)

| Failure | Recovery |
|---|---|
| Build fails | Revert `src/mcp/core.ts` hunk, restart `a-forge.service` (no other state changed) |
| Runtime crash in BrowserTools | `git revert commit; npm uninstall playwright; restart` |
| VAULT999 write fails | Tool returns VOID; no side effect; user notified |
| Browser session leak | TTL sweep in `BrowserSessionPool.cleanup()` runs every 60s |
| PII leak via screenshot | Screenshot saved to `/tmp/screenshots/{session_id}/` with `chmod 600`; auto-purged after 24h |
| Federation regression | 17 existing test files must pass; federation-probe must show all 9 organs GREEN |

---

## 8. Cost / Time

| Item | Time | Reversibility |
|---|---|---|
| Code (4 new + 3 modified files) | 1.5 days | Revert files |
| Tests (1 new file, 8 cases) | 0.5 day | Revert file |
| Build + service restart + smoke | 0.5 day | Restart to old version |
| **Total** | **2.5 days focused** | **Fully reversible** |

---

## 9. Sovereign Call-Points (where F13 veto matters)

These are the **4 unanswered decisions**. Until F13 ratifies each, the spec defaults to the safest option. **F13 ratification is required before mutation begins.**

### 9.1 Form submit gate (F13 ratification required)

- **Default (safest):** `aforge_browser_type` with `form_submit=true` always triggers 888_HOLD.
- **Override option:** F13 specifies a regex allowlist of submit patterns that auto-proceed (e.g. read-only search forms).

### 9.2 URL allowlist scope (F13 ratification required)

- **Default (safest):** Deny-by-default. Explicit allowlist needed for any domain.
- **Suggested starter set:** `*.anthropic.com`, `*.openai.com`, `*.arif-fazil.com`, `*.github.com`, `*.wikipedia.org`, `example.com`, `localhost` (dev only).
- **Always denied:** `file://`, `localhost` (prod), RFC1918 internal IPs, `127.0.0.0/8`, `0.0.0.0`, `169.254.0.0/16` (link-local), onion/Tor, any TLD on the deny list.

### 9.3 Concurrent session cap (F13 ratification required)

- **Default:** 3 sessions max.
- **Override:** 1 (safer, single-task browsers) or 10 (more throughput, more risk).
- 1-line change in `BrowserSessionPool.max_sessions`.

### 9.4 PII redaction scope (F13 ratification required)

- **Default (safest):** Detect+blur emails, phone numbers, faces.
- **Override options:** Add credit card numbers (Luhn-validated), SSN/IC/passport patterns, addresses.
- Detection via `llava:7b` for visual PII; regex for textual PII.

---

## 10. Ratification Statement

When Arif ratifies this plan, the response must include:

```
Ratify PLAN-2026-06-06-P1
- 9.1 submit gate:        [default | override: <pattern>]
- 9.2 URL allowlist:       [default | override: <list>]
- 9.3 session cap:         [default=3 | override: 1|5|10]
- 9.4 PII scope:           [default | override: <additions>]
```

Antigravity proceeds only after all 4 are answered. **No silent defaults at runtime** — the policy file is the truth.

---

**DITEMPA BUKAN DIBERI — 999 SEAL pending F13 ratification**  
*v2026.06.06 | Seri Kembangan, MY*
