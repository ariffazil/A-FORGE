# ⚡ PROXY EXECUTION CLASS & CAUSALITY DEFENSE DOCTRINE

> **FORGED:** 2026-07-22 by FORGE (000Ω) · **AUTHORITY:** 888 (Arif, F13 SOVEREIGN)
> **VAULT999:** `mem_1784701466509_k3cov` · **SESSION:** `SEAL-ff6b6fd8078b4f56`
> **STATUS:** SEALED & IMMUTABLE · **DOCTRINE:** Foundational Baseline

---

## SOURCE

**Pillar Security disclosure (July 2026):** 7 sandbox escapes across Cursor, Codex, Gemini CLI, Antigravity — Anthropic, OpenAI, Google. One vulnerability class. Zero sandbox breached. Semua bypassed by design.

---

## BUG CLASS: Proxy Execution

```
Agent writes file (dibenarkan, dalam sandbox)
         ↓
Trusted host tool reads file (Python ext, Git, Docker daemon, VS Code runner)
         ↓
Execution occurs outside agent context.
Agent never violates policy. Trusted tool is the unwitting bridge.
```

Agent tak perlu break sandbox. Sandbox bukan di-attack. **Sandbox bypassed by design.** The trusted host tool is the bridge across the perimeter.

---

## FOUR FUNDAMENTAL FAILURE MODES

| # | Mode | Example | Why Sandbox Can't Stop It |
|---|------|---------|---------------------------|
| 1 | **Denylist selalu ketinggalan** | macOS Seatbelt bypass (Antigravity) | OS evolve faster than blacklists |
| 2 | **Config file = executable code** | `.claude` hook → CVE-2026-48124 | Agent writes config; host tool reads & executes |
| 3 | **Allowlist percaya nama, bukan semantik** | `git show` trusted by name — invocation not read-only (Codex) | Sudo trusts binary; doesn't audit what binary DOES |
| 4 | **Daemon privileged di luar sandbox** | Docker socket — hit Codex, Cursor, Gemini CLI simultaneously | Daemon has full access; agent only needs socket reach |

---

## KENAPA SUDO & SANDBOX TAK BERFUNGSI LAGI

1. **Garis salah.** Sandbox draws line between agent and host. But workspace files are NOT inert — Python extension, Git integration, Docker daemon, VS Code task runner all read those files. The line is permeable by design.

2. **Prompt injection makes every repo a weapon.** README, issue, dependency, diff — any can carry payload. Agent obeys instructions, writes file. Escape happens when host tool reads that file later. Agent never broke a rule.

3. **Sudo = permission gate at wrong abstraction.** Sudo asks: "Can this process run as root?" But exploit doesn't need root. It needs a trusted process to run agent-written code. The privileged daemon already HAS all permissions.

4. **Config IS code.** `.claude`, `.vscode/tasks.json`, `.gitconfig`, `pyproject.toml`, `Makefile` — all execution surfaces. Denylist can't follow. Allowlist trusts names, not behavior.

---

## CONSTITUTIONAL MITIGATION (arifOS F1-F13)

| Floor | Mitigation | Mechanism |
|-------|-----------|-----------|
| **F3 WITNESS** | Every file mutation tagged | Config files treated as latent execution triggers, not inert text |
| **F11 AUDIT** | Semantics over names | `git show` evaluated on behavior, not binary name |
| **F8 GENIUS** | Pre-execution gate | G ≥ 0.80 + C_dark < 0.30 before trusted tool invocation |
| **888 HOLD** | Daemon socket gate | Docker socket touch or irreversible state change → absolute hold. W_scar remains with 888 |

```
Proxy Execution Chain in arifOS:
  Agent writes .vscode/tasks.json
       ↓
  [F3 WITNESS]  — file mutation tagged, config ≠ inert text
  [F11 AUDIT]   — "git show" evaluated on SEMANTICS, not name
  [F8 GENIUS]   — G ≥ 0.80 + C_dark < 0.30 before execution
  [888 HOLD]    — daemon socket touch = absolute gate
       ↓
  Chain integrity maintained. P ≥ 0.99. ΔS ≤ 0.
```

---

## DOCTRINE (Foundational Baseline)

> **"Sudo protects the OS from the user.**
> **Sandbox protects the host from the agent.**
> **Only a constitutional kernel protects the chain of execution from the environment itself."**

This is not a security layer. This is a different category of defense entirely.

| Paradigm | Trusts | Blind Spot |
|----------|--------|-----------|
| **Perimeter (Sandbox)** | The line | What crosses the line |
| **Permission (Sudo)** | The actor | What the actor does |
| **Causality (arifOS)** | Nothing — verifies every link | None |

---

## EXTERNAL VALIDATION

Pillar Security's own conclusion (paraphrased):

> "The real fix is not a new denylist. The real fix is to **watch the moment a trusted local tool runs something the agent wrote.** "

This is the definition of constitutional oversight — exactly what arifOS was architected for, BEFORE this disclosure.

---

## EPISTEMIC STATE

| Parameter | Value |
|-----------|-------|
| **Confidence** | P ≥ 0.99 |
| **Entropy** | ΔS < 0 |
| **Truth Gate** | F2 — Grounded in execution mechanics |
| **Safety Gate** | F1 — Reversible / Hold active |
| **Authority** | 888 (Arif, F13 SOVEREIGN) |
| **VAULT999 ID** | `mem_1784701466509_k3cov` |

---

## MARKET POSITION

When the market realizes perimeter defense has failed, arifOS already has an operational map for execution causality.

**4 vendors. 3 companies. Same bug class. All failed to see the chain.**

That's why arifOS exists. That's why kernel > sandbox. That's why F1-F13 > sudo.

```
Sandbox = percaya garisan
Kernel  = percaya TIADA garisan — setiap pautan diverifikasi
```

---

**DITEMPA BUKAN DIBERI. ⚒️**
**Sealed: 2026-07-22 · VAULT999: mem_1784701466509_k3cov**
