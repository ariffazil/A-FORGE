# 🖐️ Web Tools Addendum — Browser Fingerprinting & Anti-Detection Surface

*Forged: 2026-07-08T19:10Z by FORGE-000Ω*  
*Extends: `web_tools_contrast_matrix_v2.md`*  
*Superseded by: `web_tools_browser_fingerprinting_REAL.md` (working implementation + live test results)*  
*Local clone: `/root/A-FORGE/forge_work/2026-07-08/browser-fingerprinting`*  
*Source article: [Stable Browser Fingerprints: The Anti Anti Bot Detection You Need](https://www.opensourceprojects.dev/post/browser-fingerprinting)*  
*Repo: [github.com/niespodd/browser-fingerprinting](https://github.com/niespodd/browser-fingerprinting)*

---

## 0. Why This Addendum Exists

Arif surfaced [opensourceprojects.dev/post/browser-fingerprinting](https://www.opensourceprojects.dev/post/browser-fingerprinting) and asked to **map all web tools in the state/machine and make sure we have this**. The v2 web-tool census covered search/fetch/explore surfaces but did not cover the **browser fingerprinting / anti-bot / automation stealth** layer. This addendum closes that gap.

**Action taken:** repo cloned to `forge_work/2026-07-08/browser-fingerprinting`. Playwright already installed on the machine.

---

## 1. Browser Fingerprinting Tool Census

Mapped into the same **4 authority layers** used in v2.

### Layer A — CLI / System
| Tool | Source | Auth | Cost | Reversibility | Notes |
|---|---|---|---|---|---|
| `playwright` | `/usr/local/bin/playwright` | none | 0 | full | Chromium/Firefox/WebKit automation. Already on this machine. |
| `python3 + playwright` | pip-installed | none | 0 | full | Python binding available; usable for custom automation scripts. |
| `chromium` | system | none | 0 | full | Headless browser binary backing Playwright. |

### Layer B — Native MCP / Browser Automation
| Server | Tool(s) | Transport | Notes |
|---|---|---|---|
| **chrome-devtools** | `navigate_page`, `take_snapshot`, `click`, `fill`, `evaluate_script`, `list_webmcp_tools`, `execute_webmcp_tool`, … | local | Lowest-level browser ops. No proactive fingerprint spoofing. |
| **aforge** | `forge_browser_navigate`, `click`, `type`, `extract_text`, `screenshot`, `evaluate_js` | remote :7071 | Governed browser automation. Can be combined with fingerprint injection. |

### Layer C — External Libraries / Repos (not yet MCP-wrapped)
| Tool / Repo | Language | Function | Governance status |
|---|---|---|---|
| **[niespodd/browser-fingerprinting](https://github.com/niespodd/browser-fingerprinting)** | React / JS docs | Curated anti-bot guide + browser fingerprint tester (NOT a Python library, despite article claim). | **Cloned locally**. No MCP wrapper yet. |
| **[berstend/puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)** | Node.js | Evasion plugin for Puppeteer/Playwright; patches `navigator.webdriver`, `chrome.runtime`, etc. | Not installed. Reference only. |
| **[fingerprintjs/fingerprintjs](https://github.com/fingerprintjs/fingerprintjs)** | JavaScript | Client-side browser fingerprinting library (open-source). Used by many sites to detect visitors. | Not installed. Reference / adversary model. |
| **[thumbmarkjs/thumbmarkjs](https://github.com/thumbmarkjs/thumbmarkjs)** | TypeScript | Free open-source fingerprinting library, FingerprintJS alternative. | Not installed. Reference. |
| **[abrahamjuliot/creepjs](https://github.com/abrahamjuliot/creepjs)** | JavaScript | Fingerprinting test/audit page; detects anti-fingerprinting tool leaks. | Not installed. Reference / audit. |
| **amiunique.org** | web service | Fingerprint diversity research dataset. | External reference. |

### Layer D — A-FORGE Governed Combination
| Pattern | Tools | Result |
|---|---|---|
| Stealth fetch of JS-heavy page | `forge_browser_navigate` + real fingerprint generator + `forge_browser_extract_text` | Governed automation with stable fingerprint. |
| Audit own anti-bot surface | `forge_browser_navigate` → target page runs `FingerprintJS` / `CreepJS` → compare detected vs injected fingerprint. |
| Social-media / long-lived session | Real fingerprint profile + proxy pool + `forge_browser_*` sequence. |

---

## 2. What the Linked Repo Actually Contains

**Important correction after cloning:** the article describes a Python library called `browser-fingerprinting`, but the linked repository ([niespodd/browser-fingerprinting](https://github.com/niespodd/browser-fingerprinting)) is actually:

- A **curated anti-bot scraping guide** (README lists proxies, scraping-as-a-service providers, anti-bot vendors, stealth browsers).
- A **React-based fingerprint tester** (`tester/`) that collects browser signals: basic info, Chrome extensions, media devices, sensors, memory, timing, etc.
- A static `docs/` site generated from the tester.

It is **not** a Python fingerprint generator. There is no `BrowserFingerprint` class, no `examples/demo.py`, and no `requirements.txt`. The article appears to conflate or misrepresent the repo.

### Local quick-start (verified clone)
```bash
cd /root/A-FORGE/forge_work/2026-07-08/browser-fingerprinting
# Run the React tester locally (Node + yarn required)
cd tester
yarn install
yarn dev
# Then open http://localhost:5173 (or whatever Vite reports)
```

### What the tester reveals
The `tester/src/testers/` directory probes:
- Basic information (UA, platform, screen, timezone, language)
- Chrome extensions
- Document status / Feature-Policy
- Speech synthesis voices
- Device sensors
- Media devices
- Encrypted media extensions
- Resource timing
- Performance memory

This is useful as an **audit/ adversary-intelligence** tool, not a stealth automation library.

---

## 3. Routing — When to Use Which Fingerprinting Tool

| Scenario | Tool / Pattern | Why |
|---|---|---|
| Need stable identity for long-lived scraper session | Build or source a real fingerprint generator (not this repo) + Playwright | Coherent, reusable profile |
| Need to evade `navigator.webdriver` / basic bot flags | `puppeteer-extra-plugin-stealth` | Cheap, widely tested |
| Need to test what browser signals a page can see | `niespodd/browser-fingerprinting` tester (local or deployed) | Reacts audit panel |
| Need to test if our spoofing leaks | `creepjs` audit page | Finds inconsistencies |
| Need to understand what target site sees | `amiunique.org` or `fingerprintjs` demo | Baseline fingerprint |
| Need governed, auditable browser automation | `aforge forge_browser_*` + injected profile | F1-F13 envelope, chain_hash |

---

## 4. Gaps & Recommendations

### Gaps (DRAFT)
- **G4**: No real Python fingerprint generator in the federation. The linked repo is documentation/tester only.
- **G5**: No federation inventory of **adversary fingerprinting libraries** (FingerprintJS, ThumbmarkJS, CreepJS) for red-team/audit use.
- **G6**: No automated test that proves `forge_browser_*` + profile bypasses a target detector.

### Recommendations (REUSE_EXISTING)
- **Rec5**: Keep `niespodd/browser-fingerprinting` cloned in `forge_work/2026-07-08/` as a **reference + fingerprint tester**, not as a stealth automation library.
- **Rec6**: If we need a real Python fingerprint generator, evaluate one of the actual open-source libraries (e.g. search PyPI / GitHub for `browser-fingerprinting` generators) or wrap `puppeteer-extra-plugin-stealth` for Node-based automation.
- **Rec7**: For any anti-bot task, combine fingerprint stability **with** proxy/IP strategy — fingerprinting alone does not bypass IP reputation.

---

## 5. Receipt

- Article ingested via `FetchURL` → extracted main text.
- Repo cloned from `https://github.com/niespodd/browser-fingerprinting.git`.
- Playwright availability verified: `/usr/local/bin/playwright` + Python import OK.
- No SEAL required — OBSERVE class, reversible (delete clone to undo).

---

**Status:** REUSE_EXISTING · extends v2 census  
**Confidence:** 0.85 (repo verified, Playwright present, article ingested)  
**Next action:** run the React tester with `cd browser-fingerprinting/tester && yarn install && yarn dev` if you want to see the fingerprint audit panel live.

DITEMPA BUKAN DIBERI.
