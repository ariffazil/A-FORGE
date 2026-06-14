# BASHRC FORGE — Constitutional Shell Ignition | 2026-05-25

> **DITEMPA BUKAN DIBERI** — Intelligence is forged, not given.
> Authority: 777_FORGE | Verdict: SEAL | Actor: Kimi for Arif

---

## What Was Done

A complete constitutional shell ignition system was forged for the arifOS Federation VPS (`af-forge`). Every bashrc file was audited, aligned to 000-999 architecture, and extended with agentic capabilities.

### Files Changed / Created

| File | Action | Purpose |
|------|--------|---------|
| `/root/.bashrc` | **Rewritten** | Improved agent detection (Kimi, Claude, OpenCode, Aider, Gemini). Cleaner router logic. |
| `/root/.bashrc_common` | **Extended** | Added venv auto-activation, env auto-loading, Node/corepack awareness, extras loader, constitutional ignition function source. Fixed `ARIFOS_KERNEL_URL` port (8080 → 8088). |
| `/root/.bashrc_aaa` | **Rewritten** | Wires `arifos-ignite` (000-999). Exports `ARIFOS_ACTOR_ID=a-forge`. |
| `/root/.bashrc_human` | **Rewritten** | Wires `arifos-ignite`. Exports `ARIFOS_ACTOR_ID=arif`. Adds sovereign shortcuts (`status-all`, `seal-check`, `seal-tail`). |
| `/root/.bashrc_ignition` | **NEW** | Canonical 7-step ignition protocol (000_INIT → 999_VAULT). Defines `arifos-ignite`, `arifos-session-bind`, `arifos-session-resume`, `arifos-health-fast`, `arifos-context`. |
| `/home/aaa/.bashrc` | **Rewritten** | Integrates ignition status into agent banner. Adds `agent-context`, `agent-health`, `agent-bind`, `agent-resume` shortcuts. Preserves full audit engine + TREE777 grounding. |
| `/root/.bashrc_extras` | **NEW** | Optional customization modules (fzf, zoxide, starship, bat, delta, eza, lazygit, tmux, ssh-agent, pyenv, fnm, etc.). All commented out — install what you want, uncomment to activate. |

---

## The 7-Step Constitutional Ignition Protocol

When ANY shell starts (human or agent), it executes `arifos-ignite()` in ~70-90ms:

| Step | Floor | What It Does |
|------|-------|--------------|
| **000_INIT** | F1–F13 bootstrap | Exports identity, actor_id, canonical ports, endpoint URLs. Classifies shell mode (`interactive` vs `noninteractive`). |
| **111_SENSE** | F2 Truth | Probes all 7 federation services (async background, 60s cache). Writes `/tmp/.arifos/health_cache.json`. |
| **222_CONTEXT** | F4 Clarity | Reads `CONTEXT.md` modification time + epoch. Notes `AGENTS.md` and `MEMORY.md` presence. |
| **444_KERNEL** | F8 Genius | Checks local MCP port readiness. Fires async tool discovery to `.well-known/mcp/server.json`. |
| **555_MEMORY** | F5 Continuity | Notes `.arifOS/memory/` dir. Tracks if `ARIFOS_SESSION_ID` is pre-bound. |
| **666_HEART** | F6 Empathy | Arms the `DEBUG` trap for interactive shells. Kill switch: `export ARIFOS_HEART=0`. |
| **777_OPS** | OPS Thermodynamics | Logs load, memory %, disk %, PID, identity to `/var/lib/arifos/vault/shell_ignitions.jsonl`. |
| **888_JUDGE** | F13 Sovereignty | Sets authority ceiling: human = `999_SEAL`, agent = `777_FORGE` / `SABAR`. |
| **999_VAULT** | F1 Amanah | The ignition log itself becomes the vault entry. `ARIFOS_IGNITION_SEALED=1`. |

### Post-Ignition Environment Variables

```bash
IDENTITY=aaa|human
ARIFOS_ACTOR_ID=arif|a-forge
ARIFOS_MCP_LOCAL=UP|DOWN
ARIFOS_CONTEXT_EPOCH=2026-05-25
ARIFOS_IGNITION_MS=86
ARIFOS_IGNITION_SEALED=1
AGENT_AUTHORITY_MAX=777_FORGE|999_SEAL
AGENT_JUDGE_CEILING=SABAR|SEAL
```

---

## New Shell Commands

### Constitutional / Federation

| Command | What It Does |
|---------|--------------|
| `arifos-ignite` | Re-run the full 000-999 ignition manually |
| `arifos-session-bind [actor] [model]` | Bind a constitutional session via MCP (returns `SEAL-xxx`) |
| `arifos-session-resume [sid]` | Resume last session from `/tmp/.arifos_last_session` |
| `arifos-health-fast` | Print cached federation health (all 7 services) |
| `arifos-context` | Print constitutional context snapshot |
| `arifos-judge '<action>'` | Native heuristic constitutional deliberation |
| `arifos-call <tool> '<params>'` | Call any arifOS MCP tool from shell |
| `arifos-organs` | Federation organ discovery via HTTPS |

### Agent-Specific (AAA identity)

| Command | What It Does |
|---------|--------------|
| `agent-whoami` | Print identity / role / authority |
| `agent-context` | Alias for `arifos-context` |
| `agent-health` | Alias for `arifos-health-fast` |
| `agent-bind` | Alias for `arifos-session-bind` |
| `agent-resume` | Alias for `arifos-session-resume` |
| `audit-tail` | Tail agent audit log |
| `audit-count` | Count audit log lines |

### Sovereign-Specific (Human identity)

| Command | What It Does |
|---------|--------------|
| `status-all` | `arifos-health-fast` + `arifos-context` |
| `seal-check` | Count VAULT999 entries |
| `seal-tail` | Tail last 20 vault entries |
| `organs` | Federation health scan |
| `stack-restart` | Docker compose down/up |
| `stack-restart-one <svc>` | Restart one compose service |

### Environment Automation

| Feature | Trigger | Behavior |
|---------|---------|----------|
| **Venv Auto-Activation** | `cd` into project dir | Detects `.venv`, `venv`, `.venv-arifOS`, `env`. Auto-`source activate`. Auto-deactivates when leaving. |
| **Env Auto-Loading** | `cd` into project dir | Reads `.env`. Only exports vars matching `ARIFOS_ENV_WHITELIST` (safe patterns). Skips secrets blocklist. Tags directory to avoid double-load. |
| **Node/Corepack** | Shell start | Sets `COREPACK_ENABLE_AUTO_PIN=0`. Loads bun completions. Adds `PNPM_HOME` to PATH if exists. |

---

## What Else Can Be Customized?

See `/root/.bashrc_extras` — 20 optional modules, all commented out. Top recommendations:

| Tool | Install | What It Gives You |
|------|---------|-------------------|
| **fzf** | `apt install fzf` | Fuzzy file finder, history search, git branch picker |
| **zoxide** | `curl -sS https://webinstall.dev/zoxide \| bash` | Smart `cd` — `z proj` jumps to `/root/arifOS/projects/...` |
| **starship** | `curl -sS https://starship.rs/install.sh \| sh` | Beautiful, fast, cross-shell prompt with git/venv/node info |
| **bat** | `apt install bat` | Syntax-highlighted `cat` with git integration |
| **delta** | `apt install git-delta` | Side-by-side git diffs with syntax highlighting |
| **eza** | `apt install eza` | Modern `ls` with icons, git status, tree view |
| **lazygit** | `apt install lazygit` | TUI for git — incredible for stack operations |
| **btop** | `apt install btop` | Beautiful system monitor (replaces htop) |
| **tmux config** | Write `~/.tmux.conf` | Persistent multi-pane sessions for federation monitoring |
| **ssh-agent** | Uncomment in `.bashrc_extras` | Auto-start agent, auto-load keys on login |

To activate any: install the tool, open `.bashrc_extras`, uncomment the module block.

---

## Architecture Alignment

### arifOS (Python MCP Kernel)
- `ARIFOS_ACTOR_ID` env var enables **auto-ID fallback** in `session_auth.py` (the 2026-05-16 fix)
- `arif_session_init` returns `SEAL-xxx` session bound to constitution
- Vault ledger at `/var/lib/arifos/vault/outcomes.jsonl` receives shell ignition entries

### A-FORGE (TypeScript Execution Shell)
- `AF_FORGE_URL=http://127.0.0.1:7071` is exported
- Agent authority ceiling `777_FORGE` matches A-FORGE's metabolic execution boundary
- `AGENT_WORKBENCH_TRUST_LOCAL_VPS` / `ENABLE_DANGEROUS_TOOLS` are NOT auto-enabled — sovereign must set them explicitly

### AAA (Control Plane)
- `AAA_AGENT=1` marker triggers agent profile
- A2A gateway on port 3001 is noted in env vars
- TREE777 grounding banner reads skill/scar registry on every agent shell start

### WELL / WEALTH / GEOX
- Canonical ports exported: 18083 / 18082 / 8081
- Health endpoints probed in 111_SENSE
- Venv auto-activation works for `.venv` in any repo

---

## Test Results

| Test | Result |
|------|--------|
| Syntax check (all 7 files) | ✅ PASS |
| Human ignition | ✅ 73ms, `IDENTITY=human`, `AGENT_AUTHORITY_MAX=999_SEAL` |
| Agent ignition | ✅ 86ms, `IDENTITY=aaa`, `AGENT_AUTHORITY_MAX=777_FORGE` |
| Federation health probe | ✅ All services 200 (arifOS, arifosd, A-FORGE, WELL, WEALTH, GEOX). Ollama 404 (expected, no /health route). |
| Venv auto-activation | ✅ `cd /root/arifOS` → activates `.venv`. `cd /root` → deactivates. |
| Env auto-loading | ✅ Safely parses `.env` with `export KEY=value` syntax. Whitelist-only. |
| Session bind (`arifos-session-bind`) | ✅ Returns `SEAL-xxx` from localhost:8088/mcp |
| Session resume | ✅ Reads `/tmp/.arifos_last_session` |
| Vault logging | ✅ Appends to `shell_ignitions.jsonl` |
| Agent banner | ✅ Shows ignition ms, MCP status, context epoch |

---

## Known Notes / Caveats

1. **Ollama health returns 404** — Ollama has no `/health` route. The probe checks port 11434 which is reachable. This is cosmetic.
2. **Non-interactive shells** — Kimi Code CLI runs non-interactive. The ignition still runs (binding, context, vault log), but `PROMPT_COMMAND` audit and `DEBUG` trap are skipped. This is correct.
3. **Double-ignition guard** — `arifos-ignite` is idempotent. Calling it twice in one shell is safe but wasteful. The router calls it once per shell startup.
4. **Env auto-load tags** — `/tmp/.arifos_env_<path>` tags prevent double-loading `.env` when cd'ing back and forth. Tags are session-scoped (in `/tmp`).
5. **Venv deactivation edge case** — If you `cd` from one venv directly into another, it switches cleanly. If you `cd` to a parent directory of the venv, it deactivates.

---

## One-Liners for Arif

```bash
# Re-source everything (after edits)
source /root/.bashrc

# Check your current constitutional state
arifos-context

# Bind a session explicitly
arifos-session-bind arif kimi-k2

# See federation health
arifos-health-fast

# Tail your shell ignition audit trail
sudo tail -f /var/lib/arifos/vault/shell_ignitions.jsonl

# Activate optional extras (edit first, then source)
nano /root/.bashrc_extras
source /root/.bashrc_extras
```

---

*Forge complete. All systems SEALED. DITEMPA BUKAN DIBERI.*
